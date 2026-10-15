package backends

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"testing"

	"github.com/netobserv/network-observability-console-plugin/pkg/backend"
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/filters"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils/constants"
	pmod "github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetFlows(t *testing.T) {
	for _, tc := range []struct {
		name               string
		flowsBackends      []backend.FlowsBackend
		metricsBackends    []backend.MetricsBackend
		bctx               backend.QueryContext
		params             FullFlowsParams
		expectedDatasource constants.DataSource
		expectedNumQueries int
		expectedEntries    []string
		expectedError      string
		expectedCode       int
	}{
		{
			name:               "Valid backends, empty filter, empty context",
			flowsBackends:      []backend.FlowsBackend{&fakeLogBackend{name: "flb1"}, &fakeLogBackend{name: "flb2"}},
			params:             FullFlowsParams{FilterGroups: filters.MultiQueries{nil}},
			expectedDatasource: "flb1",
			expectedNumQueries: 1,
		},
		{
			name:               "Valid backends, empty filter, forced valid datasource",
			flowsBackends:      []backend.FlowsBackend{&fakeLogBackend{name: "flb1"}, &fakeLogBackend{name: "flb2"}},
			bctx:               backend.QueryContext{DataSource: "flb2"},
			params:             FullFlowsParams{FilterGroups: filters.MultiQueries{nil}},
			expectedDatasource: "flb2",
			expectedNumQueries: 1,
		},
		{
			name:            "Valid backends, empty filter, forced invalid datasource",
			flowsBackends:   []backend.FlowsBackend{&fakeLogBackend{name: "flb1"}, &fakeLogBackend{name: "flb2"}},
			metricsBackends: []backend.MetricsBackend{&fakeMetricBackend{name: "fmb1"}},
			bctx:            backend.QueryContext{DataSource: "fmb1"},
			params:          FullFlowsParams{FilterGroups: filters.MultiQueries{nil}},
			expectedError:   "cannot perform query: fmb1 datasource is not configured",
			expectedCode:    http.StatusServiceUnavailable,
		},
		{
			name:            "No valid backends",
			metricsBackends: []backend.MetricsBackend{&fakeMetricBackend{name: "fmb1"}},
			params:          FullFlowsParams{FilterGroups: filters.MultiQueries{nil}},
			expectedError:   "cannot perform query: no relevant backend configured",
			expectedCode:    http.StatusServiceUnavailable,
		},
		{
			name: "First backend error (no fallback for flows)",
			flowsBackends: []backend.FlowsBackend{
				&fakeLogBackend{name: "flb1", err: errors.New("fail"), errCode: http.StatusInternalServerError},
				&fakeLogBackend{name: "flb2"},
			},
			params:        FullFlowsParams{FilterGroups: filters.MultiQueries{nil}},
			expectedError: "fail",
			expectedCode:  http.StatusInternalServerError,
		},
		{
			name: "First backend unmanaged error (no fallback for flows)",
			flowsBackends: []backend.FlowsBackend{
				&fakeLogBackend{name: "flb1", err: backend.NewUnmanagedError(errors.New("not managed"))},
				&fakeLogBackend{name: "flb2"},
			},
			params:        FullFlowsParams{FilterGroups: filters.MultiQueries{nil}},
			expectedError: "not managed",
		},
		{
			name:          "Valid backends, filter groups",
			flowsBackends: []backend.FlowsBackend{&fakeLogBackend{name: "flb1"}, &fakeLogBackend{name: "flb2"}},
			bctx:          backend.QueryContext{DataSource: constants.DataSourceAuto},
			params: FullFlowsParams{FilterGroups: filters.MultiQueries{
				{filters.NewRegexMatch("key1", "a"), filters.NewRegexMatch("key2", "b")},
				{filters.NewEqualMatch("key1", "b")},
				{filters.NewEqualMatch("key1", "c")},
			}},
			expectedDatasource: "flb1",
			expectedNumQueries: 3,
			expectedEntries:    []string{"key1 a", "key1 b", "key1 c"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			o := Orchestrator{flowsBackends: tc.flowsBackends, metricsBackends: tc.metricsBackends}
			flows, code, err := o.Flows(context.Background(), &tc.bctx, &tc.params)
			if tc.expectedError != "" {
				assert.ErrorContains(t, err, tc.expectedError)
				assert.Equal(t, tc.expectedCode, code)
			} else {
				require.NoError(t, err)
				assert.Equal(t, 200, code)
				assert.Equal(t, []constants.DataSource{tc.expectedDatasource}, flows.Stats.DataSources)
				assert.Equal(t, tc.expectedNumQueries, flows.Stats.NumQueries)
				assert.Len(t, flows.Result, 1)
				assert.Equal(t, string(tc.expectedDatasource), flows.Result.(model.Streams)[0].Labels["backend"])
				if len(tc.expectedEntries) > 0 {
					assert.Equal(t, len(tc.expectedEntries), flows.Stats.TotalEntries)
					require.Equal(t, len(tc.expectedEntries), len(flows.Result.(model.Streams)[0].Entries))
					sorted := sortEntriesV(flows.Result.(model.Streams)[0].Entries)
					for i, ent := range sorted {
						assert.Contains(t, ent, tc.expectedEntries[i])
					}
				}
			}
		})
	}
}

