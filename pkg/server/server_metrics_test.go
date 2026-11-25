package server

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
)

type testCase struct {
	name                            string
	inputPath                       string
	lokiMockCode                    int
	promMockCode                    int
	expectedPathFromLoki            []string
	expectedContainedParamsFromLoki []string
	expectedPathFromProm            []string
	expectedContainedParamsFromProm []string
	expectedCode                    int
}

var (
	emptyLabelsResponse, _ = json.Marshal(model.LabelValuesResponse{
		Status: "",
		Data:   []string{},
	})
	emptyStreamResponse, _ = json.Marshal(model.QueryResponse{
		Status: "",
		Data: model.QueryResponseData{
			ResultType: model.ResultTypeStream,
			Result:     model.Streams{},
		},
	})
	emptyMatrixResponse, _ = json.Marshal(model.QueryResponse{
		Status: "",
		Data: model.QueryResponseData{
			ResultType: model.ResultTypeMatrix,
			Result:     model.Matrix{},
		},
	})
)

func TestMetrics_MultipleBackends(t *testing.T) {
	for _, tc := range []testCase{
		{
			// Prometheus handles namespace labels
			name:      "Fetch metrics from Prometheus",
			inputPath: "/flow/metrics?aggregateBy=SrcK8S_Namespace",
			expectedPathFromProm: []string{
				"/api/v1/query_range",
			},
			expectedContainedParamsFromProm: []string{
				"sum by(SrcK8S_Namespace)",
			},
		},
		{
			// Prometheus doesn't handle labels => Loki
			name:      "Fetch metrics from Loki",
			inputPath: "/flow/metrics?aggregateBy=SrcK8S_Name",
			expectedPathFromLoki: []string{
				// doubled for FlowDirection
				"/loki/api/v1/query_range",
				"/loki/api/v1/query_range",
			},
			expectedContainedParamsFromLoki: []string{
				// doubled for FlowDirection
				"by(SrcK8S_Name)",
				"by(SrcK8S_Name)",
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			metrics := []config.MetricInfo{{
				Enabled:    true,
				Name:       "foo",
				Labels:     []string{"SrcK8S_Namespace", "DstK8S_Namespace"},
				ValueField: "Bytes",
			}}
			backendSvc, lokiMock, promMock, cleanup := setupMocks(&tc, metrics, emptyMatrixResponse, emptyMatrixResponse)
			defer cleanup()

			// the backend service returns the expected response
			res, err := backendSvc.Client().Get(backendSvc.URL + "/api" + tc.inputPath)
			require.NoError(t, err)
			body, err := io.ReadAll(res.Body)
			require.NoError(t, err)
			if tc.expectedCode != 0 {
				require.Equalf(t, tc.expectedCode, res.StatusCode, "unexpected return %s: %s", res.Status, string(body))
			} else {
				require.Equalf(t, http.StatusOK, res.StatusCode, "unexpected return %s: %s", res.Status, string(body))
			}

			// each request has been properly forwarded to Prometheus or Loki
			assertCalls(t, lokiMock, tc.expectedPathFromLoki, tc.expectedContainedParamsFromLoki)
			assertCalls(t, promMock, tc.expectedPathFromProm, tc.expectedContainedParamsFromProm)
		})
	}
}

func TestMetrics_PromOnly(t *testing.T) {
	for _, tc := range []struct {
		name                            string
		inputPath                       string
		promMockCode                    int
		expectedPathFromProm            []string
		expectedContainedParamsFromProm []string
		expectedCode                    int
		expectedError                   string
	}{
		{
			// Prometheus handles namespace labels
			name:      "Fetch metrics from Prometheus",
			inputPath: "/flow/metrics?aggregateBy=SrcK8S_Namespace",
			expectedPathFromProm: []string{
				"/api/v1/query_range",
			},
			expectedContainedParamsFromProm: []string{
				"sum by(SrcK8S_Namespace)",
			},
		},
		{
			// Prometheus doesn't handle labels => report missing label
			name:          "Fetch metrics from Prometheus missing label",
			inputPath:     "/flow/metrics?aggregateBy=SrcK8S_Name",
			expectedCode:  http.StatusBadRequest,
			expectedError: `{"promDisabledMetrics":true,"candidates":["bar"]}`,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			// GIVEN a Prometheus service
			promMock := httpMock{}
			promMock.MockHTTPResponse(tc.promMockCode, emptyMatrixResponse)
			promSvc := httptest.NewServer(&promMock)
			defer promSvc.Close()

			// THAT is accessed behind the NOO console plugin backend
			authM := authMock{}
			authM.MockGranted()
			backendRoutes := setupRoutes(context.TODO(), &config.Config{
				Prometheus: config.Prometheus{
					URL: promSvc.URL,
					Metrics: []config.MetricInfo{{
						Enabled:    true,
						Name:       "foo",
						Labels:     []string{"SrcK8S_Namespace", "DstK8S_Namespace"},
						ValueField: "Bytes",
					}, {
						Enabled:    false,
						Name:       "bar",
						Labels:     []string{"SrcK8S_Name", "DstK8S_Name"},
						ValueField: "Bytes",
					}},
				},
				Frontend: config.Frontend{},
			}, &authM)
			backendSvc := httptest.NewServer(backendRoutes)
			defer backendSvc.Close()

			// the backend service returns the expected response
			res, err := backendSvc.Client().Get(backendSvc.URL + "/api" + tc.inputPath)
			require.NoError(t, err)
			body, err := io.ReadAll(res.Body)
			require.NoError(t, err)
			if tc.expectedCode != 0 {
				require.Equalf(t, tc.expectedCode, res.StatusCode, "unexpected return %s: %s", res.Status, string(body))
			} else {
				require.Equalf(t, http.StatusOK, res.StatusCode, "unexpected return %s: %s", res.Status, string(body))
			}
			if tc.expectedError != "" {
				assert.Equal(t, tc.expectedError, string(body))
			}

			// each request has been properly forwarded to Prometheus
			assertCalls(t, &promMock, tc.expectedPathFromProm, tc.expectedContainedParamsFromProm)
		})
	}
}

