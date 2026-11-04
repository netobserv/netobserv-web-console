package backends

import (
	"github.com/netobserv/network-observability-console-plugin/pkg/backend"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/filters"
)

// FullFlowsParams encapsulates parameters for fetching flows potentially in parallel
type FullFlowsParams struct {
	backend.FlowParams
	FilterGroups filters.MultiQueries
}

// FullMetricsParams encapsulates parameters for fetching metrics through potentially several backends
type FullMetricsParams struct {
	backend.MetricsParams
	FilterGroups filters.MultiQueries
}
