package metricsparse

import (
	"math"
	"testing"

	"github.com/netobserv/network-observability-console-plugin/pkg/model"
	pmodel "github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func sampleStream(labels map[string]string, values []Datapoint) pmodel.SampleStream {
	m := pmodel.Metric{}
	for k, v := range labels {
		m[pmodel.LabelName(k)] = pmodel.LabelValue(v)
	}
	pairs := make([]pmodel.SamplePair, 0, len(values))
	for _, v := range values {
		pairs = append(pairs, pmodel.SamplePair{
			Timestamp: pmodel.Time(int64(v[0] * 1000)),
			Value:     pmodel.SampleValue(v[1]),
		})
	}
	return pmodel.SampleStream{Metric: m, Values: pairs}
}

func TestNormalizeAndComputeStats_Simple(t *testing.T) {
	// Mirrors FE metrics.spec "should normalize and compute simple stats"
	values := []Datapoint{
		{1664372000, 5}, {1664372015, 5}, {1664372030, 5}, {1664372045, 5},
		{1664372060, 5}, {1664372075, 5}, {1664372090, 5},
		{1664372105, 10}, {1664372120, 10}, {1664372135, 10}, {1664372150, 10},
		{1664372165, 10}, {1664372180, 10}, {1664372195, 10},
		{1664372210, 8}, {1664372225, 8}, {1664372240, 8}, {1664372255, 8},
		{1664372270, 8}, {1664372285, 8}, {1664372300, 8},
	}
	cal := calibrateRange([][]Datapoint{values}, &EnrichInput{
		From: 1664372000, To: 1664372300, UnixTimestamp: 1664372300, IsMock: true,
	})
	norm := normalizeMetrics(values, cal.start, cal.end, cal.step, true)
	require.Equal(t, values, norm)

	stats := computeStats(norm)
	assert.Equal(t, 8.0, stats.Latest)
	assert.Equal(t, 5.0, stats.Min)
	assert.Equal(t, 10.0, stats.Max)
	assert.Equal(t, 7.67, stats.Avg)     // 161/21
	assert.Equal(t, 2300.0, stats.Total) // 7.67*300
}

func TestCalibrateRange_NonMock(t *testing.T) {
	values := []Datapoint{
		{1664372000, 5}, {1664372015, 5}, {1664372030, 5},
		{1664372210, 8}, {1664372225, 8}, {1664372300, 8},
	}
	cal := calibrateRange([][]Datapoint{values}, &EnrichInput{
		TimeRangeSeconds: 300,
		UnixTimestamp:    1664372300,
		ForceZeros:       true,
		IsMock:           false,
	})
	norm := normalizeMetrics(values, cal.start, cal.end, cal.step, true)
	assert.Equal(t, 8.0, computeStats(norm).Latest)
	assert.True(t, cal.end <= float64(1664372300))
}

func TestNormalizeAndComputeStats_MissingDatapoints(t *testing.T) {
	// Mirrors FE metrics.spec "should normalize and compute stats with missing data points"
	values := []Datapoint{
		{1664372000, 5}, {1664372015, 5}, {1664372030, 5}, {1664372045, 5},
		{1664372060, 5}, {1664372075, 5}, {1664372090, 5},
		{1664372210, 8}, {1664372225, 8}, {1664372240, 8}, {1664372255, 8},
		{1664372270, 8}, {1664372285, 8}, {1664372300, 8},
	}
	cal := calibrateRange([][]Datapoint{values}, &EnrichInput{
		From: 1664372000, To: 1664372300, UnixTimestamp: 1664372300, IsMock: true,
	})
	norm := normalizeMetrics(values, cal.start, cal.end, cal.step, true)
	assert.Equal(t, []Datapoint{
		{1664372000, 5}, {1664372015, 5}, {1664372030, 5}, {1664372045, 5},
		{1664372060, 5}, {1664372075, 5}, {1664372090, 5},
		{1664372105, 0}, {1664372120, 0}, {1664372135, 0}, {1664372150, 0},
		{1664372165, 0}, {1664372180, 0}, {1664372195, 0},
		{1664372210, 8}, {1664372225, 8}, {1664372240, 8}, {1664372255, 8},
		{1664372270, 8}, {1664372285, 8}, {1664372300, 8},
	}, norm)

	stats := computeStats(norm)
	assert.Equal(t, 8.0, stats.Latest)
	assert.Equal(t, 0.0, stats.Min)
	assert.Equal(t, 8.0, stats.Max)
	assert.Equal(t, 4.33, stats.Avg)     // 91/21
	assert.Equal(t, 1300.0, stats.Total) // 4.33*300
}

func TestNormalize_ForceZerosFalseSkipsNaN(t *testing.T) {
	values := []Datapoint{{100, 1}, {115, math.NaN()}, {130, 3}}
	norm := normalizeMetrics(values, 100, 145, 15, false)
	assert.Equal(t, []Datapoint{{100, 1}, {130, 3}}, norm)
}