func TestGetLabelValues_MultipleBackends(t *testing.T) {
	for _, tc := range []testCase{
		{
			// Prometheus handles namespace labels
			name:      "Fetch namespace values from Prometheus",
			inputPath: "/namespaces",
			expectedPathFromProm: []string{
				"/api/v1/label/SrcK8S_Namespace/values",
				"/api/v1/label/DstK8S_Namespace/values",
			},
		},
		{
			// Labels not handled by Prometheus
			name:      "Fetch UDN values from Loki",
			inputPath: "/udns",
			expectedPathFromLoki: []string{
				"/loki/api/v1/label/UDN/values",
			},
		},
		{
			name:         "Prometheus error",
			inputPath:    "/namespaces",
			promMockCode: 503,
			expectedCode: 503,
			expectedPathFromProm: []string{
				"/api/v1/label/SrcK8S_Namespace/values",
			},
		},
		{
			name:         "Loki error",
			inputPath:    "/udns",
			lokiMockCode: 503,
			expectedCode: 503,
			expectedPathFromLoki: []string{
				"/loki/api/v1/label/UDN/values",
			},
		},
		{
			// Prometheus auth error, should fallback
			name:         "Prometheus auth error",
			inputPath:    "/namespaces",
			promMockCode: 403,
			expectedPathFromProm: []string{
				"/api/v1/label/SrcK8S_Namespace/values",
			},
			expectedPathFromLoki: []string{
				"/loki/api/v1/label/SrcK8S_Namespace/values",
				"/loki/api/v1/label/DstK8S_Namespace/values",
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			metrics := []config.MetricInfo{{
				Enabled: true,
				Name:    "foo",
				Labels:  []string{"SrcK8S_Namespace", "DstK8S_Namespace"},
			}}
			backendSvc, lokiMock, promMock, cleanup := setupMocks(&tc, metrics, emptyLabelsResponse, emptyLabelsResponse)
			defer cleanup()

			// the backend service returns the expected response
			res, err := backendSvc.Client().Get(backendSvc.URL + "/api/resources" + tc.inputPath)
			require.NoError(t, err)
			body, err := io.ReadAll(res.Body)
			require.NoError(t, err)
			if tc.expectedCode != 0 {
				require.Equalf(t, tc.expectedCode, res.StatusCode, "unexpected return %s: %s", res.Status, string(body))
			} else {
				require.Equalf(t, http.StatusOK, res.StatusCode, "unexpected return %s: %s", res.Status, string(body))
			}

			// each request has been properly forwarded to Prometheus or Loki
			assertCalls(t, lokiMock, tc.expectedPathFromLoki, tc.expectedContainedParamsFromLoki)
			assertCalls(t, promMock, tc.expectedPathFromProm, tc.expectedContainedParamsFromProm)
		})
	}
}

