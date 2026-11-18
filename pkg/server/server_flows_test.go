package server

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"regexp"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
)

var timeNowArg = regexp.MustCompile(`\${timeNow-(\d+)}`)
var timeNowEndArg = regexp.MustCompile(`\${timeNow\+1}`)

func TestLokiFiltering(t *testing.T) {
	testCases := []struct {
		name      string
		inputPath string
		// Either outputQueries or outputQueryParts should be defined
		// Use outputQueries when multiple queries are expected (parallel queries for match any)
		// Use outputQueryParts when single query is expected but the filters order isn't predictable
		outputQueries    []string
		outputQueryParts []string
	}{{
		name:      "Simple line filter equals",
		inputPath: "?filters=SrcK8S_Name=test-pod",
		outputQueries: []string{
			"?query={app=\"netobserv-flowcollector\"}|~`SrcK8S_Name\":\"test-pod\"`",
		},
	}, {
		name:      "AND line filter contains",
		inputPath: "?filters=" + url.QueryEscape("Proto=6&SrcK8S_Name~test"),
		outputQueryParts: []string{
			"?query={app=\"netobserv-flowcollector\"}",
			"|~`Proto\":6[,}]`",
			"|~`SrcK8S_Name\":\"(?i)[^\"]*test.*\"`",
		},
	}, {
		name:      "OR line filter equals",
		inputPath: "?filters=" + url.QueryEscape("Proto=6|SrcK8S_Name=test"),
		outputQueries: []string{
			"?query={app=\"netobserv-flowcollector\"}|~`Proto\":6[,}]`",
			"?query={app=\"netobserv-flowcollector\"}|~`SrcK8S_Name\":\"test\"`",
		},
	}, {
		name:      "Simple label filter equals",
		inputPath: "?filters=" + url.QueryEscape("SrcK8S_Namespace=test-namespace"),
		outputQueries: []string{
			`?query={app="netobserv-flowcollector",SrcK8S_Namespace="test-namespace"}`,
		},
	}, {
		name:      "OR line filter same key contains",
		inputPath: "?filters=" + url.QueryEscape("SrcK8S_Name~name1,name2"),
		outputQueries: []string{
			"?query={app=\"netobserv-flowcollector\"}|~`SrcK8S_Name\":\"(?i)[^\"]*name1.*\"|SrcK8S_Name\":\"(?i)[^\"]*name2.*\"`",
		},
	}, {
		name:      "NOT line filter same key contains",
		inputPath: "?filters=" + url.QueryEscape(`SrcK8S_Name!~"name1","name2"`),
		outputQueries: []string{
			"?query={app=\"netobserv-flowcollector\"}|~`\"SrcK8S_Name\"`!~`SrcK8S_Name\":\"name1\"`!~`SrcK8S_Name\":\"name2\"`",
		},
	}, {
		name:      "OR label filter same key equals",
		inputPath: "?filters=" + url.QueryEscape("SrcK8S_Namespace=ns1,ns2"),
		outputQueries: []string{
			`?query={app="netobserv-flowcollector",SrcK8S_Namespace=~"ns1|ns2"}`,
		},
	}, {
		name:      "Several filters",
		inputPath: "?filters=" + url.QueryEscape("SrcPort=8080&SrcAddr=10.128.0.1&SrcK8S_Namespace=default"),
		outputQueries: []string{
			"?query={app=\"netobserv-flowcollector\",SrcK8S_Namespace=\"default\"}|~`SrcPort\":8080[,}]`|json|SrcAddr=ip(\"10.128.0.1\")",
		},
	}, {
		name:      "AND IP filters",
		inputPath: "?filters=" + url.QueryEscape("SrcAddr=10.128.0.1&DstAddr=10.128.0.2"),
		outputQueryParts: []string{
			"?query={app=\"netobserv-flowcollector\"}|json",
			"|SrcAddr=ip(\"10.128.0.1\")",
			"|DstAddr=ip(\"10.128.0.2\")",
		},
	}, {
		name:      "OR IP filters",
		inputPath: "?filters=" + url.QueryEscape("SrcAddr=10.128.0.1,10.128.0.2"),
		outputQueries: []string{
			"?query={app=\"netobserv-flowcollector\"}|json|SrcAddr=ip(\"10.128.0.1\")+or+SrcAddr=ip(\"10.128.0.2\")",
		},
	}, {
		name:      "NOT IP filters",
		inputPath: "?filters=" + url.QueryEscape(`SrcAddr!=10.128.0.1,10.128.0.2`),
		outputQueries: []string{
			"?query={app=\"netobserv-flowcollector\"}|json|SrcAddr!=ip(\"10.128.0.1\")|SrcAddr!=ip(\"10.128.0.2\")",
		},
	}, {
		name:      "Several OR filters",
		inputPath: "?filters=" + url.QueryEscape("SrcPort=8080|SrcAddr=10.128.0.1|SrcK8S_Namespace=default"),
		outputQueries: []string{
			"?query={app=\"netobserv-flowcollector\",SrcK8S_Namespace=\"default\"}",
			"?query={app=\"netobserv-flowcollector\"}|json|SrcAddr=ip(\"10.128.0.1\")",
			"?query={app=\"netobserv-flowcollector\"}|~`SrcPort\":8080[,}]`",
		},
	}, {
		name:          "Start time",
		inputPath:     "?startTime=1640991600",
		outputQueries: []string{`?query={app="netobserv-flowcollector"}&start=1640991600`},
	}, {
		name:          "End time",
		inputPath:     "?endTime=1641160800",
		outputQueries: []string{`?query={app="netobserv-flowcollector"}&end=1641160801`},
	}, {
		name:          "Start and end time",
		inputPath:     "?startTime=1640991600&endTime=1641160800",
		outputQueries: []string{`?query={app="netobserv-flowcollector"}&start=1640991600&end=1641160801`},
	}, {
		name:          "Time range",
		inputPath:     "?timeRange=300000",
		outputQueries: []string{`?query={app="netobserv-flowcollector"}&start=${timeNow-300000}&end=${timeNow+1}`},
	}, {
		name:      "Strict label match",
		inputPath: "?filters=" + url.QueryEscape("SrcK8S_Namespace~\"exact-namespace\""),
		outputQueries: []string{
			`?query={app="netobserv-flowcollector",SrcK8S_Namespace="exact-namespace"}`,
		},
	}, {
		name:      "Strict line match",
		inputPath: "?filters=" + url.QueryEscape("SrcK8S_Name~\"exact-pod\""),
		outputQueries: []string{
			"?query={app=\"netobserv-flowcollector\"}|~`SrcK8S_Name\":\"exact-pod\"`",
		},
	}, {
		name:      "Common src+dst name with AND",
		inputPath: "?filters=" + url.QueryEscape("Port=8080&K8S_Name=test"),
		outputQueryParts: []string{
			"?query={app=\"netobserv-flowcollector\"}",
			"|~`Port\":8080[,}]`",
			"|~`K8S_Name\":\"test\"`",
		},
	}, {
		name:      "Common src+dst name with OR",
		inputPath: "?filters=" + url.QueryEscape("Port=8080|K8S_Name=test"),
		outputQueries: []string{
			"?query={app=\"netobserv-flowcollector\"}|~`K8S_Name\":\"test\"`",
			"?query={app=\"netobserv-flowcollector\"}|~`Port\":8080[,}]`",
		},
	}, {
		name:      "Common src+dst port with AND and OR",
		inputPath: "?filters=" + url.QueryEscape("Port=8080&SrcK8S_Namespace=test|Port=8080&DstK8S_Namespace=test"),
		outputQueries: []string{
			"?query={app=\"netobserv-flowcollector\",SrcK8S_Namespace=\"test\"}|~`Port\":8080[,}]`",
			"?query={app=\"netobserv-flowcollector\",DstK8S_Namespace=\"test\"}|~`Port\":8080[,}]`",
		},
	}, {
		name:      "Common src+dst port with multiple OR",
		inputPath: "?filters=" + url.QueryEscape("Port=8080|SrcK8S_Namespace=test|DstK8S_Namespace=test"),
		outputQueries: []string{
			"?query={app=\"netobserv-flowcollector\",SrcK8S_Namespace=\"test\"}",
			"?query={app=\"netobserv-flowcollector\",DstK8S_Namespace=\"test\"}",
			"?query={app=\"netobserv-flowcollector\"}|~`Port\":8080[,}]`",
		},
	}, {
		name:      "Empty label",
		inputPath: "?filters=" + url.QueryEscape(`SrcK8S_Namespace=""&DstPort=70`),
		outputQueries: []string{
			"?query={app=\"netobserv-flowcollector\",SrcK8S_Namespace=\"\"}|~`DstPort\":70[,}]`",
		},
	}, {
		name:      "Empty line filter",
		inputPath: "?filters=" + url.QueryEscape(`SrcK8S_Name=""&DstPort=70`),
		outputQueries: []string{
			"?query={app=\"netobserv-flowcollector\"}|~`DstPort\":70[,}]`|json|SrcK8S_Name=\"\"",
		},
	}, {
		name:      "Empty line filter OR same key",
		inputPath: "?filters=" + url.QueryEscape(`SrcK8S_Name="",foo&DstK8S_Name="hello"`),
		outputQueries: []string{
			"?query={app=\"netobserv-flowcollector\"}|~`DstK8S_Name\":\"hello\"`|json|SrcK8S_Name=\"\"+or+SrcK8S_Name=\"foo\"",
		},
	}, {
		name:      "Empty label ORed",
		inputPath: "?filters=" + url.QueryEscape(`SrcK8S_Namespace=""|DstPort=70`),
		outputQueries: []string{
			"?query={app=\"netobserv-flowcollector\",SrcK8S_Namespace=\"\"}",
			"?query={app=\"netobserv-flowcollector\"}|~`DstPort\":70[,}]`",
		},
	}, {
		name:      "Empty line filter ORed",
		inputPath: "?filters=" + url.QueryEscape(`SrcK8S_Name=""|DstPort=70`),
		outputQueries: []string{
			"?query={app=\"netobserv-flowcollector\"}|~`DstPort\":70[,}]`",
			"?query={app=\"netobserv-flowcollector\"}|json|SrcK8S_Name=\"\"",
		},
	}, {
		name:      "Empty line filter ORed (bis)",
		inputPath: "?filters=" + url.QueryEscape(`SrcK8S_Name="",foo|DstK8S_Name="hello"`),
		outputQueries: []string{
			"?query={app=\"netobserv-flowcollector\"}|~`DstK8S_Name\":\"hello\"`",
			"?query={app=\"netobserv-flowcollector\"}|json|SrcK8S_Name=\"\"+or+SrcK8S_Name=\"foo\"",
		},
	}, {
		name:      "Empty line filter ORed (ter)",
		inputPath: "?filters=" + url.QueryEscape(`SrcK8S_Type="","Pod"`),
		outputQueries: []string{
			"?query={app=\"netobserv-flowcollector\"}|json|SrcK8S_Type=\"\"+or+SrcK8S_Type=\"Pod\"",
		},
	}, {
		name:      "Double empty line filters",
		inputPath: "?filters=" + url.QueryEscape(`SrcAddr=""|DstAddr=""`),
		outputQueries: []string{
			"?query={app=\"netobserv-flowcollector\"}|json|DstAddr=\"\"",
			"?query={app=\"netobserv-flowcollector\"}|json|SrcAddr=\"\"",
		},
	}, {
		name:      "Empty line port filter",
		inputPath: "?filters=" + url.QueryEscape(`SrcPort=""`),
		outputQueries: []string{
			"?query={app=\"netobserv-flowcollector\"}|json|SrcPort=\"\"",
		},
	}}

	numberQueriesExpected := 0
	for _, tc := range testCases {
		if len(tc.outputQueries) > 0 {
			numberQueriesExpected += len(tc.outputQueries)
		} else {
			numberQueriesExpected++
		}
	}

	// GIVEN a Loki service
	lokiMock := httpMock{}
	authM := authMock{}
	authM.MockGranted()
	emptyResponse, _ := json.Marshal(model.QueryResponse{
		Status: "",
		Data: model.QueryResponseData{
			ResultType: model.ResultTypeStream,
			Result:     model.Streams{},
		},
	})
	lokiMock.On("ServeHTTP", mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
		_, _ = args.Get(0).(http.ResponseWriter).Write(emptyResponse)
	}).Times(numberQueriesExpected)
	lokiSvc := httptest.NewServer(&lokiMock)
	defer lokiSvc.Close()

	// THAT is accessed behind the NOO console plugin backend
	backendRoutes := setupRoutes(context.TODO(), &config.Config{
		Loki: config.Loki{
			URL:    lokiSvc.URL,
			Labels: []string{"SrcK8S_Namespace", "SrcK8S_OwnerName", "DstK8S_Namespace", "DstK8S_OwnerName", "FlowDirection"},
			FieldsType: map[string]string{
				"Proto":   "number",
				"SrcPort": "number",
				"DstPort": "number",
			},
			FieldsFormat: map[string]string{
				"SrcAddr": "IP",
				"DstAddr": "IP",
			},
		},
		Frontend: config.Frontend{},
	}, &authM)
	backendSvc := httptest.NewServer(backendRoutes)
	defer backendSvc.Close()

	nCall := 0

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// WHEN the Loki flows endpoint is queried in the backend
			now := time.Now().Unix()
			res, err := backendSvc.Client().Get(backendSvc.URL + "/api/loki/flow/records" + tc.inputPath)
			require.NoError(t, err)
			body, err := io.ReadAll(res.Body)
			require.NoError(t, err)
			require.Equalf(t, http.StatusOK, res.StatusCode, "unexpected return %s: %s", res.Status, string(body))

			// THEN each filter argument has been properly forwarded to Loki
			var expectedURLs []string
			for _, out := range tc.outputQueries {
				expectedURLs = append(expectedURLs, "/loki/api/v1/query_range"+out)
			}

			if len(expectedURLs) > 0 {
				expectedWithTime := injectTime(t, expectedURLs, now)
				for range expectedURLs {
					requestURL := lokiMock.Calls[nCall].Arguments[1].(*http.Request).URL.String()
					assert.Contains(t, expectedWithTime, requestURL)
					nCall++
				}
			} else {
				for i, part := range tc.outputQueryParts {
					requestURL := lokiMock.Calls[nCall].Arguments[1].(*http.Request).URL.String()
					if i == 0 {
						// First part always includes URL
						part = "/loki/api/v1/query_range" + part
					}
					assert.Contains(t, requestURL, part)
				}
				nCall++
			}
		})
	}
}

func injectTime(t *testing.T, queries []string, now int64) []string {
	var modifiedQueries []string
	for _, query := range queries {
		if subMatches := timeNowArg.FindStringSubmatch(query); len(subMatches) > 0 {
			// replace ${timeNow-<seconds>} by time.Now()-<seconds> for arguments where the
			// value is dynamically calculated via the non-mockable time.Now() function
			timeNowDiff, err := strconv.ParseInt(subMatches[1], 10, 64)
			require.NoError(t, err)
			// giving 1-second room to the start time to avoid flaky tests
			expectedStart := int(now - timeNowDiff)
			for skew := -1; skew <= 1; skew++ {
				candidate := timeNowArg.ReplaceAllString(query, strconv.Itoa(expectedStart+skew))
				candidate = timeNowEndArg.ReplaceAllString(candidate, strconv.Itoa(int(now)+skew+1))
				modifiedQueries = append(modifiedQueries, candidate)
			}
		} else {
			modifiedQueries = append(modifiedQueries, query)
		}
	}
	return modifiedQueries
}
