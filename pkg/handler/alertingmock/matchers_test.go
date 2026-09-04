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
	kiali := getKialiMockAlertRules()
	matchers := parseLabelMatchers([]string{`{netobserv="true"}`})

	filteredNetobserv := filterAlertingRules(netobserv, matchers)
	filteredOvn := filterAlertingRules(ovn, matchers)
	filteredKiali := filterAlertingRules(kiali, matchers)

	if len(filteredNetobserv) == 0 {
		t.Fatal("expected netobserv alert rules to remain after netobserv filter")
	}
	if len(filteredOvn) != len(ovn) {
		t.Fatalf("expected OVN rules to match netobserv filter, got %d want %d", len(filteredOvn), len(ovn))
	}
	if len(filteredKiali) != len(kiali) {
		t.Fatalf("expected kiali rules to match netobserv filter, got %d want %d", len(filteredKiali), len(kiali))
	}
}

func TestOvnPlatformAlertRulesComplete(t *testing.T) {
	rules := getOvnPlatformAlertRules()
	if len(rules) != 16 {
		t.Fatalf("expected 16 OVN platform alert rules, got %d", len(rules))
	}
	for _, rule := range rules {
		if rule.Labels["netobserv"] != "true" {
			t.Fatalf("OVN rule %s must carry netobserv=true label", rule.Name)
		}
		if rule.Labels["netobserv_io_health_context"] != "ovn" {
			t.Fatalf("OVN rule %s must carry netobserv_io_health_context=ovn label", rule.Name)
		}
		if rule.Alerts == nil {
			t.Fatalf("OVN rule %s must use an empty alerts slice, not nil", rule.Name)
		}
	}
}

func TestKialiMockAlertRules(t *testing.T) {
	rules := getKialiMockAlertRules()
	if len(rules) != 1 {
		t.Fatalf("expected 1 kiali mock alert rule, got %d", len(rules))
	}
	if rules[0].Labels["netobserv_io_health_context"] != "kiali" {
		t.Fatalf("expected kiali context label, got %q", rules[0].Labels["netobserv_io_health_context"])
	}
}
