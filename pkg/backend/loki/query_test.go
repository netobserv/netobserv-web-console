package loki

import (
	"testing"

	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/filters"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFlowQuery_AddLabelFilters(t *testing.T) {
	cfg := config.Loki{URL: "/", Labels: []string{"foo", "flis"}}
	query := NewFlowQueryBuilderWithDefaults(&cfg)
	err := query.addFilter(filters.NewRegexMatch("foo", `"bar"`))
	require.NoError(t, err)
	err = query.addFilter(filters.NewRegexMatch("flis", `"flas"`))
	require.NoError(t, err)
	urlQuery := query.Build()
	assert.Equal(t, `/loki/api/v1/query_range?query={app="netobserv-flowcollector",foo="bar",flis="flas"}`, urlQuery)
}

func TestQuery_AuthorizedChars(t *testing.T) {
	cfg := config.Loki{URL: "/", Labels: []string{"lab1", "lab2"}}
	query := NewFlowQueryBuilderWithDefaults(&cfg)
	err := query.addFilter(filters.NewRegexMatch("key", "with/slash"))
	assert.NoError(t, err)

	query = NewFlowQueryBuilderWithDefaults(&cfg)
	err = query.addFilter(filters.NewRegexMatch("key", "with.dot"))
	assert.NoError(t, err)

	query = NewFlowQueryBuilderWithDefaults(&cfg)
	err = query.addFilter(filters.NewRegexMatch("key", "with-dash"))
	assert.NoError(t, err)

	query = NewFlowQueryBuilderWithDefaults(&cfg)
	err = query.addFilter(filters.NewRegexMatch("key", "with space"))
	assert.NoError(t, err)

	query = NewFlowQueryBuilderWithDefaults(&cfg)
	err = query.addFilter(filters.NewRegexMatch("key", "backquoted`val"))
	assert.Error(t, err)
	assert.Equal(t, "unauthorized sign in flows request: backquoted`val", err.Error())
}

func TestFlowQuery_AddNotLabelFilters(t *testing.T) {
	cfg := config.Loki{URL: "/", Labels: []string{"foo", "flis"}}
	query := NewFlowQueryBuilderWithDefaults(&cfg)
	err := query.addFilter(filters.NewRegexMatch("foo", `"bar"`))
	require.NoError(t, err)
	err = query.addFilter(filters.NewNotRegexMatch("flis", `"flas"`))
	require.NoError(t, err)
	urlQuery := query.Build()
	assert.Equal(t, `/loki/api/v1/query_range?query={app="netobserv-flowcollector",foo="bar",flis!="flas"}`, urlQuery)
}

func backtick(str string) string {
	return "`" + str + "`"
}

func TestFlowQuery_AddLineFilterMultipleValues(t *testing.T) {
	cfg := config.Loki{URL: "/"}
	query := NewFlowQueryBuilderWithDefaults(&cfg)
	err := query.addFilter(filters.NewRegexMatch("foo", `bar,baz`))
	require.NoError(t, err)
	urlQuery := query.Build()
	assert.Equal(t, `/loki/api/v1/query_range?query={app="netobserv-flowcollector"}|~`+backtick(`foo":"(?i)[^"]*bar.*"|foo":"(?i)[^"]*baz.*"`), urlQuery)
}

func TestFlowQuery_AddNotLineFilters(t *testing.T) {
	cfg := config.Loki{URL: "/"}
	query := NewFlowQueryBuilderWithDefaults(&cfg)
	err := query.addFilter(filters.NewRegexMatch("foo", `"bar"`))
	require.NoError(t, err)
	err = query.addFilter(filters.NewNotRegexMatch("flis", `"flas"`))
	require.NoError(t, err)
	urlQuery := query.Build()
	assert.Equal(t, `/loki/api/v1/query_range?query={app="netobserv-flowcollector"}|~`+backtick(`foo":"bar"`)+`|~`+backtick(`"flis"`)+`!~`+backtick(`flis":"flas"`), urlQuery)
}

func TestFlowQuery_AddLineFiltersWithEmpty(t *testing.T) {
	cfg := config.Loki{URL: "/"}
	query := NewFlowQueryBuilderWithDefaults(&cfg)
	err := query.addFilter(filters.NewRegexMatch("foo", `"bar"`))
	require.NoError(t, err)
	err = query.addFilter(filters.NewRegexMatch("flis", `""`))
	require.NoError(t, err)
	urlQuery := query.Build()
	assert.Equal(t, `/loki/api/v1/query_range?query={app="netobserv-flowcollector"}|~`+backtick(`foo":"bar"`)+`|json|flis=""`, urlQuery)
}

func TestFlowQuery_AddRecordTypeLabelFilter(t *testing.T) {
	cfg := config.Loki{URL: "/", Labels: []string{"foo", "flis", "_RecordType"}}
	query := NewFlowQueryBuilderWithDefaults(&cfg)
	err := query.addFilter(filters.NewRegexMatch("foo", `"bar"`))
	require.NoError(t, err)
	err = query.addFilter(filters.NewRegexMatch("flis", `"flas"`))
	require.NoError(t, err)
	urlQuery := query.Build()
	assert.Equal(t, `/loki/api/v1/query_range?query={app="netobserv-flowcollector",_RecordType="flowLog",foo="bar",flis="flas"}`, urlQuery)
}
