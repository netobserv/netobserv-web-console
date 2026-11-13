import { EdgeModel, NodeModel, NodeShape } from '@patternfly/react-topology';
import { TFunction } from 'i18next';
import { MetricStats, TopologyMetrics } from '../../api/query-response';
import { ScopeDefSample } from '../../components/__tests-data__/scopes';
import { buildStats } from '../../components/health/health-helper';
import { ContextSingleton } from '../../utils/context';
import { createPeer } from '../../utils/metrics';
import { getGroupName, getGroupsForScope, getStepInto, resolveGroupTypes } from '../scope';
import { AGGREGATE_EDGE_TYPE, DefaultOptions, generateDataModel, maybeAggregateEdges } from '../topology';

const t = ((s: string) => s) as TFunction;

describe('Check enabled groups', () => {
  beforeEach(() => {
    ContextSingleton.setScopes(ScopeDefSample);
  });

  it('should get group from scope', () => {
    let groups = getGroupsForScope('cluster', ScopeDefSample);
    expect(groups).toEqual(['none', 'auto']);

    groups = getGroupsForScope('host', ScopeDefSample);
    expect(groups).toEqual(['none', 'auto', 'clusters', 'zones', 'clusters+zones']);

    groups = getGroupsForScope('owner', ScopeDefSample);
    expect(groups).toEqual([
      'none',
      'auto',
      'clusters',
      'clusters+zones',
      'clusters+hosts',
      'clusters+namespaces',
      'zones',
      'zones+hosts',
      'zones+namespaces',
      'hosts',
      'hosts+namespaces',
      'namespaces'
    ]);
  });

  it('should resolve auto group', () => {
    let group = resolveGroupTypes('auto', 'resource', ScopeDefSample);
    expect(group).toEqual('namespaces+owners');

    group = resolveGroupTypes('auto', 'owner', ScopeDefSample);
    expect(group).toEqual('namespaces');

    group = resolveGroupTypes('auto', 'namespace', ScopeDefSample);
    expect(group).toEqual('none');

    group = resolveGroupTypes('auto', 'host', ScopeDefSample);
    expect(group).toEqual('none');

    group = resolveGroupTypes('hosts', 'resource', ScopeDefSample);
    expect(group).toEqual('hosts');
  });

  it('should get group name', () => {
    let name = getGroupName('hosts', ScopeDefSample, (s: string) => s);
    expect(name).toEqual('Node');

    name = getGroupName('zones+hosts', ScopeDefSample, (s: string) => s);
    expect(name).toEqual('Zone + Node');

    name = getGroupName('namespaces', ScopeDefSample, (s: string) => s);
    expect(name).toEqual('Namespace');

    name = getGroupName('zzz', ScopeDefSample, (s: string) => s);
    expect(name).toEqual('invalid zzz');

    name = getGroupName('namespaces+zzz', ScopeDefSample, (s: string) => s);
    expect(name).toEqual('Namespace + invalid zzz');
  });

  it('should get next scope', () => {
    let next = getStepInto('cluster', ['cluster', 'zone', 'host', 'namespace', 'owner', 'resource']);
    expect(next).toEqual('zone');

    next = getStepInto('cluster', ['cluster', 'host']);
    expect(next).toEqual('host');

    next = getStepInto('cluster', ['cluster']);
    expect(next).toEqual(undefined);

    next = getStepInto('resource', ['cluster', 'zone', 'host', 'namespace', 'owner', 'resource']);
    expect(next).toEqual(undefined);
  });
});

