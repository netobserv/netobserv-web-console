package alertingmock

import (
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"net/http"
	"net/url"
	"strings"
	"sync"

	"github.com/prometheus/common/model"
	"github.com/sirupsen/logrus"
)

var mlog = logrus.WithField("module", "alertingmock")

// Actual namespace pairs from topology mock data
type namespacePair struct {
	src string
	dst string
}

var namespacePairs = []namespacePair{
	{"default", "netobserv"},
	{"netobserv", "default"},
	{"openshift-console", "default"},
	{"openshift-console-operator", "default"},
	{"openshift-deployment-validation-operator", "default"},
	{"openshift-monitoring", "default"},
	{"openshift-ingress", "default"},
	{"openshift-ingress", "openshift-console"},
	{"openshift-console", "openshift-ingress"},
	{"openshift-ingress", "openshift-monitoring"},
	{"openshift-monitoring", "openshift-ingress"},
	{"openshift-monitoring", "openshift-monitoring"},
	{"netobserv", "netobserv"},
	{"openshift-console", "openshift-monitoring"},
	{"netobserv", "openshift-dns"},
	{"openshift-monitoring", "openshift-dns"},
	{"openshift-user-workload-monitoring", "openshift-ingress"},
	{"openshift-ingress", "openshift-user-workload-monitoring"},
	{"openshift-user-workload-monitoring", "openshift-monitoring"},
	{"openshift-monitoring", "openshift-user-workload-monitoring"},
	{"netobserv", "openshift-monitoring"},
	{"production", "production"},
	{"gateway-system", "gateway-system"},
	{"vms", "vms"},
	{"vms", "production"},
}

// Get unique namespaces from pairs for single-label alerts
func getUniqueNamespaces() []string {
	nsMap := make(map[string]bool)
	for _, pair := range namespacePairs {
		nsMap[pair.src] = true
		nsMap[pair.dst] = true
	}
	var namespaces []string
	for ns := range nsMap {
		namespaces = append(namespaces, ns)
	}
	return namespaces
}

// Get unique nodes from pairs for single-label alerts
func getUniqueNodes() []string {
	nodeMap := make(map[string]bool)
	for _, pair := range nodePairs {
		nodeMap[pair.src] = true
		nodeMap[pair.dst] = true
	}
	var nodes []string
	for node := range nodeMap {
		nodes = append(nodes, node)
	}
	return nodes
}

// Actual node pairs from topology mock data
type nodePair struct {
	src string
	dst string
}

var nodePairs = []nodePair{
	{"ip-10-0-1-7.ec2.internal", "ip-10-0-1-137.ec2.internal"},
	{"ip-10-0-1-137.ec2.internal", "ip-10-0-1-7.ec2.internal"},
}

type workload struct {
	namespace string
	name      string
	ownerType string
}

// Actual workloads from topology mock data
var workloads = []workload{
	{"netobserv", "netobserv-controller-manager", "Deployment"},
	{"netobserv", "flowlogs-pipeline", "DaemonSet"},
	{"netobserv", "loki", "Pod"},
	{"openshift-console", "console", "Deployment"},
	{"openshift-console-operator", "console-operator", "Deployment"},
	{"openshift-deployment-validation-operator", "deployment-validation-operator", "Deployment"},
	{"openshift-monitoring", "prometheus-k8s", "StatefulSet"},
	{"openshift-monitoring", "alertmanager-main", "StatefulSet"},
	{"openshift-monitoring", "kube-state-metrics", "Deployment"},
	{"openshift-monitoring", "thanos-querier", "Deployment"},
	{"openshift-monitoring", "cluster-monitoring-operator", "Deployment"},
	{"openshift-ingress", "router-default", "Deployment"},
	{"openshift-dns", "dns-default", "DaemonSet"},
	{"openshift-image-registry", "image-registry", "Deployment"},
	{"openshift-user-workload-monitoring", "prometheus-user-workload", "StatefulSet"},
	{"openshift-user-workload-monitoring", "thanos-ruler-user-workload", "StatefulSet"},
	{"openshift-insights", "insights-operator", "Deployment"},
	{"production", "web-deployment", "Deployment"},
	{"production", "app-deployment", "Deployment"},
	{"production", "gateway-api", "Gateway"},
	{"gateway-system", "gateway-internal", "Gateway"},
	{"gateway-system", "gateway-external", "Gateway"},
	{"vms", "vm-ubuntu-server", "VirtualMachine"},
	{"vms", "vm-centos-server", "VirtualMachine"},
	{"vms", "vmi-linux", "VirtualMachineInstance"},
	{"vms", "vmi-windows", "VirtualMachineInstance"},
}

