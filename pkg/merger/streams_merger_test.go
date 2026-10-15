package merger

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/netobserv/network-observability-console-plugin/pkg/model"
)

func TestStreamsMerge(t *testing.T) {
	now := time.Now()
	merger := NewStreamMerger(100)
	baseline := model.Stream{
		Labels: map[string]string{
			"foo": "bar",
		},
		Entries: []model.Entry{{
			Timestamp: now,
			Line:      "{key: value}",
		}},
	}
	_, err := merger.Add(qr(model.Streams{baseline}), "")
	require.NoError(t, err)

	// Different label, different line => no dedup
	merged, err := merger.Add(qr(model.Streams{{
		Labels: map[string]string{
			"foo":  "bar",
			"foo2": "bar2",
		},
		Entries: baseline.Entries,
	}, {
		Labels: baseline.Labels,
		Entries: []model.Entry{{
			Timestamp: now,
			Line:      "{key2: value2}",
		}},
	}}), "")
	require.NoError(t, err)
	assert.Len(t, merged, 2)
	assert.Len(t, merged.(model.Streams)[0].Entries, 2)
	assert.Len(t, merged.(model.Streams)[1].Entries, 1)

	// Same labels in different order => 3 dedups
	merged, err = merger.Add(qr(model.Streams{{
		Labels: map[string]string{
			"foo2": "bar2",
			"foo":  "bar",
		},
		Entries: baseline.Entries,
	}, {
		Labels: map[string]string{
			"foo2": "bar2",
			"foo":  "bar",
		},
		Entries: baseline.Entries,
	}, {
		Labels: map[string]string{
			"foo":  "bar",
			"foo2": "bar2",
		},
		Entries: baseline.Entries,
	}}), "")
	require.NoError(t, err)
	assert.Len(t, merged, 2)
	assert.Len(t, merged.(model.Streams)[0].Entries, 2)
	assert.Len(t, merged.(model.Streams)[1].Entries, 1)
	assert.Equal(t, 3, merger.duplicates)

	// Different timestamp => no dedup
	merged, err = merger.Add(qr(model.Streams{{
		Labels: baseline.Labels,
		Entries: []model.Entry{{
			Timestamp: now.Add(time.Hour),
			Line:      "{key: value}",
		}},
	}}), "")
	require.NoError(t, err)
	assert.Len(t, merged, 2)
	assert.Len(t, merged.(model.Streams)[0].Entries, 3)
	assert.Len(t, merged.(model.Streams)[1].Entries, 1)

	// some dedup
	merged, err = merger.Add(qr(model.Streams{{
		// changed line => no dedup
		Labels: baseline.Labels,
		Entries: []model.Entry{{
			Timestamp: now,
			Line:      "{key: value3}",
		}},
	}, {
		// changed line => no dedup
		Labels: baseline.Labels,
		Entries: []model.Entry{{
			Timestamp: now,
			Line:      "{}",
		}},
	}, {
		// same as previously modified timestamp => must be ignored
		Labels: baseline.Labels,
		Entries: []model.Entry{{
			Timestamp: now.Add(time.Hour),
			Line:      "{key: value}",
		}},
	},
		// baseline itself => must be ignored
		baseline,
	}), "")

	// Different timestamp => no dedup
	require.NoError(t, err)
	assert.Len(t, merged, 2)
	assert.Len(t, merged.(model.Streams)[0].Entries, 5)
	assert.Len(t, merged.(model.Streams)[1].Entries, 1)
	assert.Equal(t, 5, merger.duplicates)
}

