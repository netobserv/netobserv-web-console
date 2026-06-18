import { TFunction } from 'i18next';
import _ from 'lodash';
import percentile from 'percentile';
import { Field, Flow } from '../api/ipfix';
import {
  GenericMetric,
  GenericMetricTls,
  MetricStats,
  NameAndType,
  RawTopologyMetrics,
  Stats,
  TopologyMetricPeer,
  TopologyMetrics
} from '../api/query-response';
import { FlowScope, MetricFunction, MetricType, topologyTlsVersionAggregateSuffix } from '../model/flow-query';
import { getCustomScopes } from '../model/scope';
import { NodeData } from '../model/topology';
import { roundTwoDigits } from './count';
import { computeStepInterval, rangeToSeconds, TimeRange } from './datetime';
import { formatDurationAboveMillisecond } from './duration';
import { valueFormat } from './format';
import { getPeerId, idUnknown } from './ids';

export type MergedTlsVersionMetricRow = {
  metric: GenericMetric;
  /** First raw TLSVersion in the bucket — use for quick-filters so values match Loki labels. */
  filterValue: string;
};

// Tolerance, in seconds, to assume presence/emptiness of the last datapoint fetched, when it is
// close to "now", to accomodate with potential collection latency.
// Past this tolerance delay, missing datapoints are considered being 0.
const latencyTolerance = 120;

const shortKindMap: { [k: string]: string } = {
  Service: 'svc',
  Deployment: 'depl',
  DaemonSet: 'ds',
  StatefulSet: 'sts'
};

export const percentileValues = [90, 99];

/** Merge TLS dimensions from TlsFlows rows (same scope + TLSVersion) into volume topology rows by src/dst peer ids. */
export const mergeTlsIntoTopologyMetrics = (
  volume: TopologyMetrics[],
  tlsRows: TopologyMetrics[]
): TopologyMetrics[] => {
  const mergeTls = (a: GenericMetricTls | undefined, b: GenericMetricTls | undefined): GenericMetricTls | undefined => {
    const versions = _.uniq([...(a?.versions || []), ...(b?.versions || [])]);
    const groups = _.uniq([...(a?.groups || []), ...(b?.groups || [])]);
    if (!versions.length && !groups.length) {
      return undefined;
    }
    return {
      ...(versions.length ? { versions } : {}),
      ...(groups.length ? { groups } : {})
    };
  };

  const tlsByEdge = new Map<string, TopologyMetrics[]>();
  for (const t of tlsRows) {
    const key = `${t.source.id}@${t.destination.id}`;
    const list = tlsByEdge.get(key);
    if (list) {
      list.push(t);
    } else {
      tlsByEdge.set(key, [t]);
    }
  }

  return volume.map(m => {
    const matches = tlsByEdge.get(`${m.source.id}@${m.destination.id}`) ?? [];
    if (!matches.length) {
      return m;
    }
    let mergedTls = m.tls;
    for (const t of matches) {
      mergedTls = mergeTls(mergedTls, t.tls);
    }
    if (!mergedTls) {
      return m;
    }
    return { ...m, tls: mergedTls };
  });
};

export const parseTopologyMetrics = (
  raw: RawTopologyMetrics[],
  range: number | TimeRange,
  aggregateBy: FlowScope,
  unixTimestamp: number,
  forceZeros: boolean,
  isMock?: boolean
): TopologyMetrics[] => {
  const { start, end, step } = calibrateRange(
    raw.map(r => r.values),
    range,
    unixTimestamp,
    isMock
  );
  const metrics = raw.map(r => parseTopologyMetric(r, start, end, step, aggregateBy, forceZeros));

  const scopeForDisambiguation = aggregateBy.endsWith(topologyTlsVersionAggregateSuffix)
    ? aggregateBy.slice(0, -topologyTlsVersionAggregateSuffix.length)
    : aggregateBy;

  // Disambiguate display names with kind when necessary
  if (scopeForDisambiguation === 'owner' || scopeForDisambiguation === 'resource') {
    // Define some helpers
    const addKind = (p: TopologyMetricPeer) => {
      const name = p.getDisplayName(true, false);
      if (name) {
        let existing = nameKinds.get(name);
        if (!existing) {
          existing = new Set();
          nameKinds.set(name, existing);
        }
        if (p.resourceKind) {
          existing.add(p.resourceKind);
        }
      }
    };
    const checkAmbiguous = (p: TopologyMetricPeer) => {
      const name = p.getDisplayName(true, false);
      if (name) {
        const kinds = nameKinds.get(name);
        if (kinds && kinds.size > 1 && p.resourceKind) {
          p.isAmbiguous = true;
        }
      }
    };

    // First pass: extract all names+kind couples
    const nameKinds = new Map<string, Set<string>>();
    metrics.forEach((m: TopologyMetrics) => {
      addKind(m.source);
      addKind(m.destination);
    });

    // Second pass: mark if ambiguous
    metrics.forEach((m: TopologyMetrics) => {
      checkAmbiguous(m.source);
      checkAmbiguous(m.destination);
    });
  }
  return metrics;
};

