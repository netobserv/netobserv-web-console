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

// FlowRecord is one parsed flow entry used by CSV and JSON exports.
type FlowRecord struct {
	Labels map[string]string
	Fields map[string]interface{}
}

type flowExportData struct {
	labels  []string
	fields  []string
	records []FlowRecord
}

type parsedEntry struct {
	labels map[string]string
	line   map[string]interface{}
}

// GetFlowRecords parses stream results into structured flow records.
func GetFlowRecords(qr *model.AggregatedQueryResponse, columns []string) ([]FlowRecord, error) {
	data, err := getFlowExportData(qr, columns)
	if err != nil {
		return nil, err
	}
	return data.records, nil
}

// GetCSVData builds CSV rows (header + data) from stream results.
func GetCSVData(qr *model.AggregatedQueryResponse, columns []string) ([][]string, error) {
	data, err := getFlowExportData(qr, columns)
	if err != nil {
		return nil, err
	}

	rows := make([][]string, 0, len(data.records)+1)
	header := append([]string{startTimeCol, endTimeCol, receivedTimeCol}, data.labels...)
	header = append(header, data.fields...)
	rows = append(rows, header)

	for _, record := range data.records {
		row := []string{
			stringify(record.Fields[startTimeCol]),
			stringify(record.Fields[endTimeCol]),
			stringify(record.Fields[receivedTimeCol]),
		}
		for _, label := range data.labels {
			row = append(row, record.Labels[label])
		}
		for _, field := range data.fields {
			row = append(row, stringify(record.Fields[field]))
		}
		rows = append(rows, row)
	}

	return rows, nil
}

func getFlowExportData(qr *model.AggregatedQueryResponse, columns []string) (*flowExportData, error) {
	streams, ok := qr.Result.(model.Streams)
	if !ok {
		return nil, fmt.Errorf("loki returned an unexpected type: %T", qr.Result)
	}

	columnsMap := utils.GetMapInterface(columns)
	labelSet := map[string]struct{}{}
	fieldSet := map[string]struct{}{}
	entries := make([]parsedEntry, 0)

	for _, stream := range streams {
		for name := range stream.Labels {
			if _, exists := columnsMap[name]; exists || len(columns) == 0 {
				labelSet[name] = struct{}{}
			}
		}

		for _, entry := range stream.Entries {
			var line map[string]interface{}
			if err := json.Unmarshal([]byte(entry.Line), &line); err != nil {
				return nil, fmt.Errorf("cannot unmarshal flow line: %w", err)
			}

			for name := range line {
				if strings.HasPrefix(name, timePrefix) {
					continue
				}
				if _, exists := columnsMap[name]; exists || len(columns) == 0 {
					fieldSet[name] = struct{}{}
				}
			}

			labels := make(map[string]string, len(stream.Labels))
			for name, value := range stream.Labels {
				labels[name] = value
			}
			entries = append(entries, parsedEntry{labels: labels, line: line})
		}
	}

	data := &flowExportData{
		labels:  sortedKeys(labelSet),
		fields:  sortedKeys(fieldSet),
		records: make([]FlowRecord, 0, len(entries)),
	}

	for _, entry := range entries {
		labels := make(map[string]string, len(data.labels))
		for _, label := range data.labels {
			labels[label] = entry.labels[label]
		}

		fields := make(map[string]interface{}, len(data.fields)+3)
		fields[startTimeCol] = entry.line[startTimeCol]
		fields[endTimeCol] = entry.line[endTimeCol]
		fields[receivedTimeCol] = entry.line[receivedTimeCol]
		for _, field := range data.fields {
			fields[field] = entry.line[field]
		}

		data.records = append(data.records, FlowRecord{Labels: labels, Fields: fields})
	}

	return data, nil
}

func stringify(v interface{}) string {
	if v == nil {
		return ""
	}
	return fmt.Sprint(v)
}

func sortedKeys(set map[string]struct{}) []string {
	keys := make([]string, 0, len(set))
	for key := range set {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}
