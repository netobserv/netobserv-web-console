package handler

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/netobserv/network-observability-console-plugin/pkg/backend/loki"
	"github.com/netobserv/network-observability-console-plugin/pkg/httpclient/httpclienttest"
)

func TestFetchLimits(t *testing.T) {
	lokiClientMock := new(httpclienttest.HTTPClientMock)
	lokiClientMock.On("Get", "http://loki/config").Return([]byte(`{"limits_config": {"somelimit": 42}}`), 200, nil)
	limits, err := h.fetchLokiLimits(loki.Client{Caller: lokiClientMock})
	require.NoError(t, err)

	assert.Equal(t, map[string]any{"somelimit": 42}, limits)
}

func TestFetchLimits_Absent(t *testing.T) {
	lokiClientMock := new(httpclienttest.HTTPClientMock)
	lokiClientMock.On("Get", "http://loki/config").Return([]byte(`{"any": "any"}`), 200, nil)
	limits, err := h.fetchLokiLimits(loki.Client{Caller: lokiClientMock})
	require.NoError(t, err)

	assert.Nil(t, limits)
}

func TestFetchMaxChunkAge(t *testing.T) {
	lokiClientMock := new(httpclienttest.HTTPClientMock)
	lokiClientMock.On("Get", "http://loki/config").Return([]byte(`{"ingester": {"max_chunk_age": "10h"}}`), 200, nil)
	mca, err := h.fetchIngesterMaxChunkAge(loki.Client{Caller: lokiClientMock})
	require.NoError(t, err)

	assert.Equal(t, 10*time.Hour, mca)
}

func TestFetchMaxChunkAge_Absent(t *testing.T) {
	lokiClientMock := new(httpclienttest.HTTPClientMock)
	lokiClientMock.On("Get", "http://loki/config").Return([]byte(`{"any": "any"}`), 200, nil)
	mca, err := h.fetchIngesterMaxChunkAge(loki.Client{Caller: lokiClientMock})
	require.NoError(t, err)

	// Default value
	assert.Equal(t, 2*time.Hour, mca)
}
