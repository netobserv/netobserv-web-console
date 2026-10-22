package handler

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/mitchellh/mapstructure"
	"github.com/sirupsen/logrus"
	"gopkg.in/yaml.v3"

	"github.com/netobserv/network-observability-console-plugin/pkg/backend/loki"
	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/handler/apierrors"
)

var hlog = logrus.WithField("module", "handler")

func (h *Handlers) getLokiStatus(r *http.Request) ([]byte, int, apierrors.StructuredError) {
	// Check if the status was provided by the operator
	if h.Cfg.Loki.Status != "" {
		return []byte(h.Cfg.Loki.Status), 200, nil
	}
	lokiClient := loki.NewClient(&h.Cfg.Loki, r.Header, true, h.Cfg.ConsoleMode == config.Mock)
	baseURL := strings.TrimRight(h.Cfg.Loki.GetStatusURL(), "/")
	return lokiClient.RawFetch(fmt.Sprintf("%s/%s", baseURL, "ready"))
}

func (h *Handlers) LokiReady() func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		if !h.Cfg.IsLokiEnabled() {
			err := apierrors.NewDatasourceDisabledError("Loki is disabled")
			apierrors.Write(w, http.StatusBadRequest, err)
			return
		}
		resp, code, err := h.getLokiStatus(r)
		if err != nil {
			apierrors.Write(w, code, err)
			return
		}
		status := string(resp)
		if strings.Contains(status, "ready") {
			code = http.StatusOK
			writeText(w, code, resp)
			return
		}
		apierrors.Write(w, code, apierrors.NewLokiResponseError(code, fmt.Sprintf("Loki returned a non ready status: %s", status)))
	}
}

func (h *Handlers) LokiMetrics() func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		if !h.Cfg.IsLokiEnabled() {
			apierrors.Write(w, http.StatusBadRequest, apierrors.NewDatasourceDisabledError("Loki is disabled"))
			return
		}
		if h.Cfg.Loki.Status != "" {
			apierrors.Write(w, http.StatusBadRequest,
				apierrors.NewLokiClientError(
					errors.New("status URL endpoint is not available when using Loki operator; status is provided via LokiStack conditions")))
			return
		}
		lokiClient := loki.NewClient(&h.Cfg.Loki, r.Header, true, h.Cfg.ConsoleMode == config.Mock)
		baseURL := strings.TrimRight(h.Cfg.Loki.GetStatusURL(), "/")

		resp, code, err := lokiClient.RawFetch(fmt.Sprintf("%s/%s", baseURL, "metrics"))
		if err != nil {
			apierrors.Write(w, code, err)
			return
		}

		writeText(w, code, resp)
	}
}

func (h *Handlers) LokiBuildInfos() func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		if !h.Cfg.IsLokiEnabled() {
			apierrors.Write(w, http.StatusBadRequest, apierrors.NewDatasourceDisabledError("Loki is disabled"))
			return
		}
		if h.Cfg.Loki.Status != "" {
			apierrors.Write(
				w,
				http.StatusBadRequest,
				apierrors.NewLokiClientError(
					errors.New("status URL endpoint is not available when using Loki operator; status is provided via LokiStack conditions")),
			)
			return
		}
		lokiClient := loki.NewClient(&h.Cfg.Loki, r.Header, true, h.Cfg.ConsoleMode == config.Mock)
		baseURL := strings.TrimRight(h.Cfg.Loki.GetStatusURL(), "/")

		resp, code, err := lokiClient.RawFetch(fmt.Sprintf("%s/%s", baseURL, "loki/api/v1/status/buildinfo"))
		if err != nil {
			apierrors.Write(w, code, err)
			return
		}

		writeText(w, code, resp)
	}
}

func (h *Handlers) fetchLokiConfig(cl loki.Client, output any) apierrors.StructuredError {
	if h.Cfg.Loki.Status != "" {
		return apierrors.NewLokiClientError(errors.New("status URL endpoint is not available when using Loki operator"))
	}

	baseURL := strings.TrimRight(h.Cfg.Loki.GetStatusURL(), "/")

	resp, _, err := cl.RawFetch(fmt.Sprintf("%s/%s", baseURL, "config"))
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
		lokiClient := loki.NewClient(&h.Cfg.Loki, r.Header, true, h.Cfg.ConsoleMode == config.Mock)
		limits, err := h.fetchLokiLimits(lokiClient)
		if err != nil {
			hlog.WithError(err).Error("cannot fetch Loki limits")
			apierrors.Write(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, http.StatusOK, limits)
	}
}

func (h *Handlers) fetchLokiLimits(cl loki.Client) (map[string]any, apierrors.StructuredError) {
	type LimitsConfig struct {
		Limits map[string]any `mapstructure:"limits_config"`
	}
	limitsCfg := LimitsConfig{}
	if err := h.fetchLokiConfig(cl, &limitsCfg); err != nil {
		return nil, err
	}
	return limitsCfg.Limits, nil
}

func (h *Handlers) fetchIngesterMaxChunkAge(cl loki.Client) (time.Duration, apierrors.StructuredError) {
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
