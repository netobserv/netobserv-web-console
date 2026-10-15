package handler

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/netobserv/network-observability-console-plugin/pkg/backend"
	"github.com/netobserv/network-observability-console-plugin/pkg/backend/backends"
	"github.com/netobserv/network-observability-console-plugin/pkg/backend/loki"
	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/httpclient"
	"github.com/netobserv/network-observability-console-plugin/pkg/httpclient/httpclienttest"
)

var cfg = config.Config{
	Loki: config.Loki{
		URL:    "http://loki",
		Labels: []string{"_RecordType", "SrcK8S_Namespace", "DstK8S_Namespace", "SrcK8S_OwnerName", "DstK8S_OwnerName"},
	},
	Frontend: config.Frontend{
		ConsoleMode: config.Mock,
	},
}
var h = Handlers{Cfg: &cfg, Backends: backends.NewOrchestrator(&cfg)}

const testLokiBaseURL = "http://loki/loki/api/v1/"

func TestGetSourceOwnerNames(t *testing.T) {
	lokiClientMock := new(httpclienttest.HTTPClientMock)
	loki.MockProvider = func() httpclient.Caller { return lokiClientMock }
	lokiClientMock.SpyURL(func(url string) {
		assert.Equal(
			t,
			testLokiBaseURL+"query_range?query={app=\"netobserv-flowcollector\",_RecordType=\"flowLog\",SrcK8S_Namespace=\"default\"}|~`SrcK8S_OwnerType\":\"Deployment\"`",
			url,
		)
	})
	_, _, _ = h.getNamesForPrefix(context.Background(), &backend.QueryContext{}, "Src", "Deployment", "default")

	lokiClientMock.AssertNumberOfCalls(t, "Get", 1)
}

func TestGetDestPodNames(t *testing.T) {
	lokiClientMock := new(httpclienttest.HTTPClientMock)
	loki.MockProvider = func() httpclient.Caller { return lokiClientMock }
	lokiClientMock.SpyURL(func(url string) {
		assert.Equal(
			t,
			testLokiBaseURL+"query_range?query={app=\"netobserv-flowcollector\",_RecordType=\"flowLog\",DstK8S_Namespace=\"default\"}|~`DstK8S_Type\":\"Pod\"`",
			url,
		)
	})
	_, _, _ = h.getNamesForPrefix(context.Background(), &backend.QueryContext{}, "Dst", "Pod", "default")

	lokiClientMock.AssertNumberOfCalls(t, "Get", 1)
}

func TestGetSourceNodeNames(t *testing.T) {
	lokiClientMock := new(httpclienttest.HTTPClientMock)
	loki.MockProvider = func() httpclient.Caller { return lokiClientMock }
	lokiClientMock.SpyURL(func(url string) {
		assert.Equal(
			t,
			testLokiBaseURL+"query_range?query={app=\"netobserv-flowcollector\",_RecordType=\"flowLog\"}|~`SrcK8S_Type\":\"Node\"`",
			url,
		)
	})
	_, _, _ = h.getNamesForPrefix(context.Background(), &backend.QueryContext{}, "Src", "Node", "")

	lokiClientMock.AssertNumberOfCalls(t, "Get", 1)
}

func TestGetLabelValues(t *testing.T) {
	lokiClientMock := new(httpclienttest.HTTPClientMock)
	loki.MockProvider = func() httpclient.Caller { return lokiClientMock }
	lokiClientMock.SpyURL(func(url string) {
		assert.Equal(
			t,
			testLokiBaseURL+"label/DstK8S_Namespace/values",
			url,
		)
	})
	_, _, _ = h.Backends.GetLabelValues(context.Background(), &backend.QueryContext{}, "DstK8S_Namespace")

	lokiClientMock.AssertNumberOfCalls(t, "Get", 1)
}
