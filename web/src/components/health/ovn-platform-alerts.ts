/**
 * OpenShift CNO OVN-Kubernetes platform alert names.
 * Source: openshift/cluster-network-operator bindata/network/ovn-kubernetes/
 *   - common/alert-rules.yaml
 *   - self-hosted/alert-rules-control-plane.yaml
 */
export const OVN_PLATFORM_ALERT_NAMES: readonly string[] = [
  'NodeWithoutOVNKubeNodePodRunning',
  'OVNKubernetesControllerDisconnectedSouthboundDatabase',
  'OVNKubernetesNodePodAddError',
  'OVNKubernetesNodePodDeleteError',
  'OVNKubernetesResourceRetryFailure',
  'OVNKubernetesNodeOVSOverflowUserspace',
  'OVNKubernetesNodeOVSOverflowKernel',
  'NorthboundStale',
  'SouthboundStale',
  'OVNKubernetesNorthboundDatabaseCPUUsageHigh',
  'OVNKubernetesSouthboundDatabaseCPUUsageHigh',
  'OVNKubernetesNorthdInactive',
  'NoRunningOvnControlPlane',
  'NoOvnClusterManagerLeader',
  'V4SubnetAllocationThresholdExceeded',
  'V6SubnetAllocationThresholdExceeded'
];

export const OVN_PLATFORM_ALERT_NAME_SET = new Set<string>(OVN_PLATFORM_ALERT_NAMES);

export const isOvnPlatformAlertName = (name: string): boolean => OVN_PLATFORM_ALERT_NAME_SET.has(name);
