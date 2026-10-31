import {
  FunctionMetrics,
  GenericMetric,
  NetflowMetrics,
  RateMetrics,
  TopologyMetrics,
  TotalFunctionMetrics,
  TotalRateMetrics
} from '../api/query-response';
import { TimeRange } from '../utils/datetime';
import { ExportApiFormat } from './export-format';
import { resolveExportLimit } from './export-limit';
import { MetricFunction, MetricType, StructuredFlowQuery, structuredToRawQuery } from './flow-query';

export type MetricsExportApiFormat = ExportApiFormat;

/**
 * One metrics query to export. Metric group names are derived server-side
 * (pkg/metricsexport/groups.go) from type, function and aggregateBy.
 * Set metricGroup only when the export label must differ from that derivation
 * (e.g. totalRate.bytes, custom panels).
 */
export type MetricsExportQuery = {
  type: MetricType;
  function: MetricFunction;
  aggregateBy?: string;
  groups?: string;
  metricGroup?: string;
};

export type MetricsExportRequest = {
  format: MetricsExportApiFormat;
  includeTopologyEdges?: boolean;
  metricScope?: string;
  timeRange?: number;
  startTime?: string;
  endTime?: string;
  namespace?: string;
  filters?: string;
  recordType?: string;
  dataSource?: string;
  packetLoss?: string;
  limit?: number;
  rateInterval?: string;
  step?: string;
  groups?: string;
  queries: MetricsExportQuery[];
};

const hasTopologyRows = (metrics?: TopologyMetrics[]): boolean => !!metrics?.length;
const hasGenericRows = (metrics?: GenericMetric[]): boolean => !!metrics?.length;

const addRateQueries = (
  queries: MetricsExportQuery[],
  rate: RateMetrics | undefined,
  bytesType: MetricType,
  packetsType: MetricType
): void => {
  if (hasTopologyRows(rate?.bytes)) {
    queries.push({ type: bytesType, function: 'rate' });
  }
  if (hasTopologyRows(rate?.packets)) {
    queries.push({ type: packetsType, function: 'rate' });
  }
};

const addTotalRateQueries = (
  queries: MetricsExportQuery[],
  rate: TotalRateMetrics | undefined,
  prefix: 'totalRate' | 'totalDroppedRate',
  bytesType: MetricType,
  packetsType: MetricType
): void => {
  if (rate?.bytes) {
    queries.push({
      type: bytesType,
      function: 'rate',
      aggregateBy: 'app',
      metricGroup: `${prefix}.bytes`
    });
  }
  if (rate?.packets) {
    queries.push({
      type: packetsType,
      function: 'rate',
      aggregateBy: 'app',
      metricGroup: `${prefix}.packets`
    });
  }
};

const addFunctionQueries = (
  queries: MetricsExportQuery[],
  metrics: FunctionMetrics | undefined,
  metricType: MetricType
): void => {
  (['avg', 'min', 'max', 'p90', 'p99'] as const).forEach(fn => {
    if (hasTopologyRows(metrics?.[fn])) {
      queries.push({ type: metricType, function: fn });
    }
  });
};

const addTotalFunctionQueries = (
  queries: MetricsExportQuery[],
  metrics: TotalFunctionMetrics | undefined,
  prefix: 'totalDnsLatency' | 'totalRtt',
  metricType: MetricType
): void => {
  (['avg', 'min', 'max', 'p90', 'p99'] as const).forEach(fn => {
    if (metrics?.[fn]) {
      queries.push({
        type: metricType,
        function: fn,
        aggregateBy: 'app',
        metricGroup: `${prefix}.${fn}`
      });
    }
  });
};

