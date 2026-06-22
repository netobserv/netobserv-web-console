// Package queryparams provides shared query parameter types and helpers used by
// both the Loki and Prometheus query builders.
package queryparams

import (
	"slices"
	"strings"

	"github.com/netobserv/network-observability-console-plugin/pkg/utils/constants"
)

// TopologyInput holds the common query parameters for topology (metrics) queries,
// shared by both Loki and Prometheus query builders.
type TopologyInput struct {
	Start          string
	End            string
	Top            string
	RateInterval   string
	Step           string
	DataField      string
	MetricFunction constants.MetricFunction
	RecordType     constants.RecordType
	DataSource     constants.DataSource
	PacketLoss     constants.PacketLoss
	Aggregate      string
	Groups         string
}

// GetActualDataField returns the data field for unwrap/aggregation, or empty string
// for count-type metrics that do not unwrap a specific field.
func (in *TopologyInput) GetActualDataField() string {
	switch in.DataField {
	case constants.MetricTypeFlows, constants.MetricTypeDNSFlows, constants.MetricTypeTLSFlows:
		return ""
	default:
		return in.DataField
	}
}

// GetLabelsAndFilter returns the label fields to aggregate by and an optional extra
// line filter for the given aggregate and groups configuration.
// This function is shared by both Loki and Prometheus query builders.
func GetLabelsAndFilter(kl map[string][]string, aggregate, groups string) ([]string, string) {
	var fields []string
	var filter string
	if fields = kl[aggregate]; fields == nil {
		fields = []string{aggregate}
		filter = aggregate
	}
	if groups != "" {
		for gr, labels := range kl {
			if strings.Contains(groups, gr) {
				for _, label := range labels {
					if !slices.Contains(fields, label) {
						fields = append(fields, label)
					}
				}
			}
		}
	}
	return fields, filter
}
