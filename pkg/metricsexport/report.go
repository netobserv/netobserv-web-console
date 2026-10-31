package metricsexport

import (
	"encoding/json"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/netobserv/network-observability-console-plugin/pkg/metricsparse"
)

const totalSeriesName = "total"

// ExportFloat marshals NaN/Inf as JSON null (encoding/json rejects NaN).
type ExportFloat float64

func (f ExportFloat) MarshalJSON() ([]byte, error) {
	v := float64(f)
	if math.IsNaN(v) || math.IsInf(v, 0) {
		return []byte("null"), nil
	}
	return strconv.AppendFloat(make([]byte, 0, 24), v, 'f', -1, 64), nil
}

// MetricSeriesRow is a flattened time-series datapoint for export.
type MetricSeriesRow struct {
	MetricGroup     string      `json:"metricGroup"`
	Series          string      `json:"series"`
	Timestamp       int64       `json:"timestamp"`
	TimestampISO    string      `json:"timestampIso"`
	Value           ExportFloat `json:"value"`
	SourceKind      string      `json:"sourceKind,omitempty"`
	SourceName      string      `json:"sourceName,omitempty"`
	DestinationKind string      `json:"destinationKind,omitempty"`
	DestinationName string      `json:"destinationName,omitempty"`
}

// TopologyEdgeRow is an aggregate stats row for a topology edge.
type TopologyEdgeRow struct {
	MetricGroup     string      `json:"metricGroup"`
	SourceKind      string      `json:"sourceKind"`
	SourceName      string      `json:"sourceName"`
	DestinationKind string      `json:"destinationKind"`
	DestinationName string      `json:"destinationName"`
	Sum             ExportFloat `json:"sum"`
	Avg             ExportFloat `json:"avg"`
	Min             ExportFloat `json:"min"`
	Max             ExportFloat `json:"max"`
	Latest          ExportFloat `json:"latest"`
}

// Report is the JSON export payload.
type Report struct {
	ExportedAt    string            `json:"exportedAt"`
	TimeRange     json.RawMessage   `json:"timeRange"`
	MetricScope   string            `json:"metricScope,omitempty"`
	Metrics       []MetricSeriesRow `json:"metrics"`
	TopologyEdges []TopologyEdgeRow `json:"topologyEdges,omitempty"`
}

// QueryInput describes how to name metric groups for an export query.
type QueryInput struct {
	MetricGroup    string
	MetricType     string
	MetricFunction string
	AggregateBy    string
}

func timestampToISO(sec int64) string {
	return time.Unix(sec, 0).UTC().Format(time.RFC3339)
}

func roundTwoDigits(v float64) float64 {
	if math.IsNaN(v) || math.IsInf(v, 0) {
		return v
	}
	return math.Round(v*100) / 100
}

func normalizeSeriesName(series string) string {
	s := strings.TrimSpace(series)
	switch s {
	case "", "{}":
		return totalSeriesName
	default:
		return s
	}
}

func formatPeer(kind, name string) string {
	if kind != "" && name != "" {
		return kind + "/" + name
	}
	if name != "" {
		return name
	}
	return ""
}

func topologySeriesName(srcKind, srcName, dstKind, dstName string) string {
	src := formatPeer(srcKind, srcName)
	dst := formatPeer(dstKind, dstName)
	if src == "" && dst == "" {
		return ""
	}
	return strings.TrimSpace(src + " -> " + dst)
}

// AppendEnriched flattens enriched topology/generic metrics into export rows.
func AppendEnriched(
	rows []MetricSeriesRow,
	edges []TopologyEdgeRow,
	resultType string,
	result interface{},
	input QueryInput,
	includeTopologyEdges bool,
) ([]MetricSeriesRow, []TopologyEdgeRow) {
	group := MetricGroup(input.MetricType, input.MetricFunction, input.AggregateBy, input.MetricGroup)

	switch resultType {
	case metricsparse.ResultTypeTopologyMetrics:
		metrics, _ := result.([]metricsparse.TopologyMetric)
		for i := range metrics {
			m := &metrics[i]
			srcKind, srcName := metricsparse.FormatPeerKindName(&m.Source)
			dstKind, dstName := metricsparse.FormatPeerKindName(&m.Destination)
			series := normalizeSeriesName(topologySeriesName(srcKind, srcName, dstKind, dstName))
			for _, dp := range m.Values {
				ts := int64(dp[0])
				val := roundTwoDigits(dp[1])
				rows = append(rows, MetricSeriesRow{
					MetricGroup:     group,
					Series:          series,
					Timestamp:       ts,
					TimestampISO:    timestampToISO(ts),
					Value:           ExportFloat(val),
					SourceKind:      srcKind,
					SourceName:      srcName,
					DestinationKind: dstKind,
					DestinationName: dstName,
				})
			}
			if includeTopologyEdges && includeTopologyEdgesForGroup(group) {
				edges = append(edges, TopologyEdgeRow{
					MetricGroup:     group,
					SourceKind:      srcKind,
					SourceName:      srcName,
					DestinationKind: dstKind,
					DestinationName: dstName,
					Sum:             ExportFloat(m.Stats.Sum),
					Avg:             ExportFloat(m.Stats.Avg),
					Min:             ExportFloat(m.Stats.Min),
					Max:             ExportFloat(m.Stats.Max),
					Latest:          ExportFloat(m.Stats.Latest),
				})
			}
		}
	case metricsparse.ResultTypeGenericMetrics:
		metrics, _ := result.([]metricsparse.GenericMetric)
		for i := range metrics {
			m := &metrics[i]
			series := normalizeSeriesName(m.Name)
			for _, dp := range m.Values {
				ts := int64(dp[0])
				val := roundTwoDigits(dp[1])
				rows = append(rows, MetricSeriesRow{
					MetricGroup:  group,
					Series:       series,
					Timestamp:    ts,
					TimestampISO: timestampToISO(ts),
					Value:        ExportFloat(val),
				})
			}
		}
	}
	return rows, edges
}

// BuildReport assembles the final export report.
func BuildReport(
	timeRange json.RawMessage,
	metricScope string,
	rows []MetricSeriesRow,
	edges []TopologyEdgeRow,
	includeTopologyEdges bool,
) Report {
	report := Report{
		ExportedAt:  time.Now().UTC().Format(time.RFC3339),
		TimeRange:   timeRange,
		MetricScope: metricScope,
		Metrics:     rows,
	}
	if includeTopologyEdges && len(edges) > 0 {
		report.TopologyEdges = edges
	}
	return report
}
