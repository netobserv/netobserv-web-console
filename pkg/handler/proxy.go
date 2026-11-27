package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"time"

	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/handler/apierrors"
	"github.com/netobserv/network-observability-console-plugin/pkg/httpclient"
	"github.com/netobserv/network-observability-console-plugin/pkg/loki"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
)

// ProxyRequest contains only connection metadata, never request URLs or headers.
type ProxyRequest struct {
	ClientAddr string `json:"ProxyClientAddr"`
	ClientPort uint16 `json:"ProxyClientPort"`
	StartMs    int64  `json:"ProxyStartMs"`
	EndMs      int64  `json:"ProxyEndMs"`
	Instance   string `json:"ProxyInstance"`
	RequestID  string `json:"ProxyRequestID"`
}

type ProxyResponse struct {
	Records       []ProxyRequest `json:"records"`
	LimitReached  bool           `json:"limitReached"`
	Pending       bool           `json:"pending"`
	SearchStartMs int64          `json:"searchStartMs"`
	SearchEndMs   int64          `json:"searchEndMs"`
	LookaheadMs   int64          `json:"lookaheadMs"`
}

// GetProxyRecords must be registered behind the administrator check: proxy records
// contain client identity and are not covered by the developer namespace filter.
func (h *Handlers) GetProxyRecords(_ context.Context) func(http.ResponseWriter, *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		if !h.Cfg.IsLokiEnabled() || !slices.Contains(h.Cfg.Frontend.Features, "proxyCorrelation") {
			apierrors.Write(w, http.StatusBadRequest, fmt.Errorf("HAProxy log correlation is disabled"))
			return
		}
		query, err := loki.BuildProxyQuery(h.Cfg.Loki.URL, r.URL.Query(), time.Now(), slices.Contains(h.Cfg.Frontend.Features, "multiCluster"))
		if err != nil {
			apierrors.Write(w, http.StatusBadRequest, err)
			return
		}
		client := newLokiClient(&h.Cfg.Loki, r.Header, false, h.Cfg.ConsoleMode == config.Mock)
		result, code, err := fetchProxyRecords(client, query)
		if err != nil {
			apierrors.Write(w, code, err)
			return
		}
		writeJSON(w, http.StatusOK, result)
	}
}

func fetchProxyRecords(client httpclient.Caller, query loki.ProxyQuery) (*ProxyResponse, int, error) {
	qr, code, err := fetchLogQL(query.URL, client)
	if err != nil {
		return nil, code, err
	}
	streams, ok := qr.Data.Result.(model.Streams)
	if !ok {
		return nil, http.StatusBadGateway, fmt.Errorf("expected proxy log streams")
	}
	result := &ProxyResponse{Records: []ProxyRequest{}, Pending: query.Pending, SearchStartMs: query.SearchStartMs, SearchEndMs: query.SearchEndMs, LookaheadMs: loki.ProxyLookahead.Milliseconds()}
	seen := map[string]struct{}{}
	count := 0
	for _, stream := range streams {
		for _, entry := range stream.Entries {
			count++
			var record ProxyRequest
			if err := json.Unmarshal([]byte(entry.Line), &record); err != nil || record.ClientAddr == "" || record.ClientPort == 0 || record.RequestID == "" || record.StartMs <= 0 || record.EndMs < record.StartMs {
				return nil, http.StatusBadGateway, fmt.Errorf("invalid stored proxy request")
			}
			if _, exists := seen[record.RequestID]; !exists {
				seen[record.RequestID] = struct{}{}
				result.Records = append(result.Records, record)
			}
		}
	}
	result.LimitReached = count >= loki.ProxyResultLimit
	return result, http.StatusOK, nil
}
