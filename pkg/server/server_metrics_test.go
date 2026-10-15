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

func TestGetLabelValues_MultipleBackends(t *testing.T) {
	prometheusHandledLabels := []string{"SrcK8S_Namespace", "DstK8S_Namespace"}
	for _, tc := range []struct {
		name             string
		inputPath        string
		lokiMockCode     int
		promMockCode     int
		expectedFromLoki []string
		expectedFromProm []string
		expectedCode     int
	}{
		{
			// Prometheus handles namespace labels
			name:      "Fetch namespace values from Prometheus",
			inputPath: "/namespaces",
			expectedFromProm: []string{
				"/api/v1/label/SrcK8S_Namespace/values",
				"/api/v1/label/DstK8S_Namespace/values",
			},
		},
		{
			// Labels not handled by Prometheus
			name:      "Fetch UDN values from Loki",
			inputPath: "/udns",
			expectedFromLoki: []string{
				"/loki/api/v1/label/UDN/values",
			},
		},
		{
			name:         "Prometheus error",
			inputPath:    "/namespaces",
			promMockCode: 503,
			expectedCode: 503,
			expectedFromProm: []string{
				"/api/v1/label/SrcK8S_Namespace/values",
			},
		},
		{
			name:         "Loki error",
			inputPath:    "/udns",
			lokiMockCode: 503,
			expectedCode: 503,
			expectedFromLoki: []string{
				"/loki/api/v1/label/UDN/values",
			},
		},
		{
			// Prometheus auth error, should fallback
			name:         "Prometheus auth error",
			inputPath:    "/namespaces",
			promMockCode: 403,
			expectedFromProm: []string{
				"/api/v1/label/SrcK8S_Namespace/values",
			},
			expectedFromLoki: []string{
				"/loki/api/v1/label/SrcK8S_Namespace/values",
				"/loki/api/v1/label/DstK8S_Namespace/values",
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			// GIVEN a Loki service
			lokiMock := httpMock{}
			emptyResponse, _ := json.Marshal(model.LabelValuesResponse{
				Status: "",
				Data:   []string{},
			})
			lokiMock.MockHTTPResponse(tc.lokiMockCode, emptyResponse)
			lokiSvc := httptest.NewServer(&lokiMock)
			defer lokiSvc.Close()

			// AND a Prometheus service
			promMock := httpMock{}
			promMock.MockHTTPResponse(tc.promMockCode, emptyResponse)
			promSvc := httptest.NewServer(&promMock)
			defer promSvc.Close()

			// THAT is accessed behind the NOO console plugin backend
			authM := authMock{}
			authM.MockGranted()
			backendRoutes := setupRoutes(context.TODO(), &config.Config{
				Loki: config.Loki{URL: lokiSvc.URL},
				Prometheus: config.Prometheus{
					URL: promSvc.URL,
					Metrics: []config.MetricInfo{
						{
							Enabled: true,
							Name:    "foo",
							Labels:  prometheusHandledLabels,
						},
					}},
				Frontend: config.Frontend{},
			}, &authM)
			backendSvc := httptest.NewServer(backendRoutes)
			defer backendSvc.Close()

			// THEN the backend service returns the expected response
			res, err := backendSvc.Client().Get(backendSvc.URL + "/api/resources" + tc.inputPath)
			require.NoError(t, err)
			body, err := io.ReadAll(res.Body)
			require.NoError(t, err)
			if tc.expectedCode != 0 {
				require.Equalf(t, tc.expectedCode, res.StatusCode, "unexpected return %s: %s", res.Status, string(body))
			} else {
				require.Equalf(t, http.StatusOK, res.StatusCode, "unexpected return %s: %s", res.Status, string(body))
			}

			// AND each request has been properly forwarded to Prometheus or Loki
			lokiURLs := extractCallURLs(&lokiMock)
			assert.Equal(t, tc.expectedFromLoki, lokiURLs)
			promURLs := extractCallURLs(&promMock)
			assert.Equal(t, tc.expectedFromProm, promURLs)
		})
	}
}

func extractCallURLs(m *httpMock) []string {
	var urls []string
	for i := range m.Calls {
		u := m.Calls[i].Arguments[1].(*http.Request).URL
		u.RawQuery = ""
		urls = append(urls, u.String())
	}
	return urls
}
