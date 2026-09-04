/**
 * BGP / BFD platform alert names from bgp-cloud-connector PrometheusRules.
 * Source: openshift/bgp-cloud-connector config/prometheus/rules-frrk8s.yaml
 *
 * These alerts are based on frrk8s_* metrics exposed by the frr-k8s daemonset.
 * They are shipped by bgp-cloud-connector because it drives the FRRConfiguration lifecycle.
 */
export const BGP_PLATFORM_ALERT_NAMES: readonly string[] = [
  'BGPSessionDown',
  'BGPPeerFlapping',
  'BGPNoPrefixesReceived',
  'BGPNoPrefixesAnnounced',
  'BFDSessionDown',
  'BFDPeerFlapping'
];

export const BGP_PLATFORM_ALERT_NAME_SET = new Set<string>(BGP_PLATFORM_ALERT_NAMES);

export const isBgpPlatformAlertName = (name: string): boolean => BGP_PLATFORM_ALERT_NAME_SET.has(name);

/** PrometheusRule group names used by bgp-cloud-connector. */
export const BGP_RULES_GROUP_NAMES = ['BGPSessionHealth', 'BFDSessionHealth'];

export const isBgpPlatformRulesGroup = (group: { name?: string; file?: string }): boolean =>
  (group.name !== undefined && BGP_RULES_GROUP_NAMES.includes(group.name)) ||
  (group.file?.includes('bgp-cloud-connector') ?? false);