func TestMatchLabelValues_MultipleBackends(t *testing.T) {
	for _, tc := range []testCase{
		{
			// Prometheus handles namespace labels
			name:      "Fetch deployments values from Prometheus",
			inputPath: "/names?namespace=a&kind=Deployment",
			expectedPathFromProm: []string{
				"/api/v1/label/SrcK8S_OwnerName/values",
				"/api/v1/label/DstK8S_OwnerName/values",
			},
		},
		{
			// Labels not handled by Prometheus
			name:      "Fetch pods values from Loki",
			inputPath: "/names?namespace=a&kind=Pod",
			expectedPathFromLoki: []string{
				"/loki/api/v1/query_range",
				"/loki/api/v1/query_range",
			},
			expectedContainedParamsFromLoki: []string{
				`SrcK8S_Type":"Pod"`,
				`DstK8S_Type":"Pod"`,
			},
		},
		{
			name:         "Prometheus error",
			inputPath:    "/names?namespace=a&kind=Deployment",
			promMockCode: 503,
			expectedCode: 503,
			expectedPathFromProm: []string{
				"/api/v1/label/SrcK8S_OwnerName/values",
			},
		},
		{
			name:         "Loki error",
			inputPath:    "/names?namespace=a&kind=Pod",
			lokiMockCode: 503,
			expectedCode: 503,
			expectedPathFromLoki: []string{
				"/loki/api/v1/query_range",
			},
		},
		{
			// Prometheus auth error on label values, should not fallback
			name:         "Prometheus auth error",
			inputPath:    "/names?namespace=a&kind=Deployment",
			promMockCode: 403,
			expectedCode: 403,
			expectedPathFromProm: []string{
				"/api/v1/label/SrcK8S_OwnerName/values",
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			metrics := []config.MetricInfo{{
				Enabled: true,
				Name:    "foo",
				Labels:  []string{"SrcK8S_Namespace", "DstK8S_Namespace", "SrcK8S_Type", "DstK8S_Type", "SrcK8S_OwnerName", "DstK8S_OwnerName"},
			}}
			backendSvc, lokiMock, promMock, cleanup := setupMocks(&tc, metrics, emptyStreamResponse, emptyLabelsResponse)
			defer cleanup()

			// the backend service returns the expected response
			res, err := backendSvc.Client().Get(backendSvc.URL + "/api/resources" + tc.inputPath)
			require.NoError(t, err)
			body, err := io.ReadAll(res.Body)
			require.NoError(t, err)
			if tc.expectedCode != 0 {
				require.Equalf(t, tc.expectedCode, res.StatusCode, "unexpected return %s: %s", res.Status, string(body))
			} else {
				require.Equalf(t, http.StatusOK, res.StatusCode, "unexpected return %s: %s", res.Status, string(body))
			}

			// each request has been properly forwarded to Prometheus or Loki
			assertCalls(t, lokiMock, tc.expectedPathFromLoki, tc.expectedContainedParamsFromLoki)
			assertCalls(t, promMock, tc.expectedPathFromProm, tc.expectedContainedParamsFromProm)
		})
	}
}

func setupMocks(tc *testCase, metrics []config.MetricInfo, lokiResp, promResp []byte) (*httptest.Server, *httpMock, *httpMock, func()) {
	// GIVEN a Loki service
	lokiMock := httpMock{}
	lokiMock.MockHTTPResponse(tc.lokiMockCode, lokiResp)
	lokiSvc := httptest.NewServer(&lokiMock)

	// AND a Prometheus service
	promMock := httpMock{}
	promMock.MockHTTPResponse(tc.promMockCode, promResp)
	promSvc := httptest.NewServer(&promMock)

	// THAT is accessed behind the NOO console plugin backend
	authM := authMock{}
	authM.MockGranted()
	backendRoutes := setupRoutes(context.TODO(), &config.Config{
		Loki: config.Loki{URL: lokiSvc.URL},
		Prometheus: config.Prometheus{
			URL:     promSvc.URL,
			Metrics: metrics,
		},
		Frontend: config.Frontend{},
	}, &authM)
	backendSvc := httptest.NewServer(backendRoutes)
	return backendSvc, &lokiMock, &promMock, func() {
		lokiSvc.Close()
		promSvc.Close()
		backendSvc.Close()
	}
}

func assertCalls(t *testing.T, m *httpMock, expectedPaths, expectedContainedParams []string) {
	t.Helper()
	urls, params, err := extractCallURLs(m)
	require.NoError(t, err)
	assert.Equal(t, expectedPaths, urls)
	if expectedContainedParams != nil {
		assert.Len(t, params, len(expectedContainedParams))
		for i, params := range params {
			assert.Contains(t, params, expectedContainedParams[i])
		}
	}
}

func extractCallURLs(m *httpMock) ([]string, []string, error) {
	var paths, queries []string
	for i := range m.Calls {
		rq := m.Calls[i].Arguments[1].(*http.Request)
		paths = append(paths, rq.URL.Path)
		if rq.Method == "POST" && i < len(m.bodyPosts) {
			queries = append(queries, m.bodyPosts[i])
		} else {
			queries = append(queries, rq.URL.RawQuery)
		}
	}
	return paths, queries, nil
}
