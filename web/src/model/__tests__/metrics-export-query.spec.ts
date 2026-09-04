import { defaultNetflowMetrics, NetflowMetrics } from '../../api/query-response';
import { metrics } from '../../components/__tests-data__/metrics';
import { EXPORT_MAX_LIMIT } from '../../model/export-limit';
import { StructuredFlowQuery } from '../../model/flow-query';
import {
  buildMetricsExportQueries,
  buildMetricsExportRequest,
  hasExportableMetrics
} from '../../model/metrics-export-query';
import { Result } from '../../utils/result';

const sampleFlowQuery: StructuredFlowQuery = {
  recordType: 'flowLog',
  dataSource: 'auto',
  packetLoss: 'all',
  limit: 10,
  structuredFilters: { list: [], match: 'all' }
};

const sampleMetrics: NetflowMetrics = {
  ...defaultNetflowMetrics,
  rate: Result.success({ bytes: metrics })
};

describe('metrics-export-query', () => {
  it('builds export queries from loaded metrics state', () => {
    const queries = buildMetricsExportQueries(sampleMetrics);
    expect(queries).toEqual([{ type: 'Bytes', function: 'rate' }]);
    expect(hasExportableMetrics(sampleMetrics)).toBe(true);
    expect(hasExportableMetrics(defaultNetflowMetrics)).toBe(false);
  });

  it('raises export limit when export all series is enabled', () => {
    const request = buildMetricsExportRequest(sampleMetrics, sampleFlowQuery, 300, 'namespace', {
      format: 'csv',
      includeTopologyEdges: false,
      exportAllSeries: true
    });
    expect(request.limit).toBe(EXPORT_MAX_LIMIT);
  });

  it('keeps export limit when export all series is disabled', () => {
    const request = buildMetricsExportRequest(sampleMetrics, sampleFlowQuery, 300, 'namespace', {
      format: 'csv',
      includeTopologyEdges: false,
      exportAllSeries: false
    });
    expect(request.limit).toBe(10);
  });
});
