package model

import (
	"fmt"

	json "github.com/json-iterator/go"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils/constants"
	"github.com/prometheus/common/model"
)

// QueryResponse represents the http json response to a storage query (LogQL or PromQL)
type QueryResponse struct {
	Status string            `json:"status"`
	Data   QueryResponseData `json:"data"`
}

// AggregatedQueryResponse represents the aggregated json response to one or more storage queries
type AggregatedQueryResponse struct {
	ResultType    ResultType      `json:"resultType"`
	Result        ResultValue     `json:"result"`
	Stats         AggregatedStats `json:"stats"`
	UnixTimestamp int64           `json:"unixTimestamp"`
}

// AggregatedStats represents the stats of one or more storage queries
type AggregatedStats struct {
	NumQueries   int                    `json:"numQueries"`
	TotalEntries int                    `json:"totalEntries"`
	Duplicates   int                    `json:"duplicates"`
	LimitReached bool                   `json:"limitReached"`
	QueriesStats []interface{}          `json:"queriesStats"`
	DataSources  []constants.DataSource `json:"dataSources"`
}

// ResultType holds the type of the result
type ResultType string

// ResultType values
const (
	ResultTypeStream = "streams"
	ResultTypeScalar = "scalar"
	ResultTypeVector = "vector"
	ResultTypeMatrix = "matrix"
)

// ResultValue interface mimics the promql.Value interface
type ResultValue interface {
	Type() ResultType
}

// QueryResponseData represents the http json response data for a storage query
type QueryResponseData struct {
	ResultType ResultType  `json:"resultType"`
	Result     ResultValue `json:"result"`
	Stats      interface{} `json:"-"`
}

// Type implements the ResultValue interface
func (Streams) Type() ResultType { return ResultTypeStream }

// Type implements the ResultValue interface
func (Scalar) Type() ResultType { return ResultTypeScalar }

// Type implements the ResultValue interface
func (Vector) Type() ResultType { return ResultTypeVector }

// Type implements the ResultValue interface
func (Matrix) Type() ResultType { return ResultTypeMatrix }

// Scalar is a single timestamp/float with no labels
type Scalar model.Scalar

func (s Scalar) MarshalJSON() ([]byte, error) {
	return model.Scalar(s).MarshalJSON()
}

func (s *Scalar) UnmarshalJSON(b []byte) error {
	var v model.Scalar
	if err := v.UnmarshalJSON(b); err != nil {
		return err
	}
	*s = Scalar(v)
	return nil
}

// Vector is a slice of Samples
type Vector []model.Sample

// Matrix is a slice of SampleStreams
type Matrix []model.SampleStream

// UnmarshalJSON implements the json.Unmarshaler interface.
func (q *QueryResponseData) UnmarshalJSON(data []byte) error {
	t, result, stats, err := unmarshalQueryResponseData(data)
	if err != nil {
		return err
	}
	q.ResultType = t
	q.Result = result
	q.Stats = stats

	return nil
}

// UnmarshalJSON implements the json.Unmarshaler interface.
func (q *AggregatedQueryResponse) UnmarshalJSON(data []byte) error {
	t, result, _, err := unmarshalQueryResponseData(data)
	if err != nil {
		return err
	}
	q.ResultType = t
	q.Result = result

	return nil
}

func unmarshalQueryResponseData(data []byte) (ResultType, ResultValue, interface{}, error) {
	unmarshal := struct {
		Type   ResultType      `json:"resultType"`
		Result json.RawMessage `json:"result"`
		Stats  interface{}     `json:"stats"`
	}{}

	err := json.Unmarshal(data, &unmarshal)
	if err != nil {
		return "", nil, nil, err
	}

	var value ResultValue

	switch unmarshal.Type {
	case ResultTypeStream:
		var s Streams
		err = json.Unmarshal(unmarshal.Result, &s)
		for _, mapping := range flowLineMappings {
			for i := range s {
				for ii := range s[i].Entries {
					s[i].Entries[ii].Line = mapping(s[i].Entries[ii].Line)
				}
			}
		}
		value = s
	case ResultTypeMatrix:
		var m Matrix
		err = json.Unmarshal(unmarshal.Result, &m)
		value = m
	case ResultTypeVector:
		var v Vector
		err = json.Unmarshal(unmarshal.Result, &v)
		value = v
	case ResultTypeScalar:
		var v Scalar
		err = json.Unmarshal(unmarshal.Result, &v)
		value = v
	default:
		return "", nil, nil, fmt.Errorf("unknown type: %s", unmarshal.Type)
	}

	if err != nil {
		return "", nil, nil, err
	}

	return unmarshal.Type, value, unmarshal.Stats, nil
}
