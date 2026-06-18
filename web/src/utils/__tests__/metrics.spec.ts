import { TFunction } from 'i18next';
import { GenericMetric, MetricStats, RawTopologyMetrics, TopologyMetricPeer, TopologyMetrics } from '../../api/query-response';
import { ScopeDefSample } from '../../components/__tests-data__/scopes';
import { NodeData } from '../../model/topology';
import { ContextSingleton } from '../context';
import {
  calibrateRange,
  computeStats,
  createPeer,
  getFormattedValue,
  matchPeer,
  mergeTlsIntoTopologyMetrics,
  mergeTlsVersionUsageMetrics,
  normalizeMetrics,
  parseGenericMetrics,
  parseTopologyMetrics
} from '../metrics';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const t = (k: string) => k as any;

describe('normalize and computeStats', () => {
  beforeEach(() => {
    ContextSingleton.setScopes(ScopeDefSample);
  });

  it('should normalize and compute simple stats', () => {
    const values: [number, unknown][] = [
      [1664372000, '5'],
      [1664372015, '5'],
      [1664372030, '5'],
      [1664372045, '5'],
      [1664372060, '5'],
      [1664372075, '5'],
      [1664372090, '5'],
      [1664372105, '10'],
      [1664372120, '10'],
      [1664372135, '10'],
      [1664372150, '10'],
      [1664372165, '10'],
      [1664372180, '10'],
      [1664372195, '10'],
      [1664372210, '8'],
      [1664372225, '8'],
      [1664372240, '8'],
      [1664372255, '8'],
      [1664372270, '8'],
      [1664372285, '8'],
      [1664372300, '8']
    ];

    const { start, end, step } = calibrateRange([values], { from: 1664372000, to: 1664372300 }, 1664372300, true);
    const norm = normalizeMetrics(values, start, end, step, true);
    expect(norm).toEqual([
      [1664372000, 5],
      [1664372015, 5],
      [1664372030, 5],
      [1664372045, 5],
      [1664372060, 5],
      [1664372075, 5],
      [1664372090, 5],
      [1664372105, 10],
      [1664372120, 10],
      [1664372135, 10],
      [1664372150, 10],
      [1664372165, 10],
      [1664372180, 10],
      [1664372195, 10],
      [1664372210, 8],
      [1664372225, 8],
      [1664372240, 8],
      [1664372255, 8],
      [1664372270, 8],
      [1664372285, 8],
      [1664372300, 8]
    ]);

    const stats = computeStats(norm);

    expect(stats.latest).toEqual(8);
    expect(stats.min).toEqual(5);
    expect(stats.max).toEqual(10);
    expect(stats.avg).toEqual(7.67 /* 161/21 */);
    expect(stats.total).toEqual(2300 /* 7.67*300 */);
  });

  it('should normalize and compute stats with missing close to "now"', () => {
    // Building data so that there is a missing datapoint at +300s, which is close to "now"
    // This missing datapoint should be ignored for tolerance, rather than counted as a zero
    const now = Math.floor(new Date().getTime() / 1000);
    const first = now - 330;
    const values: [number, unknown][] = [
      [first, '5'],
      [first + 15, '5'],
      [first + 30, '5'],
      [first + 45, '5'],
      [first + 60, '5'],
      [first + 75, '5'],
      [first + 90, '5'],
      [first + 105, '10'],
      [first + 120, '10'],
      [first + 135, '10'],
      [first + 150, '10'],
      [first + 165, '10'],
      [first + 180, '10'],
      [first + 195, '10'],
      [first + 210, '8'],
      [first + 225, '8'],
      [first + 240, '8'],
      [first + 255, '8'],
      [first + 270, '8'],
      [first + 285, '8']
    ];

    const { start, end, step } = calibrateRange([values], 300, now, true);
    const norm = normalizeMetrics(values, start, end, step, true);
    expect(norm).toEqual([
      [first, 5],
      [first + 15, 5],
      [first + 30, 5],
      [first + 45, 5],
      [first + 60, 5],
      [first + 75, 5],
      [first + 90, 5],
      [first + 105, 10],
      [first + 120, 10],
      [first + 135, 10],
      [first + 150, 10],
      [first + 165, 10],
      [first + 180, 10],
      [first + 195, 10],
      [first + 210, 8],
      [first + 225, 8],
      [first + 240, 8],
      [first + 255, 8],
      [first + 270, 8],
      [first + 285, 8]
    ]);

    const stats = computeStats(norm);

    expect(stats.latest).toEqual(8);
    expect(stats.min).toEqual(5);
    expect(stats.max).toEqual(10);
    expect(stats.avg).toEqual(7.65 /* 153/20 */);
    expect(stats.total).toEqual(2180 /* 7.65*285 */);
  });

  it('should normalize and compute stats with missing data points', () => {
    // No data between 1664372105 and 1664372195
    const values: [number, unknown][] = [
      [1664372000, '5'],
      [1664372015, '5'],
      [1664372030, '5'],
      [1664372045, '5'],
      [1664372060, '5'],
      [1664372075, '5'],
      [1664372090, '5'],
      [1664372210, '8'],
      [1664372225, '8'],
      [1664372240, '8'],
      [1664372255, '8'],
      [1664372270, '8'],
      [1664372285, '8'],
      [1664372300, '8']
    ];

    const { start, end, step } = calibrateRange([values], { from: 1664372000, to: 1664372300 }, 1664372300, true);
    const norm = normalizeMetrics(values, start, end, step, true);
    expect(norm).toEqual([
      [1664372000, 5],
      [1664372015, 5],
      [1664372030, 5],
      [1664372045, 5],
      [1664372060, 5],
      [1664372075, 5],
      [1664372090, 5],
      [1664372105, 0],
      [1664372120, 0],
      [1664372135, 0],
      [1664372150, 0],
      [1664372165, 0],
      [1664372180, 0],
      [1664372195, 0],
      [1664372210, 8],
      [1664372225, 8],
      [1664372240, 8],
      [1664372255, 8],
      [1664372270, 8],
      [1664372285, 8],
      [1664372300, 8]
    ]);

    const stats = computeStats(norm);

    expect(stats.latest).toEqual(8);
    expect(stats.min).toEqual(0);
    expect(stats.max).toEqual(8);
    expect(stats.avg).toEqual(4.33 /* 91/21 */);
    expect(stats.total).toEqual(1300 /* 4.33*300 */);
  });
});

