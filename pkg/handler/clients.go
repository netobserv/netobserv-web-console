package handler

import (
	"context"
	"fmt"
	"net/http"
	"sync"

	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/handler/apierrors"
	"github.com/netobserv/network-observability-console-plugin/pkg/httpclient"
	"github.com/netobserv/network-observability-console-plugin/pkg/loki"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
	"github.com/netobserv/network-observability-console-plugin/pkg/prometheus"
	"github.com/prometheus/client_golang/api"
)

type clients struct {
	loki      httpclient.Caller
	promAdmin api.Client
	promDev   api.Client
}

func newClients(cfg *config.Config, requestHeader http.Header, useLokiStatus bool, namespace string) (clients, apierrors.StructuredError) {
	lokiClients := newLokiClients(cfg, requestHeader, useLokiStatus)
	promClients, err := newPromClients(cfg, requestHeader, namespace)
	return clients{loki: lokiClients.loki, promAdmin: promClients.promAdmin, promDev: promClients.promDev}, err
}

func newPromClients(cfg *config.Config, requestHeader http.Header, namespace string) (clients, apierrors.StructuredError) {
	var promAdminClient api.Client
	var promDevClient api.Client
	var err error

	if cfg.IsPromEnabled() {
		promAdminClient, err = prometheus.NewAdminClient(&cfg.Prometheus, requestHeader)
		if err != nil {
			return clients{}, apierrors.NewPromClientError(err)
		}
		promDevClient, err = prometheus.NewDevClient(&cfg.Prometheus, requestHeader, namespace)
		if err != nil {
			return clients{}, apierrors.NewPromClientError(err)
		}
	}
	return clients{promAdmin: promAdminClient, promDev: promDevClient}, nil
}

func newLokiClients(cfg *config.Config, requestHeader http.Header, useLokiStatus bool) clients {
	var lokiClient httpclient.Caller
	if cfg.IsLokiEnabled() {
		lokiClient = newLokiClient(&cfg.Loki, requestHeader, useLokiStatus, cfg.ConsoleMode == config.Mock)
	}
	return clients{loki: lokiClient}
}

func (c *clients) fetchLokiSingle(logQL string, merger loki.Merger) (int, apierrors.StructuredError) {
	qr, code, err := fetchLogQL(logQL, c.loki)
	if err != nil {
		return code, err
	}
	if _, err := merger.Add(qr.Data); err != nil {
		return http.StatusInternalServerError, apierrors.NewLokiClientError(err)
	}
	return code, nil
}

func (c *clients) getPromClient(isDev bool) api.Client {
	if isDev {
		return c.promDev
	}
	return c.promAdmin
}

func (c *clients) fetchPrometheusSingle(ctx context.Context, promQL *prometheus.Query, merger loki.Merger, client api.Client) (int, apierrors.StructuredError) {
	qr, code, err := prometheus.QueryMatrix(ctx, client, promQL)
	if err != nil {
		return code, apierrors.NewPromClientError(err)
	}
	if _, err := merger.Add(qr.Data); err != nil {
		return http.StatusInternalServerError, apierrors.NewPromClientError(err)
	}
	return code, nil
}

func (c *clients) fetchSingle(ctx context.Context, logQL string, promQL *prometheus.Query, merger loki.Merger, isDev bool) (int, apierrors.StructuredError) {
	if promQL != nil {
		client := c.getPromClient(isDev)
		if client == nil {
			return http.StatusBadRequest, apierrors.NewPromDisabledError(fmt.Sprintf("cannot execute the following Prometheus query: Prometheus is disabled: %v", promQL.PromQL))
		}
		return c.fetchPrometheusSingle(ctx, promQL, merger, client)
	}
	if c.loki == nil {
		return http.StatusBadRequest, apierrors.NewLokiDisabledError(fmt.Sprintf("cannot execute the following Loki query: Loki is disabled: %v", logQL))
	}
	return c.fetchLokiSingle(logQL, merger)
}

func (c *clients) fetchParallel(ctx context.Context, logQL []string, promQL []*prometheus.Query, merger loki.Merger, isDev bool) (int, apierrors.StructuredError) {
	type errorWithCode struct {
		err  apierrors.StructuredError
		code int
	}

	if c.loki == nil && len(logQL) > 0 {
		hlog.Errorf("Cannot execute the following Loki queries: Loki is disabled: %v", logQL)
		logQL = nil
	}

	promClient := c.getPromClient(isDev)
	if promClient == nil && len(promQL) > 0 {
		hlog.Errorf("Cannot execute the following Prometheus queries: Prometheus is disabled: %v", promQL[0].PromQL)
		promQL = nil
	}

	// Run queries in parallel, then aggregate them
	size := len(logQL) + len(promQL)
	if size == 0 {
		return http.StatusBadRequest, &apierrors.GenericError{Message: "no queries could be executed"}
	}

	resChan := make(chan model.QueryResponse, size)
	errChan := make(chan errorWithCode, size)
	var wg sync.WaitGroup
	wg.Add(size)

	for _, q := range logQL {
		go func(query string) {
			defer wg.Done()
			qr, code, err := fetchLogQL(query, c.loki)
			if err != nil {
				errChan <- errorWithCode{err: apierrors.NewLokiClientError(err), code: code}
			} else {
				resChan <- qr
			}
		}(q)
	}

	for _, q := range promQL {
		go func(query *prometheus.Query) {
			defer wg.Done()
			qr, code, err := prometheus.QueryMatrix(ctx, promClient, query)
			if err != nil {
				errChan <- errorWithCode{err: apierrors.NewPromClientError(err), code: code}
			} else {
				resChan <- qr
			}
		}(q)
	}

	wg.Wait()
	close(resChan)
	close(errChan)

	for errWithCode := range errChan {
		return errWithCode.code, errWithCode.err
	}

	// Aggregate results
	for r := range resChan {
		if _, err := merger.Add(r.Data); err != nil {
			return http.StatusInternalServerError, apierrors.NewLokiClientError(err)
		}
	}
	return http.StatusOK, nil
}
