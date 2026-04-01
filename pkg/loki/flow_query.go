// Package loki provides functionalities for interacting with Loki
package loki

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/netobserv/network-observability-console-plugin/pkg/config"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/fields"
	"github.com/netobserv/network-observability-console-plugin/pkg/model/filters"
	"github.com/netobserv/network-observability-console-plugin/pkg/utils/constants"
)

const (
	recordTypeField = "_RecordType"
	startParam      = "start"
	endParam        = "end"
	limitParam      = "limit"
	queryRangePath  = "/loki/api/v1/query_range?query="
	jsonOrJoiner    = "+or+"
	emptyMatch      = `""`
)

// can contains only alphanumeric / ' ' / '-' / '_' / '.' / ',' / '"' / '*' / ':' / '/' characteres
var filterRegexpValidation = regexp.MustCompile(`^[\w -_.,\"*:/]*$`)

// FlowQueryBuilder stores a state to build a LogQL query
type FlowQueryBuilder struct {
	config       *config.Loki
	startTime    string
	endTime      string
	limit        string
	labelFilters []filters.LabelFilter
	lineFilters  []filters.LineFilter
	jsonFilters  [][]filters.LabelFilter
}

func NewFlowQueryBuilder(cfg *config.Loki, start, end, limit string,
	recordType constants.RecordType, packetLoss constants.PacketLoss) *FlowQueryBuilder {
	// Always use following stream selectors
	labelFilters := []filters.LabelFilter{
		// app, which will apply whichever matching criteria (any or all)
		filters.StringEqualLabelFilter(constants.AppLabel, constants.AppLabelValue),
	}

	// only filter on _RecordType if available
	if cfg.IsLabel(recordTypeField) {
		if recordType == constants.RecordTypeAllConnections {
			// connection _RecordType including newConnection, heartbeat or endConnection
			labelFilters = append(labelFilters, filters.StringMatchLabelFilter(constants.RecordTypeLabel, strings.Join(constants.ConnectionTypes, "|")))
		} else if len(recordType) > 0 {
			// specific _RecordType either newConnection, heartbeat, endConnection or flowLog
			labelFilters = append(labelFilters, filters.StringEqualLabelFilter(constants.RecordTypeLabel, string(recordType)))
		}
	}

	lineFilters := []filters.LineFilter{}
	if packetLoss == constants.PacketLossDropped {
		// match records that doesn't contains "Packets" field and 1+ packets dropped
		// as FLP will ensure the filtering
		lineFilters = append(lineFilters,
			filters.NotContainsKeyLineFilter(fields.Packets),
			filters.RegexMatchLineFilter(fields.PktDropPackets, true, "[1-9][0-9]*"),
		)
	} else if packetLoss == constants.PacketLossHasDrop {
		// match 1+ packets dropped
		lineFilters = append(lineFilters,
			filters.RegexMatchLineFilter(fields.PktDropPackets, true, "[1-9][0-9]*"),
		)
	} else if packetLoss == constants.PacketLossSent {
		// match records that doesn't contains "PktDropPackets" field
		// as FLP will ensure the filtering
		lineFilters = append(lineFilters,
			filters.NotContainsKeyLineFilter(fields.PktDropPackets),
		)
	}

	return &FlowQueryBuilder{
		config:       cfg,
		startTime:    start,
		endTime:      end,
		limit:        limit,
		labelFilters: labelFilters,
		lineFilters:  lineFilters,
	}
}

func NewFlowQueryBuilderWithDefaults(cfg *config.Loki) *FlowQueryBuilder {
	return NewFlowQueryBuilder(cfg, "", "", "", constants.RecordTypeLog, constants.PacketLossAll)
}

func (q *FlowQueryBuilder) Filters(queryFilters filters.SingleQuery) error {
	for _, filter := range queryFilters {
		if err := q.addFilter(filter); err != nil {
			return err
		}
	}
	return nil
}

func (q *FlowQueryBuilder) addFilter(filter filters.Match) error {
	if !filterRegexpValidation.MatchString(filter.Values) {
		return fmt.Errorf("unauthorized sign in flows request: %s", filter.Values)
	}

	// Space must be url-encoded
	values := strings.Split(strings.ReplaceAll(filter.Values, " ", "%20"), ",")

	// Stream selector labels
	if q.config.IsLabel(filter.Key) {
		if lf, ok := filter.ToLabelFilter(); ok {
			q.labelFilters = append(q.labelFilters, lf)
		}
	} else if q.config.IsIP(filter.Key) {
		q.addIPFilters(filter.Key, values, filter.Not)
	} else {
		q.addLineFilters(filter, values)
	}

	return nil
}

func (q *FlowQueryBuilder) addLineFilters(filter filters.Match, values []string) {
	if len(values) == 0 {
		return
	}

	if q.config.IsArray(filter.Key) {
		q.lineFilters = append(q.lineFilters, filters.ArrayLineFilter(filter.Key, values, filter.Not))
	} else {
		var lf filters.LineFilter
		var hasEmptyMatch bool
		if q.config.IsNumeric(filter.Key) {
			lf, hasEmptyMatch = filters.NumericLineFilter(filter.Key, values, filter.Not, filter.MoreThanOrEqual)
		} else if filter.Regex {
			lf, hasEmptyMatch = filters.StringLineFilterCheckExact(filter.Key, values, filter.Not)
		} else {
			lf, hasEmptyMatch = filters.StringLineFilter(filter.Key, values, filter.Not)
		}
		// if there is at least an empty exact match, there is no uniform/safe way to filter by text,
		// so we should use JSON label matchers instead of text line matchers
		if hasEmptyMatch {
			q.jsonFilters = append(q.jsonFilters, lf.AsLabelFilters())
		} else {
			q.lineFilters = append(q.lineFilters, lf)
		}
	}
}

