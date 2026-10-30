package prometheus

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"

	"github.com/netobserv/network-observability-console-plugin/pkg/backend"
	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/handler/apierrors"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/fields"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/filters"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils/constants"
	"github.com/sirupsen/logrus"
)

var log = logrus.WithField("module", "backends.prometheus")

// Backend (prometheus.Backend) implements metrics fetcher
type Backend struct {
	cfg                *config.Prometheus
	inventory          *Inventory
	aggregateKeyLabels map[string][]string
}

func NewBackend(cfg *config.Config) *Backend {
	return &Backend{
		cfg:                &cfg.Prometheus,
		inventory:          NewInventory(&cfg.Prometheus),
		aggregateKeyLabels: cfg.Frontend.GetAggregateKeyLabels(),
	}
}

func (b *Backend) Name() constants.DataSource { return constants.DataSourceProm }

func (b *Backend) NewClient(bctx *backend.QueryContext) (*Client, error) {
	if bctx.Tenant != "" {
		// single-tenant client
		cl, err := NewTenantClient(b.cfg, bctx.RequestHeader, bctx.Tenant)
		if err != nil {
			return nil, apierrors.NewPromClientError(err)
		}
		return cl, nil
	}
	cl, err := NewAdminClient(b.cfg, bctx.RequestHeader)
	if err != nil {
		return nil, apierrors.NewPromClientError(err)
	}
	return cl, nil
}

func (b *Backend) Metrics(ctx context.Context, bctx *backend.QueryContext, p *backend.MetricsParams) (*model.AggregatedQueryResponse, int, error) {
	search, unsupportedReason := b.getEligibleMetrics(p, p.Filters)
	if unsupportedReason != nil {
		log.Debugf("Unsupported Prometheus query; reason: %s.", unsupportedReason)
		return nil, http.StatusBadRequest, backend.NewUnmanagedError(unsupportedReason)
	} else if len(search.Found) == 0 {
		if len(search.Candidates) > 0 {
			// Some candidate metrics exist but they are disabled; tell the user
			return nil, http.StatusBadRequest, backend.NewUnmanagedError(apierrors.NewPromDisabledMetrics(search.Candidates))
		} else if len(search.MissingLabels) > 0 {
			return nil, http.StatusBadRequest, backend.NewUnmanagedError(apierrors.NewPromMissingLabels(search.MissingLabels))
		}
		return nil, http.StatusBadRequest, &backend.UnmanagedError{}
	}

	// Success, we can use Prometheus
	qb := NewQuery(b.aggregateKeyLabels, p, search.Found)
	promQL := qb.Build()
	cl, err := b.NewClient(bctx)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	qr, code, err := cl.QueryMatrix(ctx, &promQL)
	if err != nil {
		// Unlike in GetLabelValues, we don't fallback to the next backend in case of 401/403:
		// we assume the metrics endpoint should support multi-tenancy, and don't want to hide a rbac issue.
		return nil, code, apierrors.NewPromClientError(err)
	}
	agg := model.NewAggregatedQueryResponse(&qr, b.Name())
	return agg, http.StatusOK, nil
}

func (b *Backend) getEligibleMetrics(p *backend.MetricsParams, filt filters.SingleQuery) (*SearchResult, error) {
	if p.RecordType != "" && p.RecordType != constants.RecordTypeLog {
		return nil, fmt.Errorf("RecordType not managed: %s", p.RecordType)
	}

	labelsNeeded, _ := GetLabelsAndFilter(b.aggregateKeyLabels, p.Aggregate, p.Groups)
	fromFilters, unsupportedReason := FiltersToLabels(filt)
	if unsupportedReason != "" {
		return nil, errors.New(unsupportedReason)
	}
	labelsNeeded = append(labelsNeeded, fromFilters...)
	if p.Tenant != "" {
		if !slices.Contains(labelsNeeded, fields.SrcNamespace) {
			labelsNeeded = append(labelsNeeded, fields.SrcNamespace)
		}
		if !slices.Contains(labelsNeeded, fields.DstNamespace) {
			labelsNeeded = append(labelsNeeded, fields.DstNamespace)
		}
	}

	// Search for such metric
	r := b.inventory.Search(labelsNeeded, p.DataField)
	return &r, nil
}

func (b *Backend) GetLabelValues(ctx context.Context, bctx *backend.QueryContext, labels ...string) ([]string, int, error) {
	// Initialize values explicitly to avoid null json when empty
	values := []string{}

	// Fetch and merge values for each label
	for _, label := range labels {
		if !b.inventory.LabelExists(label) {
			return nil, http.StatusBadRequest, backend.NewUnmanagedError(apierrors.NewPromMissingLabels(map[string][]string{"": {label}}))
		}
		cl, err := b.NewClient(bctx)
		if err != nil {
			return nil, http.StatusInternalServerError, err
		}
		resp, code, err := cl.GetLabelValues(ctx, label, nil)
		if err != nil {
			if code == http.StatusUnauthorized || code == http.StatusForbidden {
				// In case this was a prometheus 401 / 403 error, the query is repeated with Loki
				// This is because multi-tenancy is currently not managed for prom datasource, hence such queries have to go with Loki
				// We don't know a safe and generic way to pre-flight check if the user will be authorized
				return nil, code, backend.NewUnmanagedError(err)
			}
			return nil, code, apierrors.NewPromClientError(fmt.Errorf("error while fetching label %s values from Prometheus: %w", label, err))
		}
		values = append(values, resp...)
	}
	return utils.NonEmpty(utils.Dedup(values)), http.StatusOK, nil
}

func (b *Backend) MatchLabelValues(ctx context.Context, bctx *backend.QueryContext, filts filters.SingleQuery, label string) ([]string, int, error) {
	if !b.inventory.LabelExists(label) {
		return nil, http.StatusBadRequest, &backend.UnmanagedError{}
	}
	cl, err := b.NewClient(bctx)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	// Label match query (any metric)
	q := QueryFilters("", filts)
	values, code, err := cl.GetLabelValues(ctx, label, []string{q})
	if err != nil {
		// Unlike in GetLabelValues, we don't fallback to the next backend in case of 401/403:
		// this endpoint is namespaced so it should support multi-tenancy; we don't want to hide a rbac issue.
		return values, code, apierrors.NewPromClientError(err)
	}
	return values, code, nil
}