// We duplicate prom model due to missing json information
type AlertingRule struct {
	Name        string         `json:"name"`
	Labels      model.LabelSet `json:"labels"`
	Annotations model.LabelSet `json:"annotations"`
	Alerts      []*Alert       `json:"alerts"`
	State       string         `json:"state"`
}

type RecordingRule struct {
	Name   string         `json:"name"`
	Query  string         `json:"query"`
	Labels model.LabelSet `json:"labels"`
}

type Alert struct {
	Annotations model.LabelSet `json:"annotations"`
	Labels      model.LabelSet `json:"labels"`
	State       string         `json:"state"`
	Value       string         `json:"value"`
}

const (
	firing   int = 0x01
	pending  int = 0x02
	silenced int = 0x04
)

func stateToString(state int) string {
	if state&firing > 0 {
		return "firing"
	}
	if state&pending > 0 {
		return "pending"
	}
	if state&silenced > 0 {
		return "silenced"
	}
	return "inactive"
}

func randomState() int {
	rndState := rand.IntN(10)
	if rndState < 1 {
		return silenced
	} else if rndState < 3 {
		return pending
	}
	return firing
}

func createAlert(probability float64, name, resourceName string, threshold, upperBound int, targetLabels, resourceNames []string, annotations, labels model.LabelSet) (*Alert, int) {
	if rand.Float64() < probability {
		alertLabels := labels.Clone()
		alertState := randomState()
		alertLabels["alertname"] = model.LabelValue(name)
		for i, lbl := range targetLabels {
			// First label will be "resourceName"; next are picked randomly
			if i == 0 {
				alertLabels[model.LabelName(lbl)] = model.LabelValue(resourceName)
			} else {
				idx := rand.IntN(len(resourceNames))
				alertLabels[model.LabelName(lbl)] = model.LabelValue(resourceNames[idx])
			}
		}
		val := float64(threshold) + rand.Float64()*float64(upperBound-threshold)
		return &Alert{
			Annotations: annotations,
			Labels:      alertLabels,
			State:       stateToString(alertState),
			Value:       fmt.Sprintf("%f", val),
		}, alertState
	}
	return nil, 0
}

func createNamespacePairAlert(probability float64, name string, threshold, upperBound int, nsPair namespacePair, annotations, labels model.LabelSet) (*Alert, int) {
	if rand.Float64() < probability {
		alertLabels := labels.Clone()
		alertState := randomState()
		alertLabels["alertname"] = model.LabelValue(name)
		alertLabels["SrcK8S_Namespace"] = model.LabelValue(nsPair.src)
		alertLabels["DstK8S_Namespace"] = model.LabelValue(nsPair.dst)
		val := float64(threshold) + rand.Float64()*float64(upperBound-threshold)
		return &Alert{
			Annotations: annotations,
			Labels:      alertLabels,
			State:       stateToString(alertState),
			Value:       fmt.Sprintf("%f", val),
		}, alertState
	}
	return nil, 0
}

