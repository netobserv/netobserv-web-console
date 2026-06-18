import { FlowScope, MetricType, StatFunction } from '../model/flow-query';
import { StructuredError } from '../utils/errors';
import { cyrb53 } from '../utils/hash';
import { getFunctionFromId, getRateFunctionFromId } from '../utils/overview-panels';
import { Result } from '../utils/result';
import { Field, Flow, Record } from './ipfix';

export interface AggregatedQueryResponse {
  resultType: string;
  result: StreamResult[] | RawTopologyMetrics[];
  stats: Stats;
  unixTimestamp: number;
}

export interface Stats {
  numQueries: number;
  limitReached: boolean;
  dataSources: string[];
  // Here, more (raw) stats available in queriesStats array
}

export interface StreamResult {
  stream: { [key: string]: string };
  values: string[][];
}

export interface RecordsResult {
  records: Record[];
  stats: Stats;
}

export interface FlowMetricsResult {
  metrics: TopologyMetrics[];
  stats: Stats;
}

export interface GenericMetricsResult {
  metrics: GenericMetric[];
  stats: Stats;
}

export const parseStream = (raw: StreamResult): Record[] => {
  return raw.values.map(v => {
    const fields = JSON.parse(v[1]) as Flow;
    return {
      labels: raw.stream as Flow,
      key: cyrb53(v.join(',')),
      fields: fields
    };
  });
};

export type RawTopologyMetric = Flow;

export interface RawTopologyMetrics {
  metric: RawTopologyMetric;
  values: [number, unknown][];
}

export interface NameAndType {
  name: string;
  type: string;
}

export interface TopologyMetricPeer {
  id: string;
  addr?: string;
  owner?: NameAndType;
  resource?: NameAndType;
  resourceKind?: string;
  isAmbiguous: boolean;
  getDisplayName: (inclNamespace: boolean, disambiguate: boolean) => string | undefined;
  // any FlowScope can appear here as optional field
  [name: string]: unknown;
  namespace?: string;
  host?: string;
  cluster?: string;
  udn?: string;
  subnetLabel?: string;
}

/** TLS breakdown from matrix metric labels (topology TLS aggregate: TLSVersion + TLSGroup). */
export type GenericMetricTls = {
  versions?: string[];
  /** Cipher / key-exchange group (PQC compliance). */
  groups?: string[];
};

export type GenericMetric = {
  name: string;
  values: [number, number][];
  stats: MetricStats;
  aggregateBy: Field;
  tls?: GenericMetricTls;
};

export type FunctionMetrics = {
  avg?: TopologyMetrics[];
  min?: TopologyMetrics[];
  max?: TopologyMetrics[];
  p90?: TopologyMetrics[];
  p99?: TopologyMetrics[];
};

export type TotalFunctionMetrics = {
  avg?: TopologyMetrics;
  min?: TopologyMetrics;
  max?: TopologyMetrics;
  p90?: TopologyMetrics;
  p99?: TopologyMetrics;
};

export const initFunctionMetricKeys = (ids: string[]) => {
  const obj: FunctionMetrics | TotalFunctionMetrics = {};
  ids.forEach(id => {
    obj[getFunctionFromId(id)] = undefined;
  });
  return obj;
};

export const getFunctionMetricKey = (metricFunction: StatFunction) => {
  switch (metricFunction) {
    case 'min':
    case 'max':
    case 'p90':
    case 'p99':
      return metricFunction;
    default:
      return 'avg';
  }
};

export type RateMetrics = {
  bytes?: TopologyMetrics[];
  packets?: TopologyMetrics[];
};

export type TotalRateMetrics = {
  bytes?: TopologyMetrics;
  packets?: TopologyMetrics;
};

