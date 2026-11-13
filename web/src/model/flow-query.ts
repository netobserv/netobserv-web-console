import { Field } from '../api/ipfix';
import { Filter, Filters } from './filters';

export type RecordType = 'allConnections' | 'newConnection' | 'heartbeat' | 'endConnection' | 'flowLog';
export type DataSource = 'auto' | 'loki' | 'prom';
export type Match = 'any' | 'all' | 'bidirectional';
export type PacketLoss = 'dropped' | 'hasDrops' | 'sent' | 'all';
export type MetricFunction = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'p90' | 'p99' | 'rate';
export type StatFunction = MetricFunction | 'last';
export type MetricType = 'Flows' | 'DnsFlows' | 'TlsFlows' | Field;
// scope are configurable and can be any string
// such as 'app', 'cluster', 'zone', 'host', 'namespace', 'owner', 'resource'...
export type FlowScope = string;
export type AggregateBy = FlowScope | Field;

/** Suffix for aggregateBy keys that mirror a topology scope plus TLSVersion (see backend GetAggregateKeyLabels). */
export const topologyTlsVersionAggregateSuffix = '__TLSVersion';

export const aggregateByWithTlsVersion = (scope: FlowScope): AggregateBy =>
  `${scope}${topologyTlsVersionAggregateSuffix}` as AggregateBy;

export type NodeType = FlowScope | 'unknown';
// groups are configurable and can be any string
// such as 'clusters', 'clusters+zones', 'clusters+hosts', 'clusters+namespaces', 'clusters+owners',
// 'zones', 'zones+hosts', 'zones+namespaces', 'zones+owners',
// 'hosts', 'hosts+namespaces', 'hosts+owners',
// 'namespaces', 'namespaces+owners',
// 'owners'...
export type Groups = string;

export type StructuredFlowQuery = Omit<FlowQuery, 'filters'> & {
  structuredFilters: Filters;
};

export interface FlowQuery {
  timeRange?: number;
  startTime?: string;
  endTime?: string;
  tenant?: string;
  filters: string;
  recordType: RecordType;
  dataSource: DataSource;
  packetLoss: PacketLoss;
  limit: number;
  percentile?: number;
  type?: MetricType;
  function?: MetricFunction;
  aggregateBy?: AggregateBy;
  groups?: Groups;
  rateInterval?: string;
  step?: string;
}

export const structuredToRawQuery = (q: StructuredFlowQuery): FlowQuery => {
  const raw = {
    ...q,
    filters: filtersToString(q.structuredFilters.list, q.structuredFilters.match === 'any'),
    structuredFilters: undefined
  };
  delete raw.structuredFilters;
  return raw;
};

export const filtersToString = (filters: Filter[], matchAny: boolean): string => {
  const encoded = filters.map(f => {
    return f.def.encoder(f.values, f.compare, matchAny);
  });
  return encodeURIComponent(encoded.join(matchAny ? '|' : '&'));
};

export const filterByHashId = (hashId: string): string => {
  return encodeURIComponent(`_HashId="${hashId}"`);
};

export const isTimeMetric = (metricType: MetricType | undefined) => {
  return ['DnsLatencyMs', 'TimeFlowRttNs'].includes(metricType || '');
};

/** Volume metrics used for topology rate edges; TLS lock / cleartext hints apply only here (not DNS latency or RTT). */
export const showTLSHints = (metricType: MetricType | undefined): boolean => {
  if (!metricType) {
    return false;
  }
  return (
    metricType === 'Bytes' ||
    metricType === 'Packets' ||
    metricType === 'PktDropBytes' ||
    metricType === 'PktDropPackets'
  );
};
