package prometheus

import (
	"testing"
	"time"

	"github.com/netobserv/network-observability-console-plugin/pkg/model/fields"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/filters"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils/constants"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils/queryparams"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/stretchr/testify/assert"
)

var qr = v1.Range{Start: time.Now().Add(-15 * time.Minute), End: time.Now(), Step: 30 * time.Second}

var kl = map[string][]string{
	"app":          {"app"},
	"droppedState": {"PktDropLatestState"},
	"droppedCause": {"PktDropLatestDropCause"},
	"dnsRCode":     {"DnsFlagsResponseCode"},
	"cluster":      {"K8S_ClusterName"},
	"zone":         {"SrcK8S_Zone", "DstK8S_Zone"},
	"host":         {"SrcK8S_HostName", "DstK8S_HostName"},
	"namespace":    {"SrcK8S_Namespace", "DstK8S_Namespace"},
	"owner":        {"SrcK8S_OwnerName", "SrcK8S_OwnerType", "DstK8S_OwnerName", "DstK8S_OwnerType", "SrcK8S_Namespace", "DstK8S_Namespace"},
	"resource":     {"SrcK8S_Name", "SrcK8S_Type", "SrcK8S_OwnerName", "SrcK8S_OwnerType", "SrcK8S_Namespace", "SrcAddr", "SrcK8S_HostName", "DstK8S_Name", "DstK8S_Type", "DstK8S_OwnerName", "DstK8S_OwnerType", "DstK8S_Namespace", "DstAddr", "DstK8S_HostName"},
}

func TestBuildQuery_PromQLSimpleRateIgnoreApp(t *testing.T) {
	in := queryparams.TopologyInput{
		Top:            "50",
		RateInterval:   "2m",
		DataField:      "Bytes",
		MetricFunction: constants.MetricFunctionRate,
		RecordType:     constants.RecordTypeLog,
		DataSource:     constants.DataSourceAuto,
		Aggregate:      "app",
	}
	f := filters.SingleQuery{}
	q := NewQuery(kl, &in, &qr, f, []string{"my_metric"})
	result := q.Build()
	assert.Equal(
		t,
		"topk(50,sum(rate(my_metric{}[2m])))",
		result.PromQL,
	)
}

func TestBuildQuery_PromQLSimpleRateNoFilter(t *testing.T) {
	in := queryparams.TopologyInput{
		Top:            "50",
		RateInterval:   "2m",
		DataField:      "Bytes",
		MetricFunction: constants.MetricFunctionRate,
		RecordType:     constants.RecordTypeLog,
		DataSource:     constants.DataSourceAuto,
		Aggregate:      "namespace",
	}
	f := filters.SingleQuery{}
	q := NewQuery(kl, &in, &qr, f, []string{"my_metric"})
	result := q.Build()
	assert.Equal(
		t,
		"topk(50,sum by(SrcK8S_Namespace,DstK8S_Namespace)(rate(my_metric{}[2m])))",
		result.PromQL,
	)
}

func TestBuildQuery_PromQLSimpleRateAndFilter(t *testing.T) {
	in := queryparams.TopologyInput{
		Top:            "50",
		RateInterval:   "2m",
		DataField:      "Bytes",
		MetricFunction: constants.MetricFunctionRate,
		RecordType:     constants.RecordTypeLog,
		DataSource:     constants.DataSourceAuto,
		Aggregate:      "namespace",
	}
	f := filters.SingleQuery{
		{
			Key:    fields.SrcNamespace,
			Values: `"a"`,
		},
	}
	q := NewQuery(kl, &in, &qr, f, []string{"my_metric"})
	result := q.Build()
	assert.Equal(
		t,
		`topk(50,sum by(SrcK8S_Namespace,DstK8S_Namespace)(rate(my_metric{SrcK8S_Namespace="a"}[2m])))`,
		result.PromQL,
	)
}