export const parseGenericMetrics = (
  raw: RawTopologyMetrics[],
  range: number | TimeRange,
  aggregateBy: Field,
  unixTimestamp: number,
  forceZeros: boolean,
  isMock?: boolean
): GenericMetric[] => {
  const { start, end, step } = calibrateRange(
    raw.map(r => r.values),
    range,
    unixTimestamp,
    isMock
  );
  return raw.map(r => parseGenericMetric(r, start, end, step, aggregateBy, forceZeros));
};

export const createPeer = (fields: Partial<TopologyMetricPeer>): TopologyMetricPeer => {
  const newPeer: TopologyMetricPeer = {
    id: getPeerId(fields),
    addr: fields.addr,
    resource: fields.resource,
    owner: fields.owner,
    subnetLabel: fields.subnetLabel,
    isAmbiguous: false,
    getDisplayName: () => undefined
  };

  const setForNameAndType = (nt: NameAndType) => {
    const { type, name } = nt;
    newPeer.resourceKind = type;
    newPeer.getDisplayName = (inclNamespace, disambiguate) => {
      const disamb = disambiguate && newPeer.isAmbiguous ? ` (${shortKindMap[type] || type.toLowerCase()})` : '';
      return (newPeer.namespace && inclNamespace ? `${newPeer.namespace}.${name}` : name) + disamb;
    };
  };

  if (fields.resource) {
    // Resource kind
    setForNameAndType(fields.resource);
  } else if (fields.owner) {
    // Owner kind
    setForNameAndType(fields.owner);
  }

  // append custom scope fields to peer and set kind + display if not already done
  getCustomScopes()
    .reverse()
    .forEach(sc => {
      newPeer[sc.id] = fields[sc.id] as string;
      if (!newPeer.resourceKind && newPeer[sc.id]) {
        newPeer.resourceKind = sc.name;
        newPeer.getDisplayName = () => newPeer[sc.id] as string;
      }
    });

  // fallback on address and/or subnet label if nothing else available
  if (!newPeer.resourceKind) {
    if (fields.subnetLabel && fields.addr) {
      newPeer.getDisplayName = () => `${fields.subnetLabel} (${fields.addr})`;
    } else if (fields.subnetLabel) {
      newPeer.getDisplayName = () => fields.subnetLabel;
    } else if (fields.addr) {
      newPeer.getDisplayName = () => fields.addr;
    }
  }
  return newPeer;
};

const nameAndType = (name?: string, type?: string): NameAndType | undefined => {
  return name && type ? { name, type } : undefined;
};

/** Normalize TLS-related metric label values from Loki/Prometheus (arrays, JSON strings, scalars, comma-lists). */
const normalizeTlsMetricValue = (v: unknown): string | string[] | undefined => {
  if (v === undefined || v === null) {
    return undefined;
  }
  if (Array.isArray(v)) {
    return v as string[];
  }
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return String(v);
  }
  return undefined;
};

/** Parse TLSVersion / TLSGroup from Loki matrix metric JSON (string, JSON array string, or array). */
const extractTlsListField = (v: string[] | string | undefined | null): string[] => {
  if (v === undefined || v === null) {
    return [];
  }
  if (Array.isArray(v)) {
    return _.uniq(v.filter(Boolean).map(String));
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s || s === '[]' || s === 'null') {
      return [];
    }
    if (s.startsWith('[')) {
      try {
        const parsed = JSON.parse(s) as unknown;
        if (Array.isArray(parsed)) {
          return _.uniq(parsed.filter(Boolean).map(String));
        }
      } catch {
        return [s];
      }
    }
    // Prometheus / some Loki paths: multi-value as comma-separated label
    if (s.includes(',')) {
      return _.uniq(
        s
          .split(',')
          .map(x => x.trim())
          .filter(Boolean)
      );
    }
    return [s];
  }
  return [];
};