func createNodePairAlert(probability float64, name string, threshold, upperBound int, nodePair nodePair, annotations, labels model.LabelSet) (*Alert, int) {
	if rand.Float64() < probability {
		alertLabels := labels.Clone()
		alertState := randomState()
		alertLabels["alertname"] = model.LabelValue(name)
		alertLabels["SrcK8S_Hostname"] = model.LabelValue(nodePair.src)
		alertLabels["DstK8S_Hostname"] = model.LabelValue(nodePair.dst)
		val := float64(threshold) + rand.Float64()*float64(upperBound-threshold)
		return &Alert{
			Annotations: annotations,
			Labels:      alertLabels,
			State:       stateToString(alertState),
			Value:       fmt.Sprintf("%f", val),
		}, alertState
	}
	return nil, 0
}

func createAlerts(probability float64, name string, threshold, upperBound int, targetLabels, resourceNames []string, annotations, labels model.LabelSet) ([]*Alert, int) {
	alerts := []*Alert{}
	var ruleState int
	for _, resourceName := range resourceNames {
		if alert, state := createAlert(probability, name, resourceName, threshold, upperBound, targetLabels, resourceNames, annotations, labels); alert != nil {
			ruleState |= state
			alerts = append(alerts, alert)
		}
	}
	return alerts, ruleState
}

func createNamespacePairAlerts(probability float64, name string, threshold, upperBound int, annotations, labels model.LabelSet) ([]*Alert, int) {
	alerts := []*Alert{}
	var ruleState int
	for _, nsPair := range namespacePairs {
		if alert, state := createNamespacePairAlert(probability, name, threshold, upperBound, nsPair, annotations, labels); alert != nil {
			ruleState |= state
			alerts = append(alerts, alert)
		}
	}
	return alerts, ruleState
}

func createNodePairAlerts(probability float64, name string, threshold, upperBound int, annotations, labels model.LabelSet) ([]*Alert, int) {
	alerts := []*Alert{}
	var ruleState int
	for _, nodePair := range nodePairs {
		if alert, state := createNodePairAlert(probability, name, threshold, upperBound, nodePair, annotations, labels); alert != nil {
			ruleState |= state
			alerts = append(alerts, alert)
		}
	}
	return alerts, ruleState
}

func createWorkloadAlert(probability float64, name string, threshold, upperBound int, wl workload, annotations, labels model.LabelSet) (*Alert, int) {
	if rand.Float64() < probability {
		alertLabels := labels.Clone()
		alertState := randomState()
		alertLabels["alertname"] = model.LabelValue(name)
		alertLabels["SrcK8S_Namespace"] = model.LabelValue(wl.namespace)
		alertLabels["SrcK8S_OwnerName"] = model.LabelValue(wl.name)
		alertLabels["SrcK8S_Type"] = model.LabelValue(wl.ownerType)
		val := float64(threshold) + rand.Float64()*float64(upperBound-threshold)
		return &Alert{
			Annotations: annotations,
			Labels:      alertLabels,
			State:       stateToString(alertState),
			Value:       fmt.Sprintf("%f", val),
		}, alertState
	}
	return nil, 0
}

func createWorkloadAlerts(probability float64, name string, threshold, upperBound int, annotations, labels model.LabelSet) ([]*Alert, int) {
	alerts := []*Alert{}
	var ruleState int
	for _, wl := range workloads {
		if alert, state := createWorkloadAlert(probability, name, threshold, upperBound, wl, annotations, labels); alert != nil {
			ruleState |= state
			alerts = append(alerts, alert)
		}
	}
	return alerts, ruleState
}

