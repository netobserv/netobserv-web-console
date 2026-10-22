package backend

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/netobserv/network-observability-console-plugin/pkg/model"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/filters"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils/constants"
)

// FlowsBackend is the interface for backends that provide raw flows
type FlowsBackend interface {
	Name() constants.DataSource
	Flows(context.Context, *QueryContext, *FlowParams) (*model.QueryResponse, int, error)
}

// MetricsBackend is the interface for backends that provide metrics derived from flows
type MetricsBackend interface {
	Name() constants.DataSource
	Metrics(context.Context, *QueryContext, *MetricsParams) (*model.AggregatedQueryResponse, int, error)
	GetLabelValues(context.Context, *QueryContext, ...string) ([]string, int, error)
	MatchLabelValues(context.Context, *QueryContext, filters.SingleQuery, string) ([]string, int, error)
}

// FlowParams encapsulates parameters for fetching raw flows
type FlowParams struct {
	Start      time.Time
	End        time.Time
	Limit      int
	RecordType constants.RecordType
	PacketLoss constants.PacketLoss
	// Tenant     string
	Filters filters.SingleQuery
}

func (p *FlowParams) DatesLimitToString() (string, string, string) {
	var startStr, endStr, limit string
	if !p.Start.IsZero() {
		startStr = strconv.FormatInt(p.Start.Unix(), 10)
	}
	if !p.End.IsZero() {
		endStr = strconv.FormatInt(p.End.Unix(), 10)
	}
	if p.Limit != 0 {
		limit = strconv.FormatInt(int64(p.Limit), 10)
	}
	return startStr, endStr, limit
}

// MetricsParams encapsulates parameters for fetching metrics
type MetricsParams struct {
	Start          time.Time
	End            time.Time
	Top            int
	RecordType     constants.RecordType
	RateInterval   string
	Step           time.Duration
	DataField      string
	MetricFunction constants.MetricFunction
	PacketLoss     constants.PacketLoss
	Aggregate      string
	Groups         string
	Tenant         string
	Filters        filters.SingleQuery
}

func (p *MetricsParams) DatesToString() (string, string) {
	var startStr, endStr string
	if !p.Start.IsZero() {
		startStr = strconv.FormatInt(p.Start.Unix(), 10)
	}
	if !p.End.IsZero() {
		endStr = strconv.FormatInt(p.End.Unix(), 10)
	}
	return startStr, endStr
}

// QueryContext adds query context for backend resolution, such as tenant or forced datasource
type QueryContext struct {
	DataSource    constants.DataSource
	RequestHeader http.Header
	UseLokiStatus bool
	Tenant        string
}

// UnmanagedError tells that a given backend does not manage the desired function/params; orchestrator should retry with another backend.
type UnmanagedError struct {
	wrapped error
}

func NewUnmanagedError(err error) *UnmanagedError {
	return &UnmanagedError{wrapped: err}
}

func (e *UnmanagedError) Error() string {
	if e.wrapped != nil {
		return fmt.Sprintf("Unmanaged request: %v", e.wrapped.Error())
	}
	return "Unmanaged request"
}

func IsUnmanaged(err error) bool {
	var unmanaged *UnmanagedError
	return errors.As(err, &unmanaged)
}
