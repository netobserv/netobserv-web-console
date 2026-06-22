package loki

import (
	"fmt"
	"sort"
	"strings"

	"github.com/netobserv/network-observability-console-plugin/pkg/model"
)

type StreamMerger struct {
	index        map[string]indexedStream
	merged       model.Streams
	stats        []interface{}
	numQueries   int
	reqLimit     int
	totalEntries int
	duplicates   int
	limitReached bool
}

func NewStreamMerger(reqLimit int) *StreamMerger {
	return &StreamMerger{
		reqLimit: reqLimit,
		index:    map[string]indexedStream{},
		merged:   model.Streams{},
		stats:    []interface{}{},
	}
}

type indexedStream struct {
	stream  model.Stream
	entries map[string]interface{}
	index   int
}

func uniqueStream(s *model.Stream) string {
	var labels []string
	for lbl := range s.Labels {
		labels = append(labels, lbl)
	}
	sort.Strings(labels)
	sb := strings.Builder{}
	for _, lbl := range labels {
		sb.WriteString(lbl)
		sb.WriteByte('=')
		sb.WriteString(s.Labels[lbl])
		sb.WriteByte(',')
	}
	return sb.String()
}

func uniqueEntry(e *model.Entry) string {
	return e.Timestamp.String() + e.Line
}

func (m *StreamMerger) Add(from model.QueryResponseData) (model.ResultValue, error) {
	streams, ok := from.Result.(model.Streams)
	if !ok {
		return nil, fmt.Errorf("loki returned an unexpected type for StreamMerger: %T", from)
	}

	m.numQueries++
	m.stats = append(m.stats, from.Stats)
	totalEntries := 0
	for _, stream := range streams {
		lkey := uniqueStream(&stream)
		idxStream, streamExists := m.index[lkey]
		if !streamExists {
			// Stream doesn't exist => create new index
			idxStream = indexedStream{
				stream:  stream,
				entries: map[string]interface{}{},
				index:   len(m.index),
			}
		}
		// Merge content (entries)
		for _, e := range stream.Entries {
			totalEntries++
			ekey := uniqueEntry(&e)
			if _, entryExists := idxStream.entries[ekey]; !entryExists {
				// Add entry to the existing stream, and mark it as existing in idxStream.entries
				idxStream.entries[ekey] = nil
				if streamExists {
					idxStream.stream.Entries = append(idxStream.stream.Entries, e)
				}
			} else {
				// Else: entry found => ignore duplicate
				m.duplicates++
			}
		}
		// Add or overwrite index
		m.index[lkey] = idxStream
		if !streamExists {
			// Stream doesn't exist => append it
			m.merged = append(m.merged, idxStream.stream)
		} else {
			m.merged[idxStream.index] = idxStream.stream
		}
	}
	if totalEntries >= m.reqLimit {
		m.limitReached = true
	}
	m.totalEntries += totalEntries
	return m.merged, nil
}

func (m *StreamMerger) Get() *model.AggregatedQueryResponse {
	return &model.AggregatedQueryResponse{
		ResultType: model.ResultTypeStream,
		Result:     m.merged,
		Stats: model.AggregatedStats{
			NumQueries:   m.numQueries,
			LimitReached: m.limitReached,
			TotalEntries: m.totalEntries,
			Duplicates:   m.duplicates,
			QueriesStats: m.stats,
		},
	}
}
