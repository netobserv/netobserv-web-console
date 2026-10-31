import { TFunction } from 'i18next';
import { MetricStats, TopologyMetricPeer, TopologyMetrics } from '../../api/query-response';
import { ScopeDefSample } from '../../components/__tests-data__/scopes';
import { NodeData } from '../../model/topology';
import { ContextSingleton } from '../context';
import {
  computeStats,
  createPeer,
  getFormattedValue,
  hydratePeer,
  hydrateTopologyMetrics,
  matchPeer,
  mergeTlsIntoTopologyMetrics
} from '../metrics';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const t = (k: string) => k as any;

describe('computeStats', () => {
  it('computes avg/min/max/total from numeric series', () => {
    const norm: [number, number][] = [
      [1664372000, 5],
      [1664372105, 10],
      [1664372210, 8],
      [1664372300, 8]
    ];
    const stats = computeStats(norm);
    expect(stats.latest).toEqual(8);
    expect(stats.min).toEqual(5);
    expect(stats.max).toEqual(10);
    expect(stats.avg).toEqual(7.75);
    expect(stats.total).toEqual(2325 /* 7.75*300 */);
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

describe('hydrateTopologyMetrics', () => {
  beforeEach(() => {
    ContextSingleton.setScopes(ScopeDefSample);
  });

  it('should attach getDisplayName for resource peers from JSON', () => {
    const hydrated = hydrateTopologyMetrics([
      {
        source: {
          id: 'r=Pod.A',
          resource: { name: 'A', type: 'Pod' },
          resourceKind: 'Pod',
          isAmbiguous: false,
          namespace: 'ns1',
          getDisplayName: () => undefined
        },
        destination: {
          id: 'namespace=default',
          resourceKind: 'Namespace',
          isAmbiguous: false,
          namespace: 'default',
          getDisplayName: () => undefined
        },
        values: [[1, 2]],
        stats: { sum: 2, latest: 2, avg: 2, min: 2, max: 2, percentiles: [2, 2], total: 0 },
        scope: 'resource'
      }
    ]);
    expect(hydratePeer(hydrated[0].source).getDisplayName(true, false)).toEqual('ns1.A');
    expect(hydrated[0].destination.getDisplayName(false, false)).toEqual('default');
  });

  it('should disambiguate display names when isAmbiguous is set by backend', () => {
    const peer = hydratePeer({
      id: 'r=Service.B',
      resource: { name: 'B', type: 'Service' },
      resourceKind: 'Service',
      isAmbiguous: true,
      namespace: 'ns1'
    });
    expect(peer.getDisplayName(true, true)).toEqual('ns1.B (svc)');
    expect(peer.getDisplayName(true, false)).toEqual('ns1.B');
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
