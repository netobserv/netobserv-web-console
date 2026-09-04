import { AlertStates, PrometheusResponse } from '@openshift-console/dynamic-plugin-sdk';
import { SilenceMatcher } from '../../api/alert';
import { getAlerts, getRecordingRules, getSilencedAlerts, queryPrometheusMetric } from '../../api/routes';
import { RecordingAnnotations } from '../../model/config';
import { isExcludedFromNetobservHealth } from './health-context';
import { buildStats, isSilenced, RecordingRuleMetric, rulesToHealthItems } from './health-helper';
import { injectAlertRuleIds } from './ovn-health-fetcher';

export const fetchNetworkHealth = (recordingAnnotations: RecordingAnnotations) => {
  // matching netobserv="true" catches all alerts designed for netobserv (not necessarily owned by it)
  const alertsP = getAlerts('netobserv="true"').then(res =>
    injectAlertRuleIds(res.data.groups).filter(rule => !isExcludedFromNetobservHealth(rule))
  );

  const silencedP = getSilencedAlerts('netobserv=true')
    .then(res => {
      return res.filter(a => a.status.state == 'active').map(a => a.matchers);
    })
    .catch(err => {
      console.log('Could not get silenced alerts:', err);
      // Showing all alerts since we could not get silenced alerts list
      return [] as SilenceMatcher[][];
    });

  // Fetch recording rules and their current values
  const recordingP = getRecordingRules('netobserv="true"').then(res => {
    const recordingRules = res.data.groups.flatMap(group => group.rules);
    const hasAnnotation = (name: string) => recordingAnnotations && name in recordingAnnotations;

    // Include rules that have template label (built-in) OR have recording annotations (third-party)
    const queries = recordingRules
      .filter(rule => !!rule.labels?.template || hasAnnotation(rule.name))
      .map(rule => {
        return queryPrometheusMetric(rule.name)
          .then((metricRes: PrometheusResponse): RecordingRuleMetric | undefined => {
            // Store the raw metric results with the rule metadata
            if (metricRes.data && metricRes.data.result) {
              return {
                name: rule.name,
                values: metricRes.data.result
                  .filter(item => item.value && item.value.length > 1)
                  .map(item => ({
                    labels: item.metric,
                    value: parseFloat(item.value![1])
                  }))
              };
            }
            return undefined;
          })
          .catch(() => {
            return undefined;
          });
      });

    return Promise.all(queries).then(metrics => {
      return metrics.filter((m?: RecordingRuleMetric): m is RecordingRuleMetric => !!m);
    });
  });

  return Promise.all([alertsP, silencedP, recordingP]).then(([rawRules, silenced, recording]) => {
    const alertRules = rawRules.map(r => {
      const alerts = r.alerts.map(a => {
        let state = a.state;
        const labels = { ...r.labels, ...a.labels };
        if (silenced.some(s => isSilenced(s, labels))) {
          state = 'silenced' as AlertStates;
        }
        return { ...a, state: state };
      });
      return { ...r, alerts: alerts };
    });
    const healthItems = rulesToHealthItems(alertRules, recordingAnnotations || {}, recording);
    return {
      stats: buildStats(healthItems),
      alertRules: alertRules
    };
  });
};
