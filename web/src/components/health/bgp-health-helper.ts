import { Rule } from '@openshift-console/dynamic-plugin-sdk';
import * as _ from 'lodash';
import { HealthItem, HealthStat, Severity, emptyStat, getAllHealthItems, rulesToHealthItems } from './health-helper';

export type BgpSeverityCounts = {
  firing: number;
  pending: number;
  silenced: number;
};

export type BgpSummaryCounts = Record<Severity, BgpSeverityCounts>;

const emptySeverityCounts = (): BgpSeverityCounts => ({ firing: 0, pending: 0, silenced: 0 });

export const getBgpSummaryCounts = (stats: BgpHealthStats): BgpSummaryCounts => {
  const counts: BgpSummaryCounts = {
    critical: emptySeverityCounts(),
    warning: emptySeverityCounts(),
    info: emptySeverityCounts()
  };
  const items = [stats.global, ...stats.byPeer].flatMap(stat => getAllHealthItems(stat));
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

const PEER_LABEL_KEYS = ['peer', 'instance'] as const;

export type BgpHealthStats = {
  available: boolean;
  global: HealthStat;
  byPeer: HealthStat[];
};

export const getPeerNameFromLabels = (labels: Record<string, string>): string | undefined => {
  for (const key of PEER_LABEL_KEYS) {
    const value = labels[key];
    if (value) {
      return value;
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

/** Build BGP tab stats grouped by cluster-wide vs peer. */
export const buildBgpStats = (alertRules: Rule[], available: boolean): BgpHealthStats => {
  const items = rulesToHealthItems(alertRules, {}, []);
  const global = emptyStat('');
  const byPeerMap = new Map<string, HealthStat>();

  items.forEach(item => {
    if (item.state === 'inactive') {
      return;
    }
    const peer = getPeerNameFromLabels(item.labels);
    if (peer) {
      let stat = byPeerMap.get(peer);
      if (!stat) {
        stat = emptyStat(peer, undefined, 'Peer');
        byPeerMap.set(peer, stat);
      }
      pushItem(stat, item);
    } else {
      pushItem(global, item);
    }
  });

  const byPeer = _.sortBy(
    Array.from(byPeerMap.values()).filter(stat => getAllHealthItems(stat).length > 0),
    s => s.name
  );

  return { available, global, byPeer };
};

export const countBgpActiveAlerts = (stats: BgpHealthStats): number => {
  return getAllHealthItems(stats.global).length + stats.byPeer.reduce((n, s) => n + getAllHealthItems(s).length, 0);
};

export const getBgpTabStats = (stats: BgpHealthStats): HealthStat[] => {
  const result: HealthStat[] = [];
  if (getAllHealthItems(stats.global).length > 0) {
    result.push(stats.global);
  }
  return result.concat(stats.byPeer);
};
