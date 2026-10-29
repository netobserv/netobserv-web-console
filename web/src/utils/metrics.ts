import { TFunction } from 'i18next';
import _ from 'lodash';
import percentile from 'percentile';
import { Field } from '../api/ipfix';
import {
  GenericMetric,
  GenericMetricTls,
  MetricStats,
  NameAndType,
  Stats,
  TopologyMetricPeer,
  TopologyMetrics
} from '../api/query-response';
import { MetricFunction, MetricType } from '../model/flow-query';
import { getCustomScopes } from '../model/scope';
import { NodeData } from '../model/topology';
import { roundTwoDigits } from './count';
import { formatDurationAboveMillisecond } from './duration';
import { valueFormat } from './format';
import { getPeerId, idUnknown } from './ids';

const shortKindMap: { [k: string]: string } = {
  Service: 'svc',
  Deployment: 'depl',
  DaemonSet: 'ds',
  StatefulSet: 'sts',
  VirtualMachine: 'vm',
  VirtualMachineInstance: 'vmi'
};

export const percentileValues = [90, 99];

type PeerDisplayFields = Partial<TopologyMetricPeer> & {
  resourceKind?: string;
  isAmbiguous?: boolean;
};

/**
 * Attach getDisplayName to a peer deserialized from /api/flow/metrics
 * (methods cannot round-trip over JSON).
 */
export const hydratePeer = (peer: PeerDisplayFields): TopologyMetricPeer => {
  const hydrated: TopologyMetricPeer = {
    ...peer,
    id: peer.id || idUnknown,
    isAmbiguous: !!peer.isAmbiguous,
    getDisplayName: () => undefined
  };

  const setForNameAndType = (nt: NameAndType) => {
    const { type, name } = nt;
    hydrated.resourceKind = hydrated.resourceKind || type;
    hydrated.getDisplayName = (inclNamespace, disambiguate) => {
      const disamb = disambiguate && hydrated.isAmbiguous ? ` (${shortKindMap[type] || type.toLowerCase()})` : '';
      return (hydrated.namespace && inclNamespace ? `${hydrated.namespace}.${name}` : name) + disamb;
    };
  };

  if (hydrated.resource) {
    setForNameAndType(hydrated.resource);
  } else if (hydrated.owner) {
    setForNameAndType(hydrated.owner);
  } else {
    // Scope-only peers from backend enrichment (namespace, host, zone, …)
    const customs = getCustomScopes();
    const byKind = customs.find(sc => sc.name === hydrated.resourceKind && hydrated[sc.id]);
    if (byKind) {
      const v = hydrated[byKind.id] as string;
      hydrated.getDisplayName = () => v;
    } else {
      customs
        .slice()
        .reverse()
        .forEach(sc => {
          const v = hydrated[sc.id] as string | undefined;
          if (v && hydrated.getDisplayName(false, false) === undefined) {
            if (!hydrated.resourceKind) {
              hydrated.resourceKind = sc.name;
            }
            hydrated.getDisplayName = () => v;
          }
        });
    }

    if (hydrated.getDisplayName(false, false) === undefined) {
      if (hydrated.subnetLabel && hydrated.addr) {
        hydrated.getDisplayName = () => `${hydrated.subnetLabel} (${hydrated.addr})`;
      } else if (hydrated.subnetLabel) {
        hydrated.getDisplayName = () => hydrated.subnetLabel;
      } else if (hydrated.addr) {
        hydrated.getDisplayName = () => hydrated.addr;
      }
    }
  }

  return hydrated;
};

/** Hydrate topology metrics returned by the backend enrichment path. */
export const hydrateTopologyMetrics = (metrics: TopologyMetrics[]): TopologyMetrics[] => {
  return metrics.map(m => ({
    ...m,
    source: hydratePeer(m.source),
    destination: hydratePeer(m.destination)
  }));
};

/** Flatten topology rows into GenericMetric when callers expect field-style aggregates. */
export const genericMetricsFromTopology = (metrics: TopologyMetrics[], aggregateBy: Field): GenericMetric[] => {
  return metrics.map(m => {
    const displayName = m.source.getDisplayName(false, false);
    const fallbackId = m.source.id !== idUnknown ? m.source.id : '';
    return {
      name: displayName || fallbackId,
      values: m.values,
      stats: m.stats,
      aggregateBy,
      ...(m.tls ? { tls: m.tls } : {})
    };
  });
};

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

/** Build a peer from partial fields (groups, empty nodes, drawer chips, fixtures). */
export const createPeer = (fields: Partial<TopologyMetricPeer>): TopologyMetricPeer => {
  const peer: PeerDisplayFields = {
    ...fields,
    id: getPeerId(fields),
    isAmbiguous: false
  };
  // Ensure scope fields are present even when undefined (matches prior createPeer).
  getCustomScopes().forEach(sc => {
    peer[sc.id] = fields[sc.id] as string;
  });
  return hydratePeer(peer);
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
