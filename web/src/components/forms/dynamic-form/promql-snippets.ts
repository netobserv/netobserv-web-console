export type PromQLSnippet = {
  id: string;
  label: string;
  description: string;
  expr: string;
};

export const NETOBSERV_METRIC_SUGGESTIONS = [
  'netobserv_workload_ingress_bytes_total',
  'netobserv_workload_egress_bytes_total',
  'netobserv_workload_ingress_packets_total',
  'netobserv_workload_egress_packets_total',
  'netobserv_workload_drop_packets_total',
  'netobserv_workload_tls_flows_total',
  'netobserv_workload_ipsec_flows_total',
  'netobserv_namespace_ingress_bytes_total',
  'netobserv_namespace_egress_bytes_total',
  'netobserv_namespace_ingress_packets_total',
  'netobserv_namespace_egress_packets_total',
  'netobserv_namespace_drop_packets_total',
  'netobserv_namespace_rtt_seconds',
  'netobserv_namespace_rtt_seconds_bucket',
  'netobserv_namespace_rtt_seconds_count',
  'netobserv_namespace_dns_latency_seconds',
  'netobserv_namespace_dns_latency_seconds_count',
  'netobserv_namespace_network_policy_events_total',
  'netobserv_namespace_ipsec_flows_total',
  'netobserv_node_drop_packets_total',
  'netobserv_node_ingress_bytes_total',
  'netobserv_node_egress_bytes_total',
  'netobserv_node_ingress_packets_total',
  'netobserv_node_egress_packets_total',
  'netobserv_node_ipsec_flows_total',
  'netobserv_node_tls_flows_total',
  'netobserv_agent_sampling_rate',
  'netobserv_ingest_flows_processed',
  'netobserv_loki_dropped_entries_total',
  'haproxy_server_http_responses_total',
  'node_network_receive_drop_total',
  'node_network_transmit_drop_total'
];