func createWorkloadRule(probability float64, name, severity, extraFilter string, threshold, upperBound int, bynetobs bool, workloadLabels []string) AlertingRule {
	labels := model.LabelSet{
		"severity": model.LabelValue(severity),
	}
	annotations := model.LabelSet{
		"description": model.LabelValue(name + " (a complete description...)"),
		"summary":     model.LabelValue(name + " (a summary...)"),
	}
	if bynetobs {
		labels["app"] = "netobserv"
	}
	labels["netobserv"] = "true"
	var jsonWorkloadLbl string
	if len(workloadLabels) > 0 {
		var quotedLbl []string
		for _, lbl := range workloadLabels {
			quotedLbl = append(quotedLbl, `"`+lbl+`"`)
		}
		jsonWorkloadLbl = fmt.Sprintf(`"workloadLabels":[%s],`, strings.Join(quotedLbl, ","))
	}
	searchURL := "https://duckduckgo.com/?q=" + url.PathEscape(name)
	var extraFilterJSON string
	if extraFilter != "" {
		extraFilterJSON = fmt.Sprintf(`,"trafficLinkFilter":"%s"`, extraFilter)
	}
	annotations["netobserv_io_network_health"] = model.LabelValue(fmt.Sprintf(
		`{%s"threshold":"%d","upperBound":"%d","unit":"%%","links":[{"name":"Search the web", "url": "%s"}]%s}`,
		jsonWorkloadLbl,
		threshold,
		upperBound,
		searchURL,
		extraFilterJSON,
	))
	ruleLabels := labels.Clone()
	ruleLabels["prometheus"] = "openshift-monitoring/k8s"
	alerts, ruleState := createWorkloadAlerts(probability, name, threshold, upperBound, annotations, labels)
	return AlertingRule{
		Name:        name,
		Annotations: annotations,
		Labels:      labels,
		State:       stateToString(ruleState),
		Alerts:      alerts,
	}
}

func createRule(probability float64, name, severity, extraFilter string, threshold, upperBound int, bynetobs bool, nsLbl, nodeLbl []string) AlertingRule {
	labels := model.LabelSet{
		"severity": model.LabelValue(severity),
	}
	annotations := model.LabelSet{
		"description": model.LabelValue(name + " (a complete description...)"),
		"summary":     model.LabelValue(name + " (a summary...)"),
	}
	if bynetobs {
		labels["app"] = "netobserv"
	}
	labels["netobserv"] = "true"
	var jsonNsLbl, jsonNodeLbl string
	if len(nsLbl) > 0 {
		var quotedLbl []string
		for _, lbl := range nsLbl {
			quotedLbl = append(quotedLbl, `"`+lbl+`"`)
		}
		jsonNsLbl = fmt.Sprintf(`"namespaceLabels":[%s],`, strings.Join(quotedLbl, ","))
	}
	if len(nodeLbl) > 0 {
		var quotedLbl []string
		for _, lbl := range nodeLbl {
			quotedLbl = append(quotedLbl, `"`+lbl+`"`)
		}
		jsonNodeLbl = fmt.Sprintf(`"nodeLabels":[%s],`, strings.Join(quotedLbl, ","))
	}
	searchURL := "https://duckduckgo.com/?q=" + url.PathEscape(name)
	var extraFilterJSON string
	if extraFilter != "" {
		extraFilterJSON = fmt.Sprintf(`,"trafficLinkFilter":"%s"`, extraFilter)
	}
	annotations["netobserv_io_network_health"] = model.LabelValue(fmt.Sprintf(
		`{%s%s"threshold":"%d","upperBound":"%d","unit":"%%","links":[{"name":"Search the web", "url": "%s"}]%s}`,
		jsonNsLbl,
		jsonNodeLbl,
		threshold,
		upperBound,
		searchURL,
		extraFilterJSON,
	))
	ruleLabels := labels.Clone()
	ruleLabels["prometheus"] = "openshift-monitoring/k8s"
	var alerts []*Alert
	var ruleState int
	if len(nsLbl) > 0 {
		// Check if this is a pair (two labels) or single label
		if len(nsLbl) == 2 && nsLbl[0] == "SrcK8S_Namespace" && nsLbl[1] == "DstK8S_Namespace" {
			// Use actual namespace pairs from topology
			alerts, ruleState = createNamespacePairAlerts(probability, name, threshold, upperBound, annotations, labels)
		} else {
			// Single namespace label - use unique namespaces
			alerts, ruleState = createAlerts(probability, name, threshold, upperBound, nsLbl, getUniqueNamespaces(), annotations, labels)
		}
	} else if len(nodeLbl) > 0 {
		// Check if this is a pair (two labels) or single label
		if len(nodeLbl) == 2 && nodeLbl[0] == "SrcK8S_HostName" && nodeLbl[1] == "DstK8S_HostName" {
			// Use actual node pairs from topology
			alerts, ruleState = createNodePairAlerts(probability, name, threshold, upperBound, annotations, labels)
		} else {
			// Single node label - use unique nodes
			alerts, ruleState = createAlerts(probability, name, threshold, upperBound, nodeLbl, getUniqueNodes(), annotations, labels)
		}
	} else {
		// global
		alerts = []*Alert{}
		if alert, state := createAlert(probability, name, "", threshold, upperBound, nil, nil, annotations, labels); alert != nil {
			ruleState |= state
			alerts = append(alerts, alert)
		}
	}
	return AlertingRule{
		Name:        name,
		Annotations: annotations,
		Labels:      labels,
		State:       stateToString(ruleState),
		Alerts:      alerts,
	}
}

