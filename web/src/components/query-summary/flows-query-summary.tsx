import { Card } from '@patternfly/react-core';
import _ from 'lodash';
import * as React from 'react';
import { Record } from '../../api/ipfix';
import { Stats } from '../../api/query-response';
import { RecordType } from '../../model/flow-query';
import { Warning } from '../../model/warnings';
import { TimeRange } from '../../utils/datetime';
import { FlowsQuerySummaryContent } from './flows-query-summary-content';
import './query-summary.css';

export interface FlowQuerySummaryProps {
  flows: Record[];
  stats?: Stats;
  type: RecordType;
  range: number | TimeRange;
  loading?: boolean;
  lastRefresh?: Date;
  lastDuration?: number;
  warning?: Warning;
  isShowQuerySummary?: boolean;
  toggleQuerySummary?: () => void;
}

export const FlowsQuerySummary: React.FC<FlowQuerySummaryProps> = ({
  flows,
  stats,
  type,
  range,
  loading,
  lastRefresh,
  lastDuration,
  warning,
  isShowQuerySummary,
  toggleQuerySummary
}) => {
  if (!_.isEmpty(flows) && stats) {
    return (
      <Card id="query-summary">
        <FlowsQuerySummaryContent
          className="summary-container"
          direction="row"
          flows={flows}
          type={type}
          numQueries={stats.numQueries}
          limitReached={stats.limitReached}
          range={range}
          loading={loading}
          lastRefresh={lastRefresh}
          lastDuration={lastDuration}
          warning={warning}
          isShowQuerySummary={isShowQuerySummary}
          toggleQuerySummary={toggleQuerySummary}
        />
      </Card>
    );
  }
  return <></>;
};

export default FlowsQuerySummary;
