import { FlowMetricsResult, RawTopologyMetrics } from '../../api/query-response';
import { getFlowMetrics, getFlowRecords } from '../../api/routes';
import { FilterDefinitionSample } from '../../components/__tests-data__/filters';
import { ScopeDefSample } from '../../components/__tests-data__/scopes';
import { Filter, FilterCompare, FilterId, Filters, FilterValue } from '../../model/filters';
import { getFetchFunctions, mergeMetricsBNF } from '../back-and-forth';
import { ContextSingleton } from '../context';
import { findFilter } from '../filter-definitions';
import { parseTopologyMetrics } from '../metrics';

jest.mock('../../api/routes', () => ({
  getFlowRecords: jest.fn(() => Promise.resolve({ records: [] })),
  getFlowMetrics: jest.fn(() => Promise.resolve({ metrics: [] }))
}));
const getFlowRecordsMock = getFlowRecords as jest.Mock;
const getFlowMetricsMock = getFlowMetrics as jest.Mock;

const filter = (id: FilterId, values: FilterValue[], not?: boolean): Filter => {
  return {
    def: findFilter(FilterDefinitionSample, id)!,
    compare: not ? FilterCompare.notEqual : FilterCompare.equal,
    values: values
  };
};

const getEncodedFilter = (filters: Filters) => {
  getFetchFunctions(FilterDefinitionSample).getRecords({
    structuredFilters: filters,
    recordType: 'flowLog',
    dataSource: 'auto',
    limit: 5,
    packetLoss: 'all'
  });
  expect(getFlowRecordsMock).toHaveBeenCalledTimes(1);
  return getFlowRecordsMock.mock.calls[0][0].filters;
};

const getDecodedFilter = (filters: Filters) => {
  return decodeURIComponent(getEncodedFilter(filters));
};