// addIPFilters assumes that we are searching for that IP addresses as part
// of the log line (not in the stream selector labels)
func (q *FlowQueryBuilder) addIPFilters(key string, values []string, not bool) {
	if not {
		// NOT IP filters means we don't want any of the values, ie. IP!=A AND IP!=B instead of IP!=A OR IP!=B
		for _, value := range values {
			// empty exact matches should be treated as attribute filters looking for empty IP
			if value == emptyMatch {
				q.jsonFilters = append(q.jsonFilters, []filters.LabelFilter{filters.NotStringLabelFilter(key, "")})
			} else {
				q.jsonFilters = append(q.jsonFilters, []filters.LabelFilter{filters.NotIPLabelFilter(key, value)})
			}
		}
		return
	}
	// Positive case
	filtersPerKey := make([]filters.LabelFilter, 0, len(values))
	for _, value := range values {
		// empty exact matches should be treated as attribute filters looking for empty IP
		if value == emptyMatch {
			filtersPerKey = append(filtersPerKey, filters.StringEqualLabelFilter(key, ""))
		} else {
			filtersPerKey = append(filtersPerKey, filters.IPLabelFilter(key, value))
		}
	}
	q.jsonFilters = append(q.jsonFilters, filtersPerKey)
}

func (q *FlowQueryBuilder) createStringBuilderURL() *strings.Builder {
	sb := strings.Builder{}
	sb.WriteString(strings.TrimRight(q.config.URL, "/"))
	sb.WriteString(queryRangePath)
	return &sb
}

func (q *FlowQueryBuilder) appendLabels(sb *strings.Builder) {
	sb.WriteString("{")
	for i, ss := range q.labelFilters {
		if i > 0 {
			sb.WriteByte(',')
		}
		ss.WriteInto(sb)
	}
	sb.WriteByte('}')
}

func (q *FlowQueryBuilder) appendLineFilters(sb *strings.Builder) {
	for _, lf := range q.lineFilters {
		lf.WriteInto(sb)
	}
}

func (q *FlowQueryBuilder) appendFilter(sb *strings.Builder, field string) {
	// ensure field is specified
	// |~`"{{field}}"`
	sb.WriteString("|~`\"")
	sb.WriteString(field)
	sb.WriteString("\"`")
}

func (q *FlowQueryBuilder) appendDNSFilter(sb *strings.Builder) {
	// ensure at least one Dns field is specified except DnsErrno
	// |~`"DnsId`|~`"DnsName`|~`"DnsLatencyMs`|~`"DnsFlagsResponseCode"`
	sb.WriteString("|~`")
	sb.WriteString(`"DnsId`)
	sb.WriteString("`")
	sb.WriteString("|~`")
	sb.WriteString(`"DnsName`)
	sb.WriteString("`")
	sb.WriteString("|~`")
	sb.WriteString(`"DnsLatencyMs`)
	sb.WriteString("`")
	sb.WriteString("|~`")
	sb.WriteString(`"DnsFlagsResponseCode"`)
	sb.WriteString("`")
}

func (q *FlowQueryBuilder) appendDNSLatencyFilter(sb *strings.Builder) {
	// ensure DnsLatencyMs field is specified and value is not zero
	// |~`"DnsLatencyMs`!~`DnsLatencyMs%22:0[,}]`
	sb.WriteString("|~`")
	sb.WriteString(`"DnsLatencyMs`)
	sb.WriteString("`")
	sb.WriteString("!~`")
	sb.WriteString(`"DnsLatencyMs":0[,}]`)
	sb.WriteString("`")
}

func (q *FlowQueryBuilder) appendRTTFilter(sb *strings.Builder) {
	// ensure at TimeFlowRttNs field is specified
	// |~`"TimeFlowRttNs"`
	sb.WriteString("|~`")
	sb.WriteString(`"TimeFlowRttNs"`)
	sb.WriteString("`")
}

func (q *FlowQueryBuilder) appendJSON(sb *strings.Builder, forceAppend bool) {
	if forceAppend || len(q.jsonFilters) > 0 {
		sb.WriteString("|json")
		for _, lfPerKey := range q.jsonFilters {
			sb.WriteByte('|')
			for i, lf := range lfPerKey {
				if i > 0 {
					sb.WriteString(jsonOrJoiner)
				}
				lf.WriteInto(sb)
			}
		}
	}
}

func (q *FlowQueryBuilder) appendQueryParams(sb *strings.Builder) {
	if len(q.startTime) > 0 {
		appendQueryParam(sb, startParam, q.startTime)
	}
	if len(q.endTime) > 0 {
		appendQueryParam(sb, endParam, q.endTime)
	}
	if len(q.limit) > 0 {
		appendQueryParam(sb, limitParam, q.limit)
	}
}

func (q *FlowQueryBuilder) Build() string {
	sb := q.createStringBuilderURL()
	q.appendLabels(sb)
	q.appendLineFilters(sb)
	q.appendJSON(sb, false)
	q.appendQueryParams(sb)
	return sb.String()
}

func appendQueryParam(sb *strings.Builder, key, value string) {
	sb.WriteByte('&')
	sb.WriteString(key)
	sb.WriteByte('=')
	sb.WriteString(value)
}