const tlsFromFlowMetricLabels = (metric: Flow): GenericMetricTls | undefined => {
  const m = metric as Record<string, unknown>;
  const versionsRaw = extractTlsListField(normalizeTlsMetricValue(m.TLSVersion));
  const groupsRaw = extractTlsListField(normalizeTlsMetricValue(m.TLSGroup));
  if (!versionsRaw.length && !groupsRaw.length) {
    return undefined;
  }
  return {
    ...(versionsRaw.length ? { versions: versionsRaw } : {}),
    ...(groupsRaw.length ? { groups: groupsRaw } : {})
  };
};

const parseTopologyMetric = (
  raw: RawTopologyMetrics,
  start: number,
  end: number,
  step: number,
  aggregateBy: FlowScope,
  forceZeros: boolean
): TopologyMetrics => {
  const normalized = normalizeMetrics(raw.values, start, end, step, forceZeros);
  const stats = computeStats(normalized);
  const sourceFields: Partial<TopologyMetricPeer> = {
    addr: raw.metric.SrcAddr,
    resource: nameAndType(raw.metric.SrcK8S_Name, raw.metric.SrcK8S_Type),
    owner:
      raw.metric.SrcK8S_Type !== raw.metric.SrcK8S_OwnerType
        ? nameAndType(raw.metric.SrcK8S_OwnerName, raw.metric.SrcK8S_OwnerType)
        : undefined,
    subnetLabel: raw.metric.SrcSubnetLabel
  };
  const destFields: Partial<TopologyMetricPeer> = {
    addr: raw.metric.DstAddr,
    resource: nameAndType(raw.metric.DstK8S_Name, raw.metric.DstK8S_Type),
    owner:
      raw.metric.DstK8S_Type !== raw.metric.DstK8S_OwnerType
        ? nameAndType(raw.metric.DstK8S_OwnerName, raw.metric.DstK8S_OwnerType)
        : undefined,
    subnetLabel: raw.metric.DstSubnetLabel
  };
  getCustomScopes().forEach(sc => {
    if (!sc.labels.length) {
      console.error('invalid scope labels', sc);
    } else {
      const srcField = sc.labels.length === 1 ? sc.labels[0] : sc.labels.find(l => l.startsWith('Src'))!;
      sourceFields[sc.id] = (raw.metric as never)[srcField];
      const dstField = sc.labels.length === 1 ? sc.labels[0] : sc.labels.find(l => l.startsWith('Dst'))!;
      destFields[sc.id] = (raw.metric as never)[dstField];
    }
  });
  const tls = tlsFromFlowMetricLabels(raw.metric as Flow);
  return {
    source: createPeer(sourceFields),
    destination: createPeer(destFields),
    values: normalized,
    stats: stats,
    scope: aggregateBy,
    ...(tls ? { tls } : {})
  };
};

const parseGenericMetric = (
  raw: RawTopologyMetrics,
  start: number,
  end: number,
  step: number,
  aggregateBy: Field,
  forceZeros: boolean
): GenericMetric => {
  const values = normalizeMetrics(raw.values, start, end, step, forceZeros);
  const stats = computeStats(values);
  const tls = tlsFromFlowMetricLabels(raw.metric as Flow);
  return {
    name: String(raw.metric[aggregateBy] || ''),
    values,
    stats,
    aggregateBy,
    ...(tls ? { tls } : {})
  };
};

export const calibrateRange = (
  raw: [number, unknown][][],
  range: number | TimeRange,
  unixTimestamp: number,
  isMock?: boolean
): { start: number; end: number; step: number } => {
  // Extract some info based on range, and apply a tolerance about end range when it is close to "now"
  const info = computeStepInterval(range);
  const rangeInSeconds = rangeToSeconds(range);
  let start: number;
  let endWithTolerance: number;
  if (typeof range === 'number') {
    endWithTolerance = unixTimestamp - latencyTolerance;
    start = unixTimestamp - rangeInSeconds;
  } else {
    start = range.from;
    endWithTolerance = range.to;
  }

  let firstTimestamp = start;
  // Calibrate start date based on actual timestamps, to avoid inaccurate stepping from there
  //  (which screws up the chart display)
  const allFirsts = raw.filter(dp => dp.length > 0).map(dp => dp[0][0]);
  if (allFirsts.length > 0) {
    firstTimestamp = Math.min(...allFirsts);
    while (firstTimestamp > start) {
      firstTimestamp -= info.stepSeconds;
    }
  }

  // Extend normalization interval to latest timestamp if bigger than computed endWithTolerance
  const allLasts = raw.filter(dp => dp.length > 0).map(dp => dp[dp.length - 1][0]);
  if (allLasts.length > 0) {
    const lastTimestamp = Math.max(...allLasts);
    if (lastTimestamp > endWithTolerance) {
      endWithTolerance = lastTimestamp;
    }
  }

  // End time needs to be overridden to avoid huge range since mock is outdated compared to current date
  if (isMock) {
    endWithTolerance = Math.max(...raw.filter(dp => dp.length > 0).map(dp => dp[dp.length - 1][0]));
  }

  return {
    start: firstTimestamp,
    end: endWithTolerance,
    step: info.stepSeconds
  };
};

