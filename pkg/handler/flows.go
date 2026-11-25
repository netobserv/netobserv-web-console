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
	"github.com/netobserv/network-observability-console-plugin/pkg/model/fields"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/filters"
)

const (
	startTimeKey  = "startTime"
	endTimeKey    = "endTime"
	timeRangeKey  = "timeRange"
	limitKey      = "limit"
	recordTypeKey = "recordType"
	dataSourceKey = "dataSource"
	filtersKey    = "filters"
	packetLossKey = "packetLoss"
	tenantKey     = "tenant"
)

func (h *Handlers) GetFlows(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		var code int
		startTime := time.Now()
		defer func() {
			metrics.ObserveHTTPCall("GetFlows", code, startTime)
		}()

		qctx, err := getQueryContext(r)
		if err != nil {
			code = http.StatusBadRequest
			apierrors.Write(w, code, err)
			return
		}

		params := r.URL.Query()
		hlog.Debugf("GetFlows query params: %s (dataSource=%s)", params, qctx.DataSource)

		q, err := parseRawFlowsQuery(params)
		if err != nil {
			code = http.StatusBadRequest
			apierrors.Write(w, code, err)
			return
		}

		var flows *model.AggregatedQueryResponse
		flows, code, err = h.Backends.Flows(ctx, qctx, q)
		if err != nil {
			apierrors.Write(w, code, err)
			return
		}

		code = http.StatusOK
		writeJSON(w, code, flows)
	}
}

func parseRawFlowsQuery(params url.Values) (*backends.FullFlowsParams, error) {
	start, err := getStartTime(params)
	if err != nil {
		return nil, err
	}
	end, err := getEndTime(params)
	if err != nil {
		return nil, err
	}
	limit, err := getLimit(params)
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
	tenant := params.Get(tenantKey)
	rawFilters := params.Get(filtersKey)
	filterGroups, err := filters.Parse(rawFilters)
	if err != nil {
		return nil, err
	}
	if tenant != "" {
		// TODO: this should actually be managed from the loki gateway, with "namespace" query param
		filterGroups = filterGroups.Distribute(
			[]filters.SingleQuery{
				{filters.NewEqualMatch(fields.SrcNamespace, tenant)},
				{filters.NewEqualMatch(fields.DstNamespace, tenant)},
			}, nil,
		)
	}
	if len(filterGroups) == 0 {
		filterGroups = filters.MultiQueries{nil}
	}

	return &backends.FullFlowsParams{
		FlowParams: backend.FlowParams{
			Start:      start,
			End:        end,
			Limit:      limit,
			RecordType: recordType,
			PacketLoss: packetLoss,
		},
		FilterGroups: filterGroups,
	}, nil
}