describe('matchBidirectional', () => {
  beforeEach(() => {
    ContextSingleton.setScopes(ScopeDefSample);
  });

  it('should match namespace nodes', () => {
    const peers: TopologyMetricPeer[] = [createPeer({ namespace: '' }), createPeer({ namespace: 'test' })];

    // With unknown
    const data: NodeData = {
      nodeType: 'unknown',
      peer: createPeer({})
    };

    let matches = peers.filter(p => matchPeer(data, p));
    expect(matches).toEqual([peers[0]]);

    // With test namespace
    data.nodeType = 'namespace';
    data.peer = createPeer({ namespace: 'test' });

    matches = peers.filter(p => matchPeer(data, p));
    expect(matches).toEqual([peers[1]]);

    // With another namespace
    data.peer = createPeer({ namespace: 'test2' });

    matches = peers.filter(p => matchPeer(data, p));
    expect(matches).toEqual([]);
  });

  it('should match owner nodes', () => {
    const peers: TopologyMetricPeer[] = [
      createPeer({ namespace: '' }),
      createPeer({
        namespace: 'ns1',
        owner: { name: 'depl-a', type: 'Deployment' }
      }),
      createPeer({
        namespace: 'ns1',
        owner: { name: 'depl-b', type: 'Deployment' }
      }),
      createPeer({
        namespace: 'ns1',
        owner: { name: 'depl-a', type: 'DaemonSet' }
      }),
      createPeer({
        namespace: 'ns2',
        owner: { name: 'depl-a', type: 'Deployment' }
      })
    ];

    // With unknown
    const data: NodeData = {
      nodeType: 'unknown',
      peer: createPeer({})
    };

    let matches = peers.filter(p => matchPeer(data, p));
    expect(matches).toEqual([peers[0]]);

    // With depl-a deployment
    data.nodeType = 'owner';
    data.peer = createPeer({ owner: { type: 'Deployment', name: 'depl-a' }, namespace: 'ns1' });

    matches = peers.filter(p => matchPeer(data, p));
    expect(matches).toEqual([peers[1]]);
  });

  it('should match resource nodes', () => {
    const peers: TopologyMetricPeer[] = [
      createPeer({ namespace: '' }),
      createPeer({
        namespace: 'ns1',
        owner: { name: 'depl-a', type: 'Deployment' },
        resource: { name: 'depl-a-12345', type: 'Pod' },
        addr: '1.2.3.4'
      }),
      createPeer({
        namespace: 'ns1',
        owner: { name: 'depl-b', type: 'Deployment' },
        resource: { name: 'depl-b-67890', type: 'Pod' },
        addr: '1.2.3.5'
      }),
      createPeer({
        namespace: 'ns1',
        resource: { name: 'svc-a', type: 'Service' },
        addr: '1.2.3.6'
      }),
      createPeer({
        namespace: 'ns2',
        owner: { name: 'depl-a', type: 'Deployment' },
        resource: { name: 'depl-a-12345', type: 'Pod' },
        addr: '1.2.3.7'
      })
    ];

    // With unknown
    const data: NodeData = {
      nodeType: 'unknown',
      peer: createPeer({})
    };

    let matches = peers.filter(p => matchPeer(data, p));
    expect(matches).toEqual([peers[0]]);

    // With depl-a-12345 pod
    data.nodeType = 'resource';
    data.peer = createPeer({
      resource: { name: 'depl-a-12345', type: 'Pod' },
      owner: { name: 'depl-a', type: 'Deployment' },
      namespace: 'ns1',
      addr: '1.2.3.4'
    });

    matches = peers.filter(p => matchPeer(data, p));
    expect(matches).toEqual([peers[1]]);
  });

  it('should match group', () => {
    const peers: TopologyMetricPeer[] = [
      createPeer({ namespace: '' }),
      createPeer({
        namespace: 'ns1',
        host: 'host1',
        owner: { name: 'depl-a', type: 'Deployment' },
        resource: { name: 'depl-a-12345', type: 'Pod' },
        addr: '1.2.3.4'
      }),
      createPeer({
        namespace: 'ns1',
        host: 'host2',
        owner: { name: 'depl-b', type: 'Deployment' },
        resource: { name: 'depl-b-6789', type: 'Pod' },
        addr: '1.2.3.5'
      }),
      createPeer({
        namespace: 'ns1',
        resource: { name: 'Service', type: 'scv-a' },
        addr: '1.2.3.6'
      }),
      createPeer({
        namespace: 'ns2',
        host: 'host1',
        owner: { name: 'depl-a', type: 'Deployment' },
        resource: { name: 'depl-a-12345', type: 'Pod' },
        addr: '1.2.3.7'
      })
    ];

    // With namespace group
    const data: NodeData = {
      nodeType: 'namespace',
      peer: createPeer({ namespace: 'ns1' })
    };

    let matches = peers.filter(p => matchPeer(data, p));
    expect(matches).toEqual([peers[1], peers[2], peers[3]]);

    // With node group
    data.nodeType = 'host';
    data.peer = createPeer({ host: 'host1' });

    matches = peers.filter(p => matchPeer(data, p));
    expect(matches).toEqual([peers[1], peers[4]]);

    // With node+namespace
    data.peer = createPeer({ namespace: 'ns2', host: 'host1' });

    matches = peers.filter(p => matchPeer(data, p));
    expect(matches).toEqual([peers[4]]);
  });
});