var (
	netobservAlertRulesOnce  sync.Once
	netobservAlertRulesCache []AlertingRule
)

func getNetobservAlertRules() []AlertingRule {
	netobservAlertRulesOnce.Do(func() {
		netobservAlertRulesCache = []AlertingRule{
			createRule(0.4, "Packet delivery failed", "info", "", 5, 100, true, []string{"SrcK8S_Namespace", "DstK8S_Namespace"}, []string{}),
			createRule(0.3, "You have reached your hourly rate limit", "info", "", 5, 100, true, []string{"SrcK8S_Namespace", "DstK8S_Namespace"}, []string{}),
			createRule(0.1, "It's always DNS", "warning", `dns_flag_response_code!=\"\"`, 15, 100, true, []string{"SrcK8S_Namespace", "DstK8S_Namespace"}, []string{}),
			createRule(0.1, "We're under attack", "warning", "", 20, 100, true, []string{}, []string{}),
			createRule(0.1, "Sh*t - Famous last words", "critical", "", 5, 100, true, []string{}, []string{"SrcK8S_Hostname", "DstK8S_Hostname"}),
			createRule(0.3, "FromIngress", "info", "", 10, 100, false, []string{"exported_namespace"}, []string{}),
			createRule(0.3, "Degraded latency", "info", "", 100, 1000, true, []string{"SrcK8S_Namespace", "DstK8S_Namespace"}, []string{}),
			// Additional global alerts
			createRule(0.8, "High overall traffic volume", "warning", "", 1000, 5000, true, []string{}, []string{}),
			createRule(0.6, "Cluster-wide packet loss detected", "critical", "", 10, 50, true, []string{}, []string{}),
			createRule(0.5, "Global DNS resolution issues", "info", "", 100, 500, true, []string{}, []string{}),
			// Workload-specific alerts
			createWorkloadRule(0.2, "High workload packet drops", "warning", "", 10, 50, true, []string{"SrcK8S_Namespace", "SrcK8S_OwnerName", "SrcK8S_Type"}),
			createWorkloadRule(0.15, "Workload connection errors", "info", "", 5, 30, true, []string{"SrcK8S_Namespace", "SrcK8S_OwnerName", "SrcK8S_Type"}),
			createWorkloadRule(0.1, "Workload DNS issues", "warning", `dns_flag_response_code!=\"\"`, 15, 60, true, []string{"SrcK8S_Namespace", "SrcK8S_OwnerName", "SrcK8S_Type"}),
			createWorkloadRule(0.12, "Workload high latency", "info", "", 100, 500, true, []string{"SrcK8S_Namespace", "SrcK8S_OwnerName", "SrcK8S_Type"}),
			createWorkloadRule(0.08, "Workload network policy denied", "warning", "", 5, 25, true, []string{"SrcK8S_Namespace", "SrcK8S_OwnerName", "SrcK8S_Type"}),
		}
	})
	return netobservAlertRulesCache
}

