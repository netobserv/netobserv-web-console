package prometheus

import (
	"strings"

	"github.com/netobserv/network-observability-console-plugin/pkg/model/filters"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils/constants"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils/queryparams"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
)

type QueryBuilder struct {
	aggregateKeyLabels map[string][]string
	in                 *queryparams.TopologyInput
	filters            filters.SingleQuery
	orMetrics          []string
	qRange             v1.Range
}

type Query struct {
	Range  v1.Range
	PromQL string
}

// NewQuery creates a new PromQL QueryBuilder for the given topology input.
func NewQuery(kl map[string][]string, in *queryparams.TopologyInput, qr *v1.Range, filters filters.SingleQuery, orMetrics []string) *QueryBuilder {
	return &QueryBuilder{
		aggregateKeyLabels: kl,
		in:                 in,
		filters:            filters,
		orMetrics:          orMetrics,
		qRange:             *qr,
	}
}

func (q *QueryBuilder) Build() Query {
	labels, extraFilter := GetLabelsAndFilter(q.aggregateKeyLabels, q.in.Aggregate, q.in.Groups)
	if extraFilter != "" {
		q.filters = append(q.filters, filters.NewNotRegexMatch(extraFilter, `""`))
	}
	groupBy := strings.Join(labels, ",")

	var factor, quantile string
	isHisto := false
	switch q.in.DataField {
	case constants.MetricTypeFlowRTT, constants.MetricTypeDNSLatency:
		factor = "*1000" // seconds to milliseconds
		isHisto = true
	}
	if isHisto {
		if q.in.MetricFunction == constants.MetricFunctionP90 {
			quantile = "0.9"
		} else if q.in.MetricFunction == constants.MetricFunctionP99 {
			quantile = "0.99"
		}
	}

	// Build metrics query like:
	//		topk | bottomk(
	// 			<k>,
	//			sum by(<aggregations>) (
	//				<function>(
	//					<metric>{<filters>}[<interval>]
	//				) <factor>
	//			)
	//		)
	//		&<query params>&step=<step>
	sb := strings.Builder{}

	if q.in.Top != "" {
		if q.in.MetricFunction == constants.MetricFunctionMin {
			sb.WriteString("bottomk")
		} else {
			sb.WriteString("topk")
		}
		sb.WriteRune('(')
		sb.WriteString(q.in.Top)
		sb.WriteRune(',')
	}

	for orIdx, metric := range q.orMetrics {
		if orIdx > 0 {
			sb.WriteString(" or ")
		}

		if isHisto && quantile != "" {
			// use histogram_quantile
			sb.WriteString("histogram_quantile(")
			sb.WriteString(quantile)
			sb.WriteRune(',')
			if groupBy == "" {
				groupBy = "le"
			} else {
				groupBy += ",le"
			}
		}

		sb.WriteString("sum")
		if groupBy != "" {
			sb.WriteString(" by(")
			sb.WriteString(groupBy)
			sb.WriteRune(')')
		}

		sb.WriteRune('(')
		if isHisto {
			if quantile == "" {
				// histogram average: sum / count
				appendRate(&sb, metric+"_sum", q.filters, q.in.RateInterval)
				sb.WriteRune('/')
				appendRate(&sb, metric+"_count", q.filters, q.in.RateInterval)
			} else {
				appendRate(&sb, metric+"_bucket", q.filters, q.in.RateInterval)
			}
		} else {
			appendRate(&sb, metric, q.filters, q.in.RateInterval)
		}
		sb.WriteRune(')') // closes sum(...
		if isHisto && quantile != "" {
			sb.WriteRune(')') // closes histogram_quantile(...
		}

		if len(factor) > 0 {
			sb.WriteString(factor)
		}
	}

	if q.in.Top != "" {
		sb.WriteRune(')') // closes topk(...
	}

	return Query{
		PromQL: sb.String(),
		Range:  q.qRange,
	}
}

func appendRate(sb *strings.Builder, metric string, filters filters.SingleQuery, interval string) {
	sb.WriteString("rate(")
	appendFilteredMetric(sb, metric, filters)
	sb.WriteRune('[')
	sb.WriteString(interval)
	sb.WriteString("])")
}

func appendFilteredMetric(sb *strings.Builder, metric string, filters filters.SingleQuery) {
	sb.WriteString(metric)
	sb.WriteRune('{')
	first := true
	for _, filter := range filters {
		if lf, ok := filter.ToLabelFilter(); ok {
			if !first {
				sb.WriteRune(',')
			}
			lf.WriteInto(sb)
			first = false
		}
	}
	sb.WriteRune('}')
}

// GetLabelsAndFilter returns the label fields for grouping and an optional extra filter string.
// For Prometheus, the "app" aggregate is a noop (it's only relevant for Loki stream selectors).
func GetLabelsAndFilter(kl map[string][]string, aggregate, groups string) ([]string, string) {
	if aggregate == "app" {
		// ignore app: it's a noop aggregation needed for Loki, not relevant in promQL
		return nil, ""
	}
	return queryparams.GetLabelsAndFilter(kl, aggregate, groups)
}

// QueryFilters builds a PromQL metric selector string with the given filters applied.
func QueryFilters(metric string, filters filters.SingleQuery) string {
	sb := strings.Builder{}
	appendFilteredMetric(&sb, metric, filters)
	return sb.String()
}
