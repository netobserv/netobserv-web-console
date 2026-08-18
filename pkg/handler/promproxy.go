package handler

import (
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/netobserv/network-observability-console-plugin/pkg/handler/apierrors"
	"github.com/netobserv/network-observability-console-plugin/pkg/prometheus"
)

func (h *Handlers) PromProxyRules() func(w http.ResponseWriter, r *http.Request) {
	u, _ := url.JoinPath(h.Cfg.Prometheus.URL, "/api/v1/rules")
	cfg := &h.Cfg.Prometheus
	return simpleProxy(u, cfg.Timeout.Duration, cfg.SkipTLS, cfg.CAPath, cfg.ForwardUserToken, cfg.TokenPath)
}

func (h *Handlers) PromProxyQuery() func(w http.ResponseWriter, r *http.Request) {
	u, _ := url.JoinPath(h.Cfg.Prometheus.URL, "/api/v1/query")
	cfg := &h.Cfg.Prometheus
	return simpleProxy(u, cfg.Timeout.Duration, cfg.SkipTLS, cfg.CAPath, cfg.ForwardUserToken, cfg.TokenPath)
}

func (h *Handlers) PromProxySilences() func(w http.ResponseWriter, r *http.Request) {
	u, _ := url.JoinPath(h.Cfg.Prometheus.AlertManager.URL, "/api/v2/silences")
	cfg := &h.Cfg.Prometheus
	return simpleProxy(u, cfg.Timeout.Duration, cfg.SkipTLS, cfg.CAPath, cfg.ForwardUserToken, cfg.TokenPath)
}

func simpleProxy(toURLStr string, timeout time.Duration, skipTLS bool, caPath string, forwardUserToken bool, tokenPath string) func(w http.ResponseWriter, r *http.Request) {
	hlog.Infof("Proxying to: %s", toURLStr)
	toURL, _ := url.Parse(toURLStr)
	return func(w http.ResponseWriter, r *http.Request) {
		roundTripper, err := prometheus.CreateRoundTripper(timeout, skipTLS, caPath, forwardUserToken, tokenPath, r.Header)
		if err != nil {
			hlog.Errorf("Proxying to %s; CreateRoundTripper error: %v", toURL, err)
			apierrors.Write(w, http.StatusInternalServerError, err)
			return
		}
		backendURL := *toURL
		backendURL.RawQuery = r.URL.RawQuery
		rq := http.Request{
			Method:        r.Method,
			URL:           &backendURL,
			Body:          r.Body,
			ContentLength: r.ContentLength,
			Header:        http.Header{},
		}
		resp, err := roundTripper.RoundTrip(&rq)
		if err != nil {
			hlog.Errorf("Proxying to %s; RoundTrip error: %v", toURL, err)
			apierrors.Write(w, http.StatusInternalServerError, err)
			return
		}
		w.WriteHeader(resp.StatusCode)
		defer resp.Body.Close()
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			hlog.Errorf("Error reading response from proxy on %s: %v", toURL, err)
		}
		if _, err := w.Write(body); err != nil {
			hlog.Errorf("Error proxying response from %s: %v", toURL, err)
		}
	}
}
