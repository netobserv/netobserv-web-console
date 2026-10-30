package handler

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/netobserv/network-observability-console-plugin/pkg/handler/apierrors"
	"github.com/netobserv/network-observability-console-plugin/pkg/metrics"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
)

const (
	exportCSVFormat  = "csv"
	exportFormatKey  = "format"
	exportcolumnsKey = "columns"
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

		exportFormat := params.Get(exportFormatKey)
		var exportColumns []string
		if str := params.Get(exportcolumnsKey); len(str) > 0 {
			exportColumns = strings.Split(str, ",")
		}

		switch exportFormat {
		case exportCSVFormat:
			code = http.StatusOK
			writeCSV(w, code, flows, exportColumns)
		default:
			code = http.StatusBadRequest
			apierrors.Write(w, code, fmt.Errorf("export format %q is not valid", exportFormat))
		}
	}
}