describe('parseTopologyMetrics', () => {
  it('should disambiguate same names', () => {
    const metrics: RawTopologyMetrics[] = [
      {
        metric: {
          SrcK8S_Name: 'A',
          SrcK8S_Namespace: 'ns1',
          SrcK8S_Type: 'Pod',
          DstK8S_Name: 'B',
          DstK8S_Namespace: 'ns1',
          DstK8S_Type: 'Pod'
        },
        values: []
      },
      {
        metric: {
          SrcK8S_Name: 'A',
          SrcK8S_Namespace: 'ns1',
          SrcK8S_Type: 'Pod',
          DstK8S_Name: 'B',
          DstK8S_Namespace: 'ns1',
          DstK8S_Type: 'Service'
        },
        values: []
      }
    ];

    const parsed = parseTopologyMetrics(metrics, 300, 'resource', 0, true) as TopologyMetrics[];

    expect(parsed).toHaveLength(2);
    expect(parsed[0].source.getDisplayName(true, true)).toEqual('ns1.A');
    expect(parsed[0].destination.getDisplayName(true, true)).toEqual('ns1.B (pod)');
    expect(parsed[1].source.getDisplayName(true, true)).toEqual('ns1.A');
    expect(parsed[1].destination.getDisplayName(true, true)).toEqual('ns1.B (svc)');
  });
});

