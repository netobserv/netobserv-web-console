package alertingmock

import (
	"fmt"

	"github.com/prometheus/common/model"
)

var bgpMockPeers = []string{
	"10.0.45.12",
	"10.0.45.13",
}

func bgpAlert(state string, labels model.LabelSet) *Alert {
	return &Alert{
		Labels: labels.Clone(),
		State:  state,
		Value:  "1",
	}
}

func bgpRuleState(alerts []*Alert) string {
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
	if len(alerts) == 0 {
		return "inactive"
	}
	return stateToString(state)
}

func buildBgpAlert(name, severity, summary, description string, alerts []*Alert) AlertingRule {
	if alerts == nil {
		alerts = []*Alert{}
	}
	annotations := model.LabelSet{
		"summary":     model.LabelValue(summary),
		"description": model.LabelValue(description),
		"netobserv_io_network_health": "{}",
	}
	labels := model.LabelSet{
		"severity":  model.LabelValue(severity),
		"netobserv": "true",
	}
	for _, a := range alerts {
		a.Annotations = annotations
		a.Labels["alertname"] = model.LabelValue(name)
		a.Labels["severity"] = model.LabelValue(severity)
	}
	return AlertingRule{
		Name:        name,
		Annotations: annotations,
		Labels:      labels,
		State:       bgpRuleState(alerts),
		Alerts:      alerts,
	}
}

func getBgpPlatformAlertRules() []AlertingRule {
	peer1 := bgpMockPeers[0]
	peer2 := bgpMockPeers[1]

	return []AlertingRule{
		buildBgpAlert(
			"BGPSessionDown",
			"critical",
			fmt.Sprintf("BGP session to peer %s is down", peer1),
			fmt.Sprintf("BGP session to peer %s (VRF ) has been down for more than 1 minute.", peer1),
			[]*Alert{bgpAlert("firing", model.LabelSet{
				"peer": model.LabelValue(peer1),
				"vrf":  "",
			})},
		),
		buildBgpAlert(
			"BGPPeerFlapping",
			"warning",
			fmt.Sprintf("BGP peer %s is flapping", peer2),
			fmt.Sprintf("BGP session to peer %s is flapping: more than 3 opens sent in the last 10 minutes.", peer2),
			[]*Alert{bgpAlert("pending", model.LabelSet{
				"peer": model.LabelValue(peer2),
				"vrf":  "",
			})},
		),
		buildBgpAlert(
			"BGPNoPrefixesReceived",
			"warning",
			fmt.Sprintf("BGP session to peer %s has no received prefixes", peer2),
			fmt.Sprintf("BGP session to peer %s has 0 received prefixes for more than 5 minutes.", peer2),
			nil,
		),
		buildBgpAlert(
			"BGPNoPrefixesAnnounced",
			"warning",
			fmt.Sprintf("BGP session to peer %s has no announced prefixes", peer1),
			fmt.Sprintf("BGP session to peer %s has 0 announced prefixes for more than 5 minutes.", peer1),
			[]*Alert{bgpAlert("firing", model.LabelSet{
				"peer": model.LabelValue(peer1),
				"vrf":  "",
			})},
		),
		buildBgpAlert(
			"BFDSessionDown",
			"critical",
			fmt.Sprintf("BFD session to peer %s is down", peer2),
			fmt.Sprintf("BFD session to peer %s (VRF ) has been down for more than 30 seconds.", peer2),
			nil,
		),
		buildBgpAlert(
			"BFDPeerFlapping",
			"warning",
			fmt.Sprintf("BFD session to peer %s is flapping", peer1),
			fmt.Sprintf("BFD session to peer %s is flapping: more than 3 down events in the last 10 minutes.", peer1),
			nil,
		),
	}
}
