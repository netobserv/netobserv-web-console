// Package model contains data models for Loki-specific types and shared query response types.
package model

import (
	"fmt"
	"strconv"
	"time"

	json "github.com/json-iterator/go"
)

type FlowLineMapping = func(string) string

var (
	flowLineMappings = []FlowLineMapping{}
)

// AddFlowLineMapping registers a function that transforms Loki log lines before parsing.
func AddFlowLineMapping(f FlowLineMapping) {
	flowLineMappings = append(flowLineMappings, f)
}

// Streams is a slice of Stream
type Streams []Stream

// Stream represents a Loki log stream. It includes a set of log entries and their labels.
type Stream struct {
	Labels  map[string]string `json:"stream"`
	Entries []Entry           `json:"values"`
}

// Entry represents a Loki log entry. It includes a log message and the time it occurred at.
type Entry struct {
	Timestamp time.Time
	Line      string
}

// LabelValuesResponse represents the http json response to a Loki query for label values
type LabelValuesResponse struct {
	Status string   `json:"status"`
	Data   []string `json:"data"`
}

// MarshalJSON implements the json.Marshaler interface.
func (e *Entry) MarshalJSON() ([]byte, error) {
	l, err := json.Marshal(e.Line)
	if err != nil {
		return nil, err
	}
	return []byte(fmt.Sprintf("[\"%d\",%s]", e.Timestamp.UnixNano(), l)), nil
}

// UnmarshalJSON implements the json.Unmarshaler interface.
func (e *Entry) UnmarshalJSON(data []byte) error {
	var unmarshal []string

	err := json.Unmarshal(data, &unmarshal)
	if err != nil {
		return err
	}

	t, err := strconv.ParseInt(unmarshal[0], 10, 64)
	if err != nil {
		return err
	}

	e.Timestamp = time.Unix(0, t)
	e.Line = unmarshal[1]

	return nil
}
