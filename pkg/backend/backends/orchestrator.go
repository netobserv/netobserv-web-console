package backends

import (
	"context"
	"fmt"
	"net/http"
	"sync/atomic"

	"github.com/netobserv/network-observability-console-plugin/pkg/backend"
	"github.com/netobserv/network-observability-console-plugin/pkg/backend/loki"
	"github.com/netobserv/network-observability-console-plugin/pkg/backend/prometheus"
	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/handler/apierrors"
	"github.com/netobserv/network-observability-console-plugin/pkg/merger"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/filters"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils/constants"
	"golang.org/x/sync/errgroup"
)

type Orchestrator struct {
	flowsBackends   []backend.FlowsBackend
	metricsBackends []backend.MetricsBackend
}

func NewOrchestrator(cfg *config.Config) *Orchestrator {
	o := Orchestrator{}
	if cfg.IsPromEnabled() {
		b := prometheus.NewBackend(cfg)
		o.metricsBackends = append(o.metricsBackends, b)
	}
	if cfg.IsLokiEnabled() {
		b := loki.NewBackend(cfg)
		o.metricsBackends = append(o.metricsBackends, b)
		o.flowsBackends = append(o.flowsBackends, b)
	}
	return &o
}

type named interface{ Name() constants.DataSource }

func filterBackends[T named](backends []T, ds constants.DataSource) ([]T, error) {
	var filtered []T
	for _, b := range backends {
		if ds == "" || ds == constants.DataSourceAuto || ds == b.Name() {
			filtered = append(filtered, b)
		}
	}
	if len(filtered) > 0 {
		return filtered, nil
	}
	if ds == "" || ds == constants.DataSourceAuto {
		return nil, apierrors.NewDatasourceDisabledError("cannot perform query: no relevant backend configured")
	}
	return nil, apierrors.NewDatasourceDisabledError(fmt.Sprintf("cannot perform query: %s datasource is not configured", ds))
}

func (o *Orchestrator) Flows(ctx context.Context, bctx *backend.QueryContext, q *FullFlowsParams) (*model.AggregatedQueryResponse, int, error) {
	backends, err := filterBackends(o.flowsBackends, bctx.DataSource)
	if err != nil {
		return nil, http.StatusServiceUnavailable, err
	}
	// backends is now guaranteed to be non empty
	// For flows backends, we just use the first valid one
	back := backends[0]

	// Run queries in parallel, then aggregate them
	// FilterGroups should never be empty (there's 1 query per group, so empty would mean 0 query)
	if len(q.FilterGroups) == 0 {
		return nil, http.StatusBadRequest, &apierrors.GenericError{Message: "no queries to execute"}
	}

	g, ctx := errgroup.WithContext(ctx)
	sm := merger.NewStreamMerger(q.Limit)
	var code atomic.Int32

	for _, filters := range q.FilterGroups {
		subQ := q.FlowParams
		subQ.Filters = filters

		g.Go(func() error {
			qr, c, err := back.Flows(ctx, bctx, &subQ)
			if err != nil {
				code.Store(int32(c))
				return err
			}
			if _, err := sm.Add(qr, back.Name()); err != nil {
				code.Store(int32(http.StatusInternalServerError))
				return err
			}
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return nil, int(code.Load()), err
	}

	qresp := sm.Get()
	return qresp, http.StatusOK, nil
}

func (o *Orchestrator) Metrics(ctx context.Context, bctx *backend.QueryContext, q *FullMetricsParams) (*model.AggregatedQueryResponse, int, error) {
	backends, err := filterBackends(o.metricsBackends, bctx.DataSource)
	if err != nil {
		return nil, http.StatusServiceUnavailable, err
	}

	// Run queries in parallel, then aggregate them
	// FilterGroups should never be empty (there's 1 query per group, so empty would mean 0 query)
	if len(q.FilterGroups) == 0 {
		return nil, http.StatusBadRequest, &apierrors.GenericError{Message: "no queries to execute"}
	}

	g, ctx := errgroup.WithContext(ctx)
	mm := merger.NewMatrixMerger(q.Top)
	var code atomic.Int32

	for _, filters := range q.FilterGroups {
		subQ := q.MetricsParams
		subQ.Filters = filters

		g.Go(func() error {
			qr, c, err := o.singleCallMetrics(ctx, bctx, &subQ, backends)
			if err != nil {
				code.CompareAndSwap(0, int32(c))
				return err
			}
			if _, err := mm.Merge(qr); err != nil {
				code.CompareAndSwap(0, int32(http.StatusInternalServerError))
				return err
			}
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return nil, int(code.Load()), err
	}

	qresp := mm.Get()
	return qresp, http.StatusOK, nil
}

// singleCallMetrics evaluates a single query (non-parallel) across several backends, retaining the first that succeeds
func (o *Orchestrator) singleCallMetrics(ctx context.Context, bctx *backend.QueryContext, q *backend.MetricsParams, backends []backend.MetricsBackend) (r *model.AggregatedQueryResponse, code int, err error) {
	code, err = o.tryBackends(backends, func(b backend.MetricsBackend) (code int, err error) {
		r, code, err = b.Metrics(ctx, bctx, q)
		return code, err
	})
	return
}

func (o *Orchestrator) GetLabelValues(ctx context.Context, bctx *backend.QueryContext, label ...string) (values []string, code int, err error) {
	code, err = o.checkAndTryBackends(bctx.DataSource, func(b backend.MetricsBackend) (code int, err error) {
		values, code, err = b.GetLabelValues(ctx, bctx, label...)
		return code, err
	})
	return
}

func (o *Orchestrator) MatchLabelValues(ctx context.Context, bctx *backend.QueryContext, filts filters.SingleQuery, search string) (values []string, code int, err error) {
	code, err = o.checkAndTryBackends(bctx.DataSource, func(b backend.MetricsBackend) (code int, err error) {
		values, code, err = b.MatchLabelValues(ctx, bctx, filts, search)
		return code, err
	})
	return
}

func (o *Orchestrator) checkAndTryBackends(forcedDS constants.DataSource, f func(b backend.MetricsBackend) (code int, err error)) (code int, err error) {
	backends, err := filterBackends(o.metricsBackends, forcedDS)
	if err != nil {
		return http.StatusServiceUnavailable, err
	}
	return o.tryBackends(backends, f)
}

func (o *Orchestrator) tryBackends(backends []backend.MetricsBackend, f func(b backend.MetricsBackend) (code int, err error)) (code int, err error) {
	for _, b := range backends {
		code, err = f(b)
		if err != nil {
			// Continue processing backends if it's an "unmanaged" type of error
			if backend.IsUnmanaged(err) {
				continue
			}
			break
		}
		return http.StatusOK, nil
	}
	return
}
