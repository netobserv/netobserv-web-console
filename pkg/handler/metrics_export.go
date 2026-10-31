package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/netobserv/network-observability-console-plugin/pkg/export"
	"github.com/netobserv/network-observability-console-plugin/pkg/handler/apierrors"
	"github.com/netobserv/network-observability-console-plugin/pkg/metrics"
	"github.com/netobserv/network-observability-console-plugin/pkg/metricsexport"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils/constants"
)

const (
	includeTopologyEdgesKey = "includeTopologyEdges"
	// exportMetricsMaxBodyBytes caps POST /flow/metrics/export JSON bodies.
	// Overview batch payloads are small (query metadata only); 1MiB is generous headroom.
	exportMetricsMaxBodyBytes = 1 << 20
)

type exportMetricsQuery struct {
	Type        string `json:"type"`
	Function    string `json:"function"`
	AggregateBy string `json:"aggregateBy"`
	Groups      string `json:"groups,omitempty"`
	MetricGroup string `json:"metricGroup,omitempty"`
}

type exportMetricsRequest struct {
	Format               string               `json:"format"`
	IncludeTopologyEdges *bool                `json:"includeTopologyEdges"`
	MetricScope          string               `json:"metricScope,omitempty"`
	TimeRange            int64                `json:"timeRange,omitempty"`
	StartTime            string               `json:"startTime,omitempty"`
	EndTime              string               `json:"endTime,omitempty"`
	Namespace            string               `json:"namespace,omitempty"`
	Filters              string               `json:"filters,omitempty"`
	RecordType           string               `json:"recordType,omitempty"`
	DataSource           string               `json:"dataSource,omitempty"`
	PacketLoss           string               `json:"packetLoss,omitempty"`
	Limit                int                  `json:"limit,omitempty"`
	RateInterval         string               `json:"rateInterval,omitempty"`
	Step                 string               `json:"step,omitempty"`
	Groups               string               `json:"groups,omitempty"`
	Queries              []exportMetricsQuery `json:"queries"`
}

func (h *Handlers) ExportMetrics(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		var code int
		startTime := time.Now()
		defer func() {
			metrics.ObserveHTTPCall("ExportMetrics", code, startTime)
		}()

		// GET exports a single metrics query (same params as /flow/metrics).
		// POST batches multiple queries in one report (overview panels).
		switch r.Method {
		case http.MethodGet:
			code = h.exportMetricsGet(ctx, w, r)
		case http.MethodPost:
			code = h.exportMetricsPost(ctx, w, r)
		default:
			code = http.StatusMethodNotAllowed
			apierrors.Write(w, code, fmt.Errorf("method %s is not allowed", r.Method))
		}
	}
}

func (h *Handlers) exportMetricsGet(ctx context.Context, w http.ResponseWriter, r *http.Request) int {
	params := r.URL.Query()
	format, err := export.ParseFormat(params.Get(export.FormatKey), export.FormatCSV)
	if err != nil {
		apierrors.Write(w, http.StatusBadRequest, err)
		return http.StatusBadRequest
	}
	includeEdges := parseIncludeTopologyEdges(params.Get(includeTopologyEdgesKey), true)

	flows, code, err := h.fetchTopologyForExport(ctx, r.Header, params)
	if err != nil {
		apierrors.Write(w, code, err)
		return code
	}

	query := queryFromParams(params)
	report, err := h.buildMetricsExportReport(params, flows, &query, includeEdges)
	if err != nil {
		apierrors.Write(w, http.StatusBadRequest, err)
		return http.StatusBadRequest
	}

	return writeMetricsExport(w, format, &report)
}