func TestBuildQuery_PromQLRateMultiFilter(t *testing.T) {
	in := queryparams.TopologyInput{
		Top:            "50",
		RateInterval:   "2m",
		DataField:      "Bytes",
		MetricFunction: constants.MetricFunctionRate,
		RecordType:     constants.RecordTypeLog,
		DataSource:     constants.DataSourceAuto,
		Aggregate:      "namespace",
	}
	f := filters.SingleQuery{
		{
			Key:    fields.SrcNamespace,
			Regex:  true,
			Values: `"a","b"`,
		},
	}
	q := NewQuery(kl, &in, &qr, f, []string{"my_metric"})
	result := q.Build()
	assert.Equal(
		t,
		`topk(50,sum by(SrcK8S_Namespace,DstK8S_Namespace)(rate(my_metric{SrcK8S_Namespace=~"^a$|^b$"}[2m])))`,
		result.PromQL,
	)
}

func TestBuildQuery_PromQLHistogramAverage(t *testing.T) {
	in := queryparams.TopologyInput{
		Top:            "50",
		RateInterval:   "2m",
		DataField:      "TimeFlowRttNs",
		MetricFunction: constants.MetricFunctionRate,
		RecordType:     constants.RecordTypeLog,
		DataSource:     constants.DataSourceAuto,
		Aggregate:      "namespace",
	}
	f := filters.SingleQuery{
		{
			Key:    fields.SrcNamespace,
			Values: `"a"`,
		},
	}
	q := NewQuery(kl, &in, &qr, f, []string{"my_metric"})
	result := q.Build()
	assert.Equal(
		t,
		`topk(50,sum by(SrcK8S_Namespace,DstK8S_Namespace)(rate(my_metric_sum{SrcK8S_Namespace="a"}[2m])/rate(my_metric_count{SrcK8S_Namespace="a"}[2m]))*1000)`,
		result.PromQL,
	)
}

func TestBuildQuery_PromQLHistogramP99(t *testing.T) {
	in := queryparams.TopologyInput{
		Top:            "50",
		RateInterval:   "2m",
		DataField:      "TimeFlowRttNs",
		MetricFunction: constants.MetricFunctionP99,
		RecordType:     constants.RecordTypeLog,
		DataSource:     constants.DataSourceAuto,
		Aggregate:      "namespace",
	}
	f := filters.SingleQuery{
		{
			Key:    fields.SrcNamespace,
			Values: `"a"`,
		},
	}
	q := NewQuery(kl, &in, &qr, f, []string{"my_metric"})
	result := q.Build()
	assert.Equal(
		t,
		`topk(50,histogram_quantile(0.99,sum by(SrcK8S_Namespace,DstK8S_Namespace,le)(rate(my_metric_bucket{SrcK8S_Namespace="a"}[2m])))*1000)`,
		result.PromQL,
	)
}

func TestBuildQuery_PromQLByDNSResponseCode(t *testing.T) {
	in := queryparams.TopologyInput{
		Top:            "5",
		RateInterval:   "1m",
		DataField:      "DnsFlows",
		MetricFunction: constants.MetricFunctionCount,
		RecordType:     constants.RecordTypeLog,
		DataSource:     constants.DataSourceAuto,
		Aggregate:      "DnsFlagsResponseCode",
	}
	f := filters.SingleQuery{}
	q := NewQuery(kl, &in, &qr, f, []string{"netobserv_namespace_dns_latency_seconds_count"})
	result := q.Build()
	assert.Equal(
		t,
		`topk(5,sum by(DnsFlagsResponseCode)(rate(netobserv_namespace_dns_latency_seconds_count{DnsFlagsResponseCode!=""}[1m])))`,
		result.PromQL,
	)
}

func TestBuildQuery_PromQLORMetrics(t *testing.T) {
	in := queryparams.TopologyInput{
		Top:            "50",
		RateInterval:   "2m",
		DataField:      "Bytes",
		MetricFunction: constants.MetricFunctionRate,
		RecordType:     constants.RecordTypeLog,
		DataSource:     constants.DataSourceAuto,
		Aggregate:      "namespace",
	}
	f := filters.SingleQuery{
		{
			Key:    fields.SrcNamespace,
			Values: `"a"`,
		},
	}
	q := NewQuery(kl, &in, &qr, f, []string{"ingress_metric", "egress_metric"})
	result := q.Build()
	assert.Equal(
		t,
		`topk(50,sum by(SrcK8S_Namespace,DstK8S_Namespace)(rate(ingress_metric{SrcK8S_Namespace="a"}[2m]))`+
			` or sum by(SrcK8S_Namespace,DstK8S_Namespace)(rate(egress_metric{SrcK8S_Namespace="a"}[2m])))`,
		result.PromQL,
	)
}