func getNetobservRecordingRules() []RecordingRule {
	return []RecordingRule{
		{
			Name:  "netobserv_health_packet_drops_kernel_total",
			Query: "100 * (sum by (SrcK8S_Namespace) (rate(netobserv_workload_ingress_drop_packets_total{PktDropLatestDropCause=\"SKB_DROP_REASON_SOCKET_FILTER\"}[2m])) / (sum by (SrcK8S_Namespace) (rate(netobserv_workload_ingress_packets_total[2m])) > 0))",
			Labels: model.LabelSet{
				"netobserv": "true",
				"template":  "PacketDropsByKernel",
			},
		},
		{
			Name:  "netobserv_health_packet_drops_device_total",
			Query: "100 * (sum by (SrcK8S_HostName) (rate(netobserv_workload_ingress_drop_packets_total{PktDropLatestDropCause!=\"SKB_DROP_REASON_SOCKET_FILTER\"}[2m])) / (sum by (SrcK8S_HostName) (rate(netobserv_workload_ingress_packets_total[2m])) > 0))",
			Labels: model.LabelSet{
				"netobserv": "true",
				"template":  "PacketDropsByDevice",
			},
		},
		{
			Name:  "netobserv:network:dns_latency:src:p99",
			Query: "histogram_quantile(0.99, sum by (SrcK8S_Namespace, le) (rate(netobserv_workload_dns_latency_seconds_bucket[2m])))",
			Labels: model.LabelSet{
				"netobserv": "true",
				"template":  "DNSErrors",
			},
		},
		{
			Name:  "netobserv_health_dns_errors_total",
			Query: "100 * (sum(rate(netobserv_workload_dns_latency_seconds_count{DnsFlagsResponseCode!~\"NoError|NXDomain\"}[2m])) / (sum(rate(netobserv_workload_dns_latency_seconds_count[2m])) > 0))",
			Labels: model.LabelSet{
				"netobserv": "true",
				"template":  "DNSErrors",
			},
		},
		{
			Name:  "netobserv_health_dns_nxdomain_total",
			Query: "100 * (sum by (SrcK8S_Namespace) (rate(netobserv_workload_dns_latency_seconds_count{DnsFlagsResponseCode=\"NXDomain\"}[2m])) / (sum by (SrcK8S_Namespace) (rate(netobserv_workload_dns_latency_seconds_count[2m])) > 0))",
			Labels: model.LabelSet{
				"netobserv": "true",
				"template":  "DNSNxDomain",
			},
		},
		{
			Name:  "netobserv:network:packet_drop_rate:dst:avg",
			Query: "100 * (sum by (DstK8S_Namespace) (rate(netobserv_workload_ingress_drop_packets_total[2m])) / (sum by (DstK8S_Namespace) (rate(netobserv_workload_ingress_packets_total[2m])) > 0))",
			Labels: model.LabelSet{
				"netobserv": "true",
				"template":  "PacketDropsByKernel",
			},
		},
		{
			Name:  "netobserv_health_netpol_denied_total",
			Query: "100 * (sum by (SrcK8S_Namespace) (rate(netobserv_workload_network_events_total{NetworkEventsAction=\"NetworkPolicyDrop\"}[2m])) / (sum by (SrcK8S_Namespace) (rate(netobserv_workload_ingress_packets_total[2m])) > 0))",
			Labels: model.LabelSet{
				"netobserv": "true",
				"template":  "NetpolDenied",
			},
		},
		{
			Name:  "netobserv_health_latency_high_trend",
			Query: "100 * ((avg by (SrcK8S_Namespace) (rate(netobserv_workload_flow_rtt_seconds_sum[1h])) / avg by (SrcK8S_Namespace) (rate(netobserv_workload_flow_rtt_seconds_count[1h]))) - (avg by (SrcK8S_Namespace) (rate(netobserv_workload_flow_rtt_seconds_sum[1h] offset 1d)) / avg by (SrcK8S_Namespace) (rate(netobserv_workload_flow_rtt_seconds_count[1h] offset 1d)))) / (avg by (SrcK8S_Namespace) (rate(netobserv_workload_flow_rtt_seconds_sum[1h] offset 1d)) / avg by (SrcK8S_Namespace) (rate(netobserv_workload_flow_rtt_seconds_count[1h] offset 1d)))",
			Labels: model.LabelSet{
				"netobserv": "true",
				"template":  "LatencyHighTrend",
			},
		},
		{
			Name:  "netobserv_health_external_egress_high_trend",
			Query: "100 * ((sum by (SrcK8S_Namespace) (rate(netobserv_workload_egress_bytes_total{DstK8S_Type=\"\"}[1h])) - (sum by (SrcK8S_Namespace) (rate(netobserv_workload_egress_bytes_total{DstK8S_Type=\"\"} offset 1d [1h])))) / (sum by (SrcK8S_Namespace) (rate(netobserv_workload_egress_bytes_total{DstK8S_Type=\"\"} offset 1d [1h]))))",
			Labels: model.LabelSet{
				"netobserv": "true",
				"template":  "ExternalEgressHighTrend",
			},
		},
		{
			Name:  "netobserv_health_external_ingress_high_trend",
			Query: "100 * ((sum by (DstK8S_Namespace) (rate(netobserv_workload_ingress_bytes_total{SrcK8S_Type=\"\"}[1h])) - (sum by (DstK8S_Namespace) (rate(netobserv_workload_ingress_bytes_total{SrcK8S_Type=\"\"} offset 1d [1h])))) / (sum by (DstK8S_Namespace) (rate(netobserv_workload_ingress_bytes_total{SrcK8S_Type=\"\"} offset 1d [1h]))))",
			Labels: model.LabelSet{
				"netobserv": "true",
				"template":  "ExternalIngressHighTrend",
			},
		},
	}
}