func sortEntriesV(ent []model.Entry) []string {
	var ret []string
	for _, e := range ent {
		ret = append(ret, e.Line)
	}
	slices.Sort(ret)
	return ret
}

func TestGetMetrics(t *testing.T) {
	testCases := []struct {
		name               string
		flowsBackends      []backend.FlowsBackend
		metricsBackends    []backend.MetricsBackend
		bctx               backend.QueryContext
		params             FullMetricsParams
		expectedDatasource []constants.DataSource
		expectedNumQueries int
		expectedMetrics    []string
		expectedError      string
		expectedCode       int
	}{
		{
			name:               "Valid backends, empty filter, empty context",
			flowsBackends:      []backend.FlowsBackend{&fakeLogBackend{name: "flb1"}},
			metricsBackends:    []backend.MetricsBackend{&fakeMetricBackend{name: "fmb1"}, &fakeMetricBackend{name: "fmb2"}},
			params:             FullMetricsParams{FilterGroups: filters.MultiQueries{nil}},
			expectedDatasource: []constants.DataSource{"fmb1"},
			expectedNumQueries: 1,
		},
		{
			name:               "Valid backends, empty filter, forced valid datasource",
			metricsBackends:    []backend.MetricsBackend{&fakeMetricBackend{name: "fmb1"}, &fakeMetricBackend{name: "fmb2"}},
			bctx:               backend.QueryContext{DataSource: "fmb2"},
			params:             FullMetricsParams{FilterGroups: filters.MultiQueries{nil}},
			expectedDatasource: []constants.DataSource{"fmb2"},
			expectedNumQueries: 1,
		},
		{
			name:            "Valid backends, empty filter, forced invalid datasource",
			flowsBackends:   []backend.FlowsBackend{&fakeLogBackend{name: "flb1"}, &fakeLogBackend{name: "flb2"}},
			metricsBackends: []backend.MetricsBackend{&fakeMetricBackend{name: "fmb1"}},
			bctx:            backend.QueryContext{DataSource: "flb2"},
			params:          FullMetricsParams{FilterGroups: filters.MultiQueries{nil}},
			expectedError:   "cannot perform query: flb2 datasource is not configured",
			expectedCode:    http.StatusServiceUnavailable,
		},
		{
			name:          "No valid backends",
			params:        FullMetricsParams{FilterGroups: filters.MultiQueries{nil}},
			expectedError: "cannot perform query: no relevant backend configured",
			expectedCode:  http.StatusServiceUnavailable,
		},
		{
			name: "First backend error: no fallback (not an unmanaged error)",
			metricsBackends: []backend.MetricsBackend{
				&fakeMetricBackend{name: "fmb1", err: errors.New("fail"), errCode: http.StatusInternalServerError},
				&fakeMetricBackend{name: "fmb2"},
			},
			params:        FullMetricsParams{FilterGroups: filters.MultiQueries{nil}},
			expectedError: "fail",
			expectedCode:  http.StatusInternalServerError,
		},
		{
			name: "First backend unmanaged error: fallback to next",
			metricsBackends: []backend.MetricsBackend{
				&fakeMetricBackend{name: "fmb1", err: backend.NewUnmanagedError(errors.New("not managed"))},
				&fakeMetricBackend{name: "fmb2"},
			},
			params:             FullMetricsParams{FilterGroups: filters.MultiQueries{nil}},
			expectedDatasource: []constants.DataSource{"fmb2"},
			expectedNumQueries: 1,
		},
		{
			name: "Pinned datasource: no fallback",
			metricsBackends: []backend.MetricsBackend{
				&fakeMetricBackend{name: "fmb1", err: backend.NewUnmanagedError(errors.New("not managed"))},
				&fakeMetricBackend{name: "fmb2"},
			},
			bctx:          backend.QueryContext{DataSource: "fmb1"},
			params:        FullMetricsParams{FilterGroups: filters.MultiQueries{nil}},
			expectedError: "not managed",
		},
		{
			name: "All backends unmanaged",
			metricsBackends: []backend.MetricsBackend{
				&fakeMetricBackend{name: "fmb1", err: backend.NewUnmanagedError(errors.New("not managed 1"))},
				&fakeMetricBackend{name: "fmb2", err: backend.NewUnmanagedError(errors.New("not managed 2"))},
			},
			params:        FullMetricsParams{FilterGroups: filters.MultiQueries{nil}},
			expectedError: "not managed 2",
		},
		{
			name: "Valid backends, filter groups, multiple sources",
			metricsBackends: []backend.MetricsBackend{
				&fakeMetricBackend{name: "fmb1", labelValues: map[string][]string{"key1": {"a"}}},
				&fakeMetricBackend{name: "fmb2", labelValues: map[string][]string{"key1": {"a"}, "key2": {"b"}}},
			},
			bctx: backend.QueryContext{DataSource: constants.DataSourceAuto},
			params: FullMetricsParams{FilterGroups: filters.MultiQueries{
				{filters.NewRegexMatch("key1", "a"), filters.NewRegexMatch("key2", "b")},
				{filters.NewEqualMatch("key1", "b")},
				{filters.NewEqualMatch("key1", "c")},
			}},
			expectedDatasource: []constants.DataSource{"fmb1", "fmb2"},
			expectedNumQueries: 3,
			expectedMetrics: []string{
				// Note that fakeMetricBackend is not going to resolve the filters to provide realistic results - it's not the purpose of this test
				`{backend="fmb1", key1="a"}`,
				`{backend="fmb2", key1="a", key2="b"}`,
			},
		},
		{
			name: "Valid backends, some unmanaged labels",
			metricsBackends: []backend.MetricsBackend{
				&fakeMetricBackend{name: "fmb1", labelValues: map[string][]string{"key1": {"a"}}},
				&fakeMetricBackend{name: "fmb2", labelValues: map[string][]string{"key1": {"a"}}},
			},
			bctx: backend.QueryContext{DataSource: constants.DataSourceAuto},
			params: FullMetricsParams{FilterGroups: filters.MultiQueries{
				{filters.NewRegexMatch("key1", "a"), filters.NewRegexMatch("key2", "b")},
				{filters.NewEqualMatch("key1", "b")},
				{filters.NewEqualMatch("key1", "c")},
			}},
			expectedError: "Unmanaged request: label key2 not managed by fmb2", // last error wins
			expectedCode:  400,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			o := Orchestrator{flowsBackends: tc.flowsBackends, metricsBackends: tc.metricsBackends}
			metrics, code, err := o.Metrics(context.Background(), &tc.bctx, &tc.params)
			if tc.expectedError != "" {
				assert.ErrorContains(t, err, tc.expectedError)
				assert.Equal(t, tc.expectedCode, code)
			} else {
				require.NoError(t, err)
				assert.Equal(t, 200, code)
				assert.ElementsMatch(t, tc.expectedDatasource, metrics.Stats.DataSources)
				assert.Equal(t, tc.expectedNumQueries, metrics.Stats.NumQueries)
				if len(tc.expectedMetrics) > 0 {
					assert.Len(t, metrics.Result, len(tc.expectedMetrics))
					assert.Equal(t, len(tc.expectedMetrics), metrics.Stats.TotalEntries)
					sorted := sortMetrics(metrics.Result.(model.Matrix))
					assert.Equal(t, tc.expectedMetrics, sorted)
				}
			}
		})
	}
}

