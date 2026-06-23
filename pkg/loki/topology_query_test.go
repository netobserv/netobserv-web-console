package loki

import (
	"testing"

	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils/constants"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils/queryparams"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var lokiConfig = config.Loki{
	URL:    "http://loki",
	Labels: []string{"SrcK8S_Namespace", "SrcK8S_OwnerName", "DstK8S_Namespace", "DstK8S_OwnerName", "FlowDirection"},
}

var aggregateKeyLabels = map[string][]string{
	"app":               {"app"},
	"droppedState":      {"PktDropLatestState"},
	"droppedCause":      {"PktDropLatestDropCause"},
	"dnsRCode":          {"DnsFlagsResponseCode"},
	"cluster":           {"K8S_ClusterName"},
	"zone":              {"SrcK8S_Zone", "DstK8S_Zone"},
	"host":              {"SrcK8S_HostName", "DstK8S_HostName"},
	"namespace":         {"SrcK8S_Namespace", "DstK8S_Namespace"},
	"owner":             {"SrcK8S_OwnerName", "SrcK8S_OwnerType", "DstK8S_OwnerName", "DstK8S_OwnerType", "SrcK8S_Namespace", "DstK8S_Namespace"},
	"owner__TLSVersion": {"SrcK8S_OwnerName", "SrcK8S_OwnerType", "DstK8S_OwnerName", "DstK8S_OwnerType", "SrcK8S_Namespace", "DstK8S_Namespace", "TLSVersion", "TLSGroup"},
	"resource":          {"SrcK8S_Name", "SrcK8S_Type", "SrcK8S_OwnerName", "SrcK8S_OwnerType", "SrcK8S_Namespace", "SrcAddr", "SrcK8S_HostName", "DstK8S_Name", "DstK8S_Type", "DstK8S_OwnerName", "DstK8S_OwnerType", "DstK8S_Namespace", "DstAddr", "DstK8S_HostName"},
}

func TestBuildTopologyQuery_SimpleAggregate(t *testing.T) {
	in := queryparams.TopologyInput{
		Start:          "(start)",
		End:            "",
		Top:            "50",
		RateInterval:   "2m",
		Step:           "10s",
		DataField:      "Bytes",
		MetricFunction: constants.MetricFunctionRate,
		RecordType:     constants.RecordTypeLog,
		DataSource:     constants.DataSourceAuto,
		Aggregate:      "namespace",
	}
	q, err := NewTopologyQuery(&lokiConfig, aggregateKeyLabels, &in)
	require.NoError(t, err)
	result := q.Build()
	assert.Equal(
		t,
		"http://loki/loki/api/v1/query_range?query="+
			"topk(50,sum by(SrcK8S_Namespace,DstK8S_Namespace)(rate({app=\"netobserv-flowcollector\"}|json|unwrap Bytes|__error__=\"\"[2m])))&start=(start)&limit=50&step=10s",
		result,
	)
}

func TestBuildTopologyQuery_GroupsAndAggregate(t *testing.T) {
	in := queryparams.TopologyInput{
		Start:          "(start)",
		End:            "",
		Top:            "50",
		RateInterval:   "2m",
		Step:           "10s",
		DataField:      "Bytes",
		MetricFunction: constants.MetricFunctionRate,
		RecordType:     constants.RecordTypeLog,
		DataSource:     constants.DataSourceAuto,
		Aggregate:      "namespace",
		Groups:         "hosts",
	}
	q, err := NewTopologyQuery(&lokiConfig, aggregateKeyLabels, &in)
	require.NoError(t, err)
	result := q.Build()
	assert.Equal(
		t,
		"http://loki/loki/api/v1/query_range?query="+
			"topk(50,sum by(SrcK8S_Namespace,DstK8S_Namespace,SrcK8S_HostName,DstK8S_HostName)(rate({app=\"netobserv-flowcollector\"}|json|unwrap Bytes|__error__=\"\"[2m])))&start=(start)&limit=50&step=10s",
		result,
	)
}

func TestBuildTopologyQuery_CustomAggregate(t *testing.T) {
	in := queryparams.TopologyInput{
		Start:          "(start)",
		End:            "",
		Top:            "50",
		RateInterval:   "2m",
		Step:           "10s",
		DataField:      "Bytes",
		MetricFunction: constants.MetricFunctionRate,
		RecordType:     constants.RecordTypeLog,
		DataSource:     constants.DataSourceAuto,
		Aggregate:      "SomeField",
	}
	q, err := NewTopologyQuery(&lokiConfig, aggregateKeyLabels, &in)
	require.NoError(t, err)
	result := q.Build()
	assert.Equal(
		t,
		"http://loki/loki/api/v1/query_range?query="+
			"topk(50,sum by(SomeField)(rate({app=\"netobserv-flowcollector\"}|~`\"SomeField\"`|json|unwrap Bytes|__error__=\"\"[2m])))&start=(start)&limit=50&step=10s",
		result,
	)
}

func TestBuildTopologyQuery_CustomLabelAggregate(t *testing.T) {
	in := queryparams.TopologyInput{
		Start:          "(start)",
		End:            "",
		Top:            "50",
		RateInterval:   "2m",
		Step:           "10s",
		DataField:      "Bytes",
		MetricFunction: constants.MetricFunctionRate,
		RecordType:     constants.RecordTypeLog,
		DataSource:     constants.DataSourceAuto,
		Aggregate:      "FlowDirection",
	}
	q, err := NewTopologyQuery(&lokiConfig, aggregateKeyLabels, &in)
	require.NoError(t, err)
	result := q.Build()
	assert.Equal(
		t,
		"http://loki/loki/api/v1/query_range?query="+
			"topk(50,sum by(FlowDirection)(rate({app=\"netobserv-flowcollector\"}|json|unwrap Bytes|__error__=\"\"[2m])))&start=(start)&limit=50&step=10s",
		result,
	)
}

func TestBuildTopologyQuery_TlsFlowsOwnerPlusTlsVersionAggregate(t *testing.T) {
	in := queryparams.TopologyInput{
		Start:          "(start)",
		End:            "",
		Top:            "50",
		RateInterval:   "2m",
		Step:           "10s",
		DataField:      constants.MetricTypeTLSFlows,
		MetricFunction: constants.MetricFunctionRate,
		RecordType:     constants.RecordTypeLog,
		DataSource:     constants.DataSourceAuto,
		Aggregate:      "owner__TLSVersion",
	}
	q, err := NewTopologyQuery(&lokiConfig, aggregateKeyLabels, &in)
	require.NoError(t, err)
	result := q.Build()
	assert.Contains(t, result, "sum by(SrcK8S_OwnerName,SrcK8S_OwnerType,DstK8S_OwnerName,DstK8S_OwnerType,SrcK8S_Namespace,DstK8S_Namespace,TLSVersion,TLSGroup)")
	assert.Contains(t, result, "|=\"TLSTypes\"")
	assert.Contains(t, result, "|json")
}
