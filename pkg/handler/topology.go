package handler

import (
	"context"
	"net/http"
	"net/url"
	"time"

	"github.com/netobserv/network-observability-console-plugin/pkg/backend"
	"github.com/netobserv/network-observability-console-plugin/pkg/backend/backends"
	"github.com/netobserv/network-observability-console-plugin/pkg/handler/apierrors"
	"github.com/netobserv/network-observability-console-plugin/pkg/metrics"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/filters"
)

const (
	metricTypeKey     = "type"
	metricFunctionKey = "function"

	aggregateByKey  = "aggregateBy"
	groupsKey       = "groups"
	rateIntervalKey = "rateInterval"
	stepKey         = "step"

	defaultRateInterval = "1m"
	defaultStepDuration = time.Second * 30
)

func (h *Handlers) GetTopology(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		var code int
		startTime := time.Now()
		defer func() {
			metrics.ObserveHTTPCall("GetTopology", code, startTime)
		}()

		qctx, err := getQueryContext(r)
		if err != nil {
			code = http.StatusBadRequest
			apierrors.Write(w, code, err)
			return
		}

		q, err := parseTopologyParams(r.URL.Query())
		if err != nil {
			code = http.StatusBadRequest
			apierrors.Write(w, code, err)
			return
		}

		var metrics *model.AggregatedQueryResponse
		metrics, code, err = h.Backends.Metrics(ctx, qctx, q)
		if err != nil {
			apierrors.Write(w, code, err)
			return
		}

		code = http.StatusOK
		writeJSON(w, code, metrics)
	}
}

func parseTopologyParams(params url.Values) (*backends.FullMetricsParams, error) {
	start, err := getStartTime(params)
	if err != nil {
		return nil, err
	}
	end, err := getEndTime(params)
	if err != nil {
		return nil, err
	}
	top, err := getLimit(params)
	if err != nil {
		return nil, err
	}
	recordType, err := getRecordType(params)
	if err != nil {
		return nil, err
	}
	packetLoss, err := getPacketLoss(params)
	if err != nil {
		return nil, err
	}
	rateInterval, err := getRateInterval(params)
	if err != nil {
		return nil, err
	}
	step, err := getStep(params)
	if err != nil {
		return nil, err
	}
	dataField := getMetricType(params)
	metricFunction, err := getMetricFunction(params)
	if err != nil {
		return nil, err
	}
	aggregate, err := getAggregate(params)
	if err != nil {
		return nil, err
	}
	groups := params.Get(groupsKey)
	tenant := params.Get(tenantKey)
	rawFilters := params.Get(filtersKey)
	filterGroups, err := filters.Parse(rawFilters)
	if err != nil {
		return nil, err
	}
	if len(filterGroups) == 0 {
		filterGroups = filters.MultiQueries{nil}
	}

	return &backends.FullMetricsParams{
		MetricsParams: backend.MetricsParams{
			Start:          start,
			End:            end,
			Top:            top,
			RecordType:     recordType,
			PacketLoss:     packetLoss,
			RateInterval:   rateInterval,
			Step:           step,
			DataField:      dataField,
			MetricFunction: metricFunction,
			Aggregate:      aggregate,
			Groups:         groups,
			Tenant:         tenant,
		},
		FilterGroups: filterGroups,
	}, nil
}