export const PROMQL_SNIPPETS: PromQLSnippet[] = [
  {
    id: 'ingress-surge',
    label: 'Incoming traffic surge',
    description: 'Percent increase of ingress traffic vs yesterday, per destination namespace',
    expr: `(100 *
  (
    (sum(rate(netobserv_workload_ingress_bytes_total{SrcK8S_Namespace="openshift-ingress"}[30m])) by (DstK8S_Namespace) > 1000)
    - sum(rate(netobserv_workload_ingress_bytes_total{SrcK8S_Namespace="openshift-ingress"}[30m] offset 1d)) by (DstK8S_Namespace)
  )
  / sum(rate(netobserv_workload_ingress_bytes_total{SrcK8S_Namespace="openshift-ingress"}[30m] offset 1d)) by (DstK8S_Namespace))
> 100`
  },
  {
    id: 'egress-surge',
    label: 'Outgoing traffic surge',
    description: 'Percent increase of egress bytes vs yesterday, per source namespace',
    expr: `(100 *
  (
    (sum(rate(netobserv_namespace_egress_bytes_total[30m])) by (SrcK8S_Namespace) > 1000)
    - sum(rate(netobserv_namespace_egress_bytes_total[30m] offset 1d)) by (SrcK8S_Namespace)
  )
  / sum(rate(netobserv_namespace_egress_bytes_total[30m] offset 1d)) by (SrcK8S_Namespace))
> 100`
  },
  {
    id: 'namespace-drop-ratio',
    label: 'Namespace drop ratio',
    description: 'Percentage of dropped packets per namespace',
    expr: `100 *
sum by (K8S_Namespace) (rate(netobserv_namespace_drop_packets_total[5m]))
/
clamp_min(sum by (K8S_Namespace) (rate(netobserv_namespace_ingress_packets_total[5m])), 1)`
  },
  {
    id: 'node-drop-ratio',
    label: 'Node drop ratio',
    description: 'Percentage of dropped packets per node',
    expr: `100 *
sum by (instance) (rate(netobserv_node_drop_packets_total[5m]))
/
clamp_min(sum by (instance) (rate(netobserv_node_ingress_packets_total[5m])), 1)`
  },
  {
    id: 'device-drop-ratio',
    label: 'Device drop ratio (node-exporter)',
    description: 'NIC receive+transmit drops as a percentage of packets, per node',
    expr: `100 *
(sum by (instance) (rate(node_network_receive_drop_total[5m])) + sum by (instance) (rate(node_network_transmit_drop_total[5m])))
/
clamp_min(
  sum by (instance) (rate(node_network_receive_packets_total[5m])) + sum by (instance) (rate(node_network_transmit_packets_total[5m])),
  1
)`
  },
  {
    id: 'dns-errors',
    label: 'DNS error rate',
    description: 'DNS errors as a percentage of DNS requests',
    expr: `100 *
sum by (DstK8S_Namespace) (rate(netobserv_namespace_dns_latency_seconds_count{DnsFlagsResponseCode!="NoError"}[5m]))
/
clamp_min(sum by (DstK8S_Namespace) (rate(netobserv_namespace_dns_latency_seconds_count[5m])), 1)`
  },
  {
    id: 'dns-nxdomain',
    label: 'DNS NXDOMAIN rate',
    description: 'NXDOMAIN responses as a percentage of DNS requests, per namespace',
    expr: `100 *
sum by (DstK8S_Namespace) (rate(netobserv_namespace_dns_latency_seconds_count{DnsFlagsResponseCode="NXDomain"}[5m]))
/
clamp_min(sum by (DstK8S_Namespace) (rate(netobserv_namespace_dns_latency_seconds_count[5m])), 1)`
  },
  {
    id: 'netpol-denied',
    label: 'NetworkPolicy denies',
    description: 'Denied NetworkPolicy events as a percentage of policy events, per namespace',
    expr: `100 *
sum by (DstK8S_Namespace) (rate(netobserv_namespace_network_policy_events_total{action="drop"}[5m]))
/
clamp_min(sum by (DstK8S_Namespace) (rate(netobserv_namespace_network_policy_events_total[5m])), 1)`
  },
  {
    id: 'rtt-p99-high',
    label: 'High TCP RTT (p99)',
    description: '99th percentile round-trip time in milliseconds, per source namespace',
    expr: `1000 * histogram_quantile(
  0.99,
  sum by (SrcK8S_Namespace, le) (rate(netobserv_namespace_rtt_seconds_bucket{SrcK8S_Namespace!=""}[5m]))
)`
  },
  {
    id: 'rtt-trend',
    label: 'RTT increase vs yesterday',
    description: 'Percent increase of p90 RTT compared to the same window yesterday',
    expr: `100 * (
  histogram_quantile(0.9, sum by (SrcK8S_Namespace, le) (rate(netobserv_namespace_rtt_seconds_bucket{SrcK8S_Namespace!=""}[2h])))
  -
  histogram_quantile(0.9, sum by (SrcK8S_Namespace, le) (rate(netobserv_namespace_rtt_seconds_bucket{SrcK8S_Namespace!=""}[2h] offset 1d)))
)
/
clamp_min(
  histogram_quantile(0.9, sum by (SrcK8S_Namespace, le) (rate(netobserv_namespace_rtt_seconds_bucket{SrcK8S_Namespace!=""}[2h] offset 1d))),
  0.000001
)`
  },
  {
    id: 'external-egress-trend',
    label: 'External egress surge',
    description: 'Percent increase of egress to external destinations vs yesterday, per node',
    expr: `(100 *
  (
    (sum(rate(netobserv_node_egress_bytes_total{DstSubnetLabel=~"|EXT:.*",DstK8S_Namespace="",DstK8S_OwnerName=""}[30m])) by (instance) > 1000)
    - sum(rate(netobserv_node_egress_bytes_total{DstSubnetLabel=~"|EXT:.*",DstK8S_Namespace="",DstK8S_OwnerName=""}[30m] offset 1d)) by (instance)
  )
  / sum(rate(netobserv_node_egress_bytes_total{DstSubnetLabel=~"|EXT:.*",DstK8S_Namespace="",DstK8S_OwnerName=""}[30m] offset 1d)) by (instance))
> 100`
  },
  {
    id: 'ipsec-errors',
    label: 'IPsec error ratio',
    description: 'IPsec error flows as a percentage of IPsec traffic, per node',
    expr: `100 *
sum by (instance) (rate(netobserv_node_ipsec_flows_total{IPSecStatus!="success"}[5m]))
/
clamp_min(sum by (instance) (rate(netobserv_node_ipsec_flows_total[5m])), 1)`
  },
  {
    id: 'tls-insecure',
    label: 'Insecure TLS versions',
    description: 'Flows using TLS 1.0, 1.1, or SSL, per source workload',
    expr: `sum(rate(netobserv_workload_tls_flows_total{TLSVersion=~"TLS 1\\.0|TLS 1\\.1|SSL.*"}[5m]))
by (SrcK8S_Namespace, SrcK8S_OwnerName, SrcK8S_OwnerType, TLSVersion) > 0`
  },
  {
    id: 'ingress-5xx',
    label: 'Ingress 5xx errors',
    description: 'HAProxy 5xx responses as a percentage of total responses, per namespace',
    expr: `100 * sum(rate(haproxy_server_http_responses_total{code="5xx"}[2m])) by (exported_namespace)
/
clamp_min(sum(rate(haproxy_server_http_responses_total[2m])) by (exported_namespace), 1)`
  },
  {
    id: 'ingress-4xx',
    label: 'Ingress 4xx errors',
    description: 'HAProxy 4xx responses as a percentage of total responses, per namespace',
    expr: `100 * sum(rate(haproxy_server_http_responses_total{code="4xx"}[2m])) by (exported_namespace)
/
clamp_min(sum(rate(haproxy_server_http_responses_total[2m])) by (exported_namespace), 1)`
  },
  {
    id: 'sampling-normalized-bytes',
    label: 'Sampling-normalized ingress bytes',
    description: 'Ingress byte rate scaled by agent sampling rate (useful when sampling is not 1:1)',
    expr: `sum by (DstK8S_Namespace) (rate(netobserv_namespace_ingress_bytes_total[5m]))
* avg(netobserv_agent_sampling_rate > 0)`
  },
  {
    id: 'cross-namespace-bytes',
    label: 'Cross-namespace traffic',
    description: 'Egress byte rate between namespaces (source and destination labels)',
    expr: `sum by (SrcK8S_Namespace, DstK8S_Namespace) (
  rate(netobserv_workload_egress_bytes_total{SrcK8S_Namespace!="", DstK8S_Namespace!=""}[5m])
)`
  },
  {
    id: 'no-flows',
    label: 'No flows processed',
    description: 'Detects when NetObserv stops ingesting flows (operational alert pattern)',
    expr: `sum(rate(netobserv_ingest_flows_processed[1m])) == 0`
  },
  {
    id: 'loki-drops',
    label: 'Loki dropped entries',
    description: 'Detects when NetObserv cannot write flows to Loki',
    expr: `sum(rate(netobserv_loki_dropped_entries_total[1m])) > 0`
  }
];
