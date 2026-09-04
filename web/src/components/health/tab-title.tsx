import { TabTitleIcon, TabTitleText } from '@patternfly/react-core';
import {
  BellIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InfoAltIcon
} from '@patternfly/react-icons';
import * as React from 'react';
import { getAllHealthItems, getResourceSeverity, HealthStat, HealthStats, Severity } from './health-helper';
import { BgpHealthStats } from './bgp-health-helper';
import { OvnHealthStats } from './ovn-health-helper';

const getSeverityTabIcon = (severities: (Severity | undefined)[]): React.ReactElement => {
  if (severities.includes('critical')) {
    return <ExclamationCircleIcon className="icon critical" />;
  }
  if (severities.includes('warning')) {
    return <ExclamationTriangleIcon className="icon warning" />;
  }
  if (severities.includes('info')) {
    return <BellIcon className="icon minor" />;
  }
  if (severities.filter(s => s !== undefined).length > 0) {
    return <InfoAltIcon />;
  }
  return <CheckCircleIcon className="icon healthy" />;
};

export const getNetobservContextStats = (health: HealthStats): HealthStat[] => [
  health.global,
  ...health.byNode,
  ...health.byNamespace,
  ...health.byOwner
];

export const getOvnContextStats = (stats: OvnHealthStats): HealthStat[] => [stats.global, ...stats.byNode];

export const getBgpContextStats = (stats: BgpHealthStats): HealthStat[] => [stats.global, ...stats.byPeer];

export const getContextTabActiveCount = (stats: HealthStat[]): number =>
  stats.reduce((total, stat) => total + getAllHealthItems(stat).length, 0);

export interface HealthTabTitleProps {
  title: string;
  stats: HealthStat[];
}

/** Sub-tab title: icon + resource or item count for a single view (Global, Nodes, …). */
export const HealthTabTitle: React.FC<HealthTabTitleProps> = ({ stats, title }) => {
  const icon = getSeverityTabIcon(stats.map(getResourceSeverity));
  // Count = number of items to show in the tab (violations/recordings). For Global there is a single stat
  // but we show N items inside it; for Nodes/Namespaces/Workloads we show one card per stat.
  const count = stats.length === 1 ? getAllHealthItems(stats[0]).length : stats.length;
  return (
    <>
      <TabTitleIcon>{icon}</TabTitleIcon>
      <TabTitleText>{`${title} (${count})`}</TabTitleText>
    </>
  );
};

/** Context tab title (NetObserv / Platform): icon + total active items across all views. */
export const HealthContextTabTitle: React.FC<HealthTabTitleProps> = ({ stats, title }) => {
  const icon = getSeverityTabIcon(stats.map(getResourceSeverity));
  const count = getContextTabActiveCount(stats);
  return (
    <>
      <TabTitleIcon>{icon}</TabTitleIcon>
      <TabTitleText>{`${title} (${count})`}</TabTitleText>
    </>
  );
};
