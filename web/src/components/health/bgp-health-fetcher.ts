import { Rule } from '@openshift-console/dynamic-plugin-sdk';
import { AlertsResult, SilenceMatcher } from '../../api/alert';
import { getAlerts, getAllSilencedAlerts } from '../../api/routes';
import { isSilenced } from './health-helper';
import { isBgpPlatformAlertName, isBgpPlatformRulesGroup } from './bgp-platform-alerts';
import { buildBgpStats, BgpHealthStats } from './bgp-health-helper';
import { injectAlertRuleIds } from './ovn-health-fetcher';

const applySilences = (rawRules: Rule[], silenced: SilenceMatcher[][]): Rule[] =>
  rawRules.map(r => {
    const alerts = (r.alerts ?? []).map(a => {
      let state = a.state;
      const labels = { ...r.labels, ...a.labels };
      if (silenced.some(s => isSilenced(s, labels))) {
        state = 'silenced' as typeof state;
      }
      return { ...a, state };
    });
    return { ...r, alerts };
  });

export type BgpPlatformHealthResult = {
  stats: BgpHealthStats;
  alertRules: Rule[];
};

export const fetchBgpPlatformHealth = (): Promise<BgpPlatformHealthResult> => {
  const alertsP = getAlerts().then((res: AlertsResult) => {
    const bgpGroups = res.data.groups.filter(isBgpPlatformRulesGroup);
    return injectAlertRuleIds(bgpGroups).filter(r => isBgpPlatformAlertName(r.name));
  });

  const silencedP = getAllSilencedAlerts()
    .then(res => res.filter(a => a.status.state === 'active').map(a => a.matchers))
    .catch(err => {
      console.log('Could not get silenced alerts for BGP platform rules:', err);
      return [] as SilenceMatcher[][];
    });

  return Promise.all([alertsP, silencedP]).then(([platformRules, silenced]) => {
    const alertRules = applySilences(platformRules, silenced);
    return {
      stats: buildBgpStats(alertRules, platformRules.length > 0),
      alertRules
    };
  });
};