func TestStreamsLimitReached(t *testing.T) {
	now := time.Now()
	merger := NewStreamMerger(2)

	// Single entry => should not reach limit
	first := model.Stream{
		Labels: map[string]string{
			"foo": "bar",
		},
		Entries: []model.Entry{{
			Timestamp: now,
			Line:      "{key: value}",
		}},
	}
	_, err := merger.Add(qr(model.Streams{first}), "")
	require.NoError(t, err)
	assert.False(t, merger.limitReached)

	// Another single entry => limit still not reached (even if total is 2)
	_, err = merger.Add(qr(model.Streams{{
		Labels: map[string]string{
			"foo": "bar",
		},
		Entries: []model.Entry{{
			Timestamp: now,
			Line:      "{key: value}",
		}},
	}}), "")
	require.NoError(t, err)
	assert.False(t, merger.limitReached)

	// 2 entries => limit reached
	_, err = merger.Add(qr(model.Streams{{
		// changed line => no dedup
		Labels: first.Labels,
		Entries: []model.Entry{{
			Timestamp: now,
			Line:      "{key: value3}",
		}},
	}, {
		// same as first => dedup, but still counts for limit reached
		Labels: first.Labels,
		Entries: []model.Entry{{
			Timestamp: now,
			Line:      "{key: value}",
		}},
	},
	}), "")
	require.NoError(t, err)
	assert.True(t, merger.limitReached)

	// Another single entry => limit still reached
	_, err = merger.Add(qr(model.Streams{{
		Labels: map[string]string{
			"foo": "bar",
		},
		Entries: []model.Entry{{
			Timestamp: now,
			Line:      "{key: value}",
		}},
	}}), "")
	require.NoError(t, err)
	assert.True(t, merger.limitReached)
}

func TestStreamsMerge_SameStream(t *testing.T) {
	now := time.Now()
	merger := NewStreamMerger(100)
	s1 := model.Stream{
		Labels: map[string]string{
			"foo": "bar",
		},
		Entries: []model.Entry{{
			Timestamp: now,
			Line:      "{key: value1}",
		}, {
			Timestamp: now.Add(10 * time.Microsecond),
			Line:      "{key: value2}",
		}},
	}
	s2 := model.Stream{
		Labels: map[string]string{
			"foo": "bar",
		},
		Entries: []model.Entry{{
			Timestamp: now,
			Line:      "{key: value3}",
		}, {
			Timestamp: now.Add(10 * time.Microsecond),
			Line:      "{key: value4}",
		}},
	}
	_, err := merger.Add(qr(model.Streams{s1}), "")
	require.NoError(t, err)
	_, err = merger.Add(qr(model.Streams{s2}), "")
	require.NoError(t, err)
	result := merger.Get()

	assert.Len(t, result.Result, 1)
	assert.Len(t, result.Result.(model.Streams)[0].Entries, 4)
	assert.Equal(t, 4, result.Stats.TotalEntries)
	assert.Equal(t, 0, result.Stats.Duplicates)
	assert.Equal(t, 2, result.Stats.NumQueries)
}

func TestStreamsMerge_Parallel(t *testing.T) {
	merger := NewStreamMerger(100)
	wg := sync.WaitGroup{}
	wg.Add(100)
	tstamp := time.Now()

	for i := 0; i < 100; i++ {
		tstamp = tstamp.Add(10 * time.Microsecond)
		go func(ts time.Time) {
			defer wg.Done()
			s := model.Stream{
				Labels: map[string]string{
					"foo": "bar",
				},
				Entries: []model.Entry{{
					Timestamp: ts,
					Line:      "{key: value1}",
				}, {
					Timestamp: ts.Add(5 * time.Microsecond),
					Line:      "{key: value2}",
				}},
			}
			_, err := merger.Add(qr(model.Streams{s}), "")
			require.NoError(t, err)
		}(tstamp)
	}

	wg.Wait()
	result := merger.Get()

	assert.Len(t, result.Result, 1)
	assert.Len(t, result.Result.(model.Streams)[0].Entries, 200)
	assert.Equal(t, 200, result.Stats.TotalEntries)
	assert.Equal(t, 0, result.Stats.Duplicates)
	assert.Equal(t, 100, result.Stats.NumQueries)
}
