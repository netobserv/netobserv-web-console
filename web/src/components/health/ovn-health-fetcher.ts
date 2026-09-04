import { AlertStates, Rule } from '@openshift-console/dynamic-plugin-sdk';
import * as _ from 'lodash';
import { murmur3 } from 'murmurhash-js';
import { AlertsResult, SilenceMatcher } from '../../api/alert';
import { getAlerts, getAllSilencedAlerts } from '../../api/routes';
import { hasOvnHealthContextLabel } from './health-context';
import { isSilenced } from './health-helper';
import { buildOvnStats, OvnHealthStats } from './ovn-health-helper';
import { isOvnPlatformAlertName } from './ovn-platform-alerts';

/**
 * Platform alert discovery:
 * 1. Legacy (current OCP): CNO OVN rule group + allowlisted alert names.
 * 2. Labeled (CNO follow-up): netobserv="true" + netobserv_io_health_context="ovn".
 *    New platform alerts can appear without updating the console allowlist.
 */
/** CNO OVN-Kubernetes alert group in Prometheus /api/v1/rules (PrometheusRule CR labels are not exposed on rules). */
const OVN_RULES_GROUP_NAME = 'cluster-network-operator-ovn.rules';

export const isOvnPlatformRulesGroup = (group: AlertsResult['data']['groups'][number]): boolean =>
  group.name === OVN_RULES_GROUP_NAME || (group.file?.includes('openshift-ovn-kubernetes') ?? false);

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

const discoverLegacyOvnPlatformRules = (groups: AlertsResult['data']['groups']): Rule[] => {
  const ovnGroups = groups.filter(isOvnPlatformRulesGroup);
  return injectAlertRuleIds(ovnGroups).filter(r => isOvnPlatformAlertName(r.name));
};

const discoverLabeledOvnPlatformRules = (groups: AlertsResult['data']['groups']): Rule[] => {
  return injectAlertRuleIds(groups).filter(r => r.labels?.netobserv === 'true' && hasOvnHealthContextLabel(r));
};

/** Union of legacy group/allowlist discovery and future label-based discovery. */
export const discoverOvnPlatformRules = (groups: AlertsResult['data']['groups']): Rule[] => {
  return _.uniqBy(
    [...discoverLabeledOvnPlatformRules(groups), ...discoverLegacyOvnPlatformRules(groups)],
    r => r.id ?? r.name
  );
};

export const isOvnPlatformTabAvailable = (groups: AlertsResult['data']['groups'], platformRules: Rule[]): boolean => {
  if (platformRules.length > 0) {
    return true;
  }
  return groups.some(isOvnPlatformRulesGroup);
};

const applySilences = (rawRules: Rule[], silenced: SilenceMatcher[][]): Rule[] =>
  rawRules.map(r => {
    const alerts = (r.alerts ?? []).map(a => {
      let state = a.state;
      const labels = { ...r.labels, ...a.labels };
      if (silenced.some(s => isSilenced(s, labels))) {
        state = 'silenced' as AlertStates;
      }
      return { ...a, state };
    });
    return { ...r, alerts };
  });

export type OvnPlatformHealthResult = {
  stats: OvnHealthStats;
  alertRules: Rule[];
};

export const fetchOvnPlatformHealth = (): Promise<OvnPlatformHealthResult> => {
  const alertsP = getAlerts().then(res => {
    const platformRules = discoverOvnPlatformRules(res.data.groups);
    return { groups: res.data.groups, platformRules };
  });

  const silencedP = getAllSilencedAlerts()
    .then(res => res.filter(a => a.status.state === 'active').map(a => a.matchers))
    .catch(err => {
      console.log('Could not get silenced alerts for OVN platform rules:', err);
      return [] as SilenceMatcher[][];
    });

  return Promise.all([alertsP, silencedP]).then(([{ groups, platformRules }, silenced]) => {
    const alertRules = applySilences(platformRules, silenced);
    return {
      stats: buildOvnStats(alertRules, isOvnPlatformTabAvailable(groups, platformRules)),
      alertRules
    };
  });
};
