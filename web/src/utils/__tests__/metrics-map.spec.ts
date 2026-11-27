import { Field } from '../../api/ipfix';
import { TopologyMetrics } from '../../api/query-response';
import { ScopeDefSample } from '../../components/__tests-data__/scopes';
import { ContextSingleton } from '../context';
import { genericMetricsFromTopology, hydrateTopologyMetrics } from '../metrics';

describe('hydrateTopologyMetrics', () => {
  beforeEach(() => {
    ContextSingleton.setScopes(ScopeDefSample);
  });

  it('attaches getDisplayName to backend-enriched peers', () => {
    const result: TopologyMetrics[] = [
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
        values: [[1000, 5]],
        stats: { sum: 5, latest: 5, avg: 5, min: 5, max: 5, percentiles: [5, 5], total: 0 },
        scope: 'resource'
      }
    ];

    const mapped = hydrateTopologyMetrics(result);
    expect(mapped).toHaveLength(1);
    expect(mapped[0].source.getDisplayName(true, false)).toEqual('ns1.A');
    expect(mapped[0].destination.getDisplayName(false, false)).toEqual('default');
    expect(mapped[0].stats.avg).toEqual(5);
  });
});

describe('genericMetricsFromTopology', () => {
  beforeEach(() => {
    ContextSingleton.setScopes(ScopeDefSample);
  });

  it('flattens topology rows for generic callers', () => {
    const topo = hydrateTopologyMetrics([
      {
        source: {
          id: '-',
          isAmbiguous: false,
          getDisplayName: () => undefined
        },
        destination: {
          id: '-',
          isAmbiguous: false,
          getDisplayName: () => undefined
        },
        values: [[1000, 3]],
        stats: { sum: 3, latest: 3, avg: 3, min: 3, max: 3, percentiles: [3, 3], total: 0 },
        scope: 'app'
      }
    ]);
    const mapped = genericMetricsFromTopology(topo, 'app' as Field);
    expect(mapped).toHaveLength(1);
    expect(mapped[0].aggregateBy).toEqual('app');
    expect(mapped[0].name).toEqual('');
    expect(mapped[0].stats.avg).toEqual(3);
    expect(mapped[0].values).toEqual([[1000, 3]]);
  });
});
