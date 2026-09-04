import { Rule } from '@openshift-console/dynamic-plugin-sdk';
import * as _ from 'lodash';
import { HealthItem, HealthStat, Severity, emptyStat, getAllHealthItems, rulesToHealthItems } from './health-helper';

export type OvnSeverityCounts = {
  firing: number;
  pending: number;
  silenced: number;
};

export type OvnSummaryCounts = Record<Severity, OvnSeverityCounts>;

const emptySeverityCounts = (): OvnSeverityCounts => ({ firing: 0, pending: 0, silenced: 0 });

export const getOvnSummaryCounts = (stats: OvnHealthStats): OvnSummaryCounts => {
  const counts: OvnSummaryCounts = {
    critical: emptySeverityCounts(),
    warning: emptySeverityCounts(),
    info: emptySeverityCounts()
  };
  const items = [stats.global, ...stats.byNode].flatMap(stat => getAllHealthItems(stat));
  items.forEach(item => {
    const bucket = counts[item.severity] ?? counts.info;
    switch (item.state) {
      case 'firing':
        bucket.firing += 1;
        break;
      case 'pending':
        bucket.pending += 1;
        break;
      case 'silenced':
        bucket.silenced += 1;
        break;
      default:
        break;
    }
  });
  return counts;
};

const NODE_LABEL_KEYS = ['node', 'instance'] as const;

export type OvnHealthStats = {
  /** At least one allowlisted platform alert rule exists in Prometheus. */
  available: boolean;
  global: HealthStat;
  byNode: HealthStat[];
};

export const normalizeNodeLabelValue = (value: string): string => {
  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    if (end !== -1 && end + 1 < value.length && value[end + 1] === ':') {
      return value.slice(1, end);
    }
    return value;
  }
  const colon = value.lastIndexOf(':');
  if (colon !== -1) {
    return value.slice(0, colon);
  }
  return value;
};

export const getNodeNameFromLabels = (labels: Record<string, string>): string | undefined => {
  for (const key of NODE_LABEL_KEYS) {
    const value = labels[key];
    if (value) {
      return normalizeNodeLabelValue(value);
    }
  }
  return undefined;
};

const pushItem = (stat: HealthStat, item: HealthItem) => {
  let bucket: HealthStat['critical'];
  switch (item.severity) {
    case 'critical':
      bucket = stat.critical;
      break;
    case 'warning':
      bucket = stat.warning;
      break;
    default:
      bucket = stat.other;
  }
  switch (item.state) {
    case 'firing':
      bucket.firing.push(item);
      break;
    case 'pending':
      bucket.pending.push(item);
      break;
    case 'silenced':
      bucket.silenced.push(item);
      break;
    default:
      break;
  }
};

/** Build OVN tab stats grouped by cluster-wide vs node. Excludes NetObserv health score. */
export const buildOvnStats = (alertRules: Rule[], available: boolean): OvnHealthStats => {
  const items = rulesToHealthItems(alertRules, {}, []);
  const global = emptyStat('');
  const byNodeMap = new Map<string, HealthStat>();

  items.forEach(item => {
    if (item.state === 'inactive') {
      return;
    }
    const node = getNodeNameFromLabels(item.labels);
    if (node) {
      let stat = byNodeMap.get(node);
      if (!stat) {
        stat = emptyStat(node, undefined, 'Node');
        byNodeMap.set(node, stat);
      }
      pushItem(stat, item);
    } else {
      pushItem(global, item);
    }
  });

  const byNode = _.sortBy(
    Array.from(byNodeMap.values()).filter(stat => getAllHealthItems(stat).length > 0),
    s => s.name
  );

  return { available, global, byNode };
};

export const countOvnActiveAlerts = (stats: OvnHealthStats): number => {
  return getAllHealthItems(stats.global).length + stats.byNode.reduce((n, s) => n + getAllHealthItems(s).length, 0);
};

export const getOvnTabStats = (stats: OvnHealthStats): HealthStat[] => {
  const result: HealthStat[] = [];
  if (getAllHealthItems(stats.global).length > 0) {
    result.push(stats.global);
  }
  return result.concat(stats.byNode);
};
