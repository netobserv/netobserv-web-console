package metricsparse

import (
	"math"
	"sort"
)

var percentileValues = []float64{90, 99}

func roundTwoDigits(v float64) float64 {
	if math.IsNaN(v) || math.IsInf(v, 0) {
		return v
	}
	return math.Round(v*100) / 100
}

// percentile matches the npm "percentile" default linear interpolation.
func percentile(p float64, values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sorted := append([]float64(nil), values...)
	sort.Float64s(sorted)
	if len(sorted) == 1 {
		return sorted[0]
	}
	index := (p / 100) * float64(len(sorted)-1)
	lower := int(math.Floor(index))
	upper := int(math.Ceil(index))
	if lower == upper {
		return sorted[lower]
	}
	weight := index - float64(lower)
	return sorted[lower]*(1-weight) + sorted[upper]*weight
}

func computeStats(ts []Datapoint) MetricStats {
	empty := MetricStats{
		Percentiles: make([]float64, len(percentileValues)),
	}
	if len(ts) == 0 {
		return empty
	}
	values := make([]float64, 0, len(ts))
	for _, dp := range ts {
		if !math.IsNaN(dp[1]) {
			values = append(values, dp[1])
		}
	}
	if len(values) == 0 {
		return empty
	}

	sum := 0.0
	minVal := values[0]
	maxVal := values[0]
	for _, v := range values {
		sum += v
		if v < minVal {
			minVal = v
		}
		if v > maxVal {
			maxVal = v
		}
	}
	avg := sum / float64(len(values))
	pcts := make([]float64, len(percentileValues))
	for i, p := range percentileValues {
		pcts[i] = roundTwoDigits(percentile(p, values))
	}
	latest := values[len(values)-1]
	total := math.Floor(avg * (ts[len(ts)-1][0] - ts[0][0]))

	return MetricStats{
		Sum:         sum,
		Latest:      roundTwoDigits(latest),
		Avg:         roundTwoDigits(avg),
		Min:         roundTwoDigits(minVal),
		Max:         roundTwoDigits(maxVal),
		Percentiles: pcts,
		Total:       total,
	}
}
