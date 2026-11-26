package csv

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/netobserv/network-observability-console-plugin/pkg/model"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils/constants"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func flowsResponse(streams ...model.Stream) *model.AggregatedQueryResponse {
	return &model.AggregatedQueryResponse{
		ResultType: model.ResultTypeStream,
		Result:     model.Streams(streams),
	}
}

func entries(lines ...string) []model.Entry {
	entries := make([]model.Entry, 0, len(lines))
	for _, line := range lines {
		entries = append(entries, model.Entry{Timestamp: time.Unix(1700000000, 0), Line: line})
	}
	return entries
}

const (
	firstLine = `{"TimeFlowStartMs":1700000000000,"TimeFlowEndMs":1700000001000,"TimeReceived":1700000001,` +
		`"SrcAddr":"10.0.0.1","DstAddr":"8.8.8.8","SrcK8S_Name":"my-pod","Packets":42}`
	// unlike the first one, this flow record has a Kubernetes destination (DstK8S_Name)
	// but no Packets field
	secondLine = `{"TimeFlowStartMs":1700000002000,"TimeFlowEndMs":1700000003000,"TimeReceived":1700000002,` +
		`"SrcAddr":"10.0.0.1","DstAddr":"10.0.0.2","SrcK8S_Name":"my-pod","DstK8S_Name":"other-pod"}`
)

// Regression test for missing columns in "export all": flow records have variable
// field sets (e.g. DstK8S_* fields only when the endpoint is a Kubernetes resource),
// so columns must be the union of fields over all flow records, not the ones of the
// first record only.
func TestGetCSVData(t *testing.T) {
	qr := flowsResponse(model.Stream{
		Labels:  map[string]string{"FlowDirection": "Egress"},
		Entries: entries(firstLine, secondLine),
	})

	data, err := GetCSVData(qr, nil)
	require.NoError(t, err)
	require.Len(t, data, 3)

	// header: time columns, then labels, then fields (both alphabetical)
	assert.Equal(t,
		[]string{
			"TimeFlowStartMs", "TimeFlowEndMs", "TimeReceived",
			"FlowDirection",
			"DstAddr", "DstK8S_Name", "Packets", "SrcAddr", "SrcK8S_Name",
		},
		data[0])

	// DstK8S_Name must be exported even if missing from the first flow record,
	// with an empty value for records that do not have it (and reciprocally
	// for Packets, missing from the second record)
	// (numbers keep their exact value from the flow records)
	assert.Equal(t,
		[]string{"1700000000000", "1700000001000", "1700000001", "Egress", "8.8.8.8", "", "42", "10.0.0.1", "my-pod"},
		data[1])
	assert.Equal(t,
		[]string{"1700000002000", "1700000003000", "1700000002", "Egress", "10.0.0.2", "other-pod", "", "10.0.0.1", "my-pod"},
		data[2])
}

// Labels may also vary between streams: they must be unioned as well
func TestGetCSVDataLabelMissingFromFirstStream(t *testing.T) {
	qr := flowsResponse(
		model.Stream{
			Labels:  map[string]string{"FlowDirection": "Egress"},
			Entries: entries(firstLine),
		},
		model.Stream{
			Labels:  map[string]string{"FlowDirection": "Ingress", "Zone": "zone-a"},
			Entries: entries(secondLine),
		},
	)

	data, err := GetCSVData(qr, nil)
	require.NoError(t, err)
	require.Len(t, data, 3)

	// Zone is only present in the second stream: it must still be exported,
	// with an empty value for the first stream entries
	assert.Equal(t,
		[]string{
			"TimeFlowStartMs", "TimeFlowEndMs", "TimeReceived",
			"FlowDirection", "Zone",
			"DstAddr", "DstK8S_Name", "Packets", "SrcAddr", "SrcK8S_Name",
		},
		data[0])
	assert.Equal(t, "Egress", data[1][3])
	assert.Equal(t, "", data[1][4])
	assert.Equal(t, "Ingress", data[2][3])
	assert.Equal(t, "zone-a", data[2][4])
}

