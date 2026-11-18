package merger

import (
	"fmt"
	"slices"
	"sort"
	"sync"
	"time"

	pmodel "github.com/prometheus/common/model"

	"github.com/netobserv/network-observability-console-plugin/pkg/model"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils/constants"
)

// MatrixMerger aggregates multiple Matrix results from Loki or Prometheus queries.
type MatrixMerger struct {
	index        map[string]indexedSampleStream
	merged       model.Matrix
	stats        []interface{}
	numQueries   int
	reqLimit     int
	limitReached bool
	datasources  []constants.DataSource
	mu           sync.RWMutex
}

// NewMatrixMerger creates a new MatrixMerger with the given per-query result limit.
func NewMatrixMerger(reqLimit int) *MatrixMerger {
	return &MatrixMerger{
		reqLimit: reqLimit,
		index:    map[string]indexedSampleStream{},
		merged:   model.Matrix{},
		stats:    []interface{}{},
	}
}

// indexedSampleStream stores a unique SampleStream at a specific index with merged values
type indexedSampleStream struct {
	values map[pmodel.Time]pmodel.SampleValue
	index  int
}

// Add merges a new QueryResponse (Matrix result) into the aggregated result.
func (m *MatrixMerger) Add(from *model.QueryResponse, ds constants.DataSource) (model.ResultValue, error) {
	matrix, ok := from.Data.Result.(model.Matrix)
	if !ok {
		return nil, fmt.Errorf("unexpected result type for MatrixMerger: %T", from)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	m.numQueries++
	if !slices.Contains(m.datasources, ds) {
		m.datasources = append(m.datasources, ds)
	}
	m.stats = append(m.stats, from.Data.Stats)
	m.mergeStreams(matrix)

	// In Matrix results, the limit stands for the "topk" value, which relates to the number of streams
	//	(ie LabelSet cardinality)
	if from.LimitReached || (m.reqLimit > 0 && len(m.merged) >= m.reqLimit) {
		m.limitReached = true
	}
	return m.merged, nil
}

// Add merges a new QueryResponse (Matrix result) into the aggregated result.
func (m *MatrixMerger) Merge(other *model.AggregatedQueryResponse) (model.ResultValue, error) {
	matrix, ok := other.Result.(model.Matrix)
	if !ok {
		return nil, fmt.Errorf("unexpected result type for MatrixMerger: %T", other)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	m.numQueries += other.Stats.NumQueries
	for _, ds := range other.Stats.DataSources {
		if !slices.Contains(m.datasources, ds) {
			m.datasources = append(m.datasources, ds)
		}
	}
	m.stats = append(m.stats, other.Stats.QueriesStats...)
	m.mergeStreams(matrix)

	if other.Stats.LimitReached || (m.reqLimit > 0 && len(m.merged) >= m.reqLimit) {
		m.limitReached = true
	}
	return m.merged, nil
}

func (m *MatrixMerger) mergeStreams(other model.Matrix) {
	for _, sampleStream := range other {
		skey := sampleStream.Metric.String()
		idxSampleStream, sampleStreamExists := m.index[skey]
		if !sampleStreamExists {
			// SampleStream doesn't exist => create new index
			idxSampleStream = indexedSampleStream{
				values: map[pmodel.Time]pmodel.SampleValue{},
				index:  len(m.index),
			}
			m.merged = append(m.merged, pmodel.SampleStream{Metric: sampleStream.Metric.Clone()})
			// Add index
			m.index[skey] = idxSampleStream
		}
		// Merge content (values)
		for _, v := range sampleStream.Values {
			if prev, valueExists := idxSampleStream.values[v.Timestamp]; valueExists {
				// Add value to the existing sampleStream
				idxSampleStream.values[v.Timestamp] = prev + v.Value
			} else {
				// New value
				idxSampleStream.values[v.Timestamp] = v.Value
			}
		}
	}
}

// Get returns the final aggregated AggregatedQueryResponse.
func (m *MatrixMerger) Get() *model.AggregatedQueryResponse {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for idx, stream := range m.merged {
		skey := stream.Metric.String()
		if indexed, ok := m.index[skey]; ok {
			values := []pmodel.SamplePair{}
			for timestamp, value := range indexed.values {
				values = append(values, pmodel.SamplePair{Timestamp: timestamp, Value: value})
			}
			sort.Slice(values, func(i, j int) bool { return values[i].Timestamp.Before(values[j].Timestamp) })
			m.merged[idx].Values = values
		}
	}
	return &model.AggregatedQueryResponse{
		ResultType: model.ResultTypeMatrix,
		Result:     m.merged,
		Stats: model.AggregatedStats{
			NumQueries:   m.numQueries,
			LimitReached: m.limitReached,
			QueriesStats: m.stats,
			DataSources:  m.datasources,
			TotalEntries: len(m.merged),
		},
		UnixTimestamp: time.Now().Unix(),
	}
}
