import { Rule } from '@openshift-console/dynamic-plugin-sdk';
import * as _ from 'lodash';
import { murmur3 } from 'murmurhash-js';
import { AlertsResult } from '../../api/alert';
import { isOvnPlatformAlertName } from './ovn-platform-alerts';

/**
 * Temporary OVN platform alert discovery shim.
 *
 * OVN-Kubernetes alerts (both the OpenShift CNO downstream set and the upstream ovn-kubernetes helm
 * set) are emitted without the netobserv_io_network_health annotation, so they cannot flow through the
 * generic annotation-based routing (see health-context.ts). Until they ship that annotation, discovery
 * is hard-coded here: match by allowlisted alert name (see ovn-platform-alerts.ts), which is reliable
 * because the two name sets are distinctive and non-overlapping. Group/file detection is only a
 * secondary hint for tab availability. Remove this shim once the annotation is available on OVN alerts.
 */
/** CNO OVN-Kubernetes alert group in Prometheus /api/v1/rules (PrometheusRule CR labels are not exposed on rules). */
const OVN_RULES_GROUP_NAME = 'cluster-network-operator-ovn.rules';

/** Best-effort OVN group detection (downstream group name or any ovn-kubernetes file path). */
export const isOvnPlatformRulesGroup = (group: AlertsResult['data']['groups'][number]): boolean =>
  group.name === OVN_RULES_GROUP_NAME || (group.file?.includes('ovn-kubernetes') ?? false);

export const injectAlertRuleIds = (groups: AlertsResult['data']['groups']): Rule[] => {
  return groups.flatMap(group => {
    group.rules.forEach(r => {
      const key = [group.file, group.name, r.name, r.duration, r.query, ..._.map(r.labels, (k, v) => `${k}=${v}`)].join(
        ','
      );
      // murmurhash-js coerces invalid seeds (e.g. OpenShift's 'monitoring-salt') to 0.
      r.id = String(murmur3(key, 0));
    });
    return group.rules;
  });
};

/**
 * Discover OVN platform rules by allowlisted alert name (downstream + upstream), across all groups.
 * Name-based matching lets us catch the upstream set, whose PrometheusRule group (general.rules) is too
 * generic to key on. The names are distinctive enough that cross-source collisions are not a concern.
 */
export const discoverOvnPlatformRules = (groups: AlertsResult['data']['groups']): Rule[] =>
  injectAlertRuleIds(groups).filter(r => isOvnPlatformAlertName(r.name));

export const isOvnPlatformTabAvailable = (groups: AlertsResult['data']['groups'], platformRules: Rule[]): boolean => {
  if (platformRules.length > 0) {
    return true;
  }
  return groups.some(isOvnPlatformRulesGroup);
};
