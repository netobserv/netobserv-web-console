package metricsexport

import (
	"encoding/json"
	"math"
	"os"
	"testing"

	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/metricsparse"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMetricGroup(t *testing.T) {
	assert.Equal(t, "rate.bytes", MetricGroup("Bytes", "rate", "resource", ""))
	assert.Equal(t, "dnsLatency.p90", MetricGroup("DnsLatencyMs", "p90", "namespace", ""))
	assert.Equal(t, "custom.group", MetricGroup("Bytes", "rate", "resource", "custom.group"))
}

func TestAppendEnrichedFromFixture(t *testing.T) {
	raw, err := os.ReadFile("../../mocks/loki/flow_metrics_owner.json")
	require.NoError(t, err)

	var response model.QueryResponse
	require.NoError(t, json.Unmarshal(raw, &response))
	matrix, ok := response.Data.Result.(model.Matrix)
	require.True(t, ok)
	require.NotEmpty(t, matrix)

	scopes := []config.Scope{
		{ID: "namespace", Name: "Namespace", Labels: []string{"SrcK8S_Namespace", "DstK8S_Namespace"}},
		{ID: "owner", Name: "Owner", Labels: []string{"SrcK8S_OwnerName", "DstK8S_OwnerName"}},
		{ID: "resource", Name: "Resource", Labels: []string{"SrcK8S_Name", "DstK8S_Name"}},
		{ID: "host", Name: "Node", Labels: []string{"SrcK8S_HostName", "DstK8S_HostName"}},
	}
	resultType, result := metricsparse.EnrichMatrix(matrix, &metricsparse.EnrichInput{
		AggregateBy:      "owner",
		Scopes:           scopes,
		TimeRangeSeconds: 300,
		UnixTimestamp:    timeNowUnix(matrix),
		ForceZeros:       true,
	})
	require.Equal(t, metricsparse.ResultTypeTopologyMetrics, resultType)

	rows, edges := AppendEnriched(nil, nil, resultType, result, QueryInput{
		MetricType:     "Bytes",
		MetricFunction: "rate",
		AggregateBy:    "owner",
	}, true)

	assert.NotEmpty(t, rows)
	row := rows[0]
	for _, r := range rows {
		if r.SourceKind != "" && r.DestinationKind != "" && r.SourceName != "" && r.DestinationName != "" {
			row = r
			break
		}
	}
	assert.Equal(t, "rate.bytes", row.MetricGroup)
	assert.NotEmpty(t, row.Series)
	assert.NotEmpty(t, row.TimestampISO)
	assert.NotEmpty(t, row.SourceKind)
	assert.NotEmpty(t, row.SourceName)
	assert.NotEmpty(t, row.DestinationKind)
	assert.NotEmpty(t, row.DestinationName)
	assert.NotEmpty(t, edges)
	edgeIdx := 0
	for i, e := range edges {
		if e.SourceKind == row.SourceKind && e.SourceName == row.SourceName {
			edgeIdx = i
			break
		}
	}
	assert.Equal(t, row.SourceKind, edges[edgeIdx].SourceKind)
	assert.Equal(t, row.SourceName, edges[edgeIdx].SourceName)

	// Edge aggregates must come from enriched MetricStats (no recompute drift)
	topo := result.([]metricsparse.TopologyMetric)
	require.NotEmpty(t, topo)
	topoIdx := 0
	for i, m := range topo {
		sk, sn := metricsparse.FormatPeerKindName(&m.Source)
		dk, dn := metricsparse.FormatPeerKindName(&m.Destination)
		if sk == row.SourceKind && sn == row.SourceName && dk == row.DestinationKind && dn == row.DestinationName {
			topoIdx = i
			break
		}
	}
	assert.Equal(t, ExportFloat(topo[topoIdx].Stats.Sum), edges[edgeIdx].Sum)
	assert.Equal(t, ExportFloat(topo[topoIdx].Stats.Avg), edges[edgeIdx].Avg)
	assert.Equal(t, ExportFloat(topo[topoIdx].Stats.Min), edges[edgeIdx].Min)
	assert.Equal(t, ExportFloat(topo[topoIdx].Stats.Max), edges[edgeIdx].Max)
	assert.Equal(t, ExportFloat(topo[topoIdx].Stats.Latest), edges[edgeIdx].Latest)
}

func timeNowUnix(matrix model.Matrix) int64 {
	var maxTS int64
	for _, stream := range matrix {
		for _, pair := range stream.Values {
			ts := int64(pair.Timestamp) / 1000
			if ts > maxTS {
				maxTS = ts
			}
		}
	}
	if maxTS == 0 {
		return 1
	}
	return maxTS + 60
}

func TestBuildReportOmitsEdgesWhenDisabled(t *testing.T) {
	report := BuildReport(json.RawMessage(`300`), "resource", []MetricSeriesRow{
		{MetricGroup: "rate.bytes", Series: "a -> b", Timestamp: 1, TimestampISO: "1970-01-01T00:00:01Z", Value: 1},
	}, []TopologyEdgeRow{
		{MetricGroup: "rate.bytes", SourceKind: "Pod", SourceName: "a", DestinationKind: "Pod", DestinationName: "b"},
	}, false)
	assert.Nil(t, report.TopologyEdges)
}

func TestNormalizeSeriesName(t *testing.T) {
	assert.Equal(t, "total", normalizeSeriesName("{}"))
	assert.Equal(t, "total", normalizeSeriesName(""))
	assert.Equal(t, "total", normalizeSeriesName(topologySeriesName("", "", "", "")))
	assert.Equal(t, "Namespace/a ->", normalizeSeriesName(topologySeriesName("Namespace", "a", "", "")))
	assert.Equal(t, "-> Namespace/b", normalizeSeriesName(topologySeriesName("", "", "Namespace", "b")))
	assert.Equal(t, "Namespace/a -> Namespace/b", normalizeSeriesName("Namespace/a -> Namespace/b"))
	assert.Equal(t, "dns-error", normalizeSeriesName("dns-error"))
}

func TestExportFloatMarshalsNaNAsNull(t *testing.T) {
	raw, err := json.Marshal(ExportFloat(math.NaN()))
	require.NoError(t, err)
	assert.Equal(t, "null", string(raw))

	raw, err = json.Marshal(MetricSeriesRow{
		MetricGroup:  "rtt.avg",
		Series:       "total",
		Timestamp:    1,
		TimestampISO: "1970-01-01T00:00:01Z",
		Value:        ExportFloat(math.NaN()),
	})
	require.NoError(t, err)
	assert.Contains(t, string(raw), `"value":null`)
	assert.NotContains(t, string(raw), "NaN")
}
