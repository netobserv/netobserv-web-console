package loki

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/netobserv/network-observability-console-plugin/pkg/backend"
	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/handler/apierrors"
	"github.com/netobserv/network-observability-console-plugin/pkg/merger"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/fields"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/filters"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils/constants"
	"github.com/sirupsen/logrus"
)

var log = logrus.WithField("module", "backends.loki")

// Backend (loki.Backend) implements both raw flows and metrics fetcher
type Backend struct {
	cfg                *config.Loki
	useMocks           bool
	aggregateKeyLabels map[string][]string
}

func NewBackend(cfg *config.Config) *Backend {
	return &Backend{cfg: &cfg.Loki, useMocks: cfg.Frontend.ConsoleMode == config.Mock, aggregateKeyLabels: cfg.Frontend.GetAggregateKeyLabels()}
}

func (b *Backend) Name() constants.DataSource { return constants.DataSourceLoki }

func (b *Backend) Flows(_ context.Context, bctx *backend.QueryContext, p *backend.FlowParams) (*model.QueryResponse, int, error) {
	start, end, limit := p.DatesLimitToString()
	cl := NewClient(b.cfg, bctx.RequestHeader, bctx.UseLokiStatus, b.useMocks)

	qb := NewFlowQueryBuilder(b.cfg, start, end, limit, p.RecordType, p.PacketLoss)
	err := qb.Filters(p.Filters)
	if err != nil {
		return nil, http.StatusBadRequest, err
	}
	query := qb.Build()

	qr, code, err := cl.Fetch(query)
	if err != nil {
		return nil, code, err
	}
	log.Tracef("Flows response: %v", qr)
	return &qr, http.StatusOK, nil
}

func (b *Backend) Metrics(_ context.Context, bctx *backend.QueryContext, p *backend.MetricsParams) (*model.AggregatedQueryResponse, int, error) {
	cl := NewClient(b.cfg, bctx.RequestHeader, bctx.UseLokiStatus, b.useMocks)
	expanded := expandQuery(p.Filters, bctx.Tenant, p.DataField)

	// Process expanded queries sequentially (only a few)
	mm := merger.NewMatrixMerger(p.Top)
	for _, filter := range expanded {
		qb, err := NewTopologyQuery(b.cfg, b.aggregateKeyLabels, p)
		if err != nil {
			return nil, http.StatusBadRequest, err
		}
		err = qb.Filters(filter)
		if err != nil {
			return nil, http.StatusBadRequest, err
		}
		logQL := encodeQuery(qb.Build())
		qr, code, err := cl.Fetch(logQL)
		if err != nil {
			return nil, code, err
		}
		if _, err := mm.Add(&qr, b.Name()); err != nil {
			return nil, http.StatusInternalServerError, err
		}
	}

	qr := mm.Get()
	log.Tracef("Metrics response: %v", qr)
	return qr, http.StatusOK, nil
}

func (b *Backend) GetLabelValues(_ context.Context, bctx *backend.QueryContext, labels ...string) ([]string, int, error) {
	cl := NewClient(b.cfg, bctx.RequestHeader, bctx.UseLokiStatus, b.useMocks)
	// Initialize values explicitly to avoid null json when empty
	values := []string{}

	// Fetch and merge values for each label
	for _, label := range labels {
		resp, code, err := cl.GetLabelValues(b.cfg.URL, label)
		if err != nil {
			return nil, code, err
		}
		values = append(values, resp...)
	}
	return utils.NonEmpty(utils.Dedup(values)), http.StatusOK, nil
}

func (b *Backend) MatchLabelValues(_ context.Context, bctx *backend.QueryContext, filts filters.SingleQuery, label string) ([]string, int, error) {
	cl := NewClient(b.cfg, bctx.RequestHeader, bctx.UseLokiStatus, b.useMocks)
	queryBuilder := NewFlowQueryBuilderWithDefaults(b.cfg)
	if err := queryBuilder.Filters(filts); err != nil {
		return nil, http.StatusBadRequest, apierrors.NewLokiClientError(err)
	}

	query := queryBuilder.Build()
	resp, code, err := cl.RawFetch(query)
	if err != nil {
		return nil, code, err
	}
	log.Tracef("GetNames raw response: %s", resp)

	var qr model.QueryResponse
	err2 := json.Unmarshal(resp, &qr)
	if err2 != nil {
		log.WithError(err2).Errorf("cannot unmarshal, response was: %v", string(resp))
		return nil, http.StatusInternalServerError, apierrors.NewLokiClientError(errors.New("Failed to unmarshal Loki response: " + err2.Error()))
	}

	streams, ok := qr.Data.Result.(model.Streams)
	if !ok {
		return nil, http.StatusInternalServerError, apierrors.NewLokiClientError(errors.New("Loki returned unexpected type: " + string(qr.Data.ResultType)))
	}

	values := extractDistinctValues(label, streams)
	return values, http.StatusOK, nil
}

func extractDistinctValues(field string, streams model.Streams) []string {
	var values []string
	for _, stream := range streams {
		if v, ok := stream.Labels[field]; ok {
			if len(v) > 0 {
				values = append(values, v)
			}
		} else {
			for _, entry := range stream.Entries {
				var line map[string]interface{}
				err := json.Unmarshal([]byte(entry.Line), &line)
				if err != nil {
					log.Errorf("Could not unmarshal line: %v. Error was: %v", entry.Line, err)
					continue
				}
				if v, ok := line[field]; ok {
					if str, ok := v.(string); ok && len(str) > 0 {
						values = append(values, str)
					}
				}
			}
		}
	}
	return utils.Dedup(values)
}

func expandQuery(query filters.SingleQuery, tenant, metricType string) filters.MultiQueries {
	expanded := filters.MultiQueries{query}
	if metricType != constants.MetricTypeBytes && metricType != constants.MetricTypePackets {
		// Skip expanding
		return expanded
	}

	// First, expand for reporter merge (skip if FlowDirection is enforced):
	var hasFD bool
	for _, m := range query {
		if m.Key == fields.FlowDirection {
			hasFD = true
			break
		}
	}

	if !hasFD {
		// The rationale here is that most traffic is duplicated from ingress and egress PoV, except cluster-external traffic.
		// Ingress traffic will also contains pktDrop and DNS responses.
		// Merging is done by running a first query with FlowDirection=INGRESS and another with FlowDirection=EGRESS AND DstOwnerName is empty,
		// which stands for cluster-external.
		// (Note that we use DstOwnerName both as an optimization as it's a Loki index,
		// and as convenience because looking for empty fields won't work if they aren't indexed)
		q1 := filters.SingleQuery{
			filters.NewRegexMatch(fields.FlowDirection, `"`+string(constants.Ingress)+`","`+string(constants.Inner)+`"`),
		}
		q2 := filters.SingleQuery{
			filters.NewRegexMatch(fields.FlowDirection, `"`+string(constants.Egress)+`"`),
			filters.NewRegexMatch(fields.DstType, `"","Service"`),
		}
		expanded = expanded.Distribute([]filters.SingleQuery{q1, q2}, nil)
	}

	// Then, expand for tenant
	if tenant != "" {
		// TODO: this should actually be managed from the loki gateway, with "namespace" query param
		expanded = expanded.Distribute(
			[]filters.SingleQuery{
				{filters.NewRegexMatch(fields.SrcNamespace, `"`+tenant+`"`)},
				{filters.NewRegexMatch(fields.DstNamespace, `"`+tenant+`"`)},
			},
			nil,
		)
	}

	return expanded
}