export type NetflowMetrics = {
  rate: Result<RateMetrics, StructuredError | string>;
  droppedRate: Result<RateMetrics, StructuredError | string>;
  totalRate: Result<TotalRateMetrics, StructuredError | string>;
  totalDroppedRate: Result<TotalRateMetrics, StructuredError | string>;
  droppedState: Result<GenericMetric[], StructuredError | string>;
  droppedCause: Result<GenericMetric[], StructuredError | string>;
  dnsName: Result<GenericMetric[], StructuredError | string>;
  dnsRCode: Result<GenericMetric[], StructuredError | string>;
  dnsLatency: Result<FunctionMetrics, StructuredError | string>;
  rtt: Result<FunctionMetrics, StructuredError | string>;
  totalFlowCount: Result<TopologyMetrics, StructuredError | string>;
  totalDnsLatency: Result<TotalFunctionMetrics, StructuredError | string>;
  totalDnsCount: Result<GenericMetric, StructuredError | string>;
  totalRtt: Result<TotalFunctionMetrics, StructuredError | string>;
  tlsUsagePerVersion: Result<GenericMetric[], StructuredError | string>;
  tlsUsagePerCipher: Result<GenericMetric[], StructuredError | string>;
  tlsUsagePerGroup: Result<GenericMetric[], StructuredError | string>;
  tlsFlowRate: Result<GenericMetric, StructuredError | string>;
  totalFlowRate: Result<GenericMetric, StructuredError | string>;
  custom: Map<string, Result<TopologyMetrics[] | GenericMetric[], StructuredError | string>>;
  totalCustom: Map<string, Result<TopologyMetrics | GenericMetric, StructuredError | string>>;
};

export const defaultNetflowMetrics: NetflowMetrics = {
  rate: Result.empty(),
  droppedRate: Result.empty(),
  totalRate: Result.empty(),
  totalDroppedRate: Result.empty(),
  droppedState: Result.empty(),
  droppedCause: Result.empty(),
  dnsName: Result.empty(),
  dnsRCode: Result.empty(),
  dnsLatency: Result.empty(),
  rtt: Result.empty(),
  totalFlowCount: Result.empty(),
  totalDnsLatency: Result.empty(),
  totalDnsCount: Result.empty(),
  totalRtt: Result.empty(),
  tlsUsagePerCipher: Result.empty(),
  tlsUsagePerGroup: Result.empty(),
  tlsUsagePerVersion: Result.empty(),
  tlsFlowRate: Result.empty(),
  totalFlowRate: Result.empty(),
  custom: new Map(),
  totalCustom: new Map()
};

export const initRateMetricKeys = (ids: string[]) => {
  const obj: RateMetrics | TotalRateMetrics = {};
  ids.forEach(id => {
    obj[getRateFunctionFromId(id)] = undefined;
  });
  return obj;
};

export const getRateMetricKey = (metricType: MetricType) => {
  return metricType === 'Bytes' ? 'bytes' : 'packets';
};

export type TopologyMetrics = {
  source: TopologyMetricPeer;
  destination: TopologyMetricPeer;
  values: [number, number][];
  stats: MetricStats;
  scope: FlowScope;
  /** TLSVersion / TLSGroup from topology matrix labels when present. */
  tls?: GenericMetricTls;
};

export type NamedMetric = TopologyMetrics & {
  fullName: string;
  shortName: string;
  isInternal: boolean;
};

export interface MetricStats {
  sum: number;
  latest: number;
  avg: number;
  min: number;
  max: number;
  percentiles: number[];
  total: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isValidTopologyMetrics = (metric: any): metric is TopologyMetrics => {
  return (
    metric &&
    typeof metric.source === 'object' &&
    typeof metric.destination === 'object' &&
    Array.isArray(metric.values) &&
    typeof metric.stats === 'object' &&
    typeof metric.scope === 'string'
  );
};

export interface Status {
  loki: DatasourceStatus;
  prometheus: DatasourceStatus;
}

export interface DatasourceStatus {
  isEnabled: boolean;
  namespacesCount: number;
  isReady: boolean;
  error: string;
  errorCode: number;
}
