package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/netobserv/network-observability-console-plugin/pkg/handler/apierrors"
	"github.com/netobserv/network-observability-console-plugin/pkg/metrics"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/fields"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/filters"
	"github.com/netobserv/network-observability-console-plugin/pkg/prometheus"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils"
)

func (h *Handlers) GetClusters(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		params := r.URL.Query()
		namespace := params.Get(namespaceKey)
		isDev := namespace != ""

		clients, err := newClients(h.Cfg, r.Header, false, namespace)
		if err != nil {
			err.Write(w, http.StatusInternalServerError)
			return
		}
		var code int
		startTime := time.Now()
		defer func() {
			metrics.ObserveHTTPCall("GetClusters", code, startTime)
		}()

		// Fetch and merge values for K8S_ClusterName
		values, code, err := h.getLabelValues(ctx, clients, fields.Cluster, isDev)
		if err != nil {
			err.Write(w, code)
			return
		}

		code = http.StatusOK
		writeJSON(w, code, utils.NonEmpty(utils.Dedup(values)))
	}
}

func (h *Handlers) GetUDNs(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		params := r.URL.Query()
		namespace := params.Get(namespaceKey)
		isDev := namespace != ""

		clients, err := newClients(h.Cfg, r.Header, false, namespace)
		if err != nil {
			err.Write(w, http.StatusInternalServerError)
			return
		}
		var code int
		startTime := time.Now()
		defer func() {
			metrics.ObserveHTTPCall("GetUDNs", code, startTime)
		}()

		// Fetch and merge values for K8S_ClusterName
		values, code, err := h.getLabelValues(ctx, clients, fields.UDN, isDev)
		if err != nil {
			err.Write(w, code)
			return
		}

		code = http.StatusOK
		writeJSON(w, code, utils.NonEmpty(utils.Dedup(values)))
	}
}

func (h *Handlers) GetZones(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		params := r.URL.Query()
		namespace := params.Get(namespaceKey)
		isDev := namespace != ""

		clients, err := newClients(h.Cfg, r.Header, false, namespace)
		if err != nil {
			err.Write(w, http.StatusInternalServerError)
			return
		}
		var code int
		startTime := time.Now()
		defer func() {
			metrics.ObserveHTTPCall("GetZones", code, startTime)
		}()

		// Initialize values explicitly to avoid null json when empty
		values := []string{}

		// Fetch and merge values for SrcK8S_Zone and DstK8S_Zone
		values1, code, err := h.getLabelValues(ctx, clients, fields.SrcZone, isDev)
		if err != nil {
			err.Write(w, code)
			return
		}
		values = append(values, values1...)

		values2, code, err := h.getLabelValues(ctx, clients, fields.DstZone, isDev)
		if err != nil {
			err.Write(w, code)
			return
		}
		values = append(values, values2...)

		code = http.StatusOK
		writeJSON(w, code, utils.NonEmpty(utils.Dedup(values)))
	}
}

func (h *Handlers) getNamespacesValues(ctx context.Context, clients clients, isDev bool) ([]string, int, apierrors.StructuredError) {
	// Initialize values explicitly to avoid null json when empty
	values := []string{}

	// Fetch and merge values for SrcK8S_Namespace and DstK8S_Namespace
	values1, code, err := h.getLabelValues(ctx, clients, fields.SrcNamespace, isDev)
	if err != nil {
		return []string{}, code, err
	}
	values = append(values, values1...)

	values2, code, err := h.getLabelValues(ctx, clients, fields.DstNamespace, isDev)
	if err != nil {
		return []string{}, code, err
	}
	values = append(values, values2...)

	return values, http.StatusOK, nil
}

func (h *Handlers) GetNamespaces(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		params := r.URL.Query()
		namespace := params.Get(namespaceKey)
		isDev := namespace != ""

		clients, err := newClients(h.Cfg, r.Header, false, namespace)
		if err != nil {
			err.Write(w, http.StatusInternalServerError)
			return
		}
		var code int
		startTime := time.Now()
		defer func() {
			metrics.ObserveHTTPCall("GetNamespaces", code, startTime)
		}()

		values, code, err := h.getNamespacesValues(ctx, clients, isDev)
		if err != nil {
			err.Write(w, code)
			return
		}
		writeJSON(w, code, utils.NonEmpty(utils.Dedup(values)))
	}
}

