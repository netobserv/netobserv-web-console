package handler

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/handler/apierrors"
	"github.com/netobserv/network-observability-console-plugin/pkg/metrics"
)

const (
	exportCSVFormat  = "csv"
	exportFormatKey  = "format"
	exportcolumnsKey = "columns"
)

func (h *Handlers) ExportFlows(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		if !h.Cfg.IsLokiEnabled() {
			err := apierrors.NewLokiDisabledError("cannot perform flows query with disabled Loki")
			err.Write(w, http.StatusBadRequest)
			return
		}
		cl := newLokiClient(&h.Cfg.Loki, r.Header, false, h.Cfg.ConsoleMode == config.Mock)
		var code int
		startTime := time.Now()
		defer func() {
			metrics.ObserveHTTPCall("ExportFlows", code, startTime)
		}()

		params := r.URL.Query()
		hlog.Debugf("ExportFlows query params: %s", params)

		flows, code, err := h.getFlows(ctx, cl, params)
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
