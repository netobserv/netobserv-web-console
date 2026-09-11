import { AlertStates, Rule } from '@openshift-console/dynamic-plugin-sdk';
import * as _ from 'lodash';
import { SilenceMatcher } from '../../api/alert';
import { getAlerts, getAllSilencedAlerts } from '../../api/routes';
import { RecordingAnnotations } from '../../model/config';
import {
  formatContextTabTitle,
  getRuleHealthContextId,
  isReadonlyAlertsContext,
  isValidHealthContextId,
  NETOBSERV_CONTEXT_NETOBSERV,
  NETOBSERV_CONTEXT_OVN,
  parseHealthContextAnnotation,
  sortContextTabIds
} from './health-context';
import { fetchNetworkHealth } from './health-fetcher';
import { HealthItem, isSilenced } from './health-helper';
import { discoverOvnPlatformRules, injectAlertRuleIds, isOvnPlatformTabAvailable } from './ovn-health-fetcher';
import { buildReadonlyStats, ReadonlyHealthStats } from './readonly-health-helper';

export type ReadonlyHealthContexts = Record<string, ReadonlyHealthStats>;

const createReadonlyContexts = (): ReadonlyHealthContexts => Object.create(null) as ReadonlyHealthContexts;

export type HealthContextsState = {
  netobserv: {
    healthItems: HealthItem[];
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

/** Rules routed to a read-only context tab via their netobserv_io_network_health annotation. */
const discoverAnnotationReadonlyRules = (groups: Parameters<typeof injectAlertRuleIds>[0]): Rule[] =>
  injectAlertRuleIds(groups).filter(r => isReadonlyAlertsContext(getRuleHealthContextId(r)));

/** First annotation-provided display name in the group, else a formatted context id. */
const resolveDisplayName = (contextId: string, rules: Rule[]): string =>
  rules.map(r => parseHealthContextAnnotation(r.annotations).displayName).find(Boolean) ??
  formatContextTabTitle(contextId);

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

    // Group all annotation-routed read-only rules by their target context tab.
    const rulesByContext = _.groupBy(discoverAnnotationReadonlyRules(groups), r => getRuleHealthContextId(r));

    // Temporary shim: merge legacy (un-annotated) CNO OVN rules into the OVN context.
    const legacyOvnRules = discoverOvnPlatformRules(groups).filter(
      r => !parseHealthContextAnnotation(r.annotations).contextTab
    );
    if (legacyOvnRules.length > 0) {
      rulesByContext[NETOBSERV_CONTEXT_OVN] = _.uniqBy(
        [...(rulesByContext[NETOBSERV_CONTEXT_OVN] ?? []), ...legacyOvnRules],
        r => r.id ?? r.name
      );
    }

    Object.entries(rulesByContext).forEach(([contextId, rules]) => {
      if (!isValidHealthContextId(contextId)) {
        return;
      }
      const alertRules = applySilences(rules, silenced);
      const available =
        contextId === NETOBSERV_CONTEXT_OVN ? isOvnPlatformTabAvailable(groups, alertRules) : alertRules.length > 0;
      const stats = buildReadonlyStats(alertRules, available, resolveDisplayName(contextId, alertRules));
      if (stats.available) {
        readonlyContexts[contextId] = stats;
      }
    });

    // The OVN tab can be available (CNO group present) even with zero discovered rules.
    if (!readonlyContexts[NETOBSERV_CONTEXT_OVN] && isOvnPlatformTabAvailable(groups, [])) {
      readonlyContexts[NETOBSERV_CONTEXT_OVN] = buildReadonlyStats(
        [],
        true,
        formatContextTabTitle(NETOBSERV_CONTEXT_OVN)
      );
    }

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
