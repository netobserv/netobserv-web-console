import { Rule } from '@openshift-console/dynamic-plugin-sdk';
import * as _ from 'lodash';
import { HealthItem, HealthStat, Severity, emptyStat, getAllHealthItems, rulesToHealthItems } from './health-helper';

export type ReadonlySeverityCounts = {
  firing: number;
  pending: number;
  silenced: number;
};

export type ReadonlySummaryCounts = Record<Severity, ReadonlySeverityCounts>;

const emptySeverityCounts = (): ReadonlySeverityCounts => ({ firing: 0, pending: 0, silenced: 0 });

export const getReadonlySummaryCounts = (stats: ReadonlyHealthStats): ReadonlySummaryCounts => {
  const counts: ReadonlySummaryCounts = {
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

export type ReadonlyHealthStats = {
  /** At least one allowlisted platform alert rule exists in Prometheus. */
  available: boolean;
  /** Fallback human title for the context tab (annotation displayName or a formatted id). */
  displayName: string;
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

/** Build readonly-alerts context stats grouped by cluster-wide vs node. Excludes NetObserv health score. */
export const buildReadonlyStats = (
  alertRules: Rule[],
  available: boolean,
  displayName: string
): ReadonlyHealthStats => {
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

  return { available, displayName, global, byNode };
};

export const countReadonlyActiveAlerts = (stats: ReadonlyHealthStats): number => {
  return getAllHealthItems(stats.global).length + stats.byNode.reduce((n, s) => n + getAllHealthItems(s).length, 0);
};

export const getReadonlyTabStats = (stats: ReadonlyHealthStats): HealthStat[] => {
  const result: HealthStat[] = [];
  if (getAllHealthItems(stats.global).length > 0) {
    result.push(stats.global);
  }
  return result.concat(stats.byNode);
};