describe('maybeAggregateEdges', () => {
  const leaf = (id: string): NodeModel => ({
    id,
    type: 'node',
    width: 40,
    height: 40,
    shape: NodeShape.ellipse
  });

  const group = (id: string, children: string[]): NodeModel => ({
    id,
    type: 'group',
    group: true,
    children,
    style: { padding: 10 }
  });

  const edge = (source: string, target: string, bps: number): EdgeModel => ({
    id: `${source}.${target}`,
    type: 'edge',
    source,
    target,
    data: { sourceId: source, targetId: target, bps, drops: 0 }
  });

  const baseNodes = (): NodeModel[] => [
    leaf('a1'),
    leaf('a2'),
    leaf('b1'),
    group('ns-a', ['a1', 'a2']),
    group('ns-b', ['b1'])
  ];

  const baseEdges = (): EdgeModel[] => [edge('a1', 'b1', 100), edge('a2', 'b1', 50)];

  it('defaults to grouping edges (groupEdges true)', () => {
    const result = maybeAggregateEdges(
      baseNodes(),
      baseEdges(),
      { ...DefaultOptions, groupTypes: 'namespaces' },
      '',
      t
    );
    const bridges = result.filter(e => e.type === AGGREGATE_EDGE_TYPE && e.data?.role === 'bridge');
    expect(bridges).toHaveLength(1);
    expect(bridges[0].data.bps).toBe(150);
    expect(bridges[0].data.aggregatedEdgeIds).toEqual(expect.arrayContaining(['a1.b1', 'a2.b1']));
    // Hidden leaves are dropped after metrics are copied onto aggregates.
    expect(result.every(e => e.visible !== false)).toBe(true);
    expect(result.filter(e => e.type === 'edge')).toHaveLength(0);
    expect(result.filter(e => e.type === AGGREGATE_EDGE_TYPE && e.data?.role === 'exit')).toHaveLength(2);
    expect(result.filter(e => e.type === AGGREGATE_EDGE_TYPE && e.data?.role === 'bridge')).toHaveLength(1);
    expect(result.filter(e => e.type === AGGREGATE_EDGE_TYPE && e.data?.role === 'entry')).toHaveLength(1);
  });

  it('bridges at outermost differing groups when nested', () => {
    const nestedNodes: NodeModel[] = [
      leaf('p1'),
      leaf('p2'),
      group('owner-a', ['p1']),
      group('owner-b', ['p2']),
      group('ns-a', ['owner-a']),
      group('ns-b', ['owner-b'])
    ];
    const nestedEdges: EdgeModel[] = [edge('p1', 'p2', 10)];
    const result = maybeAggregateEdges(
      nestedNodes,
      nestedEdges,
      { ...DefaultOptions, groupTypes: 'namespaces+owners' },
      '',
      t
    );
    const bridges = result.filter(e => e.type === AGGREGATE_EDGE_TYPE && e.data?.role === 'bridge');
    expect(bridges).toHaveLength(1);
    // Cross-namespace: bridge between namespaces, not owners.
    expect([bridges[0].source, bridges[0].target].sort()).toEqual(['ns-a', 'ns-b']);
    // Exit steps through each nested hull: pod → owner → namespace.
    const exits = result.filter(e => e.data?.role === 'exit');
    expect(exits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'p1', target: 'owner-a' }),
        expect.objectContaining({ source: 'owner-a', target: 'ns-a' })
      ])
    );
    expect(exits).toHaveLength(2);
    const entries = result.filter(e => e.data?.role === 'entry');
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'ns-b', target: 'owner-b' }),
        expect.objectContaining({ source: 'owner-b', target: 'p2' })
      ])
    );
    expect(entries).toHaveLength(2);
  });

  it('bridges at inner groups when they share an outer group', () => {
    const nestedNodes: NodeModel[] = [
      leaf('p1'),
      leaf('p2'),
      group('owner-a', ['p1']),
      group('owner-b', ['p2']),
      group('ns-a', ['owner-a', 'owner-b'])
    ];
    const nestedEdges: EdgeModel[] = [edge('p1', 'p2', 10)];
    const result = maybeAggregateEdges(
      nestedNodes,
      nestedEdges,
      { ...DefaultOptions, groupTypes: 'namespaces+owners' },
      '',
      t
    );
    const bridges = result.filter(e => e.type === AGGREGATE_EDGE_TYPE && e.data?.role === 'bridge');
    expect(bridges).toHaveLength(1);
    expect([bridges[0].source, bridges[0].target].sort()).toEqual(['owner-a', 'owner-b']);
  });

  it('skips aggregation when groupEdges is false', () => {
    const input = baseEdges();
    const expected = input.map(e => ({ ...e, data: { ...e.data } }));
    const result = maybeAggregateEdges(
      baseNodes(),
      input,
      { ...DefaultOptions, groupTypes: 'namespaces', groupEdges: false },
      '',
      t
    );
    expect(result).toBe(input);
    expect(result).toEqual(expected);
    expect(result.every(e => e.type === 'edge')).toBe(true);
  });

  it('skips aggregation when groupTypes is none', () => {
    const input = baseEdges();
    const expected = input.map(e => ({ ...e, data: { ...e.data } }));
    const result = maybeAggregateEdges(baseNodes(), input, { ...DefaultOptions, groupTypes: 'none' }, '', t);
    expect(result).toBe(input);
    expect(result).toEqual(expected);
  });

  it('carries bidirectional leaf values onto aggregate bridge tags', () => {
    const input = [edge('a1', 'b1', 15)];
    input[0].data.forwardBps = 10;
    input[0].data.reverseBps = 5;

    const result = maybeAggregateEdges(
      baseNodes(),
      input,
      { ...DefaultOptions, groupTypes: 'namespaces', metricFunction: 'sum', metricType: 'Bytes' },
      '',
      t
    );

    const bridge = result.find(e => e.type === AGGREGATE_EDGE_TYPE && e.data?.role === 'bridge');
    expect(bridge?.data.bps).toBe(15);
    expect(bridge?.data.forwardBps).toBe(10);
    expect(bridge?.data.reverseBps).toBe(5);
    expect(bridge?.data.tag).toBe('10B 5B');
    expect(bridge?.data.forwardTag).toBeUndefined();
    expect(bridge?.data.reverseTag).toBeUndefined();
  });

  it('swaps directional leaf values when aggregating opposite bridge orientation', () => {
    const input = [edge('a1', 'b1', 15), edge('b1', 'a2', 10)];
    input[0].data.forwardBps = 10;
    input[0].data.reverseBps = 5;
    input[1].data.forwardBps = 7;
    input[1].data.reverseBps = 3;

    const result = maybeAggregateEdges(
      baseNodes(),
      input,
      { ...DefaultOptions, groupTypes: 'namespaces', metricFunction: 'sum', metricType: 'Bytes' },
      '',
      t
    );

    const bridge = result.find(e => e.type === AGGREGATE_EDGE_TYPE && e.data?.role === 'bridge');
    expect(bridge?.data.bps).toBe(25);
    expect(bridge?.data.forwardBps).toBe(13);
    expect(bridge?.data.reverseBps).toBe(12);
    expect(bridge?.data.tag).toBe('13B 12B');
    expect(bridge?.data.forwardTag).toBeUndefined();
    expect(bridge?.data.reverseTag).toBeUndefined();
  });
});

