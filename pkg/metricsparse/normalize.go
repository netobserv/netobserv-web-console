package metricsparse

import (
	"math"
	"sort"

	pmodel "github.com/prometheus/common/model"
)

func sampleTimestamp(pair pmodel.SamplePair) float64 {
	return float64(pair.Timestamp) / 1000
}

func sampleValue(pair pmodel.SamplePair) float64 {
	return float64(pair.Value)
}

func streamValues(stream *pmodel.SampleStream) []Datapoint {
	out := make([]Datapoint, 0, len(stream.Values))
	for _, pair := range stream.Values {
		out = append(out, Datapoint{sampleTimestamp(pair), sampleValue(pair)})
	}
	return out
}

func rangeToSeconds(in *EnrichInput) int64 {
	if in.TimeRangeSeconds > 0 {
		return in.TimeRangeSeconds
	}
	return in.To - in.From
}

func computeStepSeconds(rangeSeconds int64) int64 {
	interval := rangeSeconds / 10
	if interval < 30 {
		interval = 30
	}
	return interval / 2
}

type calibratedRange struct {
	start float64
	end   float64
	step  float64
}

func calibrateRange(raw [][]Datapoint, in *EnrichInput) calibratedRange {
	rangeSeconds := rangeToSeconds(in)
	step := float64(computeStepSeconds(rangeSeconds))

	var start, endWithTolerance float64
	if in.TimeRangeSeconds > 0 {
		endWithTolerance = float64(in.UnixTimestamp - latencyTolerance)
		start = float64(in.UnixTimestamp - rangeSeconds)
	} else {
		start = float64(in.From)
		endWithTolerance = float64(in.To)
	}

	firstTimestamp := start
	allFirsts := make([]float64, 0)
	for _, dp := range raw {
		if len(dp) > 0 {
			allFirsts = append(allFirsts, dp[0][0])
		}
	}
	if len(allFirsts) > 0 {
		firstTimestamp = allFirsts[0]
		for _, t := range allFirsts[1:] {
			if t < firstTimestamp {
				firstTimestamp = t
			}
		}
		for firstTimestamp > start {
			firstTimestamp -= step
		}
	}

	allLasts := make([]float64, 0)
	for _, dp := range raw {
		if len(dp) > 0 {
			allLasts = append(allLasts, dp[len(dp)-1][0])
		}
	}
	if len(allLasts) > 0 {
		lastTimestamp := allLasts[0]
		for _, t := range allLasts[1:] {
			if t > lastTimestamp {
				lastTimestamp = t
			}
		}
		if lastTimestamp > endWithTolerance {
			endWithTolerance = lastTimestamp
		}
	}

	if in.IsMock && len(allLasts) > 0 {
		endWithTolerance = allLasts[0]
		for _, t := range allLasts[1:] {
			if t > endWithTolerance {
				endWithTolerance = t
			}
		}
	}

	return calibratedRange{start: firstTimestamp, end: endWithTolerance, step: step}
}

func normalizeMetrics(values []Datapoint, start, end, step float64, forceZeros bool) []Datapoint {
	var normalized []Datapoint
	if forceZeros {
		normalized = make([]Datapoint, 0, len(values))
		bucketKeys := make(map[int64]struct{}, len(values))
		for _, dp := range values {
			val := dp[1]
			if math.IsNaN(val) {
				val = 0
			}
			normalized = append(normalized, Datapoint{dp[0], val})
			bucketKeys[int64(math.Round((dp[0]-start)/step))] = struct{}{}
		}
		for current := start; current < end; current += step {
			key := int64(math.Round((current - start) / step))
			if _, ok := bucketKeys[key]; !ok {
				normalized = append(normalized, Datapoint{current, 0})
			}
		}
	} else {
		normalized = make([]Datapoint, 0, len(values))
		for _, dp := range values {
			if !math.IsNaN(dp[1]) {
				normalized = append(normalized, Datapoint{dp[0], dp[1]})
			}
		}
	}
	sort.Slice(normalized, func(i, j int) bool {
		return normalized[i][0] < normalized[j][0]
	})
	return normalized
}
