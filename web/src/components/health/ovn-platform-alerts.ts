/**
 * OVN-Kubernetes platform alert names used by the temporary discovery shim (see ovn-health-fetcher.ts).
 *
 * Two distinct, non-overlapping sets are supported so the OVN tab works on both flavors:
 * - Downstream (OpenShift CNO), source: openshift/cluster-network-operator bindata/network/ovn-kubernetes/
 *     common/alert-rules.yaml + self-hosted/alert-rules-control-plane.yaml
 *     (PrometheusRule group cluster-network-operator-ovn.rules).
 * - Upstream (vanilla ovn-kubernetes helm chart), source:
 *     ovn-kubernetes/ovn-kubernetes helm/ovn-kubernetes/templates/ovnkube-alerts.yaml
 *     (PrometheusRule group general.rules, namespace ovn-kubernetes).
 */
export const OVN_DOWNSTREAM_PLATFORM_ALERT_NAMES: readonly string[] = [
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

export const OVN_UPSTREAM_PLATFORM_ALERT_NAMES: readonly string[] = [
  'OvnKubeNoRunningManager',
  'OvnKubeManagerMultipleLeaders',
  'OvnKubeManagerNoLeader',
  'OvnKubePodRestarts',
  'K8sNodeWithoutOvnKubeAgentRunning',
  'OvnKubeHighPodCreationLatency99thPercentile',
  'OvnKubeIncreaseInPodCreationLatency99thPercentile',
  'OvnKubeHighNBCliLatency99thPercentile',
  'OvnKubeHighSBCliLatency99thPercentile',
  'OvnKubeHighK8sNetworkPolicyUpdateLatency99thPercentile',
  'OvnKubeHighK8sNamespaceUpdateLatency99thPercentile',
  'OvnKubeHighK8sServiceUpdateLatency99thPercentile',
  'OvnKubeHighK8sEndpointUpdateLatency99thPercentile',
  'OvnNBDBStale',
  'OvnSBDBStale',
  'OvnNBDBContainerRestarts',
  'OvnSBDBContainerRestarts',
  'OvnNorthdContainerRestarts',
  'OvnNorthdNotActive',
  'OvnNorthdTxnError',
  'OvnNorthdTxnIncomplete',
  'OvnControllerContainerRestarts',
  'OvnControllerTxnError',
  'OvnControllerTxnIncomplete',
  'OvnControllerLflowRun',
  'OvnControllerLowerGenevePortCount',
  'OVNKubeAllocatedV4SubnetsDoNotMatch',
  'OVNKubeAllocatedV6SubnetsDoNotMatch'
];

/** Union of downstream (OpenShift CNO) and upstream (vanilla ovn-kubernetes) platform alert names. */
export const OVN_PLATFORM_ALERT_NAMES: readonly string[] = [
  ...OVN_DOWNSTREAM_PLATFORM_ALERT_NAMES,
  ...OVN_UPSTREAM_PLATFORM_ALERT_NAMES
];

export const OVN_PLATFORM_ALERT_NAME_SET = new Set<string>(OVN_PLATFORM_ALERT_NAMES);

export const isOvnPlatformAlertName = (name: string): boolean => OVN_PLATFORM_ALERT_NAME_SET.has(name);