describe('generateDataModel edge tags', () => {
  const stats = (value: number): MetricStats => ({
    sum: value,
    latest: value,
    avg: value,
    min: value,
    max: value,
    percentiles: [value, value],
    total: value
  });

  const metric = (source: string, destination: string, value: number): TopologyMetrics => ({
    source: createPeer({ host: source }),
    destination: createPeer({ host: destination }),
    values: [],
    stats: stats(value),
    scope: 'host'
  });

  const generate = (metrics: TopologyMetrics[]) =>
    generateDataModel(
      metrics,
      [],
      { ...DefaultOptions, groupTypes: 'none', metricFunction: 'sum', metricType: 'Bytes' },
      'host',
      ScopeDefSample,
      '',
      '',
      { match: 'all', list: [] },
      t,
      [],
      {},
      [],
      false,
      buildStats([])
    );

  beforeEach(() => {
    ContextSingleton.setScopes(ScopeDefSample);
  });

  it('shows direction for one-way edge tags', () => {
    const model = generate([metric('node-a', 'node-b', 10)]);
    const edges = model.edges || [];
    expect(edges).toHaveLength(1);
    expect(edges[0].data.bps).toBe(10);
    expect(edges[0].data.forwardBps).toBe(10);
    expect(edges[0].data.reverseBps).toBe(0);
    expect(edges[0].data.tag).toBe('10B');
    expect(edges[0].data.forwardTag).toBeUndefined();
    expect(edges[0].data.reverseTag).toBeUndefined();
  });

  it('shows directional tags for bidirectional edges', () => {
    const model = generate([metric('node-a', 'node-b', 13600), metric('node-b', 'node-a', 5300)]);
    const edges = model.edges || [];
    expect(edges).toHaveLength(1);
    expect(edges[0].data.bps).toBe(18900);
    expect(edges[0].data.forwardBps).toBe(13600);
    expect(edges[0].data.reverseBps).toBe(5300);
    expect(edges[0].data.tag).toBe('13.6kB 5.3kB');
    expect(edges[0].data.forwardTag).toBeUndefined();
    expect(edges[0].data.reverseTag).toBeUndefined();
  });
});
