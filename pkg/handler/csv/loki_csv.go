package csv

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/netobserv/network-observability-console-plugin/pkg/model"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils"
)

const (
	timePrefix      = "Time"
	startTimeCol    = timePrefix + "FlowStartMs"
	endTimeCol      = timePrefix + "FlowEndMs"
	receivedTimeCol = timePrefix + "Received"
)

// parsedEntry is a flow record (parsed JSON line) associated with the stream it belongs to
type parsedEntry struct {
	stream *model.Stream
	line   map[string]interface{}
}

// GetCSVData makes CSV data containing header as first line + rows.
func GetCSVData(qr *model.AggregatedQueryResponse, columns []string) ([][]string, error) {
	streams, ok := qr.Result.(model.Streams)
	if !ok {
		return nil, fmt.Errorf("loki returned an unexpected type: %T", qr.Result)
	}

	// parse every flow line once, collecting labels & field names as they are discovered
	columnsMap := utils.GetMapInterface(columns)
	labelSet := map[string]struct{}{}
	fieldSet := map[string]struct{}{}
	entries := make([]parsedEntry, 0)
	for s := range streams {
		stream := &streams[s]
		for name := range stream.Labels {
			if isExported(name, columnsMap) {
				labelSet[name] = struct{}{}
			}
		}
		for _, entry := range stream.Entries {
			line, err := decodeLine(entry.Line)
			if err != nil {
				return nil, fmt.Errorf("cannot unmarshal line %s", entry.Line)
			}
			entries = append(entries, parsedEntry{stream: stream, line: line})
			for name := range line {
				// time columns are set first, separately
				if !strings.HasPrefix(name, timePrefix) && isExported(name, columnsMap) {
					fieldSet[name] = struct{}{}
				}
			}
		}
	}

	labels, fields := orderColumns(labelSet, fieldSet, columns)

	// header: time columns first, then labels, then fields
	header := make([]string, 0, len(labels)+len(fields)+3)
	header = append(header, startTimeCol, endTimeCol, receivedTimeCol)
	header = append(header, labels...)
	header = append(header, fields...)

	data := make([][]string, 1, len(entries)+1)
	data[0] = header
	for _, entry := range entries {
		data = append(data, getRowDatas(entry.stream, labels, fields, entry.line, len(header)))
	}
	return data, nil
}

// decodeLine parses a flow record JSON line into a map.
// Numbers are decoded as json.Number to preserve their exact textual value
// in the CSV export (e.g. TimeFlowStartMs as 1700000000000 rather than
// the float64 notation 1.7e+12)
func decodeLine(line string) (map[string]interface{}, error) {
	decoder := json.NewDecoder(strings.NewReader(line))
	decoder.UseNumber()
	parsed := map[string]interface{}{}
	err := decoder.Decode(&parsed)
	if err != nil {
		return nil, err
	}
	return parsed, nil
}

// isExported indicates whether a label / field must be exported:
// everything when no columns are specified (export all),
// or only the names listed in the columns parameter
func isExported(name string, columnsMap map[string]struct{}) bool {
	if len(columnsMap) == 0 {
		return true
	}
	_, exists := columnsMap[name]
	return exists
}

// orderColumns returns the labels and fields to export, in a stable order:
// the order of the columns parameter when specified, alphabetical otherwise.
// A name missing from the response is not returned.
func orderColumns(labelSet, fieldSet map[string]struct{}, columns []string) (labels, fields []string) {
	if len(columns) == 0 {
		return sortedNames(labelSet), sortedNames(fieldSet)
	}
	for _, column := range columns {
		if _, ok := labelSet[column]; ok {
			labels = append(labels, column)
		}
		if _, ok := fieldSet[column]; ok {
			fields = append(fields, column)
		}
	}
	return labels, fields
}

func sortedNames(set map[string]struct{}) []string {
	names := make([]string, 0, len(set))
	for name := range set {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

func getRowDatas(stream *model.Stream, labels, fields []string,
	line map[string]interface{}, size int) []string {
	rowDatas := make([]string, 0, size)

	// set time columns
	rowDatas = append(rowDatas, formatValue(line[startTimeCol]))
	rowDatas = append(rowDatas, formatValue(line[endTimeCol]))
	rowDatas = append(rowDatas, formatValue(line[receivedTimeCol]))

	// set labels values (missing labels are empty)
	for _, label := range labels {
		rowDatas = append(rowDatas, stream.Labels[label])
	}

	// set field values (missing fields are empty)
	for _, field := range fields {
		rowDatas = append(rowDatas, formatValue(line[field]))
	}

	return rowDatas
}

// formatValue stringifies a flow record value, leaving missing values empty.
// Numbers are kept as their original textual value (see decodeLine)
func formatValue(value interface{}) string {
	if value == nil {
		return ""
	}
	return fmt.Sprint(value)
}
