package alertingmock

import "github.com/prometheus/common/model"

func getKialiMockAlertRules() []AlertingRule {
	return []AlertingRule{
		buildKialiAlert(
			"KialiControlPlaneDown",
			"critical",
			"Kiali control plane is down.",
			"Kiali is unavailable in the service mesh control plane.",
			[]*Alert{kialiAlert("firing", model.LabelSet{"namespace": "istio-system"})},
		),
	}
}

func kialiAlert(state string, labels model.LabelSet) *Alert {
	return &Alert{
		Labels: labels.Clone(),
		State:  state,
		Value:  "1",
	}
}

func buildKialiAlert(name, severity, summary, description string, alerts []*Alert) AlertingRule {
	if alerts == nil {
		alerts = []*Alert{}
	}
	annotations := model.LabelSet{
		"summary":     model.LabelValue(summary),
		"description": model.LabelValue(description),
	}
	labels := model.LabelSet{
		"severity":                    model.LabelValue(severity),
		"netobserv":                   "true",
		"netobserv_io_health_context": "kiali",
	}
	for _, a := range alerts {
		a.Annotations = annotations
		a.Labels["alertname"] = model.LabelValue(name)
		a.Labels["severity"] = model.LabelValue(severity)
	}
	state := 0
	for _, a := range alerts {
		switch a.State {
		case "firing":
			state |= firing
		case "pending":
			state |= pending
		case "silenced":
			state |= silenced
		}
	}
	ruleState := "inactive"
	if len(alerts) > 0 {
		ruleState = stateToString(state)
	}
	return AlertingRule{
		Name:        name,
		Annotations: annotations,
		Labels:      labels,
		State:       ruleState,
		Alerts:      alerts,
	}
}