func (h *Handlers) exportMetricsPost(ctx context.Context, w http.ResponseWriter, r *http.Request) int {
	r.Body = http.MaxBytesReader(w, r.Body, exportMetricsMaxBodyBytes)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			apierrors.Write(w, http.StatusRequestEntityTooLarge, fmt.Errorf("request body exceeds %d bytes", exportMetricsMaxBodyBytes))
			return http.StatusRequestEntityTooLarge
		}
		apierrors.Write(w, http.StatusBadRequest, err)
		return http.StatusBadRequest
	}

	var req exportMetricsRequest
	if err := json.Unmarshal(body, &req); err != nil {
		apierrors.Write(w, http.StatusBadRequest, err)
		return http.StatusBadRequest
	}
	if len(req.Queries) == 0 {
		apierrors.Write(w, http.StatusBadRequest, fmt.Errorf("queries must not be empty"))
		return http.StatusBadRequest
	}

	format, err := export.ParseFormat(req.Format, export.FormatCSV)
	if err != nil {
		apierrors.Write(w, http.StatusBadRequest, err)
		return http.StatusBadRequest
	}
	includeEdges := true
	if req.IncludeTopologyEdges != nil {
		includeEdges = *req.IncludeTopologyEdges
	}

	baseParams, err := baseParamsFromExportRequest(&req)
	if err != nil {
		apierrors.Write(w, http.StatusBadRequest, err)
		return http.StatusBadRequest
	}

	rows := []metricsexport.MetricSeriesRow{}
	edges := []metricsexport.TopologyEdgeRow{}
	for i := range req.Queries {
		query := &req.Queries[i]
		params := mergeExportQuery(baseParams, query, req.MetricScope)
		flows, code, fetchErr := h.fetchTopologyForExport(ctx, r.Header, params)
		if fetchErr != nil {
			apierrors.Write(w, code, fetchErr)
			return code
		}
		report, buildErr := h.buildMetricsExportReport(params, flows, query, includeEdges)
		if buildErr != nil {
			apierrors.Write(w, http.StatusBadRequest, buildErr)
			return http.StatusBadRequest
		}
		rows = append(rows, report.Metrics...)
		if includeEdges {
			edges = append(edges, report.TopologyEdges...)
		}
	}

	timeRange, err := encodeExportTimeRange(req.TimeRange, req.StartTime, req.EndTime)
	if err != nil {
		apierrors.Write(w, http.StatusBadRequest, err)
		return http.StatusBadRequest
	}
	metricScope := req.MetricScope
	if metricScope == "" {
		metricScope = req.Queries[0].AggregateBy
	}
	report := metricsexport.BuildReport(timeRange, metricScope, rows, edges, includeEdges)
	return writeMetricsExport(w, format, &report)
}

func (h *Handlers) fetchTopologyForExport(ctx context.Context, headers http.Header, params url.Values) (*model.AggregatedQueryResponse, int, error) {
	namespace := params.Get(namespaceKey)
	clients, sterr := newClients(h.Cfg, headers, false, namespace)
	if sterr != nil {
		return nil, http.StatusInternalServerError, sterr
	}

	ds, err := getDatasource(params)
	if err != nil {
		return nil, http.StatusBadRequest, err
	}

	flows, code, err := h.getTopologyFlows(ctx, clients, params, ds)
	var promClErr *apierrors.PromClientError
	if err != nil &&
		ds == constants.DataSourceAuto &&
		h.Cfg.IsLokiEnabled() &&
		(code == http.StatusForbidden || code == http.StatusUnauthorized) &&
		errors.As(err, &promClErr) {
		hlog.Info("Retrying metrics export with Loki...")
		flows, code, err = h.getTopologyFlows(ctx, clients, params, constants.DataSourceLoki)
	}
	return flows, code, err
}

func (h *Handlers) buildMetricsExportReport(
	params url.Values,
	flows *model.AggregatedQueryResponse,
	query *exportMetricsQuery,
	includeTopologyEdges bool,
) (metricsexport.Report, error) {
	enriched, err := enrichTopologyResponse(flows, params, h.Cfg.Frontend.Scopes)
	if err != nil {
		return metricsexport.Report{}, err
	}

	timeRange, err := encodeExportTimeRangeFromParams(params)
	if err != nil {
		return metricsexport.Report{}, err
	}

	rows := []metricsexport.MetricSeriesRow{}
	edges := []metricsexport.TopologyEdgeRow{}
	rows, edges = metricsexport.AppendEnriched(rows, edges, enriched.ResultType, enriched.Result, metricsexport.QueryInput{
		MetricGroup:    query.MetricGroup,
		MetricType:     firstNonEmpty(query.Type, params.Get(metricTypeKey)),
		MetricFunction: firstNonEmpty(query.Function, params.Get(metricFunctionKey)),
		AggregateBy:    firstNonEmpty(query.AggregateBy, params.Get(aggregateByKey)),
	}, includeTopologyEdges)

	metricScope := params.Get(aggregateByKey)
	return metricsexport.BuildReport(timeRange, metricScope, rows, edges, includeTopologyEdges), nil
}

