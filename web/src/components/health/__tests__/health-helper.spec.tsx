import { PrometheusLabels } from '@openshift-console/dynamic-plugin-sdk';
import {
  AlertState,
  buildStats,
  computeHealthItemScore,
  computeResourceScore,
  HealthItem,
  HealthStat,
  isSilenced,
  Severity
} from '../health-helper';

const mockAlert = (
  name: string,
  severity: string,
  state: string,
  threshold: number,
  value: number,
  labels?: PrometheusLabels
): HealthItem => {
  const item: HealthItem = {
    ruleName: name,
    labels: { alertname: name, severity: severity, ...labels },
    severity: severity as Severity,
    state: state as AlertState,
    ruleID: '',
    description: '',
    summary: '',
    threshold: '',
    thresholdF: threshold,
    upperBound: '',
    metadata: {
      alertThresholdF: threshold,
      alertThreshold: '',
      upperBoundF: 100,
      upperBound: '',
      unit: '%',
      links: []
    },
    value: value
  };
  if (labels?.namespace) {
    item.metadata.namespaceLabels = ['namespace'];
  }
  if (labels?.node) {
    item.metadata.nodeLabels = ['node'];
  }
  if (labels?.workload) {
    item.metadata.workloadLabels = ['workload'];
  }
  if (labels?.kind) {
    item.metadata.kindLabels = ['kind'];
  }
  return item;
};

describe('health helpers, score', () => {
  it('should compute unweighted alert min score', () => {
    const alert = mockAlert('test', 'critical', 'firing', 10, 10);
    const score = computeHealthItemScore(alert);
    expect(score.rawScore).toBeCloseTo(6.0, 2);
    expect(score.weight).toEqual(1);
  });

  it('should compute unweighted alert max score', () => {
    const alert = mockAlert('test', 'critical', 'firing', 10, 100);
    const score = computeHealthItemScore(alert);
    expect(score.rawScore).toEqual(0);
    expect(score.weight).toEqual(1);
  });

  it('should compute weighted alert score', () => {
    const alert = mockAlert('test', 'info', 'pending', 10, 10);
    const score = computeHealthItemScore(alert);
    expect(score.rawScore).toBeCloseTo(10.0, 2);
    expect(score.weight).toEqual(0.075);
  });

  it('should compute unweighted alert score with upper bound', () => {
    const alert = mockAlert('test', 'critical', 'firing', 100, 500);
    alert.metadata!.upperBoundF = 1000;
    const score = computeHealthItemScore(alert);
    expect(score.rawScore).toBeCloseTo(3.33, 2);
  });

  it('should compute unweighted alert score with clamping', () => {
    // below threshold
    const alert = mockAlert('test', 'critical', 'firing', 100, 1);
    alert.metadata!.upperBoundF = 1000;
    let score = computeHealthItemScore(alert);
    expect(score.rawScore).toEqual(6);

    // above upper bound
    alert.value = 5000;
    score = computeHealthItemScore(alert);
    expect(score.rawScore).toEqual(0);
  });

  it('should compute full score', () => {
    // Start with an empty one => max score
    const r: HealthStat = {
      name: 'test',
      critical: { firing: [], pending: [], silenced: [], inactive: [], recording: [] },
      warning: { firing: [], pending: [], silenced: [], inactive: [], recording: [] },
      other: { firing: [], pending: [], silenced: [], inactive: [], recording: [] },
      score: 0
    };
    expect(computeResourceScore(r)).toEqual(10);

    // Add 3 inactive alerts => still max score
    r.critical.inactive.push('test-critical');
    r.warning.inactive.push('test-warning');
    r.other.inactive.push('test-info');
    expect(computeResourceScore(r)).toEqual(10);

    // Turn the inactive info into pending => slightly decreasing score
    r.other.inactive = [];
    r.other.pending = [mockAlert('test-info', 'info', 'pending', 10, 20)];
    expect(computeResourceScore(r)).toBeCloseTo(9.98, 2);

    // Turn the inactive warning into firing => more decreasing score
    r.warning.inactive = [];
    r.warning.firing = [mockAlert('test-warning', 'warning', 'firing', 10, 40)];
    expect(computeResourceScore(r)).toBeCloseTo(8.92, 2);

    // Turn the inactive critical into firing => more decrease
    r.critical.inactive = [];
    r.critical.firing = [mockAlert('test-critical', 'critical', 'firing', 10, 40)];
    expect(computeResourceScore(r)).toBeCloseTo(5.11, 2);
  });
});

describe('health helpers, grouping', () => {
  it('should group', () => {
    const a1 = mockAlert('test1', 'info', 'pending', 15, 10, { namespace: 'a' });
    const a2 = mockAlert('test2', 'warning', 'firing', 20, 30, { namespace: 'a' });
    const b = mockAlert('test2', 'warning', 'firing', 20, 30, { namespace: 'b' });
    const w = mockAlert('test3', 'warning', 'firing', 20, 30, { namespace: 'a', workload: 'w', kind: 'k' });
    const g = mockAlert('test4', 'warning', 'firing', 20, 30, {});

    const s = buildStats([a1, a2, b, w, g]);
    expect(s.global.score).toBeCloseTo(7.5, 2);
    expect(s.global.warning.firing.length).toEqual(1);
    expect(s.byNamespace.length).toEqual(2);
    expect(s.byNamespace[0].name).toEqual('b');
    expect(s.byNamespace[0].score).toBeCloseTo(7.5, 2);
    expect(s.byNamespace[0].warning.firing.length).toEqual(1);
    expect(s.byNamespace[1].name).toEqual('a');
    expect(s.byNamespace[1].score).toBeCloseTo(7.8, 1);
    expect(s.byNamespace[1].other.pending.length).toEqual(1);
    expect(s.byNamespace[1].warning.firing.length).toEqual(1);
    expect(s.byNode).toEqual([]);
    expect(s.byOwner.length).toEqual(1);
    expect(s.byOwner[0].name).toEqual('w');
    expect(s.byOwner[0].score).toBeCloseTo(7.5, 2);
    expect(s.byOwner[0].warning.firing.length).toEqual(1);
  });
});

describe('isSilenced', () => {
  it('matches positive equality matchers', () => {
    expect(isSilenced([{ name: 'alertname', value: 'Foo' }], { alertname: 'Foo' })).toBe(true);
    expect(isSilenced([{ name: 'alertname', value: 'Foo' }], { alertname: 'Bar' })).toBe(false);
  });

  it('honors negative and regex matchers', () => {
    expect(isSilenced([{ name: 'severity', value: 'info', isEqual: false }], { severity: 'warning' })).toBe(true);
    expect(isSilenced([{ name: 'alertname', value: 'Foo.*', isRegex: true }], { alertname: 'FooBar' })).toBe(true);
    expect(isSilenced([{ name: 'alertname', value: 'Foo.*', isRegex: true }], { alertname: 'Bar' })).toBe(false);
  });
});