/**
 * normalizeMetrics fills all missing or NaN datapoints with zeros
 */
export const normalizeMetrics = (
  values: [number, unknown][],
  start: number,
  end: number,
  step: number,
  forceZeros: boolean
): [number, number][] => {
  let normalized: [number, number][];
  if (forceZeros) {
    // Normalize by counting all NaN as zeros
    normalized = values.map(dp => {
      let val = Number(dp[1]);
      if (_.isNaN(val)) {
        val = 0;
      }
      return [dp[0], val];
    });

    // Normalize by filling missing datapoints with zeros
    for (let current = start; current < end; current += step) {
      if (!getValueCloseTo(normalized, current, step)) {
        normalized.push([current, 0]);
      }
    }
  } else {
    // skipping NaN
    normalized = values
      .filter(dp => !_.isNaN(Number(dp[1])))
      .map(dp => {
        return [dp[0], Number(dp[1])];
      });
  }

  return normalized.sort((a, b) => a[0] - b[0]);
};

const getValueCloseTo = (values: [number, number][], timestamp: number, step: number): number | undefined => {
  const tolerance = step / 2;
  const datapoint = values.find(dp => dp[0] > timestamp - tolerance && dp[0] < timestamp + tolerance);
  return datapoint ? datapoint[1] : undefined;
};

/**
 * computeStats computes avg, max and total. Input metric is always the bytes rate (Bps).
 */
export const computeStats = (ts: [number, number][]): MetricStats => {
  if (ts.length === 0) {
    return { sum: 0, latest: 0, avg: 0, min: 0, max: 0, percentiles: percentileValues.map(() => 0), total: 0 };
  }

  const values = ts.map(dp => dp[1]);
  const filteredValues = values.filter(v => !Number.isNaN(v));
  if (!filteredValues.length) {
    return { sum: 0, latest: 0, avg: 0, min: 0, max: 0, percentiles: percentileValues.map(() => 0), total: 0 };
  }

  // Compute stats
  const sum = filteredValues.reduce((prev, cur) => prev + cur, 0);
  const avg = sum / filteredValues.length;
  const min = Math.min(...filteredValues);
  const max = Math.max(...filteredValues);
  const percentiles = percentile(percentileValues, filteredValues) as number[];
  const latest = filteredValues[filteredValues.length - 1];

  return {
    sum,
    latest: roundTwoDigits(latest),
    avg: roundTwoDigits(avg),
    min: roundTwoDigits(min),
    max: roundTwoDigits(max),
    percentiles: percentiles.map(p => roundTwoDigits(p)),
    total: Math.floor(avg * (ts[ts.length - 1][0] - ts[0][0]))
  };
};

export const getFormattedValue = (v: number, mt: MetricType, mf: MetricFunction, t: TFunction): string => {
  if (mt === 'DnsLatencyMs' || mt === 'TimeFlowRttNs') {
    return formatDurationAboveMillisecond(v);
  } else {
    switch (mt) {
      case 'PktDropBytes':
      case 'Bytes':
        if (mf !== 'rate') {
          return valueFormat(v, 1, t('B'));
        }
        return valueFormat(v, 1, t('Bps'));
      case 'PktDropPackets':
      case 'Packets':
        if (mf !== 'rate') {
          return valueFormat(v, 1, t('P'));
        }
        return valueFormat(v, 1, t('Pps'));
      case 'Flows':
        if (mf !== 'rate') {
          return valueFormat(v, 1, t('flows'));
        }
        return valueFormat(v, 1, t('fps'));
      default:
        return valueFormat(v, 1);
    }
  }
};

// matchPeer returns true is the peer id (= a given metric) equals, or contains the node id
//  E.g: peer id "h=host1,n=ns2,o=Deployment.depl-a,r=Pod.depl-a-12345,a=1.2.3.7" contains group id "h=host1"
export const matchPeer = (data: NodeData, peer: TopologyMetricPeer): boolean => {
  if (data.peer.id === idUnknown) {
    return peer.id === idUnknown;
  }
  return peer.id.includes(data.peer.id);
};

