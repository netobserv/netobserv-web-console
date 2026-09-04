package flowexport

import (
	"encoding/json"
	"os"
	"testing"

	csvdata "github.com/netobserv/network-observability-console-plugin/pkg/handler/csv"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildReportFromFixture(t *testing.T) {
	raw, err := os.ReadFile("../../../mocks/loki/flow_records.json")
	require.NoError(t, err)

	var response model.QueryResponse
	require.NoError(t, json.Unmarshal(raw, &response))

	qr := &model.AggregatedQueryResponse{
		ResultType: response.Data.ResultType,
		Result:     response.Data.Result,
	}

	records, err := csvdata.GetFlowRecords(qr, nil)
	require.NoError(t, err)
	require.NotEmpty(t, records)

	report, err := BuildReport(qr, nil, json.RawMessage(`300`))
	require.NoError(t, err)

	assert.NotEmpty(t, report.ExportedAt)
	assert.JSONEq(t, `300`, string(report.TimeRange))
	assert.Len(t, report.Flows, len(records))
	assert.Equal(t, records[0].Labels["K8S_ClusterName"], report.Flows[0].Labels["K8S_ClusterName"])
	assert.NotEmpty(t, report.Flows[0].Fields["SrcAddr"])
}
