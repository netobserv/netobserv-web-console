package server

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/handler/flowexport"
	"github.com/netobserv/network-observability-console-plugin/pkg/metricsexport"
)

func mockExportConfig() *config.Config {
	return &config.Config{
		ConsoleMode: config.Mock,
		Loki: config.Loki{
			URL: "http://mock-loki",
			Labels: []string{
				"SrcK8S_Namespace", "SrcK8S_OwnerName", "SrcK8S_Type",
				"DstK8S_Namespace", "DstK8S_OwnerName", "DstK8S_Type",
				"K8S_FlowLayer", "FlowDirection",
			},
		},
		Frontend: config.Frontend{},
	}
}

func TestExportEndpointsMockMode(t *testing.T) {
	t.Chdir("../..")

	authM := authMock{}
	authM.MockGranted()
	backendRoutes := setupRoutes(context.TODO(), mockExportConfig(), &authM)
	backendSvc := httptest.NewServer(backendRoutes)
	defer backendSvc.Close()

	client := backendSvc.Client()
	baseQuery := "recordType=flowLog&dataSource=auto&packetLoss=all&limit=100&timeRange=300"

	t.Run("flows CSV", func(t *testing.T) {
		res, err := client.Get(backendSvc.URL + "/api/loki/export?format=csv&" + baseQuery)
		require.NoError(t, err)
		defer res.Body.Close()
		body, err := io.ReadAll(res.Body)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, res.StatusCode)
		assert.Contains(t, res.Header.Get("Content-Disposition"), "netobserv_flows_")
		assert.Contains(t, res.Header.Get("Content-Type"), "text/csv")
		assert.Contains(t, string(body), "TimeFlowStartMs")
		assert.Contains(t, string(body), "SrcAddr")
	})

	t.Run("flows JSON", func(t *testing.T) {
		res, err := client.Get(backendSvc.URL + "/api/loki/export?format=json&" + baseQuery)
		require.NoError(t, err)
		defer res.Body.Close()
		body, err := io.ReadAll(res.Body)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, res.StatusCode)
		assert.Contains(t, res.Header.Get("Content-Disposition"), ".json")

		var report flowexport.FlowsExportReport
		require.NoError(t, json.Unmarshal(body, &report))
		assert.NotEmpty(t, report.ExportedAt)
		assert.NotEmpty(t, report.Flows)
		assert.NotEmpty(t, report.Flows[0].Fields)
	})

	metricsQuery := baseQuery + "&type=bytes&function=avg&aggregateBy=workload&includeTopologyEdges=true"

	t.Run("metrics JSON GET", func(t *testing.T) {
		res, err := client.Get(backendSvc.URL + "/api/flow/metrics/export?format=json&" + metricsQuery)
		require.NoError(t, err)
		defer res.Body.Close()
		body, err := io.ReadAll(res.Body)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, res.StatusCode)

		var report metricsexport.Report
		require.NoError(t, json.Unmarshal(body, &report))
		assert.NotEmpty(t, report.Metrics)
		assert.Equal(t, "workload", report.MetricScope)
		assert.Contains(t, res.Header.Get("Content-Disposition"), "netobserv_metrics_workload_")
	})

	t.Run("metrics CSV GET", func(t *testing.T) {
		res, err := client.Get(backendSvc.URL + "/api/flow/metrics/export?format=csv&" + metricsQuery)
		require.NoError(t, err)
		defer res.Body.Close()
		body, err := io.ReadAll(res.Body)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, res.StatusCode)
		assert.Contains(t, res.Header.Get("Content-Type"), "text/csv")
		assert.Contains(t, string(body), "metricGroup,series,timestamp")
	})

	t.Run("metrics JSON POST", func(t *testing.T) {
		payload := `{
			"format":"json",
			"includeTopologyEdges":true,
			"timeRange":300,
			"recordType":"flowLog",
			"dataSource":"auto",
			"packetLoss":"all",
			"limit":100,
			"metricScope":"workload",
			"queries":[{"type":"bytes","function":"avg","aggregateBy":"workload"}]
		}`
		res, err := client.Post(
			backendSvc.URL+"/api/flow/metrics/export",
			"application/json",
			strings.NewReader(payload),
		)
		require.NoError(t, err)
		defer res.Body.Close()
		body, err := io.ReadAll(res.Body)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, res.StatusCode)

		var report metricsexport.Report
		require.NoError(t, json.Unmarshal(body, &report))
		assert.NotEmpty(t, report.Metrics)
	})

	t.Run("metrics POST without per-query aggregateBy", func(t *testing.T) {
		payload := `{
			"format":"csv",
			"includeTopologyEdges":true,
			"timeRange":300,
			"recordType":"flowLog",
			"dataSource":"auto",
			"packetLoss":"all",
			"limit":100,
			"metricScope":"workload",
			"queries":[{"type":"Bytes","function":"rate"}]
		}`
		res, err := client.Post(
			backendSvc.URL+"/api/flow/metrics/export",
			"application/json",
			strings.NewReader(payload),
		)
		require.NoError(t, err)
		defer res.Body.Close()
		body, err := io.ReadAll(res.Body)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, res.StatusCode, string(body))
		assert.Contains(t, string(body), "metricGroup,series,timestamp")
	})
}

