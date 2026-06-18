import { Card } from '@patternfly/react-core';
import * as React from 'react';
import { NetflowMetrics, Stats } from '../../api/query-response';
import { Warning } from '../../model/warnings';
import { MetricsQuerySummaryContent } from './metrics-query-summary-content';
import './query-summary.css';

export interface MetricsQuerySummaryProps {
  stats?: Stats;
  metrics: NetflowMetrics;
  loading?: boolean;
  lastRefresh?: Date;
  lastDuration?: number;
  warning?: Warning;
  isShowQuerySummary?: boolean;
  toggleQuerySummary?: () => void;
  isDark?: boolean;
}

export const MetricsQuerySummary: React.FC<MetricsQuerySummaryProps> = ({
  metrics,
  stats,
  loading,
  lastRefresh,
  lastDuration,
  warning,
  isShowQuerySummary,
  toggleQuerySummary,
  isDark
}) => {
  return (
    <Card id="query-summary">
      <MetricsQuerySummaryContent
        className="summary-container"
        direction="row"
        metrics={metrics}
        numQueries={stats?.numQueries}
        dataSources={stats?.dataSources}
        loading={loading}
        lastRefresh={lastRefresh}
        lastDuration={lastDuration}
        warning={warning}
        isShowQuerySummary={isShowQuerySummary}
        toggleQuerySummary={toggleQuerySummary}
        isDark={isDark}
      />
    </Card>
  );
};

export default MetricsQuerySummary;
