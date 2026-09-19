package metricsparse

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
	pmodel "github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testScopes() []config.Scope {
	return []config.Scope{
		{ID: "cluster", Name: "Cluster", Labels: []string{"K8S_ClusterName"}},
		{ID: "zone", Name: "Zone", Labels: []string{"SrcK8S_Zone", "DstK8S_Zone"}},
		{ID: "host", Name: "Node", Labels: []string{"SrcK8S_HostName", "DstK8S_HostName"}},
		{ID: "namespace", Name: "Namespace", Labels: []string{"SrcK8S_Namespace", "DstK8S_Namespace"}},
		{ID: "owner", Name: "Owner", Labels: []string{"SrcK8S_OwnerName", "DstK8S_OwnerName"}},
		{ID: "resource", Name: "Resource", Labels: []string{"SrcK8S_Name", "DstK8S_Name"}},
		{ID: "addr", Name: "IP", Labels: []string{"SrcAddr", "DstAddr"}},
	}
}

func loadMatrix(t *testing.T, path string) model.Matrix {
	t.Helper()
	raw, err := os.ReadFile(path)
	require.NoError(t, err)
	var response model.QueryResponse
	require.NoError(t, json.Unmarshal(raw, &response))
	matrix, ok := response.Data.Result.(model.Matrix)
	require.True(t, ok)
	return matrix
}

func maxUnix(matrix model.Matrix) int64 {
	var maxTS int64
	for _, stream := range matrix {
		for _, pair := range stream.Values {
			ts := int64(pair.Timestamp) / 1000
			if ts > maxTS {
				maxTS = ts
			}
		}
	}
	return maxTS + 60
}

func TestEnrichMatrixNamespacePeers(t *testing.T) {
	matrix := loadMatrix(t, "../../mocks/loki/flow_metrics_namespace.json")
	resultType, result := EnrichMatrix(matrix, &EnrichInput{
		AggregateBy:      "namespace",
		Scopes:           testScopes(),
		TimeRangeSeconds: 300,
		UnixTimestamp:    maxUnix(matrix),
		ForceZeros:       true,
	})
	require.Equal(t, ResultTypeTopologyMetrics, resultType)
	metrics := result.([]TopologyMetric)
	require.NotEmpty(t, metrics)
	assert.Equal(t, "Namespace", metrics[0].Source.ResourceKind)
	assert.NotEmpty(t, metrics[0].Source.Scopes["namespace"])
	assert.Equal(t, "Namespace", metrics[0].Destination.ResourceKind)
	assert.NotEmpty(t, metrics[0].Destination.Scopes["namespace"])
	assert.NotEqual(t, metrics[0].Source.Scopes["namespace"], metrics[0].Destination.Scopes["namespace"])
	assert.NotEmpty(t, metrics[0].Values)
	assert.Equal(t, 2, len(metrics[0].Stats.Percentiles))
}

func TestEnrichMatrixOwnerPeers(t *testing.T) {
	matrix := loadMatrix(t, "../../mocks/loki/flow_metrics_owner.json")
	resultType, result := EnrichMatrix(matrix, &EnrichInput{
		AggregateBy:      "owner",
		Scopes:           testScopes(),
		TimeRangeSeconds: 300,
		UnixTimestamp:    maxUnix(matrix),
		ForceZeros:       true,
	})
	require.Equal(t, ResultTypeTopologyMetrics, resultType)
	metrics := result.([]TopologyMetric)
	require.NotEmpty(t, metrics)
	srcKind, srcName := FormatPeerKindName(&metrics[0].Source)
	dstKind, dstName := FormatPeerKindName(&metrics[0].Destination)
	assert.NotEmpty(t, srcKind)
	assert.NotEmpty(t, srcName)
	assert.NotEmpty(t, dstKind)
	assert.NotEmpty(t, dstName)
}

func TestEnrichMatrixAppAggregateUsesTopology(t *testing.T) {
	// Overview totals query with aggregateBy=app; labels are not Src/Dst directional.
	matrix := loadMatrix(t, "../../mocks/loki/flow_metrics_app.json")
	resultType, result := EnrichMatrix(matrix, &EnrichInput{
		AggregateBy:      "app",
		Scopes:           testScopes(),
		TimeRangeSeconds: 300,
		UnixTimestamp:    maxUnix(matrix),
		ForceZeros:       true,
	})
	require.Equal(t, ResultTypeTopologyMetrics, resultType)
	metrics := result.([]TopologyMetric)
	require.Len(t, metrics, 1)
	assert.Equal(t, "app", metrics[0].Scope)
	assert.NotEmpty(t, metrics[0].Values)
	assert.Equal(t, idUnknown, metrics[0].Source.ID)
	assert.Equal(t, idUnknown, metrics[0].Destination.ID)
}

func TestEnrichMatrixFieldAggregateUsesGeneric(t *testing.T) {
	matrix := model.Matrix{
		{
			Metric: map[pmodel.LabelName]pmodel.LabelValue{
				"DnsFlagsResponseCode": "NoError",
			},
			Values: []pmodel.SamplePair{
				{Timestamp: 1708009560000, Value: 1},
				{Timestamp: 1708009920000, Value: 2},
			},
		},
	}
	resultType, result := EnrichMatrix(matrix, &EnrichInput{
		AggregateBy:      "DnsFlagsResponseCode",
		Scopes:           testScopes(),
		TimeRangeSeconds: 300,
		UnixTimestamp:    1708010000,
		ForceZeros:       true,
	})
	require.Equal(t, ResultTypeGenericMetrics, resultType)
	metrics := result.([]GenericMetric)
	require.Len(t, metrics, 1)
	assert.Equal(t, "NoError", metrics[0].Name)
}

func TestComputeStats(t *testing.T) {
	stats := computeStats([]Datapoint{{1, 5}, {2, 10}, {3, 15}})
	assert.Equal(t, 30.0, stats.Sum)
	assert.Equal(t, 10.0, stats.Avg)
	assert.Equal(t, 5.0, stats.Min)
	assert.Equal(t, 15.0, stats.Max)
	assert.Equal(t, 15.0, stats.Latest)
	assert.Len(t, stats.Percentiles, 2)
}

func TestPeerJSONRoundTrip(t *testing.T) {
	p := Peer{
		ID:           "namespace=netobserv",
		ResourceKind: "Namespace",
		IsAmbiguous:  false,
		Scopes:       map[string]string{"namespace": "netobserv"},
	}
	raw, err := json.Marshal(p)
	require.NoError(t, err)
	var out Peer
	require.NoError(t, json.Unmarshal(raw, &out))
	assert.Equal(t, "netobserv", out.Scopes["namespace"])
	assert.Equal(t, "Namespace", out.ResourceKind)
}