export const isUnknownPeer = (peer: TopologyMetricPeer): boolean => peer.id === idUnknown;

const stepFromGenericValues = (values: [number, number][]): number => {
  if (values.length < 2) {
    return 1;
  }
  const d = values[1][0] - values[0][0];
  return Number.isFinite(d) && d > 0 ? d : 1;
};

const combineValues = (
  values1: [number, number][],
  values2: [number, number][],
  step: number,
  op: (a: number, b: number) => number
): [number, number][] => {
  return values1.map(dp1 => {
    const t = dp1[0];
    const v1 = dp1[1];
    const v2 = getValueCloseTo(values2, t, step);
    if (v2 === undefined) {
      // shouldn't happen in theory since metrics are normalized, except on end timerange boundary
      return [t, op(v1, 0)];
    }
    return [t, op(v1, v2)];
  });
};

/**
 * Merge metrics rows that share the same TLSVersion label (after trim). Preserves raw Loki label strings.
 */
export const mergeTlsVersionUsageMetrics = (rows: GenericMetric[]): MergedTlsVersionMetricRow[] => {
  type Bucket = { displayName: string; filterValue: string; rows: GenericMetric[] };
  const buckets = new Map<string, Bucket>();

  for (const row of rows) {
    const display = row.name.trim();
    if (!display) {
      continue;
    }
    let b = buckets.get(display);
    if (!b) {
      b = { displayName: display, filterValue: row.name, rows: [] };
      buckets.set(display, b);
    }
    b.rows.push(row);
  }

  const merged: MergedTlsVersionMetricRow[] = [];
  for (const b of buckets.values()) {
    const { rows: group, displayName, filterValue } = b;
    if (group.length === 1) {
      const g0 = group[0];
      merged.push({
        metric: displayName === g0.name ? g0 : { ...g0, name: displayName },
        filterValue
      });
      continue;
    }
    const seedIndex = group.findIndex(row => row.values.length > 0);
    if (seedIndex < 0) {
      merged.push({
        metric: { ...group[0], name: displayName, values: [], stats: computeStats([]) },
        filterValue
      });
      continue;
    }
    const step = stepFromGenericValues(group[seedIndex].values);
    let values = group[seedIndex].values;
    for (let i = 0; i < group.length; i++) {
      if (i === seedIndex) {
        continue;
      }
      values = combineValues(values, group[i].values, step, (a, b) => a + b);
    }
    merged.push({
      metric: {
        ...group[0],
        name: displayName,
        values,
        stats: computeStats(values)
      },
      filterValue
    });
  }

  merged.sort((a, b) => a.metric.name.localeCompare(b.metric.name));
  return merged;
};

const combineMetrics = (
  metrics1: TopologyMetrics[],
  metrics2: TopologyMetrics[],
  step: number,
  op: (a: number, b: number) => number,
  ignoreAbsentMetric?: boolean
): TopologyMetrics[] => {
  const cache: Map<string, TopologyMetrics> = new Map();
  const keyFunc = (m: TopologyMetrics) => `${m.source.id}@${m.destination.id}`;
  metrics1.forEach(m => {
    cache.set(keyFunc(m), m);
  });
  metrics2.forEach(m => {
    const inCache = cache.get(keyFunc(m));
    if (inCache) {
      inCache.values = combineValues(inCache.values, m.values, step, op);
      inCache.stats = computeStats(inCache.values);
    } else if (!ignoreAbsentMetric) {
      cache.set(keyFunc(m), m);
    }
  });
  return Array.from(cache.values());
};

export const sumMetrics = (
  metrics1: TopologyMetrics[],
  metrics2: TopologyMetrics[],
  step: number
): TopologyMetrics[] => {
  return combineMetrics(metrics1, metrics2, step, (a, b) => a + b);
};

export const substractMetrics = (
  metrics1: TopologyMetrics[],
  metrics2: TopologyMetrics[],
  step: number
): TopologyMetrics[] => {
  return combineMetrics(metrics1, metrics2, step, (a, b) => a - b, true);
};

export const mergeStats = (prev: Stats | undefined, current: Stats): Stats => {
  if (!prev) {
    return current;
  }
  return {
    ...prev,
    limitReached: prev.limitReached || current.limitReached,
    numQueries: prev.numQueries + current.numQueries,
    dataSources: _.union(prev.dataSources, current.dataSources)
  };
};
