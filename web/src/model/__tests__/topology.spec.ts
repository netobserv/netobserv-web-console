import { EdgeModel, NodeModel, NodeShape } from '@patternfly/react-topology';
import { TFunction } from 'i18next';
import { ScopeDefSample } from '../../components/__tests-data__/scopes';
import { ContextSingleton } from '../../utils/context';
import { getGroupName, getGroupsForScope, getStepInto, resolveGroupTypes } from '../scope';
import { AGGREGATE_EDGE_TYPE, DefaultOptions, maybeAggregateEdges } from '../topology';

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

  const nodes: NodeModel[] = [leaf('a1'), leaf('a2'), leaf('b1'), group('ns-a', ['a1', 'a2']), group('ns-b', ['b1'])];

  const edges: EdgeModel[] = [edge('a1', 'b1', 100), edge('a2', 'b1', 50)];

  it('defaults to grouping edges (groupEdges true)', () => {
    const result = maybeAggregateEdges(nodes, edges, { ...DefaultOptions, groupTypes: 'namespaces' }, '', t);
    const bridges = result.filter(e => e.type === AGGREGATE_EDGE_TYPE && e.data?.role === 'bridge');
    expect(bridges).toHaveLength(1);
    expect(bridges[0].data.bps).toBe(150);
    expect(bridges[0].data.aggregatedEdgeIds).toEqual(expect.arrayContaining(['a1.b1', 'a2.b1']));
    // Hidden leaves are dropped after metrics are copied onto aggregates.
    expect(result.every(e => e.visible !== false)).toBe(true);
    expect(result.filter(e => e.type === 'edge')).toHaveLength(0);
    expect(result.filter(e => e.type === AGGREGATE_EDGE_TYPE).length).toBeGreaterThanOrEqual(3);
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
    const result = maybeAggregateEdges(
      nodes,
      edges,
      { ...DefaultOptions, groupTypes: 'namespaces', groupEdges: false },
      '',
      t
    );
    expect(result).toEqual(edges);
    expect(result.every(e => e.type === 'edge')).toBe(true);
  });

  it('skips aggregation when groupTypes is none', () => {
    const result = maybeAggregateEdges(nodes, edges, { ...DefaultOptions, groupTypes: 'none' }, '', t);
    expect(result).toEqual(edges);
  });
});