func TestGetTopologyReturnsEnrichedMetrics(t *testing.T) {
	t.Chdir("../..")

	authM := authMock{}
	authM.MockGranted()
	cfg := mockExportConfig()
	cfg.Frontend.Scopes = []config.Scope{
		{ID: "namespace", Name: "Namespace", Labels: []string{"SrcK8S_Namespace", "DstK8S_Namespace"}},
		{ID: "owner", Name: "Owner", Labels: []string{"SrcK8S_OwnerName", "DstK8S_OwnerName"}},
		{ID: "resource", Name: "Resource", Labels: []string{"SrcK8S_Name", "DstK8S_Name"}},
		{ID: "host", Name: "Node", Labels: []string{"SrcK8S_HostName", "DstK8S_HostName"}},
	}
	backendRoutes := setupRoutes(context.TODO(), cfg, &authM)
	backendSvc := httptest.NewServer(backendRoutes)
	defer backendSvc.Close()

	url := backendSvc.URL + "/api/flow/metrics?recordType=flowLog&dataSource=auto&packetLoss=all&limit=100&timeRange=300&type=Bytes&function=rate&aggregateBy=namespace"
	res, err := backendSvc.Client().Get(url)
	require.NoError(t, err)
	defer res.Body.Close()
	body, err := io.ReadAll(res.Body)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, res.StatusCode, string(body))

	var payload struct {
		ResultType    string `json:"resultType"`
		UnixTimestamp int64  `json:"unixTimestamp"`
		Result        []struct {
			Source struct {
				ID           string `json:"id"`
				ResourceKind string `json:"resourceKind"`
				Namespace    string `json:"namespace"`
			} `json:"source"`
			Destination struct {
				ID string `json:"id"`
			} `json:"destination"`
			Values [][]float64 `json:"values"`
			Stats  struct {
				Sum         float64   `json:"sum"`
				Avg         float64   `json:"avg"`
				Percentiles []float64 `json:"percentiles"`
			} `json:"stats"`
			Scope string `json:"scope"`
		} `json:"result"`
		Stats struct {
			DataSources []string `json:"dataSources"`
		} `json:"stats"`
	}
	require.NoError(t, json.Unmarshal(body, &payload))
	assert.Equal(t, "topologyMetrics", payload.ResultType)
	assert.NotZero(t, payload.UnixTimestamp)
	require.NotEmpty(t, payload.Result)
	assert.Equal(t, "namespace", payload.Result[0].Scope)
	assert.NotEmpty(t, payload.Result[0].Source.ID)
	assert.NotEmpty(t, payload.Result[0].Values)
	assert.Len(t, payload.Result[0].Stats.Percentiles, 2)
	assert.Contains(t, payload.Stats.DataSources, "mock")
}
