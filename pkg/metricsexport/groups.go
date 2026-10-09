package metricsexport

import (
	"strings"

	"github.com/netobserv/network-observability-console-plugin/pkg/model/fields"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils/constants"
)

func normalizeFunction(fn string) string {
	switch fn {
	case string(constants.MetricFunctionMin),
		string(constants.MetricFunctionMax),
		string(constants.MetricFunctionP90),
		string(constants.MetricFunctionP99):
		return fn
	default:
		return string(constants.MetricFunctionAvg)
	}
}

func rateMetricGroup(metricType, metricFunction string) (string, bool) {
	if metricFunction != string(constants.MetricFunctionRate) {
		return "", false
	}
	switch metricType {
	case constants.MetricTypeBytes:
		return "rate.bytes", true
	case constants.MetricTypePackets:
		return "rate.packets", true
	case constants.MetricTypeDroppedBytes:
		return "droppedRate.bytes", true
	case constants.MetricTypeDroppedPackets:
		return "droppedRate.packets", true
	default:
		return "", false
	}
}

func dnsFlowsMetricGroup(aggregateBy string) string {
	switch aggregateBy {
	case fields.DNSName:
		return "dnsName"
	case fields.DNSCode:
		return "dnsRCode"
	default:
		return "totalDnsCount"
	}
}

func tlsFlowsMetricGroup(aggregateBy string) string {
	switch aggregateBy {
	case "TLSVersion":
		return "tlsUsagePerVersion"
	case "TLSCipher":
		return "tlsUsagePerCipher"
	case "TLSGroup":
		return "tlsUsagePerGroup"
	default:
		return "tlsFlowRate"
	}
}

func flowsMetricGroup(metricFunction string) string {
	if metricFunction == string(constants.MetricFunctionCount) {
		return "totalFlowCount"
	}
	return "totalFlowRate"
}

func pktDropMetricGroup(aggregateBy string) (string, bool) {
	switch aggregateBy {
	case fields.PktDropLatestState:
		return "droppedState", true
	case fields.PktDropLatestDropCause:
		return "droppedCause", true
	default:
		return "", false
	}
}

// MetricGroup derives the export metric group name from query parameters.
func MetricGroup(metricType, metricFunction, aggregateBy, override string) string {
	if override != "" {
		return override
	}

	if group, ok := rateMetricGroup(metricType, metricFunction); ok {
		return group
	}

	switch metricType {
	case constants.MetricTypeDNSLatency:
		return "dnsLatency." + normalizeFunction(metricFunction)
	case constants.MetricTypeFlowRTT:
		return "rtt." + normalizeFunction(metricFunction)
	case constants.MetricTypeDNSFlows:
		return dnsFlowsMetricGroup(aggregateBy)
	case constants.MetricTypeFlows:
		return flowsMetricGroup(metricFunction)
	case constants.MetricTypeTLSFlows:
		return tlsFlowsMetricGroup(aggregateBy)
	}

	if group, ok := pktDropMetricGroup(aggregateBy); ok {
		return group
	}

	return strings.ToLower(metricFunction) + "." + strings.ToLower(metricType)
}

func includeTopologyEdgesForGroup(group string) bool {
	switch {
	case strings.HasPrefix(group, "rate."),
		strings.HasPrefix(group, "droppedRate."),
		strings.HasPrefix(group, "dnsLatency."),
		strings.HasPrefix(group, "rtt."):
		return true
	default:
		return false
	}
}
