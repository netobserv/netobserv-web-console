package loki

import (
	"fmt"
	"slices"
	"strconv"
	"strings"

	"github.com/netobserv/network-observability-console-plugin/pkg/backend"
	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils/constants"
)

const (
	topologyDefaultLimit = 100
)

// TopologyQueryBuilder builds LogQL metric queries for topology views.
type TopologyQueryBuilder struct {
	*FlowQueryBuilder
	topology           *backend.MetricsParams
	aggregateKeyLabels map[string][]string
}

// NewTopologyQuery creates a new TopologyQueryBuilder for the given Loki config and topology input.
func NewTopologyQuery(cfg *config.Loki, kl map[string][]string, p *backend.MetricsParams) (*TopologyQueryBuilder, error) {
	var rt constants.RecordType
	if slices.Contains(constants.AnyConnectionType, string(p.RecordType)) {
		rt = "endConnection"
	} else {
		rt = "flowLog"
	}
	startStr, endStr := p.DatesToString()
	top := strconv.FormatInt(int64(p.Top), 10)

	fqb := NewFlowQueryBuilder(cfg, startStr, endStr, top, rt, p.PacketLoss)
	return &TopologyQueryBuilder{
		FlowQueryBuilder:   fqb,
		topology:           p,
		aggregateKeyLabels: kl,
	}, nil
}

// GetFunctionWithQuantile maps a MetricFunction to its LogQL function name and optional quantile value.
func GetFunctionWithQuantile(metricFunction constants.MetricFunction) (string, string) {
	switch metricFunction {
	case constants.MetricFunctionCount:
		return "count_over_time", ""
	case constants.MetricFunctionSum:
		return "sum_over_time", ""
	case constants.MetricFunctionMax:
		return "max_over_time", ""
	case constants.MetricFunctionMin:
		return "min_over_time", ""
	case constants.MetricFunctionAvg:
		return "avg_over_time", ""
	case constants.MetricFunctionP90:
		return "quantile_over_time", "0.9"
	case constants.MetricFunctionP99:
		return "quantile_over_time", "0.99"
	case constants.MetricFunctionRate:
		return "rate", ""
	default:
		panic(fmt.Sprint("wrong function provided:", metricFunction))
	}
}

func getFactor(metricType string) string {
	switch metricType {
	case constants.MetricTypeFlowRTT:
		return "/1000000" // nanoseconds to milliseconds
	default:
		return ""
	}
}

// Build constructs the full LogQL topology query URL string.
func (q *TopologyQueryBuilder) Build() string {
	top := q.topology.Top
	if top == 0 {
		top = topologyDefaultLimit
	}

	labels, extraFilter := backend.GetLabelsAndFilter(q.aggregateKeyLabels, q.topology.Aggregate, q.topology.Groups)
	if q.config.IsLabel(extraFilter) {
		extraFilter = ""
	}
	strLabels := strings.Join(labels, ",")

	factor := getFactor(q.topology.DataField)
	function, quantile := GetFunctionWithQuantile(q.topology.MetricFunction)

	sumBy := function == "rate" || function == "count_over_time" || function == "sum_over_time"
	// Build topology query like:
	// /<url path>?query=
	//		topk | bottomk(
	// 			<k>,
	//			<sum | avg> by(<aggregations>) (
	//				<function>(
	//					{<label filters>}|<line filters>|json|<json filters>
	//						|unwrap Bytes|__error__=""[<interval>]
	//				) <factor>
	//			)
	//		)
	//		&<query params>&step=<step>
	sb := q.createStringBuilderURL()
	if function == "min_over_time" {
		sb.WriteString("bottomk")
	} else {
		sb.WriteString("topk")
	}
	sb.WriteRune('(')
	sb.WriteString(strconv.FormatInt(int64(top), 10))
	sb.WriteRune(',')

	if sumBy {
		sb.WriteString("sum by(")
		sb.WriteString(strLabels)
		sb.WriteRune(')')
	}

	sb.WriteRune('(')
	sb.WriteString(function)
	sb.WriteString("(")
	if len(quantile) > 0 {
		sb.WriteString(quantile)
		sb.WriteRune(',')
	}
	q.appendLabels(sb)
	q.appendLineFilters(sb)

	if len(extraFilter) > 0 {
		q.appendFilter(sb, extraFilter)
	}

	switch q.topology.DataField {
	case constants.MetricTypeDNSLatency:
		q.appendDNSLatencyFilter(sb)
	case constants.MetricTypeDNSFlows:
		q.appendFilter(sb, "DnsId")
	case constants.MetricTypeTLSFlows:
		q.appendTLSFilter(sb)
	case constants.MetricTypeFlowRTT:
		q.appendFilter(sb, "TimeFlowRttNs")
	}

	q.appendJSON(sb, true)

	dataField := backend.GetActualDataField(q.topology.DataField)
	if len(dataField) > 0 {
		sb.WriteString("|unwrap ")
		sb.WriteString(dataField)
		sb.WriteString(`|__error__=""`)
	}
	sb.WriteRune('[')
	if function != "rate" {
		sb.WriteString(q.topology.Step.String())
	} else {
		sb.WriteString(q.topology.RateInterval)
	}
	sb.WriteString("])")

	if !sumBy {
		sb.WriteString(" by(")
		sb.WriteString(strLabels)
		sb.WriteRune(')')
	}
	sb.WriteRune(')')

	if len(factor) > 0 {
		sb.WriteString(factor)
	}
	sb.WriteRune(')')

	q.appendQueryParams(sb)
	sb.WriteString("&step=")
	sb.WriteString(q.topology.Step.String())

	return sb.String()
}