func GetRules() func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		ruleType := r.URL.Query().Get("type")
		matchers := labelMatchersFromRequest(r.URL.Query())
		mlog.Infof("GetRules called with type=%s, full query: %s", ruleType, r.URL.RawQuery)

		groups := []map[string]any{}
		if ruleType == "record" {
			recordingRules := filterRecordingRules(getNetobservRecordingRules(), matchers)
			if len(recordingRules) > 0 {
				groups = append(groups, map[string]any{
					"name":     "netobserv-recording-rules",
					"file":     "/etc/prometheus/rules/netobserv-recording.yml",
					"interval": 30,
					"rules":    recordingRules,
				})
			}
		} else {
			netobservRules := filterAlertingRules(getNetobservAlertRules(), matchers)
			if len(netobservRules) > 0 {
				groups = append(groups, map[string]any{
					"name":     "netobserv-rules",
					"file":     "/etc/prometheus/rules/netobserv.yml",
					"interval": 30,
					"rules":    netobservRules,
				})
			}
			ovnRules := filterAlertingRules(getOvnPlatformAlertRules(), matchers)
			if len(ovnRules) > 0 {
				groups = append(groups, map[string]any{
					"name":     "cluster-network-operator-ovn.rules",
					"file":     "/etc/prometheus/rules/openshift-ovn-kubernetes/networking-rules.yaml",
					"interval": 30,
					"rules":    ovnRules,
				})
			}
			bgpRules := filterAlertingRules(getBgpPlatformAlertRules(), matchers)
			if len(bgpRules) > 0 {
				groups = append(groups, map[string]any{
					"name":     "BGPSessionHealth",
					"file":     "/etc/prometheus/rules/bgp-cloud-connector/rules-frrk8s.yaml",
					"interval": 30,
					"rules":    bgpRules,
				})
			}
		}

		res := map[string]any{
			"status": "success",
			"data": map[string]any{
				"groups": groups,
			},
		}

		response, err := json.Marshal(res)
		if err != nil {
			mlog.Errorf("Marshalling error while responding JSON: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			if _, err = w.Write([]byte(err.Error())); err != nil {
				mlog.Errorf("Error while responding error: %v", err)
			}
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		if _, err = w.Write(response); err != nil {
			mlog.Errorf("Error while responding JSON: %v", err)
		}
	}
}

