package merger

import (
	"testing"
	"time"

	pmodel "github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/netobserv/network-observability-console-plugin/pkg/model"
)

func qrData(result model.ResultValue) model.QueryResponseData {
	return model.QueryResponseData{Result: result}
}

func TestMatrixMerge(t *testing.T) {
	now := pmodel.Now()
	m := NewMatrixMerger(100)
	baseline := pmodel.SampleStream{
		Metric: pmodel.Metric{
			"foo": "bar",
		},
		Values: []pmodel.SamplePair{{
			Timestamp: now,
			Value:     pmodel.SampleValue(42),
		}},
	}
	_, err := m.Add(qrData(model.Matrix{baseline}))
	require.NoError(t, err)

	// Different metric, different value pair => no dedup
	_, err = m.Add(qrData(model.Matrix{{
		Metric: pmodel.Metric{
			"foo":  "bar",
			"foo2": "bar2",
		},
		Values: baseline.Values,
	}, {
		Metric: baseline.Metric,
		Values: []pmodel.SamplePair{{
			Timestamp: now,
			Value:     pmodel.SampleValue(12),
		}},
	}}))
	require.NoError(t, err)
	result := m.Get().Result.(model.Matrix)
	assert.Len(t, result, 2)
	assert.Len(t, result[0].Values, 1)
	assert.Equal(t, result[0].Values[0].Value, pmodel.SampleValue(54))
	assert.Len(t, result[1].Values, 1)
	assert.Equal(t, result[1].Values[0].Value, pmodel.SampleValue(42))

	// Same metrics in different order => no dedup
	_, err = m.Add(qrData(model.Matrix{{
		Metric: pmodel.Metric{
			"foo2": "bar2",
			"foo":  "bar",
		},
		Values: baseline.Values,
	}, {
		Metric: pmodel.Metric{
			"foo2": "bar2",
			"foo":  "bar",
		},
		Values: baseline.Values,
	}, {
		Metric: pmodel.Metric{
			"foo":  "bar",
			"foo2": "bar2",
		},
		Values: baseline.Values,
	}}))
	require.NoError(t, err)
	result = m.Get().Result.(model.Matrix)
	assert.Len(t, result, 2)
	assert.Len(t, result[0].Values, 1)
	assert.Equal(t, result[0].Values[0].Value, pmodel.SampleValue(54))
	assert.Len(t, result[1].Values, 1)
	assert.Equal(t, result[1].Values[0].Value, pmodel.SampleValue(168))

	// Different timestamp => no dedup
	_, err = m.Add(qrData(model.Matrix{{
		Metric: baseline.Metric,
		Values: []pmodel.SamplePair{{
			Timestamp: now.Add(time.Hour),
			Value:     pmodel.SampleValue(12),
		}},
	}}))
	require.NoError(t, err)
	result = m.Get().Result.(model.Matrix)
	assert.Len(t, result, 2)
	assert.Len(t, result[0].Values, 2)
	assert.Equal(t, result[0].Values[0].Value, pmodel.SampleValue(54))
	assert.Equal(t, result[0].Values[1].Value, pmodel.SampleValue(12))
	assert.Len(t, result[1].Values, 1)
	assert.Equal(t, result[1].Values[0].Value, pmodel.SampleValue(168))

	// no dedup
	_, err = m.Add(qrData(model.Matrix{{
		// changed value => no dedup
		Metric: baseline.Metric,
		Values: []pmodel.SamplePair{{
			Timestamp: now,
			Value:     pmodel.SampleValue(8),
		}},
	}, {
		// changed value => no dedup
		Metric: baseline.Metric,
		Values: []pmodel.SamplePair{{
			Timestamp: now,
			Value:     pmodel.SampleValue(0),
		}},
	}, {
		// same as previously modified timestamp => will be added
		Metric: baseline.Metric,
		Values: []pmodel.SamplePair{{
			Timestamp: now.Add(time.Hour),
			Value:     pmodel.SampleValue(42),
		}},
	},
		// baseline itself => still added
		baseline,
	}))

	// Different timestamp
	require.NoError(t, err)
	result = m.Get().Result.(model.Matrix)
	assert.Len(t, result, 2)
	assert.Len(t, result[0].Values, 2)
	assert.Equal(t, result[0].Values[0].Value, pmodel.SampleValue(104))
	assert.Equal(t, result[0].Values[1].Value, pmodel.SampleValue(54))
	assert.Len(t, result[1].Values, 1)
	assert.Equal(t, result[1].Values[0].Value, pmodel.SampleValue(168))
}

func TestMatrixLimitReached(t *testing.T) {
	now := pmodel.Now()
	m := NewMatrixMerger(2)

	// Single entry => should not reach limit
	first := pmodel.SampleStream{
		Metric: pmodel.Metric{
			"foo": "bar",
		},
		Values: []pmodel.SamplePair{{
			Timestamp: now,
			Value:     pmodel.SampleValue(42),
		}},
	}
	_, err := m.Add(qrData(model.Matrix{first}))
	require.NoError(t, err)
	assert.False(t, m.limitReached)

	// Another single entry => limit still not reached (even if total is 2)
	_, err = m.Add(qrData(model.Matrix{pmodel.SampleStream{
		Metric: pmodel.Metric{
			"foo": "bar",
		},
		Values: []pmodel.SamplePair{{
			Timestamp: now,
			Value:     pmodel.SampleValue(42),
		}},
	}}))
	require.NoError(t, err)
	assert.False(t, m.limitReached)

	// 2 entries => limit reached
	_, err = m.Add(qrData(model.Matrix{pmodel.SampleStream{
		Metric: pmodel.Metric{
			"foo": "bar",
		},
		Values: []pmodel.SamplePair{{
			Timestamp: now,
			Value:     pmodel.SampleValue(42),
		}},
	}, pmodel.SampleStream{
		Metric: pmodel.Metric{
			"foo": "baz",
		},
		Values: []pmodel.SamplePair{{
			Timestamp: now,
			Value:     pmodel.SampleValue(42),
		}},
	}}))
	require.NoError(t, err)
	assert.True(t, m.limitReached)

	// Another single entry => limit still reached
	_, err = m.Add(qrData(model.Matrix{pmodel.SampleStream{
		Metric: pmodel.Metric{
			"foo": "bar",
		},
		Values: []pmodel.SamplePair{{
			Timestamp: now,
			Value:     pmodel.SampleValue(42),
		}},
	}}))
	require.NoError(t, err)
	assert.True(t, m.limitReached)
}