describe('Match all, flows', () => {
  beforeEach(() => {
    getFlowRecordsMock.mockClear();
  });

  it('should encode', () => {
    const filters = getEncodedFilter({ list: [filter('src_name', [{ v: 'test1' }, { v: 'test2' }])], match: 'all' });
    expect(filters).toEqual('SrcK8S_Name%3Dtest1%2Ctest2');
  });

  it('should generate AND groups', () => {
    const grouped = getDecodedFilter({
      list: [filter('src_name', [{ v: 'test1' }, { v: 'test2' }]), filter('src_namespace', [{ v: 'ns' }])],
      match: 'all'
    });
    expect(grouped).toEqual('SrcK8S_Name=test1,test2&SrcK8S_Namespace=ns');
  });

  it('should generate AND groups, back and forth', () => {
    const grouped = getDecodedFilter({
      list: [filter('src_name', [{ v: 'test1' }, { v: 'test2' }]), filter('dst_port', [{ v: '443' }])],
      match: 'bidirectional'
    });
    expect(grouped).toEqual('SrcK8S_Name=test1,test2&DstPort=443|DstK8S_Name=test1,test2&SrcPort=443');
  });

  it('should filter for namespace to owner back and forth', () => {
    const grouped = getDecodedFilter({
      list: [filter('src_namespace', [{ v: 'ns' }]), filter('dst_owner_name', [{ v: 'test' }])],
      match: 'bidirectional'
    });
    expect(grouped).toEqual('SrcK8S_Namespace=ns&DstK8S_OwnerName=test|DstK8S_Namespace=ns&SrcK8S_OwnerName=test');
  });

  it('should generate AND groups, back and forth, mixed with non-Src/Dst', () => {
    const grouped = getDecodedFilter({
      list: [
        filter('src_name', [{ v: 'test' }]),
        filter('dst_port', [{ v: '443' }]),
        filter('src_kind', [{ v: 'Pod' }]),
        filter('protocol', [{ v: '6' }])
      ],
      match: 'bidirectional'
    });
    expect(grouped).toEqual(
      'SrcK8S_Name=test&DstPort=443&SrcK8S_Type=Pod&Proto=6' + '|DstK8S_Name=test&SrcPort=443&DstK8S_Type=Pod&Proto=6'
    );
  });

  it('should generate simple Src K8S resource', () => {
    const grouped = getDecodedFilter({ list: [filter('src_resource', [{ v: 'Pod.ns.test' }])], match: 'all' });
    expect(grouped).toEqual('SrcK8S_Type="Pod"&SrcK8S_Namespace="ns"&SrcK8S_Name="test"');
  });

  it('should generate K8S resource, back and forth', () => {
    const grouped = getDecodedFilter({
      list: [filter('src_resource', [{ v: 'Pod.ns.test' }])],
      match: 'bidirectional'
    });
    expect(grouped).toEqual(
      'SrcK8S_Type="Pod"&SrcK8S_Namespace="ns"&SrcK8S_Name="test"' +
        '|DstK8S_Type="Pod"&DstK8S_Namespace="ns"&DstK8S_Name="test"'
    );
  });

  it('should generate Node Src/Dst K8S resource, back and forth', () => {
    const grouped = getDecodedFilter({ list: [filter('src_resource', [{ v: 'Node.test' }])], match: 'bidirectional' });
    expect(grouped).toEqual(
      'SrcK8S_Type="Node"&SrcK8S_Namespace=""&SrcK8S_Name="test"' +
        '|DstK8S_Type="Node"&DstK8S_Namespace=""&DstK8S_Name="test"'
    );
  });

  it('should generate Owner Src/Dst K8S resource, back and forth', () => {
    const grouped = getDecodedFilter({
      list: [filter('src_resource', [{ v: 'DaemonSet.ns.test' }])],
      match: 'bidirectional'
    });
    expect(grouped).toEqual(
      'SrcK8S_OwnerType="DaemonSet"&SrcK8S_Namespace="ns"&SrcK8S_OwnerName="test"' +
        '|DstK8S_OwnerType="DaemonSet"&DstK8S_Namespace="ns"&DstK8S_OwnerName="test"'
    );
  });

  it('should generate Src/Dst K8S resource ANDed with Dst Name, back and forth', () => {
    const grouped = getDecodedFilter({
      list: [filter('src_resource', [{ v: 'Pod.ns.test' }]), filter('dst_name', [{ v: 'peer' }])],
      match: 'bidirectional'
    });
    expect(grouped).toEqual(
      'SrcK8S_Type="Pod"&SrcK8S_Namespace="ns"&SrcK8S_Name="test"&DstK8S_Name=peer' +
        '|DstK8S_Type="Pod"&DstK8S_Namespace="ns"&DstK8S_Name="test"&SrcK8S_Name=peer'
    );
  });
});

describe('Match any, flows', () => {
  beforeEach(() => {
    getFlowRecordsMock.mockClear();
  });

  it('should encode', () => {
    const grouped = getEncodedFilter({ list: [filter('src_name', [{ v: 'test1' }, { v: 'test2' }])], match: 'any' });
    expect(grouped).toEqual('SrcK8S_Name%3Dtest1%2Ctest2');
  });

  it('should generate OR groups', () => {
    const grouped = getDecodedFilter({
      list: [filter('src_name', [{ v: 'test1' }, { v: 'test2' }]), filter('src_namespace', [{ v: 'ns' }])],
      match: 'any'
    });
    expect(grouped).toEqual('SrcK8S_Name=test1,test2|SrcK8S_Namespace=ns');
  });

  it('should generate simple two Src K8S resource', () => {
    const grouped = getDecodedFilter({
      list: [filter('src_resource', [{ v: 'Pod.ns.test1' }, { v: 'Pod.ns.test2' }])],
      match: 'any'
    });
    expect(grouped).toEqual(
      'SrcK8S_Type="Pod"&SrcK8S_Namespace="ns"&SrcK8S_Name="test1"|SrcK8S_Type="Pod"&SrcK8S_Namespace="ns"&SrcK8S_Name="test2"'
    );
  });

  it('should generate K8S resource, ORed with Name', () => {
    const grouped = getDecodedFilter({
      list: [filter('src_resource', [{ v: 'Pod.ns.test' }]), filter('dst_name', [{ v: 'peer' }])],
      match: 'any'
    });
    expect(grouped).toEqual('SrcK8S_Type="Pod"&SrcK8S_Namespace="ns"&SrcK8S_Name="test"|DstK8S_Name=peer');
  });
});