export const buildMetricsExportQueries = (metrics: NetflowMetrics): MetricsExportQuery[] => {
  const queries: MetricsExportQuery[] = [];

  if (metrics.rate.result) {
    addRateQueries(queries, metrics.rate.result, 'Bytes', 'Packets');
  }
  if (metrics.droppedRate.result) {
    addRateQueries(queries, metrics.droppedRate.result, 'PktDropBytes', 'PktDropPackets');
  }
  if (metrics.totalRate.result) {
    addTotalRateQueries(queries, metrics.totalRate.result, 'totalRate', 'Bytes', 'Packets');
  }
  if (metrics.totalDroppedRate.result) {
    addTotalRateQueries(queries, metrics.totalDroppedRate.result, 'totalDroppedRate', 'PktDropBytes', 'PktDropPackets');
  }

  addFunctionQueries(queries, metrics.dnsLatency.result, 'DnsLatencyMs');
  addFunctionQueries(queries, metrics.rtt.result, 'TimeFlowRttNs');
  addTotalFunctionQueries(queries, metrics.totalDnsLatency.result, 'totalDnsLatency', 'DnsLatencyMs');
  addTotalFunctionQueries(queries, metrics.totalRtt.result, 'totalRtt', 'TimeFlowRttNs');

  if (hasGenericRows(metrics.droppedState.result)) {
    queries.push({
      type: 'PktDropPackets',
      function: 'rate',
      aggregateBy: 'PktDropLatestState'
    });
  }
  if (hasGenericRows(metrics.droppedCause.result)) {
    queries.push({
      type: 'PktDropPackets',
      function: 'rate',
      aggregateBy: 'PktDropLatestDropCause'
    });
  }
  if (hasGenericRows(metrics.dnsName.result)) {
    queries.push({ type: 'DnsFlows', function: 'count', aggregateBy: 'DnsName' });
  }
  if (hasGenericRows(metrics.dnsRCode.result)) {
    queries.push({
      type: 'DnsFlows',
      function: 'count',
      aggregateBy: 'DnsFlagsResponseCode'
    });
  }
  if (hasGenericRows(metrics.tlsUsagePerVersion.result)) {
    queries.push({ type: 'TlsFlows', function: 'rate', aggregateBy: 'TLSVersion' });
  }
  if (hasGenericRows(metrics.tlsUsagePerCipher.result)) {
    queries.push({ type: 'TlsFlows', function: 'rate', aggregateBy: 'TLSCipher' });
  }
  if (hasGenericRows(metrics.tlsUsagePerGroup.result)) {
    queries.push({ type: 'TlsFlows', function: 'rate', aggregateBy: 'TLSGroup' });
  }
  if (metrics.tlsFlowRate.result) {
    queries.push({ type: 'TlsFlows', function: 'rate' });
  }
  if (metrics.totalFlowRate.result) {
    queries.push({ type: 'Flows', function: 'rate', aggregateBy: 'app' });
  }
  if (metrics.totalFlowCount.result) {
    queries.push({ type: 'Flows', function: 'count', aggregateBy: 'app' });
  }
  if (metrics.totalDnsCount.result) {
    queries.push({ type: 'DnsFlows', function: 'count', aggregateBy: 'app' });
  }

  metrics.custom.forEach((value, key) => {
    if (!value.result) {
      return;
    }
    const result = value.result;
    if (Array.isArray(result) && result.length > 0) {
      const first = result[0] as TopologyMetrics | GenericMetric;
      if ('source' in first) {
        queries.push({ type: 'Flows', function: 'rate', metricGroup: `custom.${key}` });
      } else {
        queries.push({
          type: 'Flows',
          function: 'rate',
          aggregateBy: first.aggregateBy,
          metricGroup: `custom.${key}`
        });
      }
    }
  });

  metrics.totalCustom.forEach((value, key) => {
    if (!value.result) {
      return;
    }
    const result = value.result;
    if ('source' in result) {
      queries.push({ type: 'Flows', function: 'rate', aggregateBy: 'app', metricGroup: `totalCustom.${key}` });
    } else {
      queries.push({
        type: 'Flows',
        function: 'rate',
        aggregateBy: result.aggregateBy,
        metricGroup: `totalCustom.${key}`
      });
    }
  });

  return queries;
};

export const buildMetricsExportRequest = (
  metrics: NetflowMetrics,
  flowQuery: StructuredFlowQuery,
  range: number | TimeRange,
  metricScope: string,
  options: {
    format: MetricsExportApiFormat;
    includeTopologyEdges: boolean;
    exportAllSeries?: boolean;
  }
): MetricsExportRequest => {
  const raw = structuredToRawQuery(flowQuery);
  const limit = resolveExportLimit(raw.limit, !!options.exportAllSeries);
  const request: MetricsExportRequest = {
    format: options.format,
    includeTopologyEdges: options.includeTopologyEdges,
    metricScope,
    namespace: raw.namespace,
    filters: raw.filters,
    recordType: raw.recordType,
    dataSource: raw.dataSource,
    packetLoss: raw.packetLoss,
    limit,
    rateInterval: raw.rateInterval,
    step: raw.step,
    groups: raw.groups,
    queries: buildMetricsExportQueries(metrics)
  };

  if (typeof range === 'number') {
    request.timeRange = range;
  } else {
    request.startTime = range.from.toString();
    request.endTime = range.to.toString();
  }

  return request;
};

export const hasExportableMetrics = (metrics: NetflowMetrics): boolean => buildMetricsExportQueries(metrics).length > 0;