func writeMetricsExport(w http.ResponseWriter, format string, report *metricsexport.Report) int {
	prefix := metricsexport.ExportFilenamePrefix(report.MetricScope)
	switch format {
	case export.FormatJSON:
		if err := export.WriteJSON(w, http.StatusOK, prefix, report); err != nil {
			hlog.Errorf("Error while writing metrics JSON export: %v", err)
		}
		return http.StatusOK
	case export.FormatCSV:
		if err := export.WriteCSVAttachment(w, http.StatusOK, prefix, metricsexport.CSVRows(report)); err != nil {
			hlog.Errorf("Error while writing metrics CSV export: %v", err)
		}
		return http.StatusOK
	default:
		apierrors.Write(w, http.StatusBadRequest, fmt.Errorf("export format %q is not valid", format))
		return http.StatusBadRequest
	}
}

func parseIncludeTopologyEdges(raw string, defaultValue bool) bool {
	if raw == "" {
		return defaultValue
	}
	parsed, err := strconv.ParseBool(raw)
	if err != nil {
		return defaultValue
	}
	return parsed
}

func queryFromParams(params url.Values) exportMetricsQuery {
	return exportMetricsQuery{
		Type:        params.Get(metricTypeKey),
		Function:    params.Get(metricFunctionKey),
		AggregateBy: params.Get(aggregateByKey),
		Groups:      params.Get(groupsKey),
		MetricGroup: params.Get("metricGroup"),
	}
}

func baseParamsFromExportRequest(req *exportMetricsRequest) (url.Values, error) {
	params := url.Values{}
	if req.TimeRange > 0 {
		params.Set(timeRangeKey, strconv.FormatInt(req.TimeRange, 10))
	}
	setIfNotEmpty(params, startTimeKey, req.StartTime)
	setIfNotEmpty(params, endTimeKey, req.EndTime)
	setIfNotEmpty(params, namespaceKey, req.Namespace)
	setIfNotEmpty(params, filtersKey, req.Filters)
	setIfNotEmpty(params, recordTypeKey, req.RecordType)
	setIfNotEmpty(params, dataSourceKey, req.DataSource)
	setIfNotEmpty(params, packetLossKey, req.PacketLoss)
	if req.Limit > 0 {
		params.Set(limitKey, strconv.Itoa(req.Limit))
	}
	setIfNotEmpty(params, rateIntervalKey, req.RateInterval)
	setIfNotEmpty(params, stepKey, req.Step)
	setIfNotEmpty(params, groupsKey, req.Groups)
	setIfNotEmpty(params, aggregateByKey, req.MetricScope)
	if params.Get(timeRangeKey) == "" && params.Get(startTimeKey) == "" {
		return nil, fmt.Errorf("timeRange or startTime is required")
	}
	return params, nil
}

func mergeExportQuery(base url.Values, query *exportMetricsQuery, metricScope string) url.Values {
	params := cloneValues(base)
	setIfNotEmpty(params, metricTypeKey, query.Type)
	setIfNotEmpty(params, metricFunctionKey, query.Function)
	setIfNotEmpty(params, aggregateByKey, query.AggregateBy)
	if params.Get(aggregateByKey) == "" && metricScope != "" {
		params.Set(aggregateByKey, metricScope)
	}
	setIfNotEmpty(params, groupsKey, query.Groups)
	setIfNotEmpty(params, "metricGroup", query.MetricGroup)
	return params
}

func cloneValues(values url.Values) url.Values {
	cloned := url.Values{}
	for key, vals := range values {
		cloned[key] = append([]string(nil), vals...)
	}
	return cloned
}

func setIfNotEmpty(values url.Values, key, value string) {
	if value != "" {
		values.Set(key, value)
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
