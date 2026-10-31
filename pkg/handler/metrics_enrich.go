package handler

import (
	"fmt"
	"net/url"
	"strconv"
	"time"

	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/metricsparse"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils/constants"
)

// enrichedMetricsResponse is the JSON shape for /api/flow/metrics after matrix enrichment.
type enrichedMetricsResponse struct {
	ResultType    string                `json:"resultType"`
	Result        interface{}           `json:"result"`
	Stats         model.AggregatedStats `json:"stats"`
	UnixTimestamp int64                 `json:"unixTimestamp"`
}

func isTimeMetricType(metricType string) bool {
	return metricType == constants.MetricTypeDNSLatency || metricType == constants.MetricTypeFlowRTT
}

func enrichInputFromParams(params url.Values, unixTimestamp int64, isMock bool, scopes []config.Scope) (metricsparse.EnrichInput, error) {
	in := metricsparse.EnrichInput{
		AggregateBy:   params.Get(aggregateByKey),
		Scopes:        scopes,
		UnixTimestamp: unixTimestamp,
		ForceZeros:    !isTimeMetricType(params.Get(metricTypeKey)),
		IsMock:        isMock,
	}
	if tr := params.Get(timeRangeKey); tr != "" {
		r, err := strconv.ParseInt(tr, 10, 64)
		if err != nil {
			return in, fmt.Errorf("could not parse time range: %w", err)
		}
		in.TimeRangeSeconds = r
		return in, nil
	}
	start := params.Get(startTimeKey)
	end := params.Get(endTimeKey)
	if start == "" {
		// FE always sends timeRange/startTime; smoke tests and some callers omit them.
		// Fall back to a relative window ending at the response timestamp (or now).
		if in.UnixTimestamp == 0 {
			in.UnixTimestamp = time.Now().Unix()
		}
		in.TimeRangeSeconds = 300
		return in, nil
	}
	from, err := strconv.ParseInt(start, 10, 64)
	if err != nil {
		return in, fmt.Errorf("could not parse start time: %w", err)
	}
	in.From = from
	if end != "" {
		to, err := strconv.ParseInt(end, 10, 64)
		if err != nil {
			return in, fmt.Errorf("could not parse end time: %w", err)
		}
		in.To = to
	} else {
		in.To = unixTimestamp
	}
	return in, nil
}

func enrichTopologyResponse(flows *model.AggregatedQueryResponse, params url.Values, scopes []config.Scope) (*enrichedMetricsResponse, error) {
	matrix, ok := flows.Result.(model.Matrix)
	if !ok {
		return nil, fmt.Errorf("unexpected metrics result type %T", flows.Result)
	}
	isMock := false
	for _, ds := range flows.Stats.DataSources {
		if string(ds) == "mock" {
			isMock = true
			break
		}
	}
	in, err := enrichInputFromParams(params, flows.UnixTimestamp, isMock, scopes)
	if err != nil {
		return nil, err
	}
	resultType, result := metricsparse.EnrichMatrix(matrix, &in)
	return &enrichedMetricsResponse{
		ResultType:    resultType,
		Result:        result,
		Stats:         flows.Stats,
		UnixTimestamp: flows.UnixTimestamp,
	}, nil
}
