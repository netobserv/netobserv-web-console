package prometheus

import (
	"strconv"
	"strings"

	"github.com/netobserv/network-observability-console-plugin/pkg/backend"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/filters"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils/constants"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
)

type QueryBuilder struct {
	aggregateKeyLabels map[string][]string
	params             *backend.MetricsParams
	orMetrics          []string
}

type Query struct {
	Range  v1.Range
	PromQL string
}

// NewQuery creates a new PromQL QueryBuilder for the given topology input.
func NewQuery(kl map[string][]string, params *backend.MetricsParams, orMetrics []string) *QueryBuilder {
	return &QueryBuilder{aggregateKeyLabels: kl, params: params, orMetrics: orMetrics}
}

func (q *QueryBuilder) Build() Query {
	labels, extraFilter := GetLabelsAndFilter(q.aggregateKeyLabels, q.params.Aggregate, q.params.Groups)
	if extraFilter != "" {
		q.params.Filters = append(q.params.Filters, filters.NewNotRegexMatch(extraFilter, `""`))
	}
	groupBy := strings.Join(labels, ",")

	var factor, quantile string
	isHisto := false
	switch q.params.DataField {
	case constants.MetricTypeFlowRTT, constants.MetricTypeDNSLatency:
		factor = "*1000" // seconds to milliseconds
		isHisto = true
	}
	if isHisto {
		if q.params.MetricFunction == constants.MetricFunctionP90 {
			quantile = "0.9"
		} else if q.params.MetricFunction == constants.MetricFunctionP99 {
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

	if q.params.Top != 0 {
		if q.params.MetricFunction == constants.MetricFunctionMin {
			sb.WriteString("bottomk")
		} else {
			sb.WriteString("topk")
		}
		sb.WriteRune('(')
		sb.WriteString(strconv.FormatInt(int64(q.params.Top), 10))
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
				appendRateOrIncrease(&sb, false, metric+"_sum", q.params.Filters, q.params.RateInterval)
				sb.WriteRune('/')
				appendRateOrIncrease(&sb, false, metric+"_count", q.params.Filters, q.params.RateInterval)
			} else {
				appendRateOrIncrease(&sb, false, metric+"_bucket", q.params.Filters, q.params.RateInterval)
			}
		} else {
			appendRateOrIncrease(&sb, q.params.MetricFunction == constants.MetricFunctionCount, metric, q.params.Filters, q.params.RateInterval)
		}
		sb.WriteRune(')') // closes sum(...
		if isHisto && quantile != "" {
			sb.WriteRune(')') // closes histogram_quantile(...
		}

		if len(factor) > 0 {
			sb.WriteString(factor)
		}
	}

	if q.params.Top != 0 {
		sb.WriteRune(')') // closes topk(...
	}

	return Query{
		PromQL: sb.String(),
		Range: v1.Range{
			Start: q.params.Start,
			End:   q.params.End,
			Step:  q.params.Step,
		},
	}
}

func appendRateOrIncrease(sb *strings.Builder, isIncrease bool, metric string, filters filters.SingleQuery, interval string) {
	if isIncrease {
		sb.WriteString("increase(")
	} else {
		sb.WriteString("rate(")
	}
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
	return backend.GetLabelsAndFilter(kl, aggregate, groups)
}

// QueryFilters builds a PromQL metric selector string with the given filters applied.
func QueryFilters(metric string, filters filters.SingleQuery) string {
	sb := strings.Builder{}
	appendFilteredMetric(&sb, metric, filters)
	return sb.String()
}