func (h *Handlers) getLabelValues(ctx context.Context, cl clients, label string, isDev bool) ([]string, int, apierrors.StructuredError) {
	if h.PromInventory != nil && h.PromInventory.LabelExists(label) {
		client := cl.getPromClient(isDev)
		if client != nil {
			resp, code, err := prometheus.GetLabelValues(ctx, client, label, nil)
			if err != nil {
				if code == http.StatusUnauthorized || code == http.StatusForbidden {
					// In case this was a prometheus 401 / 403 error, the query is repeated with Loki
					// This is because multi-tenancy is currently not managed for prom datasource, hence such queries have to go with Loki
					// Unfortunately we don't know a safe and generic way to pre-flight check if the user will be authorized
					hlog.Info("Retrying with Loki...")
					// continuing with loki below
				} else {
					return nil, code, apierrors.NewPromClientError(fmt.Errorf("error while fetching label %s values from Prometheus: %w", label, err))
				}
			} else {
				return resp, code, nil
			}
		}
	}
	if cl.loki != nil {
		resp, code, err := getLokiLabelValues(h.Cfg.Loki.URL, cl.loki, label)
		if err != nil {
			return nil, code, err
		}
		return resp, code, nil
	}
	// Loki disabled AND label not managed in metrics => send an error
	return nil, http.StatusBadRequest, apierrors.NewPromMissingLabels(map[string][]string{"": {label}})
}

func (h *Handlers) GetNames(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		params := r.URL.Query()
		namespace := params.Get(namespaceKey)
		kind := params.Get("kind")

		clients, err := newClients(h.Cfg, r.Header, false, namespace)
		if err != nil {
			err.Write(w, http.StatusInternalServerError)
			return
		}
		var code int
		startTime := time.Now()
		defer func() {
			metrics.ObserveHTTPCall("GetNames", code, startTime)
		}()

		// Initialize names explicitly to avoid null json when empty
		names := []string{}

		// TODO: parallelize
		names1, code, err := h.getNamesForPrefix(ctx, clients, fields.Src, kind, namespace)
		if err != nil {
			err.Write(w, code)
			return
		}
		names = append(names, names1...)

		names2, code, err := h.getNamesForPrefix(ctx, clients, fields.Dst, kind, namespace)
		if err != nil {
			err.Write(w, code)
			return
		}
		names = append(names, names2...)

		code = http.StatusOK
		writeJSON(w, code, utils.NonEmpty(utils.Dedup(names)))
	}
}

func (h *Handlers) getNamesForPrefix(ctx context.Context, cl clients, prefix, kind, namespace string) ([]string, int, apierrors.StructuredError) {
	filts := filters.SingleQuery{}
	if namespace != "" {
		filts = append(filts, filters.NewRegexMatch(prefix+fields.Namespace, exact(namespace)))
	}
	var searchField string
	if utils.IsOwnerKind(kind) {
		filts = append(filts, filters.NewRegexMatch(prefix+fields.OwnerType, exact(kind)))
		searchField = prefix + fields.OwnerName
	} else {
		filts = append(filts, filters.NewRegexMatch(prefix+fields.Type, exact(kind)))
		searchField = prefix + fields.Name
	}

	if h.Cfg.IsPromEnabled() && h.PromInventory.LabelExists(searchField) {
		// Label match query (any metric)
		q := prometheus.QueryFilters("", filts)
		values, code, err := prometheus.GetLabelValues(ctx, cl.promAdmin, searchField, []string{q})
		if err != nil {
			return values, code, apierrors.NewPromClientError(err)
		}
		return values, code, nil
	}
	return getLokiNamesForPrefix(&h.Cfg.Loki, cl.loki, filts, searchField)
}

func exact(str string) string {
	return `"` + str + `"`
}

func extractDistinctValues(field string, streams model.Streams) []string {
	var values []string
	for _, stream := range streams {
		if v, ok := stream.Labels[field]; ok {
			if len(v) > 0 {
				values = append(values, v)
			}
		} else {
			for _, entry := range stream.Entries {
				var line map[string]interface{}
				err := json.Unmarshal([]byte(entry.Line), &line)
				if err != nil {
					hlog.Errorf("Could not unmarshal line: %v. Error was: %v", entry.Line, err)
					continue
				}
				if v, ok := line[field]; ok {
					if str, ok := v.(string); ok && len(str) > 0 {
						values = append(values, str)
					}
				}
			}
		}
	}
	return utils.Dedup(values)
}