describe('parseGenericMetrics', () => {
  it('should attach TLSVersion and TLSGroup from matrix labels', () => {
    const metrics: RawTopologyMetrics[] = [
      {
        metric: {
          SrcK8S_Name: 'A',
          SrcK8S_Type: 'Pod',
          DstK8S_Name: 'B',
          DstK8S_Type: 'Pod',
          TLSVersion: 'TLS 1.3',
          TLSGroup: 'X25519MLKEM768'
        },
        values: [[1, 1]]
      }
    ];
    const parsed = parseGenericMetrics(metrics, 300, 'SrcK8S_Name', 0, true);
    expect(parsed[0].name).toBe('A');
    expect(parsed[0].tls?.versions).toEqual(['TLS 1.3']);
    expect(parsed[0].tls?.groups).toEqual(['X25519MLKEM768']);
  });

  it('should not attach TLSTypes (omitted from topology TLS aggregation)', () => {
    const metrics: RawTopologyMetrics[] = [
      {
        metric: {
          SrcK8S_Name: 'A',
          SrcK8S_Type: 'Pod',
          DstK8S_Name: 'B',
          DstK8S_Type: 'Pod',
          TLSTypes: ['ClientHello'],
          TLSVersion: 'TLS 1.3'
        },
        values: [[1, 1]]
      }
    ];
    const parsed = parseGenericMetrics(metrics, 300, 'SrcK8S_Name', 0, true);
    expect(parsed[0].tls?.versions).toEqual(['TLS 1.3']);
    expect(parsed[0].tls).not.toHaveProperty('types');
  });
});

describe('mergeTlsIntoTopologyMetrics', () => {
  const statStub: MetricStats = { sum: 1, latest: 1, avg: 1, min: 1, max: 1, percentiles: [0, 0], total: 0 };

  const edgeVolume = (): TopologyMetrics => ({
    source: createPeer({ owner: { name: 'curl-client', type: 'Deployment' }, namespace: 'tls-tests' }),
    destination: createPeer({ owner: { name: 'dns-default', type: 'Service' }, namespace: 'openshift-dns' }),
    values: [],
    stats: statStub,
    scope: 'owner'
  });

  it('merges TLS versions from multiple tls rows for the same edge', () => {
    const vol = [edgeVolume()];
    const tlsRows: TopologyMetrics[] = [
      { ...edgeVolume(), tls: { versions: ['TLS 1.2'] } },
      { ...edgeVolume(), tls: { versions: ['TLS 1.3'] } }
    ];
    const out = mergeTlsIntoTopologyMetrics(vol, tlsRows);
    expect(out[0].tls?.versions).toEqual(expect.arrayContaining(['TLS 1.2', 'TLS 1.3']));
    expect(out[0].tls?.versions).toHaveLength(2);
  });

  it('leaves volume rows unchanged when no tls row matches the edge', () => {
    const vol = [edgeVolume()];
    const tlsRows: TopologyMetrics[] = [
      {
        ...edgeVolume(),
        source: createPeer({ owner: { name: 'other', type: 'Deployment' }, namespace: 'tls-tests' }),
        tls: { versions: ['TLS 1.2'] }
      }
    ];
    const out = mergeTlsIntoTopologyMetrics(vol, tlsRows);
    expect(out[0].tls).toBeUndefined();
  });
});

describe('mergeTlsVersionUsageMetrics', () => {
  it('merges duplicate version rows by summing aligned datapoints', () => {
    const valuesA: [number, number][] = [
      [100, 1],
      [200, 2]
    ];
    const valuesB: [number, number][] = [
      [100, 10],
      [200, 20]
    ];
    const a: GenericMetric = {
      name: 'TLS 1.3',
      values: valuesA,
      stats: computeStats(valuesA),
      aggregateBy: 'TLSVersion'
    };
    const b: GenericMetric = {
      name: 'TLS 1.3',
      values: valuesB,
      stats: computeStats(valuesB),
      aggregateBy: 'TLSVersion'
    };
    const merged = mergeTlsVersionUsageMetrics([a, b]);
    expect(merged).toHaveLength(1);
    expect(merged[0].metric.name).toBe('TLS 1.3');
    expect(merged[0].metric.values).toEqual([
      [100, 11],
      [200, 22]
    ]);
  });

  it('keeps distinct TLSVersion label strings as separate buckets', () => {
    const valuesA: [number, number][] = [[1, 5]];
    const valuesB: [number, number][] = [[1, 5]];
    const merged = mergeTlsVersionUsageMetrics([
      { name: 'TLS 1.3', values: valuesA, stats: computeStats(valuesA), aggregateBy: 'TLSVersion' },
      { name: '0x0304', values: valuesB, stats: computeStats(valuesB), aggregateBy: 'TLSVersion' }
    ]);
    expect(merged).toHaveLength(2);
    const names = merged.map(m => m.metric.name).sort();
    expect(names).toEqual(['0x0304', 'TLS 1.3']);
  });

  it('keeps non-standard hex TLSVersion labels', () => {
    const values: [number, number][] = [[1, 9]];
    const merged = mergeTlsVersionUsageMetrics([
      { name: '0xFAFA', values, stats: computeStats(values), aggregateBy: 'TLSVersion' }
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].metric.name).toBe('0xFAFA');
    expect(merged[0].filterValue).toBe('0xFAFA');
  });

  it('merges when the first duplicate row has empty values', () => {
    const emptyValues: [number, number][] = [];
    const datapoints: [number, number][] = [
      [100, 3],
      [200, 7]
    ];
    const merged = mergeTlsVersionUsageMetrics([
      {
        name: 'TLS 1.3',
        values: emptyValues,
        stats: computeStats(emptyValues),
        aggregateBy: 'TLSVersion'
      },
      {
        name: 'TLS 1.3',
        values: datapoints,
        stats: computeStats(datapoints),
        aggregateBy: 'TLSVersion'
      }
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].metric.values).toEqual(datapoints);
    expect(merged[0].filterValue).toBe('TLS 1.3');
  });
});

