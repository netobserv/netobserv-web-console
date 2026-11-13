package handler

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/netobserv/network-observability-console-plugin/pkg/httpclient/httpclienttest"
	"github.com/netobserv/network-observability-console-plugin/pkg/loki"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestProxyRecordsRetainsAllClientsAndDeduplicates(t *testing.T) {
	a := `{"ProxyClientAddr":"192.0.2.1","ProxyClientPort":45000,"ProxyStartMs":1000,"ProxyEndMs":2000,"ProxyInstance":"router-1","ProxyRequestID":"router-1/42/1/1000"}`
	b := `{"ProxyClientAddr":"192.0.2.2","ProxyClientPort":45001,"ProxyStartMs":1100,"ProxyEndMs":1900,"ProxyInstance":"router-1","ProxyRequestID":"router-1/42/2/1100"}`
	data, err := json.Marshal(model.QueryResponse{Status: "success", Data: model.QueryResponseData{ResultType: model.ResultTypeStream, Result: model.Streams{{Entries: []model.Entry{{Line: a}, {Line: b}, {Line: a}}}}}})
	require.NoError(t, err)
	cl := new(httpclienttest.HTTPClientMock)
	cl.On("Get", mock.Anything).Return(data, http.StatusOK, nil)
	result, code, err := fetchProxyRecords(cl, loki.ProxyQuery{URL: "http://loki/query", Pending: true, SearchStartMs: 1000, SearchEndMs: 9000})
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, code)
	require.Len(t, result.Records, 2)
	require.True(t, result.Pending)
	require.False(t, result.LimitReached)
	require.Equal(t, "192.0.2.1", result.Records[0].ClientAddr)
	require.Equal(t, "192.0.2.2", result.Records[1].ClientAddr)
}

func TestProxyRecordsPropagatesLokiFailure(t *testing.T) {
	cl := new(httpclienttest.HTTPClientMock)
	cl.On("Get", mock.Anything).Return([]byte("forbidden"), http.StatusForbidden, nil)
	result, code, err := fetchProxyRecords(cl, loki.ProxyQuery{URL: "http://loki/query"})
	require.Error(t, err)
	require.Nil(t, result)
	require.Equal(t, http.StatusForbidden, code)
}
