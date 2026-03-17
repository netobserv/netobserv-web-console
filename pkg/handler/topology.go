package handler

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"time"

	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/handler/apierrors"
	"github.com/netobserv/network-observability-console-plugin/pkg/loki"
	"github.com/netobserv/network-observability-console-plugin/pkg/metrics"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/fields"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/filters"
	"github.com/netobserv/network-observability-console-plugin/pkg/prometheus"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils/constants"

	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
)

const (
	metricTypeKey     = "type"
	metricFunctionKey = "function"

	aggregateByKey  = "aggregateBy"
	groupsKey       = "groups"
	rateIntervalKey = "rateInterval"
	stepKey         = "step"

	defaultRateInterval = "1m"
	defaultStep         = "30s"
	defaultStepDuration = time.Second * 30
)

func (h *Handlers) GetTopology(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		params := r.URL.Query()
		namespace := params.Get(namespaceKey)

		clients, sterr := newClients(h.Cfg, r.Header, false, namespace)
		if sterr != nil {
			sterr.Write(w, http.StatusInternalServerError)
			return
		}

		var code int
		startTime := time.Now()
		defer func() {
			metrics.ObserveHTTPCall("GetTopology", code, startTime)
		}()

		ds, err := getDatasource(params)
		if err != nil {
			apierrors.Write(w, http.StatusBadRequest, err)
			return
		}

		flows, code, err := h.getTopologyFlows(ctx, clients, params, ds)
		var promClErr *apierrors.PromClientError
		if err != nil &&
			ds == constants.DataSourceAuto &&
			h.Cfg.IsLokiEnabled() &&
			(code == http.StatusForbidden || code == http.StatusUnauthorized) &&
			errors.As(err, &promClErr) {
			// In case this was a prometheus 401 / 403 error, the query is repeated with Loki
			// This is because multi-tenancy is currently not managed for prom datasource, hence such queries have to go with Loki
			// Unfortunately we don't know a safe and generic way to pre-flight check if the user will be authorized
			hlog.Info("Retrying with Loki...")
			flows, code, err = h.getTopologyFlows(ctx, clients, params, constants.DataSourceLoki)
		}
		if err != nil {
			apierrors.Write(w, code, err)
			return
		}

		code = http.StatusOK
		writeJSON(w, code, flows)
	}
}

func (h *Handlers) extractTopologyQueryParams(params url.Values, ds constants.DataSource) (*loki.TopologyInput, filters.MultiQueries, v1.Range, int, error) {
	in := loki.TopologyInput{DataSource: ds}
	qr := v1.Range{}
	var reqLimit int
	var err error

	in.Start, qr.Start, err = getStartTime(params)
	if err != nil {
		return nil, nil, qr, reqLimit, err
	}
	in.End, qr.End, err = getEndTime(params)
	if err != nil {
		return nil, nil, qr, reqLimit, err
	}
	in.Top, reqLimit, err = getLimit(params)
	if err != nil {
		return nil, nil, qr, reqLimit, err
	}
	in.RateInterval, err = getRateInterval(params)
	if err != nil {
		return nil, nil, qr, reqLimit, err
	}
	in.Step, qr.Step, err = getStep(params)
	if err != nil {
		return nil, nil, qr, reqLimit, err
	}
	in.DataField = getMetricType(params)
	in.MetricFunction, err = getMetricFunction(params)
	if err != nil {
		return nil, nil, qr, reqLimit, err
	}
	in.RecordType, err = getRecordType(params)
	if err != nil {
		return nil, nil, qr, reqLimit, err
	}
	in.PacketLoss, err = getPacketLoss(params)
	if err != nil {
		return nil, nil, qr, reqLimit, err
	}
	in.Aggregate, err = getAggregate(params)
	if err != nil {
		return nil, nil, qr, reqLimit, err
	}
	in.Groups = params.Get(groupsKey)
	namespace := params.Get(namespaceKey)
	rawFilters := params.Get(filtersKey)
	filterGroups, err := filters.Parse(rawFilters)
	if err != nil {
		return nil, nil, qr, reqLimit, err
	}

	if shouldMergeReporters(in.DataField) {
		filterGroups = expandQueries(
			filterGroups,
			namespace,
			func(filters filters.SingleQuery) bool {
				// Do not expand if this is managed from prometheus
				sr, _ := getEligiblePromMetric(h.Cfg.Frontend.GetAggregateKeyLabels(), h.PromInventory, filters, &in, namespace != "")
				return sr != nil && len(sr.Found) > 0
			},
		)
	}

	return &in, filterGroups, qr, reqLimit, err
}

