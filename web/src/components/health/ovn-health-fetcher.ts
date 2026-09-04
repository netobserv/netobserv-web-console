import { AlertStates, Rule } from '@openshift-console/dynamic-plugin-sdk';
import * as _ from 'lodash';
import { murmur3 } from 'murmurhash-js';
import { AlertsResult, SilenceMatcher } from '../../api/alert';
import { getAlerts, getAllSilencedAlerts } from '../../api/routes';
import { isSilenced } from './health-helper';
import { buildOvnStats, OvnHealthStats } from './ovn-health-helper';
import { isOvnPlatformAlertName } from './ovn-platform-alerts';

/** CNO OVN-Kubernetes alert group in Prometheus /api/v1/rules (label on PrometheusRule CR is not exposed on rules). */
const OVN_RULES_GROUP_NAME = 'cluster-network-operator-ovn.rules';

export const isOvnPlatformRulesGroup = (group: AlertsResult['data']['groups'][number]): boolean =>
  group.name === OVN_RULES_GROUP_NAME || (group.file?.includes('openshift-ovn-kubernetes') ?? false);

export const injectAlertRuleIds = (groups: AlertsResult['data']['groups']): Rule[] => {
  return groups.flatMap(group => {
    group.rules.forEach(r => {
      const key = [group.file, group.name, r.name, r.duration, r.query, ..._.map(r.labels, (k, v) => `${k}=${v}`)].join(
        ','
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      r.id = String(murmur3(key, 'monitoring-salt' as any));
    });
    return group.rules;
  });
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
    const ovnGroups = res.data.groups.filter(isOvnPlatformRulesGroup);
    return injectAlertRuleIds(ovnGroups).filter(r => isOvnPlatformAlertName(r.name));
  });

  const silencedP = getAllSilencedAlerts()
    .then(res => res.filter(a => a.status.state === 'active').map(a => a.matchers))
    .catch(err => {
      console.log('Could not get silenced alerts for OVN platform rules:', err);
      return [] as SilenceMatcher[][];
    });

  return Promise.all([alertsP, silencedP]).then(([platformRules, silenced]) => {
    const alertRules = applySilences(platformRules, silenced);
    return {
      stats: buildOvnStats(alertRules, platformRules.length > 0),
      alertRules
    };
  });
};
