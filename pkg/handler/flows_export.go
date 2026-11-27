package handler

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/netobserv/network-observability-console-plugin/pkg/export"
	"github.com/netobserv/network-observability-console-plugin/pkg/handler/apierrors"
	"github.com/netobserv/network-observability-console-plugin/pkg/handler/csv"
	"github.com/netobserv/network-observability-console-plugin/pkg/handler/flowexport"
	"github.com/netobserv/network-observability-console-plugin/pkg/metrics"
)

const (
	exportcolumnsKey  = "columns"
	flowsExportPrefix = "netobserv_flows"
)

func (h *Handlers) ExportFlows(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		var code int
		startTime := time.Now()
		defer func() {
			metrics.ObserveHTTPCall("ExportFlows", code, startTime)
		}()

		params := r.URL.Query()
		hlog.Debugf("ExportFlows query params: %s", params)

		qctx, err := getQueryContext(r)
		if err != nil {
			code = http.StatusBadRequest
			apierrors.Write(w, code, err)
			return
		}
		query, err := parseRawFlowsQuery(params)
		if err != nil {
			code = http.StatusBadRequest
			apierrors.Write(w, code, err)
			return
		}
		flows, code, err := h.Backends.Flows(ctx, qctx, query)
		if err != nil {
			apierrors.Write(w, code, err)
			return
		}

		exportFormat, err := export.ParseFormat(params.Get(export.FormatKey), export.FormatCSV)
		if err != nil {
			code = http.StatusBadRequest
			apierrors.Write(w, code, err)
			return
		}

		var exportColumns []string
		if str := params.Get(exportcolumnsKey); len(str) > 0 {
			exportColumns = strings.Split(str, ",")
		}

		code = http.StatusOK
		switch exportFormat {
		case export.FormatCSV:
			data, csvErr := csv.GetCSVData(flows, exportColumns)
			if csvErr != nil {
				code = http.StatusInternalServerError
				apierrors.Write(w, code, csvErr)
				return
			}
			hlog.Tracef("CSV data rows: %d", len(data))
			if err := export.WriteCSVAttachment(w, code, flowsExportPrefix, data); err != nil {
				hlog.Errorf("Error while writing flows CSV export: %v", err)
			}
		case export.FormatJSON:
			timeRange, err := encodeExportTimeRangeFromParams(params)
			if err != nil {
				code = http.StatusBadRequest
				apierrors.Write(w, code, err)
				return
			}
			report, err := flowexport.BuildReport(flows, exportColumns, timeRange)
			if err != nil {
				code = http.StatusInternalServerError
				apierrors.Write(w, code, err)
				return
			}
			if err := export.WriteJSON(w, code, flowsExportPrefix, report); err != nil {
				hlog.Errorf("Error while writing flows JSON export: %v", err)
			}
		}
	}
}
