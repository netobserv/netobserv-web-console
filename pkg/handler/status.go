package handler

import (
	"context"
	"net/http"
	"strings"
	"sync"

	"github.com/netobserv/network-observability-console-plugin/pkg/handler/apierrors"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/fields"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils/constants"
)

func (h *Handlers) Status(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		qctx, err := getQueryContext(r)
		if err != nil {
			apierrors.Write(w, http.StatusBadRequest, err)
			return
		}

		wg := sync.WaitGroup{}

		prometheus := model.DatasourceStatus{IsEnabled: h.Cfg.IsPromEnabled()}
		if prometheus.IsEnabled {
			wg.Add(1)
			promCtx := qctx
			promCtx.DataSource = constants.DataSourceProm

			go func() {
				defer wg.Done()
				// Get namespaces using Prom
				promNamespaces, code, err := h.Backends.GetLabelValues(ctx, qctx, fields.SrcNamespace, fields.DstNamespace)
				if err != nil {
					prometheus.Error = err.Error()
					prometheus.ErrorCode = code
				} else {
					prometheus.IsReady = true
					prometheus.NamespacesCount = len(promNamespaces)
				}
			}()
		}

		loki := model.DatasourceStatus{IsEnabled: h.Cfg.IsLokiEnabled()}
		if loki.IsEnabled {
			wg.Add(1)
			lokiCtx := qctx
			lokiCtx.DataSource = constants.DataSourceLoki

			go func() {
				defer wg.Done()
				resp, code, err := h.getLokiStatus(r)
				if err != nil {
					loki.Error = err.Error()
					loki.ErrorCode = code
				} else {
					lokiStatus := string(resp)
					loki.IsReady = strings.Contains(lokiStatus, "ready")

					// Get namespaces using Loki
					lokiNamespaces, code, err := h.Backends.GetLabelValues(ctx, lokiCtx, fields.SrcNamespace, fields.DstNamespace)
					if err != nil {
						loki.Error = "Error while fetching label namespace values from Loki: " + err.Error()
						loki.ErrorCode = code
					} else {
						loki.NamespacesCount = len(lokiNamespaces)
					}
				}
			}()
		}

		wg.Wait()
		writeJSON(w, http.StatusOK, model.Status{
			Loki:       loki,
			Prometheus: prometheus,
		})
	}
}
