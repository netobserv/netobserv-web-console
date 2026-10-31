package metricsexport

import (
	"io"
	"math"
	"strconv"

	"github.com/netobserv/network-observability-console-plugin/pkg/export"
)

var metricHeaders = []string{
	"metricGroup",
	"series",
	"timestamp",
	"timestampIso",
	"value",
	"sourceKind",
	"sourceName",
	"destinationKind",
	"destinationName",
}

var edgeHeaders = []string{
	"metricGroup",
	"sourceKind",
	"sourceName",
	"destinationKind",
	"destinationName",
	"sum",
	"avg",
	"min",
	"max",
	"latest",
}

// CSVRows builds CSV rows for a metrics export report.
func CSVRows(report *Report) [][]string {
	rows := make([][]string, 0, len(report.Metrics)+len(report.TopologyEdges)+3)
	rows = append(rows, metricHeaders)
	for i := range report.Metrics {
		rows = append(rows, metricSeriesToCSV(&report.Metrics[i]))
	}
	if len(report.TopologyEdges) > 0 {
		rows = append(rows, []string{})
		rows = append(rows, edgeHeaders)
		for i := range report.TopologyEdges {
			rows = append(rows, topologyEdgeToCSV(&report.TopologyEdges[i]))
		}
	}
	return rows
}

// WriteCSV writes metrics series and optional topology edges to CSV.
func WriteCSV(w io.Writer, report *Report) error {
	return export.WriteCSV(w, CSVRows(report))
}

func metricSeriesToCSV(row *MetricSeriesRow) []string {
	return []string{
		row.MetricGroup,
		row.Series,
		strconv.FormatInt(row.Timestamp, 10),
		row.TimestampISO,
		formatFloat(float64(row.Value)),
		row.SourceKind,
		row.SourceName,
		row.DestinationKind,
		row.DestinationName,
	}
}

func topologyEdgeToCSV(row *TopologyEdgeRow) []string {
	return []string{
		row.MetricGroup,
		row.SourceKind,
		row.SourceName,
		row.DestinationKind,
		row.DestinationName,
		formatFloat(float64(row.Sum)),
		formatFloat(float64(row.Avg)),
		formatFloat(float64(row.Min)),
		formatFloat(float64(row.Max)),
		formatFloat(float64(row.Latest)),
	}
}

func formatFloat(v float64) string {
	if math.IsNaN(v) || math.IsInf(v, 0) {
		return ""
	}
	return strconv.FormatFloat(v, 'f', -1, 64)
}
