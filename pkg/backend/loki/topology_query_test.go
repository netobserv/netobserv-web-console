package loki

import (
	"strconv"
	"testing"
	"time"

	"github.com/netobserv/network-observability-console-plugin/pkg/backend"
	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/fields"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/filters"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils/constants"
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

func parseDate(str string) time.Time {
	i, _ := strconv.ParseInt(str, 10, 64)
	return time.Unix(i, 0)
}

func TestBuildTopologyQuery_SimpleAggregate(t *testing.T) {
	in := backend.MetricsParams{
		Start:          parseDate("1789000000"),
		Top:            50,
		RateInterval:   "2m",
		Step:           10 * time.Second,
		DataField:      "Bytes",
		MetricFunction: constants.MetricFunctionRate,
		RecordType:     constants.RecordTypeLog,
		Aggregate:      "namespace",
	}
	q, err := NewTopologyQuery(&lokiConfig, aggregateKeyLabels, &in)
	require.NoError(t, err)
	result := q.Build()
	assert.Equal(
		t,
		"http://loki/loki/api/v1/query_range?query="+
			"topk(50,sum by(SrcK8S_Namespace,DstK8S_Namespace)(rate({app=\"netobserv-flowcollector\"}|json|unwrap Bytes|__error__=\"\"[2m])))&start=1789000000&limit=50&step=10s",
		result,
	)
}

func TestBuildTopologyQuery_GroupsAndAggregate(t *testing.T) {
	in := backend.MetricsParams{
		Start:          parseDate("1789000000"),
		End:            parseDate("1790000000"),
		Top:            50,
		RateInterval:   "2m",
		Step:           10 * time.Second,
		DataField:      "Bytes",
		MetricFunction: constants.MetricFunctionRate,
		RecordType:     constants.RecordTypeLog,
		Aggregate:      "namespace",
		Groups:         "hosts",
	}
	q, err := NewTopologyQuery(&lokiConfig, aggregateKeyLabels, &in)
	require.NoError(t, err)
	result := q.Build()
	assert.Equal(
		t,
		"http://loki/loki/api/v1/query_range?query="+
			"topk(50,sum by(SrcK8S_Namespace,DstK8S_Namespace,SrcK8S_HostName,DstK8S_HostName)(rate({app=\"netobserv-flowcollector\"}|json|unwrap Bytes|__error__=\"\"[2m])))&start=1789000000&end=1790000000&limit=50&step=10s",
		result,
	)
}

func TestBuildTopologyQuery_CustomAggregate(t *testing.T) {
	in := backend.MetricsParams{
		Start:          parseDate("1789000000"),
		Top:            50,
		RateInterval:   "2m",
		Step:           10 * time.Second,
		DataField:      "Bytes",
		MetricFunction: constants.MetricFunctionRate,
		RecordType:     constants.RecordTypeLog,
		Aggregate:      "SomeField",
	}
	q, err := NewTopologyQuery(&lokiConfig, aggregateKeyLabels, &in)
	require.NoError(t, err)
	result := q.Build()
	assert.Equal(
		t,
		"http://loki/loki/api/v1/query_range?query="+
			"topk(50,sum by(SomeField)(rate({app=\"netobserv-flowcollector\"}|~`\"SomeField\"`|json|unwrap Bytes|__error__=\"\"[2m])))&start=1789000000&limit=50&step=10s",
		result,
	)
}

func TestBuildTopologyQuery_CustomLabelAggregate(t *testing.T) {
	in := backend.MetricsParams{
		Start:          parseDate("1789000000"),
		Top:            50,
		RateInterval:   "2m",
		Step:           10 * time.Second,
		DataField:      "Bytes",
		MetricFunction: constants.MetricFunctionRate,
		RecordType:     constants.RecordTypeLog,
		Aggregate:      "FlowDirection",
	}
	q, err := NewTopologyQuery(&lokiConfig, aggregateKeyLabels, &in)
	require.NoError(t, err)
	result := q.Build()
	assert.Equal(
		t,
		"http://loki/loki/api/v1/query_range?query="+
			"topk(50,sum by(FlowDirection)(rate({app=\"netobserv-flowcollector\"}|json|unwrap Bytes|__error__=\"\"[2m])))&start=1789000000&limit=50&step=10s",
		result,
	)
}

func TestBuildTopologyQuery_TlsFlowsOwnerPlusTlsVersionAggregate(t *testing.T) {
	in := backend.MetricsParams{
		Start:          parseDate("1789000000"),
		Top:            50,
		RateInterval:   "2m",
		Step:           10 * time.Second,
		DataField:      constants.MetricTypeTLSFlows,
		MetricFunction: constants.MetricFunctionRate,
		RecordType:     constants.RecordTypeLog,
		Aggregate:      "owner__TLSVersion",
	}
	q, err := NewTopologyQuery(&lokiConfig, aggregateKeyLabels, &in)
	require.NoError(t, err)
	result := q.Build()
	assert.Contains(t, result, "sum by(SrcK8S_OwnerName,SrcK8S_OwnerType,DstK8S_OwnerName,DstK8S_OwnerType,SrcK8S_Namespace,DstK8S_Namespace,TLSVersion,TLSGroup)")
	assert.Contains(t, result, "|=\"TLSTypes\"")
	assert.Contains(t, result, "|json")
}

func TestSplitForReportersMerge_NilQuery(t *testing.T) {
	res := expandQuery(
		nil,
		"",
		fields.DNSCode,
	)
	assert.Len(t, res, 1)
	assert.Nil(t, res[0])
}

func TestSplitForReportersMerge_OtherField_NoSplit(t *testing.T) {
	res := expandQuery(
		filters.SingleQuery{filters.NewRegexMatch("srcns", "a")},
		"",
		fields.DNSCode,
	)
	assert.Len(t, res, 1)
	assert.Equal(t, filters.SingleQuery{filters.NewRegexMatch("srcns", "a")}, res[0])
}

func TestSplitForReportersMerge_FlowDirection_NoSplit(t *testing.T) {
	res := expandQuery(
		filters.SingleQuery{filters.NewRegexMatch("srcns", "a"), filters.NewRegexMatch("FlowDirection", string(constants.Ingress))},
		"",
		fields.Bytes,
	)
	assert.Len(t, res, 1)
	assert.Equal(t, filters.SingleQuery{
		filters.NewRegexMatch("srcns", "a"),
		filters.NewRegexMatch("FlowDirection", string(constants.Ingress)),
	}, res[0])
}

func TestSplitForReportersMerge(t *testing.T) {
	res := expandQuery(
		filters.SingleQuery{filters.NewRegexMatch("srcns", "a"), filters.NewRegexMatch("dstns", "b")},
		"",
		fields.Bytes,
	)

	assert.Len(t, res, 2)
	assert.Equal(t, filters.SingleQuery{
		filters.NewRegexMatch("FlowDirection", `"`+string(constants.Ingress)+`","`+string(constants.Inner)+`"`),
		filters.NewRegexMatch("srcns", "a"),
		filters.NewRegexMatch("dstns", "b"),
	}, res[0])
	assert.Equal(t, filters.SingleQuery{
		filters.NewRegexMatch("FlowDirection", `"`+string(constants.Egress)+`"`),
		filters.NewRegexMatch("DstK8S_Type", `"","Service"`),
		filters.NewRegexMatch("srcns", "a"),
		filters.NewRegexMatch("dstns", "b"),
	}, res[1])
}

func TestExpand_ComplexQuery(t *testing.T) {
	res := expandQuery(
		filters.SingleQuery{filters.NewRegexMatch("key1", "a"), filters.NewRegexMatch("key2", "b")},
		"my-namespace",
		fields.Bytes,
	)

	assert.Len(t, res, 4)
	assert.Equal(t, filters.SingleQuery{
		filters.NewRegexMatch("SrcK8S_Namespace", `"my-namespace"`),
		filters.NewRegexMatch("FlowDirection", `"`+string(constants.Ingress)+`","`+string(constants.Inner)+`"`),
		filters.NewRegexMatch("key1", "a"),
		filters.NewRegexMatch("key2", "b"),
	}, res[0])
	assert.Equal(t, filters.SingleQuery{
		filters.NewRegexMatch("DstK8S_Namespace", `"my-namespace"`),
		filters.NewRegexMatch("FlowDirection", `"`+string(constants.Ingress)+`","`+string(constants.Inner)+`"`),
		filters.NewRegexMatch("key1", "a"),
		filters.NewRegexMatch("key2", "b"),
	}, res[1])
	assert.Equal(t, filters.SingleQuery{
		filters.NewRegexMatch("SrcK8S_Namespace", `"my-namespace"`),
		filters.NewRegexMatch("FlowDirection", `"`+string(constants.Egress)+`"`),
		filters.NewRegexMatch("DstK8S_Type", `"","Service"`),
		filters.NewRegexMatch("key1", "a"),
		filters.NewRegexMatch("key2", "b"),
	}, res[2])
	assert.Equal(t, filters.SingleQuery{
		filters.NewRegexMatch("DstK8S_Namespace", `"my-namespace"`),
		filters.NewRegexMatch("FlowDirection", `"`+string(constants.Egress)+`"`),
		filters.NewRegexMatch("DstK8S_Type", `"","Service"`),
		filters.NewRegexMatch("key1", "a"),
		filters.NewRegexMatch("key2", "b"),
	}, res[3])
}
