import { AlertStates, Rule } from '@openshift-console/dynamic-plugin-sdk';
import * as _ from 'lodash';
import { SilenceMatcher } from '../../api/alert';
import { getAlerts, getAllSilencedAlerts } from '../../api/routes';
import { RecordingAnnotations } from '../../model/config';
import {
  getRuleHealthContextId,
  isReadonlyAlertsContext,
  isValidHealthContextId,
  NETOBSERV_CONTEXT_NETOBSERV,
  NETOBSERV_CONTEXT_OVN,
  sortContextTabIds
} from './health-context';
import { fetchNetworkHealth } from './health-fetcher';
import { HealthStats, isSilenced } from './health-helper';
import { discoverOvnPlatformRules, injectAlertRuleIds, isOvnPlatformTabAvailable } from './ovn-health-fetcher';
import { buildOvnStats, OvnHealthStats } from './ovn-health-helper';

export type ReadonlyHealthContexts = Record<string, OvnHealthStats>;

const createReadonlyContexts = (): ReadonlyHealthContexts => Object.create(null) as ReadonlyHealthContexts;

export type HealthContextsState = {
  netobserv: {
    stats: HealthStats;
    alertRules: Rule[];
  };
  readonlyContexts: ReadonlyHealthContexts;
  availableContextIds: string[];
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

const discoverThirdPartyReadonlyRules = (groups: Parameters<typeof injectAlertRuleIds>[0]): Rule[] => {
  const ovnRuleKeys = new Set(discoverOvnPlatformRules(groups).map(r => r.id ?? r.name));
  return injectAlertRuleIds(groups).filter(r => {
    const contextId = getRuleHealthContextId(r);
    if (!isReadonlyAlertsContext(contextId) || contextId === NETOBSERV_CONTEXT_OVN) {
      return false;
    }
    return !ovnRuleKeys.has(r.id ?? r.name);
  });
};

export const fetchHealthContexts = (recordingAnnotations: RecordingAnnotations): Promise<HealthContextsState> => {
  const netobservP = fetchNetworkHealth(recordingAnnotations);
  const allAlertsP = getAlerts();
  const silencedP = getAllSilencedAlerts()
    .then(res => res.filter(a => a.status.state === 'active').map(a => a.matchers))
    .catch(err => {
      console.log('Could not get silenced alerts for health contexts:', err);
      return [] as SilenceMatcher[][];
    });

  return Promise.all([netobservP, allAlertsP, silencedP]).then(([netobserv, allAlerts, silenced]) => {
    const groups = allAlerts.data.groups;
    const readonlyContexts = createReadonlyContexts();

    const ovnRules = applySilences(discoverOvnPlatformRules(groups), silenced);
    const ovnStats = buildOvnStats(ovnRules, isOvnPlatformTabAvailable(groups, ovnRules));
    if (ovnStats.available) {
      readonlyContexts[NETOBSERV_CONTEXT_OVN] = ovnStats;
    }

    const thirdPartyRules = applySilences(discoverThirdPartyReadonlyRules(groups), silenced);
    const thirdPartyByContext = _.groupBy(thirdPartyRules, r => getRuleHealthContextId(r));
    Object.entries(thirdPartyByContext).forEach(([contextId, rules]) => {
      if (!isValidHealthContextId(contextId)) {
        return;
      }
      readonlyContexts[contextId] = buildOvnStats(rules, rules.length > 0);
    });

    const availableContextIds = sortContextTabIds([
      NETOBSERV_CONTEXT_NETOBSERV,
      ...Object.entries(readonlyContexts)
        .filter(([, stats]) => stats.available)
        .map(([contextId]) => contextId)
    ]);

    return {
      netobserv,
      readonlyContexts,
      availableContextIds
    };
  });
};
