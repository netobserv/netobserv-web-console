import { Rule } from '@openshift-console/dynamic-plugin-sdk';
import { buildStats, emptyStat, HealthStats } from '../health-helper';
import { buildOvnStats } from '../ovn-health-helper';
import { getContextTabActiveCount, getNetobservContextStats, getOvnContextStats } from '../tab-title';

const makeOvnRule = (name: string, state: 'firing' | 'pending' = 'firing'): Rule => ({
  id: `rule-${name}`,
  name,
  query: 'vector(1)',
  duration: 600,
  labels: { severity: 'critical' },
  annotations: { summary: `${name} summary` },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: state as any,
  type: 'alerting',
  alerts: [
    {
      labels: { severity: 'critical', alertname: name },
      annotations: { summary: `${name} summary` },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      state: state as any,
      value: 1,
      activeAt: '2026-08-12T10:00:00Z'
    }
  ]
});

describe('tab-title context helpers', () => {
  it('aggregates NetObserv stats from all views', () => {
    const health: HealthStats = buildStats([]);
    health.global.warning.firing.push({
      ruleName: 'test',
      metadata: { alertThresholdF: 0, upperBound: '', upperBoundF: 0, unit: '', links: [] },
      value: 1,
      severity: 'warning',
      state: 'firing',
      threshold: '',
      thresholdF: 0,
      upperBound: '',
      labels: {},
      summary: 's',
      description: 'd'
    });
    health.byNode.push(emptyStat('node-a', undefined, 'Node'));
    health.byNode[0].critical.pending.push({
      ruleName: 'node-alert',
      metadata: { alertThresholdF: 0, upperBound: '', upperBoundF: 0, unit: '', links: [] },
      value: 1,
      severity: 'critical',
      state: 'pending',
      threshold: '',
      thresholdF: 0,
      upperBound: '',
      labels: { node: 'node-a' },
      summary: 's',
      description: 'd'
    });

    const stats = getNetobservContextStats(health);
    expect(stats).toHaveLength(2);
    expect(getContextTabActiveCount(stats)).toBe(2);
  });

  it('aggregates OVN platform stats from global and nodes', () => {
    const ovn = buildOvnStats([makeOvnRule('NoRunningOvnControlPlane')], true);
    const stats = getOvnContextStats(ovn);
    expect(getContextTabActiveCount(stats)).toBe(1);
  });
});