const getTopoForFilter = (filters: Filters) => {
  getFetchFunctions(FilterDefinitionSample).getMetrics(
    {
      structuredFilters: filters,
      recordType: 'flowLog',
      dataSource: 'auto',
      limit: 5,
      packetLoss: 'all'
    },
    300
  );
};

describe('Match all, topology', () => {
  beforeEach(() => {
    getFlowMetricsMock.mockClear();
  });

  it('should encode', () => {
    getTopoForFilter({ list: [filter('src_name', [{ v: 'test1' }, { v: 'test2' }])], match: 'all' });
    expect(getFlowMetricsMock).toHaveBeenCalledTimes(1);
    expect(getFlowMetricsMock.mock.calls[0][0].filters).toEqual('SrcK8S_Name%3Dtest1%2Ctest2');
  });

  it('should generate AND groups', () => {
    getTopoForFilter({
      list: [filter('src_name', [{ v: 'test1' }, { v: 'test2' }]), filter('src_namespace', [{ v: 'ns' }])],
      match: 'all'
    });
    expect(getFlowMetricsMock).toHaveBeenCalledTimes(1);
    expect(decodeURIComponent(getFlowMetricsMock.mock.calls[0][0].filters)).toEqual(
      'SrcK8S_Name=test1,test2&SrcK8S_Namespace=ns'
    );
  });

  it('should generate AND groups, back and forth', () => {
    getTopoForFilter({
      list: [filter('src_name', [{ v: 'test1' }, { v: 'test2' }]), filter('dst_port', [{ v: '443' }])],
      match: 'bidirectional'
    });
    expect(getFlowMetricsMock).toHaveBeenCalledTimes(3);
    expect(decodeURIComponent(getFlowMetricsMock.mock.calls[0][0].filters)).toEqual(
      'SrcK8S_Name=test1,test2&DstPort=443'
    );
    expect(decodeURIComponent(getFlowMetricsMock.mock.calls[1][0].filters)).toEqual(
      'DstK8S_Name=test1,test2&SrcPort=443'
    );
    expect(decodeURIComponent(getFlowMetricsMock.mock.calls[2][0].filters)).toEqual(
      'SrcK8S_Name=test1,test2&DstPort=443&DstK8S_Name=test1,test2&SrcPort=443'
    );
  });
});