func TestGetLabelValues(t *testing.T) {
	testCases := []struct {
		name            string
		flowsBackends   []backend.FlowsBackend
		metricsBackends []backend.MetricsBackend
		bctx            backend.QueryContext
		labels          []string
		expectedError   string
		expectedCode    int
		expectedValues  []string
		expectedNames   []string // set expectedNames if different from expectedValues (true when querying multiple labels)
	}{
		{
			name: "Valid backends, some result",
			metricsBackends: []backend.MetricsBackend{
				&fakeMetricBackend{name: "fmb1", labelValues: map[string][]string{"key1": {"a", "b"}}},
				&fakeMetricBackend{name: "fmb2", labelValues: map[string][]string{"key1": {"a", "c"}, "key2": {"d"}}},
			},
			labels:         []string{"key1"},
			expectedValues: []string{"a", "b"}, // first backend wins
		},
		{
			name: "Valid backends, fallback to next, some result",
			metricsBackends: []backend.MetricsBackend{
				&fakeMetricBackend{name: "fmb1", labelValues: map[string][]string{"key1": {"a"}}},
				&fakeMetricBackend{name: "fmb2", labelValues: map[string][]string{"key1": {"a"}, "key2": {"b"}}},
			},
			labels:         []string{"key1", "key2"},
			expectedValues: []string{"a", "b"}, // Second backend wins
			expectedNames:  []string{"a"},      // Only 1 label considered for names
		},
		{
			name: "Valid backends, fallback to next, unmanaged",
			metricsBackends: []backend.MetricsBackend{
				&fakeMetricBackend{name: "fmb1", labelValues: map[string][]string{"key1": {"a"}}},
				&fakeMetricBackend{name: "fmb2", labelValues: map[string][]string{"key1": {"a"}, "key2": {"b"}}},
			},
			labels:        []string{"key3"},
			expectedError: "Unmanaged request: label key3 not managed by fmb2", // last error wins
			expectedCode:  400,
		},
		{
			name: "Valid backends, forced datasource",
			metricsBackends: []backend.MetricsBackend{
				&fakeMetricBackend{name: "fmb1", labelValues: map[string][]string{"key1": {"a1"}}},
				&fakeMetricBackend{name: "fmb2", labelValues: map[string][]string{"key1": {"a2"}, "key2": {"b"}}},
			},
			bctx:           backend.QueryContext{DataSource: "fmb2"},
			labels:         []string{"key1"},
			expectedValues: []string{"a2"},
		},
		{
			name: "Valid backends, forced invalid datasource",
			metricsBackends: []backend.MetricsBackend{
				&fakeMetricBackend{name: "fmb1", labelValues: map[string][]string{"key1": {"a"}}},
				&fakeMetricBackend{name: "fmb2", labelValues: map[string][]string{"key1": {"a"}, "key2": {"b"}}},
			},
			bctx:          backend.QueryContext{DataSource: "fmb3"},
			labels:        []string{"key1"},
			expectedError: "cannot perform query: fmb3 datasource is not configured",
			expectedCode:  http.StatusServiceUnavailable,
		},
		{
			name:          "No valid backends",
			labels:        []string{"test"},
			expectedError: "cannot perform query: no relevant backend configured",
			expectedCode:  http.StatusServiceUnavailable,
		},
		{
			name: "First backend error: no fallback (not an unmanaged error)",
			metricsBackends: []backend.MetricsBackend{
				&fakeMetricBackend{name: "fmb1", err: errors.New("fail"), errCode: http.StatusInternalServerError},
				&fakeMetricBackend{name: "fmb2"},
			},
			labels:        []string{"test"},
			expectedError: "fail",
			expectedCode:  http.StatusInternalServerError,
		},
		{
			name: "First backend unmanaged error: fallback to next",
			metricsBackends: []backend.MetricsBackend{
				&fakeMetricBackend{name: "fmb1", err: backend.NewUnmanagedError(errors.New("not managed"))},
				&fakeMetricBackend{name: "fmb2", labelValues: map[string][]string{"key1": {"a"}, "key2": {"b"}}},
			},
			labels:         []string{"key1"},
			expectedValues: []string{"a"},
		},
		{
			name: "All backends unmanaged",
			metricsBackends: []backend.MetricsBackend{
				&fakeMetricBackend{name: "fmb1", err: backend.NewUnmanagedError(errors.New("not managed 1"))},
				&fakeMetricBackend{name: "fmb2", err: backend.NewUnmanagedError(errors.New("not managed 2"))},
			},
			labels:        []string{"test"},
			expectedError: "not managed 2",
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			o := Orchestrator{flowsBackends: tc.flowsBackends, metricsBackends: tc.metricsBackends}
			values, code, err := o.GetLabelValues(context.Background(), &tc.bctx, tc.labels...)
			names, code2, err2 := o.MatchLabelValues(context.Background(), &tc.bctx, nil, tc.labels[0])
			if tc.expectedError != "" {
				assert.ErrorContains(t, err, tc.expectedError)
				assert.Equal(t, tc.expectedCode, code)
				assert.ErrorContains(t, err2, tc.expectedError)
				assert.Equal(t, tc.expectedCode, code2)
			} else {
				require.NoError(t, err)
				assert.Equal(t, 200, code)
				slices.Sort(values)
				slices.Sort(names)
				assert.Equal(t, tc.expectedValues, values)
				if tc.expectedNames == nil {
					assert.Equal(t, tc.expectedValues, names)
				} else {
					assert.Equal(t, tc.expectedNames, names)
				}
			}
		})
	}
}

