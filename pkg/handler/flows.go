package handler

import (
	"context"
	"net/http"
	"net/url"
	"strconv"
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

		queryTime := time.Now()
		q, err := parseRawFlowsQueryAt(params, queryTime)
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
		flows.UnixTimestamp = queryTime.Unix()

		code = http.StatusOK
		writeJSON(w, code, flows)
	}
}

func parseRawFlowsQuery(params url.Values) (*backends.FullFlowsParams, error) {
	return parseRawFlowsQueryAt(params, time.Now())
}

func parseRawFlowsQueryAt(params url.Values, now time.Time) (*backends.FullFlowsParams, error) {
	start, end, err := getFlowQueryTimes(params, now)
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

func getFlowQueryTimes(params url.Values, now time.Time) (start, end time.Time, err error) {
	if params.Get(timeRangeKey) != "" && params.Get(startTimeKey) == "" && params.Get(endTimeKey) == "" {
		// Resolve the relative range once and return the same server clock anchor to
		// clients so follow-up pagination uses the interval Loki actually queried.
		params.Set(endTimeKey, strconv.FormatInt(now.Unix(), 10))
	}
	start, err = getStartTimeAt(params, now)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	end, err = getEndTimeAt(params, now)
	return start, end, err
}
