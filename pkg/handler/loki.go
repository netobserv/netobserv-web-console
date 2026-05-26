package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/mitchellh/mapstructure"
	"github.com/sirupsen/logrus"
	"gopkg.in/yaml.v3"

	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/handler/apierrors"
	"github.com/netobserv/network-observability-console-plugin/pkg/handler/lokiclientmock"
	"github.com/netobserv/network-observability-console-plugin/pkg/httpclient"
	"github.com/netobserv/network-observability-console-plugin/pkg/kubernetes/auth"
	"github.com/netobserv/network-observability-console-plugin/pkg/loki"
	"github.com/netobserv/network-observability-console-plugin/pkg/metrics"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/filters"
)

var hlog = logrus.WithField("module", "handler")

const (
	lokiOrgIDHeader = "X-Scope-OrgID"
)

func newLokiClient(cfg *config.Loki, requestHeader http.Header, useStatusConfig, useMocks bool) httpclient.Caller {
	headers := map[string][]string{}
	if cfg.TenantID != "" {
		headers[lokiOrgIDHeader] = []string{cfg.TenantID}
	}

	if token, _, err := auth.RetrieveToken(requestHeader, cfg.ForwardUserToken, cfg.TokenPath); err != nil {
		hlog.WithError(err).Warn("Continuing without token authentication. This may cause authentication failures if the Loki server requires authentication.")
	} else if token != "" {
		headers[auth.AuthHeader] = []string{"Bearer " + token}
	}

	if useMocks {
		hlog.Debug("Mocking Loki Client")
		return new(lokiclientmock.LokiClientMock)
	}

	skipTLS := cfg.SkipTLS
	caPath := cfg.CAPath
	userCertPath := ""
	userKeyPath := ""
	if useStatusConfig {
		skipTLS = cfg.StatusSkipTLS
		caPath = cfg.StatusCAPath
		userCertPath = cfg.StatusUserCertPath
		userKeyPath = cfg.StatusUserKeyPath
	}

	return httpclient.NewClientWrapper(cfg.Timeout.Duration, headers, skipTLS, caPath, userCertPath, userKeyPath)
}

/* loki query will fail if spaces or quotes are not encoded
 * we can't use url.QueryEscape or url.Values here since Loki doesn't manage encoded parenthesis
 */
func EncodeQuery(url string) string {
	unquoted := strings.ReplaceAll(url, "\"", "%22")
	unspaced := strings.ReplaceAll(unquoted, " ", "%20")
	return unspaced
}

func getLokiError(resp []byte, code int) (int, *apierrors.LokiResponseError) {
	var f map[string]string
	if code == http.StatusBadRequest {
		return code, apierrors.NewLokiResponseError(code, fmt.Sprintf("Loki message: %s", resp))
	}
	if code == http.StatusForbidden {
		return code, apierrors.NewLokiResponseError(code, fmt.Sprintf("Forbidden: %s", resp))
	}
	err := json.Unmarshal(resp, &f)
	if err != nil {
		hlog.WithError(err).Errorf("cannot unmarshal, response was: %v", string(resp))
		return http.StatusBadRequest, apierrors.NewLokiResponseError(code, fmt.Sprintf("Unknown error from Loki\ncannot unmarshal\n%s", resp))
	}
	message, ok := f["error"]
	if !ok {
		message, ok = f["message"]
		if !ok {
			hlog.WithError(err).Errorf("unknown Loki error: %v", f)
			return http.StatusBadRequest, apierrors.NewLokiResponseError(code, "Unknown error from Loki")
		}
	}
	return http.StatusBadRequest, apierrors.NewLokiResponseError(code, fmt.Sprintf("Loki message: %s", message))
}

func fetchLogQL(logQL string, lokiClient httpclient.Caller) (model.QueryResponse, int, apierrors.StructuredError) {
	var qr model.QueryResponse
	resp, code, err := executeLokiQuery(logQL, lokiClient)
	if err != nil {
		return qr, code, err
	}
	if err := json.Unmarshal(resp, &qr); err != nil {
		hlog.WithError(err).Errorf("cannot unmarshal, response was: %v", string(resp))
		return qr, http.StatusInternalServerError, apierrors.NewLokiClientError(err)
	}
	return qr, code, nil
}

func executeLokiQuery(flowsURL string, lokiClient httpclient.Caller) ([]byte, int, apierrors.StructuredError) {
	hlog.Debugf("executeLokiQuery URL: %s", flowsURL)
	var code int
	startTime := time.Now()
	defer func() {
		metrics.ObserveLokiCall(code, startTime)
	}()

	resp, code, err := lokiClient.Get(flowsURL)
	if err != nil {
		return nil, http.StatusServiceUnavailable, apierrors.NewLokiClientError(err)
	}
	if code != http.StatusOK {
		newCode, err := getLokiError(resp, code)
		hlog.Debugf("executeLokiQuery error: %s", err.Error())
		return nil, newCode, err
	}
	return resp, http.StatusOK, nil
}