type silenceResponse struct {
	ID     string `json:"id"`
	Status struct {
		State string `json:"state"`
	} `json:"status"`
	Matchers []struct {
		Name  string `json:"name"`
		Value string `json:"value"`
	} `json:"matchers"`
}

func GetSilences() func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, _ *http.Request) {
		// One deterministic silence so OVN tab can exercise silenced state in mock mode.
		silences := []silenceResponse{
			{
				ID: "ovn-mock-silence-pod-delete",
				Status: struct {
					State string `json:"state"`
				}{State: "active"},
				Matchers: []struct {
					Name  string `json:"name"`
					Value string `json:"value"`
				}{
					{Name: "alertname", Value: "OVNKubernetesNodePodDeleteError"},
					{Name: "instance", Value: ovnMockInstances[1]},
				},
			},
		}
		response, err := json.Marshal(silences)
		if err != nil {
			mlog.Errorf("Marshalling error while responding JSON: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			if _, err = w.Write([]byte(err.Error())); err != nil {
				mlog.Errorf("Error while responding error: %v", err)
			}
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		if _, err = w.Write(response); err != nil {
			mlog.Errorf("Error while responding JSON: %v", err)
		}
	}
}

func GetQuery() func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query().Get("query")
		mlog.Infof("GetQuery called with query=%s", query)

		// Determine template from query (metric name)
		var template string
		switch query {
		case "netobserv_health_packet_drops_kernel_total":
			template = "PacketDropsByKernel"
		case "netobserv_health_packet_drops_device_total":
			template = "PacketDropsByDevice"
		case "netobserv:network:dns_latency:src:p99":
			template = "DNSErrors"
		case "netobserv_health_dns_errors_total":
			template = "DNSErrors"
		case "netobserv_health_dns_nxdomain_total":
			template = "DNSNxDomain"
		case "netobserv:network:packet_drop_rate:dst:avg":
			template = "PacketDropsByKernel"
		case "netobserv_health_netpol_denied_total":
			template = "NetpolDenied"
		case "netobserv_health_latency_high_trend":
			template = "LatencyHighTrend"
		case "netobserv_health_external_egress_high_trend":
			template = "ExternalEgressHighTrend"
		case "netobserv_health_external_ingress_high_trend":
			template = "ExternalIngressHighTrend"
		}

		// Get fixed mock data for this template
		mockData := getMockData(template)
		mlog.Infof("Template: %s, mock data count: %d", template, len(mockData))
		var result []map[string]any

		for _, data := range mockData {
			metric := map[string]any{}
			if data.namespace != "" {
				// Frontend looks for lowercase groupBy labels
				metric["namespace"] = data.namespace
			}
			if data.node != "" {
				// Frontend looks for lowercase groupBy labels
				metric["node"] = data.node
			}

			mlog.Infof("Adding metric: namespace=%s, node=%s, value=%f", data.namespace, data.node, data.value)
			result = append(result, map[string]any{
				"metric": metric,
				"value":  []any{float64(1234567890), fmt.Sprintf("%f", data.value)},
			})
		}

		mlog.Infof("Total results: %d", len(result))

		res := map[string]any{
			"status": "success",
			"data": map[string]any{
				"resultType": "vector",
				"result":     result,
			},
		}

		response, err := json.Marshal(res)
		if err != nil {
			mlog.Errorf("Marshalling error while responding JSON: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			if _, err = w.Write([]byte(err.Error())); err != nil {
				mlog.Errorf("Error while responding error: %v", err)
			}
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		if _, err = w.Write(response); err != nil {
			mlog.Errorf("Error while responding JSON: %v", err)
		}
	}
}