func sortMetrics(m model.Matrix) []string {
	var ret []string
	for _, e := range m {
		ret = append(ret, e.Metric.String())
	}
	slices.Sort(ret)
	return ret
}

type fakeLogBackend struct {
	name    string
	err     error
	errCode int
}

func (b *fakeLogBackend) Name() constants.DataSource { return constants.DataSource(b.name) }
func (b *fakeLogBackend) Flows(_ context.Context, _ *backend.QueryContext, q *backend.FlowParams) (*model.QueryResponse, int, error) {
	if b.err != nil {
		return nil, b.errCode, b.err
	}
	return &model.QueryResponse{
		Data: model.QueryResponseData{
			ResultType: model.ResultTypeStream,
			Result: model.Streams{{
				Labels: map[string]string{"backend": b.name},
				Entries: []model.Entry{{
					Timestamp: q.Start,
					Line:      fmt.Sprintf("%v", q.Filters),
				}},
			}},
		},
	}, 0, nil
}

type fakeMetricBackend struct {
	name        string
	labelValues map[string][]string
	err         error
	errCode     int
}

func (b *fakeMetricBackend) Name() constants.DataSource { return constants.DataSource(b.name) }
func (b *fakeMetricBackend) Metrics(_ context.Context, _ *backend.QueryContext, q *backend.MetricsParams) (*model.AggregatedQueryResponse, int, error) {
	if b.err != nil {
		return nil, b.errCode, b.err
	}
	for _, filter := range q.Filters {
		if _, exists := b.labelValues[filter.Key]; !exists {
			// Simulate label not managed
			return nil, http.StatusBadRequest, backend.NewUnmanagedError(fmt.Errorf("label %s not managed by %s", filter.Key, b.Name()))
		}
	}
	metric := pmod.Metric{"backend": pmod.LabelValue(b.name)}
	for lbl, v := range b.labelValues {
		metric[pmod.LabelName(lbl)] = pmod.LabelValue(v[0])
	}
	qr := model.QueryResponse{
		Data: model.QueryResponseData{
			ResultType: model.ResultTypeMatrix,
			Result: model.Matrix{{
				Metric: metric,
				Values: []pmod.SamplePair{{Timestamp: 0, Value: 50}},
			}},
		},
	}
	return model.NewAggregatedQueryResponse(&qr, b.Name()), 0, nil
}
func (b *fakeMetricBackend) GetLabelValues(_ context.Context, _ *backend.QueryContext, labels ...string) ([]string, int, error) {
	if b.err != nil {
		return nil, b.errCode, b.err
	}
	for _, l := range labels {
		if _, exists := b.labelValues[l]; !exists {
			// Simulate label not managed
			return nil, http.StatusBadRequest, backend.NewUnmanagedError(fmt.Errorf("label %s not managed by %s", l, b.Name()))
		}
	}
	var values []string
	for _, l := range labels {
		values = append(values, b.labelValues[l]...)
	}
	return values, 200, nil
}
func (b *fakeMetricBackend) MatchLabelValues(ctx context.Context, bctx *backend.QueryContext, _ filters.SingleQuery, label string) ([]string, int, error) {
	// Simplify by just returning the same as GetLabelValues
	// The goal is to test the orchestrator, not to produce realistic data
	return b.GetLabelValues(ctx, bctx, label)
}