func getLokiLabelValues(baseURL string, lokiClient httpclient.Caller, label string) ([]string, int, apierrors.StructuredError) {
	baseURL = strings.TrimRight(baseURL, "/")
	url := fmt.Sprintf("%s/loki/api/v1/label/%s/values", baseURL, label)
	hlog.Debugf("getLokiLabelValues URL: %s", url)

	resp, code, err := lokiClient.Get(url)
	if err != nil {
		return nil, http.StatusServiceUnavailable, apierrors.NewLokiClientError(fmt.Errorf("error while fetching label %s values from Loki: [%d] %w", label, code, err))
	}
	if code != http.StatusOK {
		newCode, err := getLokiError(resp, code)
		hlog.Debugf("getLokiLabelValues error: %s", err.Error())
		return nil, newCode, err
	}
	hlog.Tracef("getLokiLabelValues raw response: %s", resp)
	var lvr model.LabelValuesResponse
	err = json.Unmarshal(resp, &lvr)
	if err != nil {
		return nil, http.StatusInternalServerError, apierrors.NewLokiClientError(fmt.Errorf("unmarshal error while fetching label %s values from Loki: %w", label, err))
	}
	return lvr.Data, http.StatusOK, nil
}

func getLokiNamesForPrefix(cfg *config.Loki, lokiClient httpclient.Caller, filts filters.SingleQuery, searchField string) ([]string, int, apierrors.StructuredError) {
	queryBuilder := loki.NewFlowQueryBuilderWithDefaults(cfg)
	if err := queryBuilder.Filters(filts); err != nil {
		return nil, http.StatusBadRequest, apierrors.NewLokiClientError(err)
	}

	query := queryBuilder.Build()
	resp, code, err := executeLokiQuery(query, lokiClient)
	if err != nil {
		return nil, code, err
	}
	hlog.Tracef("GetNames raw response: %s", resp)

	var qr model.QueryResponse
	err2 := json.Unmarshal(resp, &qr)
	if err2 != nil {
		hlog.WithError(err2).Errorf("cannot unmarshal, response was: %v", string(resp))
		return nil, http.StatusInternalServerError, apierrors.NewLokiClientError(errors.New("Failed to unmarshal Loki response: " + err2.Error()))
	}

	streams, ok := qr.Data.Result.(model.Streams)
	if !ok {
		return nil, http.StatusInternalServerError, apierrors.NewLokiClientError(errors.New("Loki returned unexpected type: " + string(qr.Data.ResultType)))
	}

	values := extractDistinctValues(searchField, streams)
	return values, http.StatusOK, nil
}

func (h *Handlers) getLokiStatus(r *http.Request) ([]byte, int, apierrors.StructuredError) {
	// Check if the status was provided by the operator
	if h.Cfg.Loki.Status != "" {
		return []byte(h.Cfg.Loki.Status), 200, nil
	}
	lokiClient := newLokiClient(&h.Cfg.Loki, r.Header, true, h.Cfg.ConsoleMode == config.Mock)
	baseURL := strings.TrimRight(h.Cfg.Loki.GetStatusURL(), "/")
	return executeLokiQuery(fmt.Sprintf("%s/%s", baseURL, "ready"), lokiClient)
}

func (h *Handlers) LokiReady() func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		if !h.Cfg.IsLokiEnabled() {
			err := apierrors.NewLokiDisabledError("Loki is disabled")
			err.Write(w, http.StatusBadRequest)
			return
		}
		resp, code, err := h.getLokiStatus(r)
		if err != nil {
			err.Write(w, code)
			return
		}
		status := string(resp)
		if strings.Contains(status, "ready") {
			code = http.StatusOK
			writeText(w, code, resp)
			return
		}
		notready := apierrors.NewLokiResponseError(code, fmt.Sprintf("Loki returned a non ready status: %s", status))
		notready.Write(w, code)
	}
}