// Numbers are exported with their exact textual value from the flow records,
// not reformatted as float64 (which turns large values such as timestamps
// into scientific notation, e.g. 1.7e+12)
func TestGetCSVDataNumberFormatting(t *testing.T) {
	qr := flowsResponse(model.Stream{
		Labels: map[string]string{},
		Entries: entries(`{"TimeFlowStartMs":1700000000000,"TimeFlowEndMs":1700000001000,"TimeReceived":1700000001,` +
			`"Bytes":1500,"DnsLatencyMs":0.25,"Packets":42}`),
	})

	data, err := GetCSVData(qr, nil)
	require.NoError(t, err)
	require.Len(t, data, 2)

	assert.Equal(t,
		[]string{"TimeFlowStartMs", "TimeFlowEndMs", "TimeReceived", "Bytes", "DnsLatencyMs", "Packets"},
		data[0])
	assert.Equal(t,
		[]string{"1700000000000", "1700000001000", "1700000001", "1500", "0.25", "42"},
		data[1])
}

func TestGetCSVDataColumnsFilter(t *testing.T) {
	qr := flowsResponse(model.Stream{
		Labels:  map[string]string{"FlowDirection": "Egress", "Zone": "zone-a"},
		Entries: entries(firstLine, secondLine),
	})

	// only the requested columns are exported, in the requested order
	// (unknown columns are ignored)
	data, err := GetCSVData(qr, []string{"SrcK8S_Name", "FlowDirection", "DstK8S_Name", "Unknown"})
	require.NoError(t, err)
	require.Len(t, data, 3)

	assert.Equal(t,
		[]string{"TimeFlowStartMs", "TimeFlowEndMs", "TimeReceived", "FlowDirection", "SrcK8S_Name", "DstK8S_Name"},
		data[0])
	assert.Equal(t, []string{"1700000000000", "1700000001000", "1700000001", "Egress", "my-pod", ""}, data[1])
	assert.Equal(t, []string{"1700000002000", "1700000003000", "1700000002", "Egress", "my-pod", "other-pod"}, data[2])
}

func TestGetCSVDataEmptyResponse(t *testing.T) {
	data, err := GetCSVData(flowsResponse(), nil)
	require.NoError(t, err)
	assert.Equal(t, [][]string{{startTimeCol, endTimeCol, receivedTimeCol}}, data)
}

func TestGetCSVDataBadLine(t *testing.T) {
	qr := flowsResponse(model.Stream{
		Labels:  map[string]string{"FlowDirection": "Egress"},
		Entries: entries(firstLine, `{invalid`),
	})

	_, err := GetCSVData(qr, nil)
	assert.ErrorContains(t, err, "cannot unmarshal line")
}

func TestGetCSVDataUnexpectedType(t *testing.T) {
	qr := &model.AggregatedQueryResponse{ResultType: model.ResultTypeScalar, Result: &model.Scalar{}}

	_, err := GetCSVData(qr, nil)
	assert.ErrorContains(t, err, "loki returned an unexpected type")
}

// End-to-end test on mocked Loki data: its first flow record does not contain
// DstK8S_Name while subsequent ones do, which used to remove the column from
// the whole export.
func TestGetCSVDataFromMockedFlows(t *testing.T) {
	raw, err := os.ReadFile("../../../mocks/loki/flow_records.json")
	require.NoError(t, err)

	var qr model.QueryResponse
	err = json.Unmarshal(raw, &qr)
	require.NoError(t, err)

	streams, ok := qr.Data.Result.(model.Streams)
	require.True(t, ok)
	require.NotEmpty(t, streams)
	require.NotEmpty(t, streams[0].Entries)

	data, err := GetCSVData(model.NewAggregatedQueryResponse(&qr, constants.DataSourceLoki), nil)
	require.NoError(t, err)
	require.NotEmpty(t, data)

	header := data[0]
	assert.Contains(t, header, "SrcK8S_Name")
	assert.Contains(t, header, "DstK8S_Name")
	// every row must have as many values as the header
	for i, row := range data[1:] {
		assert.Len(t, row, len(header), "row %d", i)
	}

	// numbers must be exported with their exact textual value from the
	// flow records (e.g. no scientific notation for TimeFlowStartMs)
	var firstLine map[string]json.RawMessage
	err = json.Unmarshal([]byte(streams[0].Entries[0].Line), &firstLine)
	require.NoError(t, err)
	assert.Equal(t, strings.TrimSpace(string(firstLine[startTimeCol])), data[1][0])
}