func (h *Handlers) getTopologyFlows(ctx context.Context, cl clients, params url.Values, ds constants.DataSource) (*model.AggregatedQueryResponse, int, error) {
	hlog.Debugf("GetTopology query params: %s", params)

	dataSources := make(map[constants.DataSource]bool)
	if h.Cfg.Loki.UseMocks {
		dataSources["mock"] = true
	}

	in, filterGroups, qr, reqLimit, err := h.extractTopologyQueryParams(params, ds)
	if err != nil {
		return nil, http.StatusBadRequest, err
	}
	isDev := params.Get(namespaceKey) != ""
	merger := loki.NewMatrixMerger(reqLimit)
	if len(filterGroups) > 1 {
		// match any, and multiple filters => run in parallel then aggregate
		var lokiQ []string
		var promQ []*prometheus.Query
		for _, filters := range filterGroups {
			lq, pq, code, err := buildTopologyQuery(h.Cfg, h.PromInventory, filters, in, &qr, isDev)
			if err != nil {
				return nil, code, err
			}
			if pq != nil {
				promQ = append(promQ, pq)
				dataSources[constants.DataSourceProm] = true
			} else {
				lokiQ = append(lokiQ, lq)
				dataSources[constants.DataSourceLoki] = true
			}
		}
		code, err := cl.fetchParallel(ctx, lokiQ, promQ, merger, isDev)
		if err != nil {
			return nil, code, err
		}
	} else {
		// else, run all at once
		var filters filters.SingleQuery
		if len(filterGroups) > 0 {
			filters = filterGroups[0]
		}
		lokiQ, promQ, code, err := buildTopologyQuery(h.Cfg, h.PromInventory, filters, in, &qr, isDev)
		if err != nil {
			return nil, code, err
		}
		if len(lokiQ) > 0 {
			dataSources[constants.DataSourceLoki] = true
		}
		if promQ != nil {
			dataSources[constants.DataSourceProm] = true
		}
		code, err = cl.fetchSingle(ctx, lokiQ, promQ, merger, isDev)
		if err != nil {
			return nil, code, err
		}
	}

	qresp := merger.Get()
	qresp.Stats.DataSources = []constants.DataSource{}
	for str, ok := range dataSources {
		if ok {
			qresp.Stats.DataSources = append(qresp.Stats.DataSources, str)
		}
	}
	qresp.UnixTimestamp = time.Now().Unix()
	hlog.Tracef("GetTopology response: %v", qresp)
	return qresp, http.StatusOK, nil
}

func shouldMergeReporters(metricType string) bool {
	return metricType == constants.MetricTypeBytes || metricType == constants.MetricTypePackets
}

func expandQueries(queries filters.MultiQueries, namespace string, isForProm func(filters filters.SingleQuery) bool) filters.MultiQueries {
	// First, expand for reporter merge:

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

	shouldSkip := func(q filters.SingleQuery) bool {
		if isForProm(q) {
			return true
		}
		// If FlowDirection is enforced, skip merging both reporters
		for _, m := range q {
			if m.Key == fields.FlowDirection {
				return true
			}
		}
		return false
	}

	expanded := queries.Distribute([]filters.SingleQuery{q1, q2}, shouldSkip)

	// Then, expand for namespace
	if namespace != "" {
		// TODO: this should actually be managed from the loki gateway, with "namespace" query param
		expanded = expanded.Distribute(
			[]filters.SingleQuery{
				{filters.NewRegexMatch(fields.SrcNamespace, `"`+namespace+`"`)},
				{filters.NewRegexMatch(fields.DstNamespace, `"`+namespace+`"`)},
			},
			isForProm,
		)
	}

	return expanded
}

func buildTopologyQuery(
	cfg *config.Config,
	promInventory *prometheus.Inventory,
	filters filters.SingleQuery,
	in *loki.TopologyInput,
	qr *v1.Range,
	isDev bool,
) (string, *prometheus.Query, int, error) {
	search, unsupportedReason := getEligiblePromMetric(cfg.Frontend.GetAggregateKeyLabels(), promInventory, filters, in, isDev)
	if unsupportedReason != "" {
		hlog.Debugf("Unsupported Prometheus query; reason: %s.", unsupportedReason)
	} else if search != nil && len(search.Found) > 0 {
		// Success, we can use Prometheus
		qb := prometheus.NewQuery(cfg.Frontend.GetAggregateKeyLabels(), in, qr, filters, search.Found)
		q := qb.Build()
		return "", &q, http.StatusOK, nil
	}

	if !cfg.IsLokiEnabled() || in.DataSource == constants.DataSourceProm {
		// No Loki => return an error
		if search != nil {
			if len(search.Candidates) > 0 {
				// Some candidate metrics exist but they are disabled; tell the user
				return "", nil, http.StatusBadRequest, apierrors.NewPromDisabledMetrics(search.Candidates)
			} else if len(search.MissingLabels) > 0 {
				return "", nil, http.StatusBadRequest, apierrors.NewPromMissingLabels(search.MissingLabels)
			}
		}
		return "", nil, http.StatusBadRequest, apierrors.NewPromUnsupported(unsupportedReason)
	}

	qb, err := loki.NewTopologyQuery(&cfg.Loki, cfg.Frontend.GetAggregateKeyLabels(), in)
	if err != nil {
		return "", nil, http.StatusBadRequest, err
	}
	err = qb.Filters(filters)
	if err != nil {
		return "", nil, http.StatusBadRequest, err
	}
	return EncodeQuery(qb.Build()), nil, http.StatusOK, nil
}

func getEligiblePromMetric(kl map[string][]string, promInventory *prometheus.Inventory, filters filters.SingleQuery, in *loki.TopologyInput, isDev bool) (*prometheus.SearchResult, string) {
	if in.DataSource != constants.DataSourceAuto && in.DataSource != constants.DataSourceProm {
		return nil, ""
	}
	if promInventory == nil {
		return nil, ""
	}
	if in.RecordType != "" && in.RecordType != constants.RecordTypeLog {
		return nil, fmt.Sprintf("RecordType not managed: %s", in.RecordType)
	}

	labelsNeeded, _ := prometheus.GetLabelsAndFilter(kl, in.Aggregate, in.Groups)
	fromFilters, unsupportedReason := prometheus.FiltersToLabels(filters)
	if unsupportedReason != "" {
		return nil, unsupportedReason
	}
	labelsNeeded = append(labelsNeeded, fromFilters...)
	if isDev {
		if !slices.Contains(labelsNeeded, fields.SrcNamespace) {
			labelsNeeded = append(labelsNeeded, fields.SrcNamespace)
		}

		if !slices.Contains(labelsNeeded, fields.DstNamespace) {
			labelsNeeded = append(labelsNeeded, fields.DstNamespace)
		}
	}

	// Search for such metric
	r := promInventory.Search(labelsNeeded, in.DataField)
	return &r, ""
}