func (h *Handlers) LokiMetrics() func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		if !h.Cfg.IsLokiEnabled() {
			err := apierrors.NewLokiDisabledError("Loki is disabled")
			err.Write(w, http.StatusBadRequest)
			return
		}
		if h.Cfg.Loki.Status != "" {
			err := apierrors.NewLokiClientError(errors.New("status URL endpoint is not available when using Loki operator; status is provided via LokiStack conditions"))
			err.Write(w, http.StatusBadRequest)
			return
		}
		lokiClient := newLokiClient(&h.Cfg.Loki, r.Header, true, h.Cfg.ConsoleMode == config.Mock)
		baseURL := strings.TrimRight(h.Cfg.Loki.GetStatusURL(), "/")

		resp, code, err := executeLokiQuery(fmt.Sprintf("%s/%s", baseURL, "metrics"), lokiClient)
		if err != nil {
			err.Write(w, code)
			return
		}

		writeText(w, code, resp)
	}
}

func (h *Handlers) LokiBuildInfos() func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		if !h.Cfg.IsLokiEnabled() {
			err := apierrors.NewLokiDisabledError("Loki is disabled")
			err.Write(w, http.StatusBadRequest)
			return
		}
		if h.Cfg.Loki.Status != "" {
			err := apierrors.NewLokiClientError(errors.New("status URL endpoint is not available when using Loki operator; status is provided via LokiStack conditions"))
			err.Write(w, http.StatusBadRequest)
			return
		}
		lokiClient := newLokiClient(&h.Cfg.Loki, r.Header, true, h.Cfg.ConsoleMode == config.Mock)
		baseURL := strings.TrimRight(h.Cfg.Loki.GetStatusURL(), "/")

		resp, code, err := executeLokiQuery(fmt.Sprintf("%s/%s", baseURL, "loki/api/v1/status/buildinfo"), lokiClient)
		if err != nil {
			err.Write(w, code)
			return
		}

		writeText(w, code, resp)
	}
}

func (h *Handlers) fetchLokiConfig(cl httpclient.Caller, output any) apierrors.StructuredError {
	if h.Cfg.Loki.Status != "" {
		return apierrors.NewLokiClientError(errors.New("status URL endpoint is not available when using Loki operator"))
	}

	baseURL := strings.TrimRight(h.Cfg.Loki.GetStatusURL(), "/")

	resp, _, err := executeLokiQuery(fmt.Sprintf("%s/%s", baseURL, "config"), cl)
	if err != nil {
		return err
	}

	cfg := make(map[string]interface{})
	err2 := yaml.Unmarshal(resp, &cfg)
	if err2 != nil {
		hlog.WithError(err2).Errorf("cannot unmarshal Loki config, response was: %v", string(resp))
		return apierrors.NewLokiClientError(errors.New("Failed to unmarshal Loki response: " + err2.Error()))
	}

	err2 = mapstructure.Decode(cfg, output)
	if err2 != nil {
		hlog.WithError(err2).Errorf("cannot decode Loki config, response was: %v", cfg)
		return apierrors.NewLokiClientError(fmt.Errorf("cannot decode Loki config: %w", err2))
	}

	return nil
}

func (h *Handlers) LokiLimits() func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		if !h.Cfg.IsLokiEnabled() {
			writeJSON(w, http.StatusNoContent, "Loki is disabled")
			return
		}
		lokiClient := newLokiClient(&h.Cfg.Loki, r.Header, true, h.Cfg.ConsoleMode == config.Mock)
		limits, err := h.fetchLokiLimits(lokiClient)
		if err != nil {
			hlog.WithError(err).Error("cannot fetch Loki limits")
			err.Write(w, http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, limits)
	}
}

func (h *Handlers) fetchLokiLimits(cl httpclient.Caller) (map[string]any, apierrors.StructuredError) {
	type LimitsConfig struct {
		Limits map[string]any `mapstructure:"limits_config"`
	}
	limitsCfg := LimitsConfig{}
	if err := h.fetchLokiConfig(cl, &limitsCfg); err != nil {
		return nil, err
	}
	return limitsCfg.Limits, nil
}

func (h *Handlers) fetchIngesterMaxChunkAge(cl httpclient.Caller) (time.Duration, apierrors.StructuredError) {
	type ChunkAgeConfig struct {
		Ingester struct {
			MaxChunkAge string `mapstructure:"max_chunk_age"`
		} `mapstructure:"ingester"`
	}
	ageCfg := ChunkAgeConfig{}
	if err := h.fetchLokiConfig(cl, &ageCfg); err != nil {
		return 0, err
	}

	if ageCfg.Ingester.MaxChunkAge == "" {
		// default max chunk age is 2h
		// see https://grafana.com/docs/loki/latest/configure/#ingester
		return 2 * time.Hour, nil
	}

	parsed, err := time.ParseDuration(ageCfg.Ingester.MaxChunkAge)
	if err != nil {
		return 0, apierrors.NewLokiClientError(fmt.Errorf("cannot parse max chunk age: %w", err))
	}

	return parsed, nil
}
