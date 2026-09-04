package alertingmock

import (
	"testing"

	"github.com/prometheus/common/model"
)

func TestLabelsMatchAny(t *testing.T) {
	labels := model.LabelSet{"netobserv": "true", "severity": "warning"}
	matchers := parseLabelMatchers([]string{`{netobserv="true"}`})

	if !labelsMatchAny(matchers, labels) {
		t.Fatal("expected netobserv rule to match netobserv selector")
	}
	if labelsMatchAny(matchers, model.LabelSet{"severity": "warning"}) {
		t.Fatal("expected non-netobserv labels to not match netobserv selector")
	}
	if !labelsMatchAny(nil, labels) {
		t.Fatal("expected empty matchers to match all labels")
	}
}

func TestFilterAlertingRulesByMatcher(t *testing.T) {
	netobserv := getNetobservAlertRules()
	ovn := getOvnPlatformAlertRules()
	matchers := parseLabelMatchers([]string{`{netobserv="true"}`})

	filteredNetobserv := filterAlertingRules(netobserv, matchers)
	filteredOvn := filterAlertingRules(ovn, matchers)

	if len(filteredNetobserv) == 0 {
		t.Fatal("expected netobserv alert rules to remain after netobserv filter")
	}
	if len(filteredOvn) != 0 {
		t.Fatalf("expected OVN rules to be excluded by netobserv filter, got %d", len(filteredOvn))
	}
}

func TestOvnPlatformAlertRulesComplete(t *testing.T) {
	rules := getOvnPlatformAlertRules()
	if len(rules) != 16 {
		t.Fatalf("expected 16 OVN platform alert rules, got %d", len(rules))
	}
	for _, rule := range rules {
		if _, ok := rule.Labels["netobserv"]; ok {
			t.Fatalf("OVN rule %s must not carry netobserv label", rule.Name)
		}
		if rule.Alerts == nil {
			t.Fatalf("OVN rule %s must use an empty alerts slice, not nil", rule.Name)
		}
	}
}
