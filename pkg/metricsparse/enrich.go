package metricsparse

import (
	"strings"

	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/fields"
	pmodel "github.com/prometheus/common/model"
)

// EnrichMatrix converts a raw Prometheus/Loki matrix into topology or generic metrics.
func EnrichMatrix(matrix model.Matrix, in *EnrichInput) (resultType string, result interface{}) {
	if useTopologyEnrichment(matrix, in) {
		return ResultTypeTopologyMetrics, parseTopologyMetrics(matrix, in)
	}
	return ResultTypeGenericMetrics, parseGenericMetrics(matrix, in)
}

// EnrichTopology always builds topology metrics (peers + stats), matching the
// historical frontend getFlowMetrics path. Used for fixture conversion and tests
// where a matrix may lack Src/Dst on every series (e.g. cluster-only labels).
func EnrichTopology(matrix model.Matrix, in *EnrichInput) []TopologyMetric {
	return parseTopologyMetrics(matrix, in)
}

func useTopologyEnrichment(matrix model.Matrix, in *EnrichInput) bool {
	if isMatrixTopology(matrix) {
		return true
	}
	// Overview totals and scope aggregates historically used getFlowMetrics →
	// TopologyMetrics (even for app-only / cluster-only label sets).
	return isFlowScopeAggregate(in.AggregateBy, in.Scopes)
}

func isFlowScopeAggregate(aggregateBy string, scopes []config.Scope) bool {
	base := strings.TrimSuffix(aggregateBy, topologyTLSVersionAggregateSuffix)
	switch base {
	case "", "app", "addr":
		return true
	}
	for i := range scopes {
		if scopes[i].ID == base {
			return true
		}
	}
	return false
}

func isMatrixTopology(matrix model.Matrix) bool {
	for i := range matrix {
		if IsTopologyMetric(matrix[i].Metric) {
			return true
		}
	}
	return false
}

func parseTopologyMetrics(matrix model.Matrix, in *EnrichInput) []TopologyMetric {
	rawValues := make([][]Datapoint, len(matrix))
	for i := range matrix {
		rawValues[i] = streamValues(&matrix[i])
	}
	cal := calibrateRange(rawValues, in)

	metrics := make([]TopologyMetric, 0, len(matrix))
	for i := range matrix {
		metrics = append(metrics, parseTopologyMetric(&matrix[i], cal, in))
	}

	scopeForDisambiguation := strings.TrimSuffix(in.AggregateBy, topologyTLSVersionAggregateSuffix)
	if scopeForDisambiguation == "owner" || scopeForDisambiguation == "resource" {
		markAmbiguous(metrics)
	}
	return metrics
}

func parseTopologyMetric(stream *pmodel.SampleStream, cal calibratedRange, in *EnrichInput) TopologyMetric {
	normalized := normalizeMetrics(streamValues(stream), cal.start, cal.end, cal.step, in.ForceZeros)
	stats := computeStats(normalized)
	source := peerFromMetric(stream.Metric, fields.Src, in.Scopes)
	destination := peerFromMetric(stream.Metric, fields.Dst, in.Scopes)
	tls := tlsFromMetric(stream.Metric)
	return TopologyMetric{
		Source:      source,
		Destination: destination,
		Values:      normalized,
		Stats:       stats,
		Scope:       in.AggregateBy,
		TLS:         tls,
	}
}

func parseGenericMetrics(matrix model.Matrix, in *EnrichInput) []GenericMetric {
	rawValues := make([][]Datapoint, len(matrix))
	for i := range matrix {
		rawValues[i] = streamValues(&matrix[i])
	}
	cal := calibrateRange(rawValues, in)

	metrics := make([]GenericMetric, 0, len(matrix))
	for i := range matrix {
		metrics = append(metrics, parseGenericMetric(&matrix[i], cal, in))
	}
	return metrics
}

func parseGenericMetric(stream *pmodel.SampleStream, cal calibratedRange, in *EnrichInput) GenericMetric {
	normalized := normalizeMetrics(streamValues(stream), cal.start, cal.end, cal.step, in.ForceZeros)
	stats := computeStats(normalized)
	name := labelString(stream.Metric, in.AggregateBy)
	tls := tlsFromMetric(stream.Metric)
	return GenericMetric{
		Name:        name,
		Values:      normalized,
		Stats:       stats,
		AggregateBy: in.AggregateBy,
		TLS:         tls,
	}
}

func markAmbiguous(metrics []TopologyMetric) {
	nameKinds := map[string]map[string]struct{}{}
	addKind := func(p *Peer) {
		name := peerDisplayName(p, true, false)
		if name == "" {
			return
		}
		set, ok := nameKinds[name]
		if !ok {
			set = map[string]struct{}{}
			nameKinds[name] = set
		}
		if p.ResourceKind != "" {
			set[p.ResourceKind] = struct{}{}
		}
	}
	for i := range metrics {
		addKind(&metrics[i].Source)
		addKind(&metrics[i].Destination)
	}
	check := func(p *Peer) {
		name := peerDisplayName(p, true, false)
		if name == "" {
			return
		}
		kinds := nameKinds[name]
		if len(kinds) > 1 && p.ResourceKind != "" {
			p.IsAmbiguous = true
		}
	}
	for i := range metrics {
		check(&metrics[i].Source)
		check(&metrics[i].Destination)
	}
}
