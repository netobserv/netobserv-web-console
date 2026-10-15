package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/netobserv/network-observability-console-plugin/pkg/backend"
	"github.com/netobserv/network-observability-console-plugin/pkg/handler/apierrors"
	"github.com/netobserv/network-observability-console-plugin/pkg/metrics"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/fields"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/filters"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils"
)

func (h *Handlers) GetClusters(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		h.getLabelValues(ctx, w, r, "GetClusters", fields.Cluster)
	}
}

func (h *Handlers) GetUDNs(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		h.getLabelValues(ctx, w, r, "GetUDNs", fields.UDN)
	}
}

func (h *Handlers) GetZones(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		h.getLabelValues(ctx, w, r, "GetZones", fields.SrcZone, fields.DstZone)
	}
}

func (h *Handlers) GetNamespaces(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		h.getLabelValues(ctx, w, r, "GetNamespaces", fields.SrcNamespace, fields.DstNamespace)
	}
}

func (h *Handlers) getLabelValues(ctx context.Context, w http.ResponseWriter, r *http.Request, funcName string, labels ...string) {
	var code int
	startTime := time.Now()
	defer func() {
		metrics.ObserveHTTPCall(funcName, code, startTime)
	}()

	qctx, err := getQueryContext(r)
	if err != nil {
		code = http.StatusBadRequest
		apierrors.Write(w, code, err)
		return
	}

	// Fetch and merge values for each label
	v, code, err := h.Backends.GetLabelValues(ctx, qctx, labels...)
	if err != nil {
		apierrors.Write(w, code, err)
		return
	}

	code = http.StatusOK
	writeJSON(w, code, v)
}

func (h *Handlers) GetNames(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		var code int
		startTime := time.Now()
		defer func() {
			metrics.ObserveHTTPCall("GetNames", code, startTime)
		}()

		qctx, err := getQueryContext(r)
		if err != nil {
			code = http.StatusBadRequest
			apierrors.Write(w, code, err)
			return
		}

		params := r.URL.Query()
		namespace := params.Get("namespace")
		kind := params.Get("kind")

		// Initialize names explicitly to avoid null json when empty
		names := []string{}

		names1, code, err := h.getNamesForPrefix(ctx, qctx, fields.Src, kind, namespace)
		if err != nil {
			apierrors.Write(w, code, err)
			return
		}
		names = append(names, names1...)

		names2, code, err := h.getNamesForPrefix(ctx, qctx, fields.Dst, kind, namespace)
		if err != nil {
			apierrors.Write(w, code, err)
			return
		}
		names = append(names, names2...)

		code = http.StatusOK
		writeJSON(w, code, utils.NonEmpty(utils.Dedup(names)))
	}
}

func (h *Handlers) getNamesForPrefix(ctx context.Context, bctx *backend.QueryContext, prefix, kind, namespace string) ([]string, int, apierrors.StructuredError) {
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

	return h.Backends.MatchLabelValues(ctx, bctx, filts, searchField)
}

func exact(str string) string {
	return `"` + str + `"`
}