describe('getFormattedValue', () => {
  it('should format BPS', () => {
    expect(getFormattedValue(500, 'Bytes', 'rate', t as TFunction)).toBe('500 Bps');
    expect(getFormattedValue(1300, 'Bytes', 'rate', t as TFunction)).toBe('1.3 kBps');
    expect(getFormattedValue(10500, 'Bytes', 'rate', t as TFunction)).toBe('10.5 kBps');
    expect(getFormattedValue(1500000, 'Bytes', 'rate', t as TFunction)).toBe('1.5 MBps');
  });

  it('should format absolute bytes', () => {
    expect(getFormattedValue(500, 'Bytes', 'sum', t as TFunction)).toBe('500 B');
    expect(getFormattedValue(10500, 'Bytes', 'sum', t as TFunction)).toBe('10.5 kB');
  });

  it('should format packets rate', () => {
    expect(getFormattedValue(500, 'Packets', 'rate', t as TFunction)).toBe('500 Pps');
    expect(getFormattedValue(1300, 'Packets', 'rate', t as TFunction)).toBe('1.3 kPps');
    expect(getFormattedValue(10500, 'Packets', 'rate', t as TFunction)).toBe('10.5 kPps');
    expect(getFormattedValue(1500000, 'Packets', 'rate', t as TFunction)).toBe('1.5 MPps');
  });

  it('should format absolute packets', () => {
    expect(getFormattedValue(500, 'Packets', 'sum', t as TFunction)).toBe('500 P');
    expect(getFormattedValue(10500, 'Packets', 'sum', t as TFunction)).toBe('10.5 kP');
  });

  it('should format DNS latency in milliseconds', () => {
    expect(getFormattedValue(50, 'DnsLatencyMs', 'avg', t as TFunction)).toBe('50ms');
    expect(getFormattedValue(500, 'DnsLatencyMs', 'avg', t as TFunction)).toBe('500ms');
    expect(getFormattedValue(900, 'DnsLatencyMs', 'avg', t as TFunction)).toBe('900ms');
  });

  it('should format DNS latency 1-60s with decimal precision', () => {
    expect(getFormattedValue(1000, 'DnsLatencyMs', 'avg', t as TFunction)).toBe('1s');
    expect(getFormattedValue(1500, 'DnsLatencyMs', 'max', t as TFunction)).toBe('1.5s');
    expect(getFormattedValue(2000, 'DnsLatencyMs', 'p90', t as TFunction)).toBe('2s');
    expect(getFormattedValue(2345, 'DnsLatencyMs', 'p90', t as TFunction)).toBe('2.35s');
    expect(getFormattedValue(45230, 'DnsLatencyMs', 'avg', t as TFunction)).toBe('45.23s');
  });

  it('should format DNS latency above 60s without decimal precision', () => {
    expect(getFormattedValue(180000, 'DnsLatencyMs', 'avg', t as TFunction)).toBe('3m');
    expect(getFormattedValue(200000, 'DnsLatencyMs', 'max', t as TFunction)).toBe('3m 20s');
  });

  it('should format RTT latency correctly', () => {
    expect(getFormattedValue(50, 'TimeFlowRttNs', 'avg', t as TFunction)).toBe('50ms');
    expect(getFormattedValue(1000, 'TimeFlowRttNs', 'avg', t as TFunction)).toBe('1s');
    expect(getFormattedValue(1500, 'TimeFlowRttNs', 'max', t as TFunction)).toBe('1.5s');
    expect(getFormattedValue(2500, 'TimeFlowRttNs', 'max', t as TFunction)).toBe('2.5s');
  });
});