describe('Merge topology BNF', () => {
  const range = { from: 0, to: 300 };
  const genNsMetric = (
    srcns: string | undefined,
    dstns: string | undefined,
    value1stHalf: number | undefined,
    value2ndHalf: number | undefined
  ): RawTopologyMetrics => {
    const m: RawTopologyMetrics = {
      metric: { SrcK8S_Namespace: srcns, DstK8S_Namespace: dstns },
      values: []
    };
    if (value1stHalf !== undefined) {
      for (let i = 0; i < 10; i++) {
        m.values.push([i * 15, value1stHalf]);
      }
    }
    if (value2ndHalf !== undefined) {
      for (let i = 10; i < 20; i++) {
        m.values.push([i * 15, value2ndHalf]);
      }
    }
    return m;
  };

  it('should merge without overlap', () => {
    ContextSingleton.setScopes(ScopeDefSample);

    const rsOrig: FlowMetricsResult = {
      metrics: parseTopologyMetrics(
        [
          genNsMetric('foo', 'bar', 10, 20),
          genNsMetric('foo', 'foo', 10, 5),
          genNsMetric('foo', undefined, 5, undefined)
        ],
        range,
        'namespace',
        0,
        true
      ),
      stats: { limitReached: true, numQueries: 2, dataSources: ['loki'] }
    };
    const rsSwap: FlowMetricsResult = {
      metrics: parseTopologyMetrics(
        [genNsMetric('bar', 'foo', 1, 1), genNsMetric('foo', 'foo', 5, 5)],
        range,
        'namespace',
        0,
        true
      ),
      stats: { limitReached: false, numQueries: 1, dataSources: ['loki'] }
    };

    const merged = mergeMetricsBNF(range, rsOrig, rsSwap);
    expect(merged.metrics).toHaveLength(4);
    expect(merged.metrics[0].source.namespace).toEqual('foo');
    expect(merged.metrics[0].destination.namespace).toEqual('bar');
    expect(merged.metrics[0].stats).toEqual({
      avg: 15,
      max: 20,
      sum: 300,
      total: 4275,
      latest: 20,
      min: 10,
      percentiles: [20, 20]
    });
    expect(merged.metrics[1].source.namespace).toEqual('foo');
    expect(merged.metrics[1].destination.namespace).toEqual('foo');
    expect(merged.metrics[1].stats).toEqual({
      avg: 12.5,
      max: 15,
      sum: 250,
      total: 3562,
      latest: 10,
      min: 10,
      percentiles: [15, 15]
    });
    expect(merged.metrics[2].source.namespace).toEqual('foo');
    expect(merged.metrics[2].destination.namespace).toBeUndefined();
    expect(merged.metrics[2].stats).toEqual({
      avg: 2.5,
      max: 5,
      sum: 50,
      total: 712,
      latest: 0,
      min: 0,
      percentiles: [5, 5]
    });
    expect(merged.metrics[3].source.namespace).toEqual('bar');
    expect(merged.metrics[3].destination.namespace).toEqual('foo');
    expect(merged.metrics[3].stats).toEqual({
      avg: 1,
      max: 1,
      sum: 20,
      total: 285,
      latest: 1,
      min: 1,
      percentiles: [1, 1]
    });
    expect(merged.stats).toEqual({ dataSources: ['loki'], limitReached: true, numQueries: 3 });
  });

  it('should merge with overlap', () => {
    const rsOrig: FlowMetricsResult = {
      metrics: parseTopologyMetrics(
        [
          genNsMetric('foo', 'bar', 10, 20),
          genNsMetric('foo', 'foo', 10, 5),
          genNsMetric('foo', undefined, 5, undefined)
        ],
        range,
        'namespace',
        0,
        true
      ),
      stats: { limitReached: true, numQueries: 2, dataSources: ['loki'] }
    };
    const rsSwap: FlowMetricsResult = {
      metrics: parseTopologyMetrics(
        [genNsMetric('bar', 'foo', 1, 1), genNsMetric('foo', 'foo', 5, 5)],
        range,
        'namespace',
        0,
        true
      ),
      stats: { limitReached: false, numQueries: 1, dataSources: ['loki'] }
    };
    const rsOverlap: FlowMetricsResult = {
      metrics: parseTopologyMetrics([genNsMetric('foo', 'foo', 3, 3)], range, 'namespace', 0, true),
      stats: { limitReached: false, numQueries: 1, dataSources: ['loki'] }
    };

    const merged = mergeMetricsBNF(range, rsOrig, rsSwap, rsOverlap);
    expect(merged.metrics).toHaveLength(4);
    expect(merged.metrics[0].source.namespace).toEqual('foo');
    expect(merged.metrics[0].destination.namespace).toEqual('bar');
    expect(merged.metrics[0].stats).toEqual({
      avg: 15,
      max: 20,
      sum: 300,
      total: 4275,
      latest: 20,
      min: 10,
      percentiles: [20, 20]
    });
    expect(merged.metrics[1].source.namespace).toEqual('foo');
    expect(merged.metrics[1].destination.namespace).toEqual('foo');
    expect(merged.metrics[1].stats).toEqual({
      avg: 9.5,
      max: 12,
      sum: 190,
      total: 2707,
      latest: 7,
      min: 7,
      percentiles: [12, 12]
    });
    expect(merged.metrics[2].source.namespace).toEqual('foo');
    expect(merged.metrics[2].destination.namespace).toBeUndefined();
    expect(merged.metrics[2].stats).toEqual({
      avg: 2.5,
      max: 5,
      sum: 50,
      total: 712,
      latest: 0,
      min: 0,
      percentiles: [5, 5]
    });
    expect(merged.metrics[3].source.namespace).toEqual('bar');
    expect(merged.metrics[3].destination.namespace).toEqual('foo');
    expect(merged.metrics[3].stats).toEqual({
      avg: 1,
      max: 1,
      sum: 20,
      total: 285,
      latest: 1,
      min: 1,
      percentiles: [1, 1]
    });
    expect(merged.stats).toEqual({ dataSources: ['loki'], limitReached: true, numQueries: 4 });
  });
});
