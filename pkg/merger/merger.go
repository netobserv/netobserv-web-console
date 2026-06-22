// Package merger provides interfaces and implementations for aggregating
// query responses from multiple storage backends (Loki, Prometheus).
package merger

import (
	"github.com/netobserv/network-observability-console-plugin/pkg/model"
)

// Merger aggregates multiple storage query responses into a single result.
type Merger interface {
	Add(from model.QueryResponseData) (model.ResultValue, error)
	Get() *model.AggregatedQueryResponse
}