func TestEnrichMatrix_Ambiguity(t *testing.T) {
	// Mirrors FE parseTopologyMetrics disambiguation
	matrix := model.Matrix{
		sampleStream(map[string]string{
			"SrcK8S_Name": "A", "SrcK8S_Namespace": "ns1", "SrcK8S_Type": "Pod",
			"DstK8S_Name": "B", "DstK8S_Namespace": "ns1", "DstK8S_Type": "Pod",
		}, []Datapoint{{1000, 1}}),
		sampleStream(map[string]string{
			"SrcK8S_Name": "A", "SrcK8S_Namespace": "ns1", "SrcK8S_Type": "Pod",
			"DstK8S_Name": "B", "DstK8S_Namespace": "ns1", "DstK8S_Type": "Service",
		}, []Datapoint{{1000, 1}}),
	}
	resultType, result := EnrichMatrix(matrix, &EnrichInput{
		AggregateBy: "resource",
		Scopes:      testScopes(),
		From:        1000, To: 1030, UnixTimestamp: 1030,
		ForceZeros: true, IsMock: true,
	})
	require.Equal(t, ResultTypeTopologyMetrics, resultType)
	metrics := result.([]TopologyMetric)
	require.Len(t, metrics, 2)
	assert.False(t, metrics[0].Source.IsAmbiguous)
	assert.True(t, metrics[0].Destination.IsAmbiguous)
	assert.False(t, metrics[1].Source.IsAmbiguous)
	assert.True(t, metrics[1].Destination.IsAmbiguous)
	assert.Equal(t, "ns1.B", peerDisplayName(&metrics[0].Destination, true, false))
	assert.Equal(t, "ns1.B (pod)", peerDisplayName(&metrics[0].Destination, true, true))
	assert.Equal(t, "ns1.B (svc)", peerDisplayName(&metrics[1].Destination, true, true))
}

func TestEnrichMatrix_GenericWithTLS(t *testing.T) {
	matrix := model.Matrix{
		sampleStream(map[string]string{
			"SrcK8S_Name": "pod-a",
			"TLSVersion":  `["VersionTLS13"]`,
			"TLSGroup":    `["X25519MLKEM768"]`,
			"TLSCipher":   "TLS_AES_128_GCM_SHA256",
		}, []Datapoint{{1000, 2}, {1015, 4}}),
	}
	resultType, result := EnrichMatrix(matrix, &EnrichInput{
		AggregateBy: "SrcK8S_Name",
		Scopes:      testScopes(),
		From:        1000, To: 1030, UnixTimestamp: 1030,
		ForceZeros: true, IsMock: true,
	})
	require.Equal(t, ResultTypeGenericMetrics, resultType)
	metrics := result.([]GenericMetric)
	require.Len(t, metrics, 1)
	assert.Equal(t, "pod-a", metrics[0].Name)
	require.NotNil(t, metrics[0].TLS)
	assert.Equal(t, []string{"VersionTLS13"}, metrics[0].TLS.Versions)
	assert.Equal(t, []string{"X25519MLKEM768"}, metrics[0].TLS.Groups)
}

func TestEnrichMatrix_GenericIgnoresTLSTypes(t *testing.T) {
	matrix := model.Matrix{
		sampleStream(map[string]string{
			"SrcK8S_Name": "pod-a",
			"TLSTypes":    "1",
		}, []Datapoint{{1000, 1}}),
	}
	_, result := EnrichMatrix(matrix, &EnrichInput{
		AggregateBy: "SrcK8S_Name",
		Scopes:      testScopes(),
		From:        1000, To: 1030, UnixTimestamp: 1030,
		ForceZeros: true, IsMock: true,
	})
	metrics := result.([]GenericMetric)
	assert.Nil(t, metrics[0].TLS)
}

func TestEnrichMatrix_EmptyMatrix(t *testing.T) {
	resultType, result := EnrichMatrix(model.Matrix{}, &EnrichInput{
		AggregateBy:      "namespace",
		Scopes:           testScopes(),
		TimeRangeSeconds: 300,
		UnixTimestamp:    1000,
		ForceZeros:       true,
	})
	assert.Equal(t, ResultTypeTopologyMetrics, resultType)
	assert.Empty(t, result.([]TopologyMetric))
}

func TestEnrichMatrix_AddressPeer(t *testing.T) {
	matrix := model.Matrix{
		sampleStream(map[string]string{
			"SrcAddr": "1.2.3.4", "SrcSubnetLabel": "nodes",
			"DstAddr": "5.6.7.8",
		}, []Datapoint{{1000, 1}}),
	}
	resultType, result := EnrichMatrix(matrix, &EnrichInput{
		AggregateBy: "addr",
		Scopes:      testScopes(),
		From:        1000, To: 1030, UnixTimestamp: 1030,
		ForceZeros: true, IsMock: true,
	})
	require.Equal(t, ResultTypeTopologyMetrics, resultType)
	metrics := result.([]TopologyMetric)
	srcKind, srcName := FormatPeerKindName(&metrics[0].Source)
	dstKind, dstName := FormatPeerKindName(&metrics[0].Destination)
	assert.Equal(t, "Address", srcKind)
	assert.Equal(t, "nodes (1.2.3.4)", srcName)
	assert.Equal(t, "Address", dstKind)
	assert.Equal(t, "5.6.7.8", dstName)
	assert.Contains(t, metrics[0].Source.ID, "a=1.2.3.4")
}

func TestPeerID_CustomScopes(t *testing.T) {
	id := peerID(map[string]string{"namespace": "ns1", "host": "node1"}, nil, &NameAndType{Name: "p", Type: "Pod"}, "", "", testScopes())
	assert.Equal(t, "host=node1,namespace=ns1,r=Pod.p", id)
}

func TestExtractTLSListField_CommaSeparated(t *testing.T) {
	assert.Equal(t, []string{"a", "b"}, extractTLSListField("a, b"))
}
