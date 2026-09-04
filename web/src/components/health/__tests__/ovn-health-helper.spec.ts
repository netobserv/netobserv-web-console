import { Rule } from '@openshift-console/dynamic-plugin-sdk';
import {
  buildOvnStats,
  countOvnActiveAlerts,
  getNodeNameFromLabels,
  getOvnSummaryCounts,
  getOvnTabStats
} from '../ovn-health-helper';
import { isOvnPlatformAlertName, OVN_PLATFORM_ALERT_NAMES } from '../ovn-platform-alerts';

const makeRule = (
  name: string,
  state: 'firing' | 'pending' | 'silenced',
  labels: Record<string, string> = {}
): Rule => ({
  id: `rule-${name}`,
  name,
  query: 'vector(1)',
  duration: 600,
  labels: { severity: 'warning' },
  annotations: { summary: `${name} summary` },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: state as any,
  type: 'alerting',
  alerts: [
    {
      labels: { severity: 'warning', alertname: name, ...labels },
      annotations: { summary: `${name} summary` },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      state: state as any,
      value: 1,
      activeAt: '2026-08-12T10:00:00Z'
    }
  ]
});

describe('ovn-platform-alerts', () => {
  it('contains expected CNO alert names', () => {
    expect(OVN_PLATFORM_ALERT_NAMES).toContain('OVNKubernetesNodePodAddError');
    expect(OVN_PLATFORM_ALERT_NAMES).toContain('NorthboundStale');
  });

  it('matches allowlisted names only', () => {
    expect(isOvnPlatformAlertName('OVNKubernetesNodePodAddError')).toBe(true);
    expect(isOvnPlatformAlertName('NetObservNoFlows')).toBe(false);
  });
});

describe('ovn-health-helper', () => {
  it('extracts node name from labels', () => {
    expect(getNodeNameFromLabels({ node: 'worker-1' })).toBe('worker-1');
    expect(getNodeNameFromLabels({ instance: '10.0.0.1:9090' })).toBe('10.0.0.1');
    expect(getNodeNameFromLabels({ instance: '[2001:db8::1]:9090' })).toBe('2001:db8::1');
    expect(getNodeNameFromLabels({})).toBeUndefined();
  });

  it('groups cluster-wide and per-node alerts', () => {
    const rules = [
      makeRule('NorthboundStale', 'firing'),
      makeRule('OVNKubernetesNodePodAddError', 'firing', { node: 'worker-a' }),
      makeRule('OVNKubernetesNodePodDeleteError', 'pending', { instance: 'worker-b:9090' })
    ];
    const stats = buildOvnStats(rules, true);
    expect(stats.available).toBe(true);
    expect(stats.global.critical.firing).toHaveLength(0);
    expect(stats.global.warning.firing).toHaveLength(1);
    expect(stats.byNode).toHaveLength(2);
    expect(stats.byNode.find(s => s.name === 'worker-b')).toBeDefined();
    expect(countOvnActiveAlerts(stats)).toBe(3);
    expect(getOvnTabStats(stats)).toHaveLength(3);
  });

  it('merges node and instance identities for the same host', () => {
    const rules = [
      makeRule('OVNKubernetesNodePodAddError', 'firing', { node: 'worker-a' }),
      makeRule('OVNKubernetesNodePodDeleteError', 'pending', { instance: 'worker-a:9095' })
    ];
    const stats = buildOvnStats(rules, true);
    expect(stats.byNode).toHaveLength(1);
    expect(stats.byNode[0].name).toBe('worker-a');
    expect(countOvnActiveAlerts(stats)).toBe(2);
  });

  it('marks unavailable when no allowlisted rules are present', () => {
    const stats = buildOvnStats([], false);
    expect(stats.available).toBe(false);
    expect(countOvnActiveAlerts(stats)).toBe(0);
  });

  it('summarizes OVN alerts by severity and state', () => {
    const rules = [
      makeRule('NoRunningOvnControlPlane', 'firing'),
      makeRule('NorthboundStale', 'firing'),
      makeRule('OVNKubernetesNodePodDeleteError', 'silenced', { instance: 'worker-b:9090' }),
      makeRule('NodeWithoutOVNKubeNodePodRunning', 'pending', { node: 'worker-a' })
    ];
    rules[0].alerts[0].labels.severity = 'critical';
    const stats = buildOvnStats(rules, true);
    const counts = getOvnSummaryCounts(stats);
    expect(counts.critical.firing).toBe(1);
    expect(counts.warning.firing).toBe(1);
    expect(counts.warning.pending).toBe(1);
    expect(counts.warning.silenced).toBe(1);
  });
});
