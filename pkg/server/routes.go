package server

import (
	"context"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"

	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/handler"
	"github.com/netobserv/network-observability-console-plugin/pkg/handler/alertingmock"
	"github.com/netobserv/network-observability-console-plugin/pkg/kubernetes/auth"
	"github.com/netobserv/network-observability-console-plugin/pkg/prometheus"
)

func setupRoutes(ctx context.Context, cfg *config.Config, authChecker auth.Checker) *mux.Router {
	var promInventory *prometheus.Inventory
	if cfg.IsPromEnabled() {
		promInventory = prometheus.NewInventory(&cfg.Prometheus)
	}

	r := mux.NewRouter()
	h := handler.Handlers{Cfg: cfg, PromInventory: promInventory}

	// Role
	r.PathPrefix("/").Subrouter().HandleFunc("/role", getRole(authChecker))

	// API role checks
	api := r.PathPrefix("/api").Subrouter()
	api.Use(func(orig http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if err := authChecker.CheckAuth(ctx, r.Header); err != nil {
				w.WriteHeader(http.StatusUnauthorized)
				_, err2 := w.Write([]byte(err.Error()))
				if err2 != nil {
					logrus.Errorf("Error while responding an error: %v (initial was: %v)", err2, err)
				}
				return
			}
			orig.ServeHTTP(w, r)
		})
	})

	// Server status and config
	api.HandleFunc("/status", h.Status(ctx))
	api.HandleFunc("/frontend-config", h.GetFrontendConfig())

	if cfg.Static {
		// Expose static files only
		r.PathPrefix("/").Handler(http.FileServer(http.Dir("./web/dist/static")))
	} else {
		// Loki endpoints
		api.HandleFunc("/loki/ready", h.LokiReady())
		api.HandleFunc("/loki/metrics", forceCheckAdmin(authChecker, h.LokiMetrics()))
		api.HandleFunc("/loki/buildinfo", forceCheckAdmin(authChecker, h.LokiBuildInfos()))
		api.HandleFunc("/loki/config/limits", forceCheckAdmin(authChecker, h.LokiLimits()))
		api.HandleFunc("/loki/flow/records", h.GetFlows(ctx))
		api.HandleFunc("/loki/export", h.ExportFlows(ctx))

		// Common endpoints
		api.HandleFunc("/flow/metrics", h.GetTopology(ctx))
		api.HandleFunc("/resources/clusters", h.GetClusters(ctx))
		api.HandleFunc("/resources/udns", h.GetUDNs(ctx))
		api.HandleFunc("/resources/zones", h.GetZones(ctx))
		api.HandleFunc("/resources/namespaces", h.GetNamespaces(ctx))
		api.HandleFunc("/resources/names", h.GetNames(ctx))

		// K8S endpoints
		api.HandleFunc("/k8s/resources/udnIds", h.GetUDNIdss(ctx))

		// Path prefixed with "console-" are routed via react-router (standalone console)
		r.PathPrefix("/console-").HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.ServeFile(w, r, "./web/dist/index.html")
		})

		// Frontend files
		r.PathPrefix("/").Handler(http.FileServer(http.Dir("./web/dist/")))
	}

	switch cfg.ConsoleMode {
	case config.Standalone:
		api.HandleFunc("/prometheus/api/v1/rules", h.PromProxyRules())
		api.HandleFunc("/prometheus/api/v1/query", h.PromProxyQuery())
		api.HandleFunc("/alertmanager/api/v2/silences", h.PromProxySilences())
		api.HandleFunc("/resources/flowcollector", h.GetFlowCollector(ctx))
	case config.OpenShiftPlugin:
		// Those paths are handled by the Console proxy, nothing to do
	case config.Mock:
		// Redirect to mocks
		api.HandleFunc("/prometheus/api/v1/rules", alertingmock.GetRules())
		api.HandleFunc("/prometheus/api/v1/query", alertingmock.GetQuery())
		api.HandleFunc("/alertmanager/api/v2/silences", alertingmock.GetSilences())
	}

	return r
}

func getRole(authChecker auth.Checker) func(http.ResponseWriter, *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		role := "dev"
		if err := authChecker.CheckAdmin(context.TODO(), r.Header); err == nil {
			role = "admin"
		}
		_, err := w.Write([]byte(role))
		if err != nil {
			logrus.Errorf("Error: %v", err)
		}
	}
}

func forceCheckAdmin(authChecker auth.Checker, handle func(http.ResponseWriter, *http.Request)) func(http.ResponseWriter, *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := authChecker.CheckAdmin(context.TODO(), r.Header); err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			_, err2 := w.Write([]byte(err.Error()))
			if err2 != nil {
				logrus.Errorf("Error while responding an error: %v (initial was: %v)", err2, err)
			}
			return
		}
		handle(w, r)
	}
}
