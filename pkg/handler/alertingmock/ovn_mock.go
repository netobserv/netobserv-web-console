package alertingmock

import (
	"fmt"

	"github.com/prometheus/common/model"
)

const (
	ovnRunbookBase = "https://github.com/openshift/runbooks/blob/master/alerts/cluster-network-operator/"
)

var ovnMockInstances = []string{
	"ip-10-0-1-7.ec2.internal:9095",
	"ip-10-0-1-137.ec2.internal:9095",
}

func ovnRunbook(doc string) string {
	return ovnRunbookBase + doc
}

func ovnAlert(state string, labels model.LabelSet) *Alert {
	return &Alert{
		Labels: labels.Clone(),
		State:  state,
		Value:  "1",
	}
}

func ovnRuleState(alerts []*Alert) string {
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

func buildOvnPlatformAlert(name, severity, summary, description, runbookDoc string, alerts []*Alert) AlertingRule {
	if alerts == nil {
		alerts = []*Alert{}
	}
	annotations := model.LabelSet{
		"summary":     model.LabelValue(summary),
		"description": model.LabelValue(description),
	}
	if runbookDoc != "" {
		annotations["runbook_url"] = model.LabelValue(ovnRunbook(runbookDoc))
	}
	labels := model.LabelSet{
		"severity":   model.LabelValue(severity),
		"prometheus": "openshift-ovn-kubernetes/k8s",
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
		State:       ovnRuleState(alerts),
		Alerts:      alerts,
	}
}

// getOvnPlatformAlertRules returns deterministic CNO OVN-Kubernetes platform alerts for mock mode.
// Active alerts are stable so the OVN / CNI tab can be tested locally without OpenShift.
func getOvnPlatformAlertRules() []AlertingRule {
	node1 := "ip-10-0-1-7.ec2.internal"
	node2 := "ip-10-0-1-137.ec2.internal"
	inst1 := ovnMockInstances[0]
	inst2 := ovnMockInstances[1]

	return []AlertingRule{
		buildOvnPlatformAlert(
			"NodeWithoutOVNKubeNodePodRunning",
			"warning",
			fmt.Sprintf("All Linux nodes should be running an ovnkube-node pod, %s is not.", node2),
			"Networking is degraded on nodes that do not have a functioning ovnkube-node pod.",
			"NodeWithoutOVNKubeNodePodRunning.md",
			[]*Alert{ovnAlert("pending", model.LabelSet{"node": model.LabelValue(node2)})},
		),
		buildOvnPlatformAlert(
			"OVNKubernetesControllerDisconnectedSouthboundDatabase",
			"warning",
			fmt.Sprintf("Networking control plane is degraded on node %s because OVN controller is not connected to OVN southbound database.", node1),
			"Networking is degraded on nodes when OVN controller is not connected to OVN southbound database connection.",
			"OVNKubernetesControllerDisconnectedSouthboundDatabase.md",
			nil,
		),
		buildOvnPlatformAlert(
			"OVNKubernetesNodePodAddError",
			"warning",
			"OVN Kubernetes is experiencing pod creation errors at an elevated rate.",
			"OVN Kubernetes experiences pod creation errors at an elevated rate. The pods will be retried.",
			"",
			[]*Alert{ovnAlert("firing", model.LabelSet{
				"instance":  model.LabelValue(inst1),
				"namespace": "openshift-ovn-kubernetes",
			})},
		),
		buildOvnPlatformAlert(
			"OVNKubernetesNodePodDeleteError",
			"warning",
			"OVN Kubernetes experiencing pod deletion errors at an elevated rate.",
			"OVN Kubernetes experiences pod deletion errors at an elevated rate. The pods will be retried.",
			"",
			[]*Alert{ovnAlert("firing", model.LabelSet{
				"instance":  model.LabelValue(inst2),
				"namespace": "openshift-ovn-kubernetes",
			})},
		),
		buildOvnPlatformAlert(
			"OVNKubernetesResourceRetryFailure",
			"warning",
			"OVN Kubernetes failed to apply networking control plane configuration.",
			"OVN Kubernetes failed to apply networking control plane configuration after several attempts.",
			"",
			nil,
		),
		buildOvnPlatformAlert(
			"OVNKubernetesNodeOVSOverflowUserspace",
			"warning",
			"OVS vSwitch daemon drops packets due to buffer overflow.",
			"Netlink messages dropped by OVS vSwitch daemon due to netlink socket buffer overflow.",
			"",
			nil,
		),
		buildOvnPlatformAlert(
			"OVNKubernetesNodeOVSOverflowKernel",
			"warning",
			"OVS kernel module drops packets due to buffer overflow.",
			"Netlink messages dropped by OVS kernel module due to netlink socket buffer overflow.",
			"",
			nil,
		),
		buildOvnPlatformAlert(
			"NorthboundStale",
			"warning",
			fmt.Sprintf("OVN-Kubernetes controller %s has not successfully synced any changes to the northbound database for too long.", inst1),
			"OVN-Kubernetes controller and/or OVN northbound database may cause a degraded networking control plane for the affected node.",
			"NorthboundStaleAlert.md",
			[]*Alert{ovnAlert("firing", model.LabelSet{"instance": model.LabelValue(inst1)})},
		),
		buildOvnPlatformAlert(
			"SouthboundStale",
			"warning",
			fmt.Sprintf("OVN northd %s has not successfully synced any changes to the southbound database for too long.", inst2),
			"OVN northd may cause a degraded networking control plane for the affected node.",
			"SouthboundStaleAlert.md",
			nil,
		),
		buildOvnPlatformAlert(
			"OVNKubernetesNorthboundDatabaseCPUUsageHigh",
			"info",
			fmt.Sprintf("OVN northbound database %s has high CPU usage.", inst1),
			"High OVN northbound CPU usage indicates high load on the networking control plane for the affected node.",
			"",
			nil,
		),
		buildOvnPlatformAlert(
			"OVNKubernetesSouthboundDatabaseCPUUsageHigh",
			"info",
			fmt.Sprintf("OVN southbound database %s has high CPU usage.", inst2),
			"High OVN southbound CPU usage indicates high load on the networking control plane for the affected node.",
			"",
			nil,
		),
		buildOvnPlatformAlert(
			"OVNKubernetesNorthdInactive",
			"warning",
			fmt.Sprintf("OVN northd %s is not active.", inst2),
			"An inactive OVN northd instance may cause a degraded networking control plane for the affected node.",
			"OVNKubernetesNorthdInactive.md",
			[]*Alert{ovnAlert("pending", model.LabelSet{"instance": model.LabelValue(inst2)})},
		),
		buildOvnPlatformAlert(
			"NoRunningOvnControlPlane",
			"critical",
			"There is no running ovn-kubernetes control plane.",
			"Networking control plane is degraded while there are no OVN Kubernetes control plane pods.",
			"NoRunningOvnControlPlane.md",
			[]*Alert{ovnAlert("firing", model.LabelSet{"namespace": "openshift-ovn-kubernetes"})},
		),
		buildOvnPlatformAlert(
			"NoOvnClusterManagerLeader",
			"critical",
			"There is no ovn-kubernetes cluster manager leader.",
			"Networking control plane is degraded while there is no OVN Kubernetes cluster manager leader.",
			"NoOvnClusterManagerLeader.md",
			nil,
		),
		buildOvnPlatformAlert(
			"V4SubnetAllocationThresholdExceeded",
			"warning",
			"More than 80% of v4 subnets available to assign to the nodes are allocated.",
			"More than 80% of IPv4 subnets are used. Insufficient IPv4 subnets could degrade provisioning of workloads.",
			"V4SubnetAllocationThresholdExceeded.md",
			[]*Alert{ovnAlert("firing", model.LabelSet{"namespace": "openshift-ovn-kubernetes"})},
		),
		buildOvnPlatformAlert(
			"V6SubnetAllocationThresholdExceeded",
			"warning",
			"More than 80% of the v6 subnets available to assign to the nodes are allocated.",
			"More than 80% of IPv6 subnets are used. Insufficient IPv6 subnets could degrade provisioning of workloads.",
			"",
			nil,
		),
	}
}
