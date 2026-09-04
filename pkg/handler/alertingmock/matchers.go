package alertingmock

import (
	"net/url"
	"strings"

	"github.com/prometheus/common/model"
)

func parseLabelMatchers(values []string) []model.LabelSet {
	matchers := make([]model.LabelSet, 0, len(values))
	for _, raw := range values {
		raw = strings.TrimSpace(raw)
		if !strings.HasPrefix(raw, "{") || !strings.HasSuffix(raw, "}") {
			continue
		}
		inner := strings.TrimSpace(raw[1 : len(raw)-1])
		if inner == "" {
			matchers = append(matchers, model.LabelSet{})
			continue
		}
		ls := model.LabelSet{}
		for _, part := range strings.Split(inner, ",") {
			part = strings.TrimSpace(part)
			eq := strings.Index(part, "=")
			if eq <= 0 {
				continue
			}
			key := strings.TrimSpace(part[:eq])
			val := strings.TrimSpace(part[eq+1:])
			val = strings.Trim(val, `"`)
			ls[model.LabelName(key)] = model.LabelValue(val)
		}
		matchers = append(matchers, ls)
	}
	return matchers
}

func labelsMatch(matcher, labels model.LabelSet) bool {
	for k, v := range matcher {
		if labels[k] != v {
			return false
		}
	}
	return true
}

func labelsMatchAny(matchers []model.LabelSet, labels model.LabelSet) bool {
	if len(matchers) == 0 {
		return true
	}
	for _, matcher := range matchers {
		if labelsMatch(matcher, labels) {
			return true
		}
	}
	return false
}

func filterAlertingRules(rules []AlertingRule, matchers []model.LabelSet) []AlertingRule {
	if len(matchers) == 0 {
		return rules
	}
	filtered := make([]AlertingRule, 0, len(rules))
	for _, rule := range rules {
		if labelsMatchAny(matchers, rule.Labels) {
			filtered = append(filtered, rule)
		}
	}
	return filtered
}

func filterRecordingRules(rules []RecordingRule, matchers []model.LabelSet) []RecordingRule {
	if len(matchers) == 0 {
		return rules
	}
	filtered := make([]RecordingRule, 0, len(rules))
	for _, rule := range rules {
		if labelsMatchAny(matchers, rule.Labels) {
			filtered = append(filtered, rule)
		}
	}
	return filtered
}

func labelMatchersFromRequest(r url.Values) []model.LabelSet {
	return parseLabelMatchers(r["match[]"])
}
