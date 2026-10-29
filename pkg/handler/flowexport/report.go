package flowexport

import (
	"encoding/json"
	"time"

	csvdata "github.com/netobserv/network-observability-console-plugin/pkg/handler/csv"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
)

// Record is one exported flow row.
type Record struct {
	Labels map[string]string      `json:"labels"`
	Fields map[string]interface{} `json:"fields"`
}

// FlowsExportReport is the JSON export payload for /api/loki/export.
type FlowsExportReport struct {
	ExportedAt string          `json:"exportedAt"`
	TimeRange  json.RawMessage `json:"timeRange,omitempty"`
	Flows      []Record        `json:"flows"`
}

// BuildReport builds a JSON export report from a Loki streams response.
func BuildReport(qr *model.AggregatedQueryResponse, columns []string, timeRange json.RawMessage) (FlowsExportReport, error) {
	rows, err := csvdata.GetFlowRecords(qr, columns)
	if err != nil {
		return FlowsExportReport{}, err
	}
	flows := make([]Record, 0, len(rows))
	for _, row := range rows {
		flows = append(flows, Record{Labels: row.Labels, Fields: row.Fields})
	}
	return FlowsExportReport{
		ExportedAt: time.Now().UTC().Format(time.RFC3339),
		TimeRange:  timeRange,
		Flows:      flows,
	}, nil
}
