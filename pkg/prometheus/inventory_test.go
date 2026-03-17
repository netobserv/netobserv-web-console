package prometheus

import (
	"testing"

	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/stretchr/testify/assert"
)

var configuredMetrics = []config.MetricInfo{
	{
		Enabled:    true,
		Name:       "netobserv_metric_1",
		Type:       "Counter",
		ValueField: "Bytes",
		Direction:  config.Egress,
		Labels:     []string{"SrcK8S_Namespace", "DstK8S_Namespace", "SrcK8S_OwnerName", "DstK8S_OwnerName", "SrcK8S_OwnerType", "DstK8S_OwnerType"},
	},
	{
		Enabled:    true,
		Name:       "netobserv_metric_1bis",
		Type:       "Counter",
		ValueField: "Bytes",
		Direction:  config.Ingress,
		Labels:     []string{"SrcK8S_Namespace", "DstK8S_Namespace"},
	},
	{
		Enabled:    false,
		Name:       "netobserv_metric_2",
		Type:       "Counter",
		ValueField: "Packets",
		Direction:  config.Egress,
		Labels:     []string{"SrcK8S_Namespace", "DstK8S_Namespace", "SrcK8S_OwnerName", "DstK8S_OwnerName", "SrcK8S_OwnerType", "DstK8S_OwnerType"},
	},
	{
		Enabled:    true,
		Name:       "netobserv_metric_3",
		Type:       "Counter",
		ValueField: "",
		Direction:  config.AnyDirection,
		Labels:     []string{"SrcK8S_Namespace", "DstK8S_Namespace", "SrcK8S_HostName", "DstK8S_HostName"},
	},
	{
		Enabled:    false,
		Name:       "netobserv_workload_rtt_seconds",
		Type:       "Histogram",
		ValueField: "TimeFlowRttNs",
		Labels: []string{
			"SrcK8S_Namespace",
			"DstK8S_Namespace",
			"K8S_FlowLayer",
			"SrcSubnetLabel",
			"DstSubnetLabel",
			"SrcK8S_OwnerName",
			"DstK8S_OwnerName",
			"SrcK8S_OwnerType",
			"DstK8S_OwnerType",
			"SrcK8S_Type",
			"DstK8S_Type",
		},
	},
}

func TestInventory_Search(t *testing.T) {
	inv := NewInventory(&config.Prometheus{Metrics: configuredMetrics})
	// Search bytes metrics
	search := inv.Search([]string{"SrcK8S_Namespace", "DstK8S_Namespace"}, "Bytes")
	assert.Equal(t, []string{"netobserv_metric_1bis", "netobserv_metric_1"}, search.Found)
	assert.Empty(t, search.Candidates)

	search = inv.Search([]string{"SrcK8S_HostName", "DstK8S_HostName"}, "Bytes")
	assert.Empty(t, search.Found)
	assert.Empty(t, search.Candidates)

	// Search packet metrics
	search = inv.Search([]string{"SrcK8S_Namespace", "DstK8S_Namespace"}, "Packets")
	assert.Empty(t, search.Found)
	assert.Equal(t, []string{"netobserv_metric_2"}, search.Candidates)

	search = inv.Search([]string{"SrcK8S_HostName", "DstK8S_HostName"}, "Packets")
	assert.Empty(t, search.Found)
	assert.Empty(t, search.Candidates)

	// Search flows metrics
	search = inv.Search([]string{"SrcK8S_Namespace", "DstK8S_Namespace"}, "")
	assert.Equal(t, []string{"netobserv_metric_3"}, search.Found)
	assert.Empty(t, search.Candidates)

	search = inv.Search([]string{"SrcK8S_HostName", "DstK8S_HostName"}, "")
	assert.Equal(t, []string{"netobserv_metric_3"}, search.Found)
	assert.Empty(t, search.Candidates)
}

func TestInventory_Search_RTT_Candidate(t *testing.T) {
	inv := NewInventory(&config.Prometheus{Metrics: configuredMetrics})
	// Search bytes metrics
	search := inv.Search([]string{"SrcK8S_Namespace", "DstK8S_Namespace", "K8S_FlowLayer", "DstK8S_Type", "SrcK8S_Type"}, "TimeFlowRttNs")
	assert.Equal(t, []string{"netobserv_workload_rtt_seconds"}, search.Candidates)
}

func TestInventory_Search_MissingLabels(t *testing.T) {
	inv := NewInventory(&config.Prometheus{Metrics: configuredMetrics})
	search := inv.Search([]string{"SrcK8S_Namespace", "DstK8S_Namespace", "SrcK8S_HostName"}, "Bytes")
	assert.Equal(t, map[string][]string{"netobserv_metric_1bis": {"SrcK8S_HostName"}}, search.MissingLabels)
}
