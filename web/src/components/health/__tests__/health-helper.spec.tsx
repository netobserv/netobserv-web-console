import { PrometheusLabels } from '@openshift-console/dynamic-plugin-sdk';
import {
  AlertState,
  apportionToOneDecimal,
  buildStats,
  collectAvailableNamespaces,
  computeHealthItemScore,
  computeResourceScore,
  HealthItem,
  HealthStat,
  NamedItem,
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
    expect(computeResourceScore(r).score).toEqual(10);

    // Add 3 inactive alerts => still max score (inactive rules are excluded from the score, so with
    // nothing active the resource stays at a perfect 10)
    r.critical.inactive.push('test-critical');
    r.warning.inactive.push('test-warning');
    r.other.inactive.push('test-info');
    expect(computeResourceScore(r).score).toEqual(10);

    // Turn the inactive info into pending => score reflects ONLY the active (pending info) rule; the two
    // remaining inactive rules no longer prop the score up toward 10.
    r.other.inactive = [];
    r.other.pending = [mockAlert('test-info', 'info', 'pending', 10, 20)];
    expect(computeResourceScore(r).score).toBeCloseTo(9.56, 2);

    // Turn the inactive warning into firing => averaged over the two active rules (still ignoring the
    // inactive critical), so the firing warning drags the score down further.
    r.warning.inactive = [];
    r.warning.firing = [mockAlert('test-warning', 'warning', 'firing', 10, 40)];
    expect(computeResourceScore(r).score).toBeCloseTo(7.04, 2);

    // Turn the inactive critical into firing => more decrease
    r.critical.inactive = [];
    r.critical.firing = [mockAlert('test-critical', 'critical', 'firing', 10, 40)];
    expect(computeResourceScore(r).score).toBeCloseTo(5.11, 2);
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

  it('should filter out items via the optional predicate before aggregating', () => {
    const a1 = mockAlert('test1', 'info', 'pending', 15, 10, { namespace: 'a' });
    const a2 = mockAlert('test2', 'warning', 'firing', 20, 30, { namespace: 'a' });
    const b = mockAlert('test2', 'warning', 'firing', 20, 30, { namespace: 'b' });

    const onlyCritical = (item: NamedItem) => item.severity === 'critical';
    const s = buildStats([a1, a2, b], onlyCritical);
    // Nothing is critical => every resource is dropped entirely (not just emptied)
    expect(s.byNamespace).toEqual([]);
    expect(s.global.score).toEqual(10);

    // For Namespace-superkind items, the resolved namespace value is exposed as `name` (see toNamedItem).
    const onlyNamespaceA = (item: NamedItem) => item.name === 'a';
    const filtered = buildStats([a1, a2, b], onlyNamespaceA);
    expect(filtered.byNamespace.length).toEqual(1);
    expect(filtered.byNamespace[0].name).toEqual('a');
  });

  it('should round impacts so they still add up exactly to the rounded total', () => {
    // Values whose naive per-item rounding drifts from the rounded total.
    const values = [0.25, 0.25, 0.25, 0.25, 1.5];
    const rounded = apportionToOneDecimal(values);
    // Each result is a clean multiple of 0.1
    rounded.forEach(v => expect(Math.round(v * 10)).toBeCloseTo(v * 10, 10));
    // Manual sum of the displayed values reconciles with the rounded total.
    const displayedSum = rounded.reduce((s, v) => s + v, 0);
    const rawTotal = values.reduce((s, v) => s + v, 0);
    expect(Math.round(displayedSum * 10) / 10).toEqual(Math.round(rawTotal * 10) / 10);
  });

  it('should preserve the rounded total for a realistic score breakdown', () => {
    const items = [
      mockAlert('a', 'critical', 'firing', 10, 20),
      mockAlert('b', 'warning', 'firing', 10, 12),
      mockAlert('c', 'info', 'pending', 10, 11)
    ];
    const breakdown = computeResourceScore(buildStats(items).global);
    const totalWeight = breakdown.details.reduce((sum, d) => sum + d.weight, 0);
    const pointsLost = breakdown.details.map(d => ((10 - d.rawScore) * d.weight) / totalWeight);
    const displayed = apportionToOneDecimal(pointsLost);
    const displayedSum = displayed.reduce((s, v) => s + v, 0);
    // Displayed per-rule impacts sum to the same 1-decimal value as (10 - score).
    expect(Math.round(displayedSum * 10) / 10).toEqual(Math.round((10 - breakdown.score) * 10) / 10);
  });

  it('should collect distinct namespace values from the unfiltered dataset', () => {
    const a1 = mockAlert('test1', 'info', 'pending', 15, 10, { namespace: 'a' });
    const a2 = mockAlert('test2', 'warning', 'firing', 20, 30, { namespace: 'a' });
    const b = mockAlert('test3', 'warning', 'firing', 20, 30, { namespace: 'b' });
    const w = mockAlert('test4', 'warning', 'firing', 20, 30, { namespace: 'c', workload: 'w', kind: 'k' });
    const g = mockAlert('test5', 'warning', 'firing', 20, 30, {});

    expect(collectAvailableNamespaces([a1, a2, b, w, g])).toEqual(['a', 'b', 'c']);
  });
});
