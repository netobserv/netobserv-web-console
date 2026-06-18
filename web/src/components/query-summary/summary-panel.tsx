import {
  Divider,
  DrawerActions,
  DrawerCloseButton,
  DrawerHead,
  DrawerPanelBody,
  DrawerPanelContent,
  Text,
  TextVariants
} from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Record } from '../../api/ipfix';
import { NetflowMetrics, Stats } from '../../api/query-response';
import { RecordType } from '../../model/flow-query';
import { Warning } from '../../model/warnings';
import { TimeRange } from '../../utils/datetime';
import { defaultSize, maxSize, minSize } from '../../utils/panel';
import { SummaryPanelContent } from './summary-panel-content';
import './summary-panel.css';

export interface SummaryPanelProps {
  onClose: () => void;
  flows?: Record[];
  metrics: NetflowMetrics;
  type: RecordType;
  stats?: Stats;
  maxChunkAge?: number;
  limit: number;
  range: number | TimeRange;
  lastRefresh?: Date;
  lastDuration?: number;
  warning?: Warning;
  showDNSLatency?: boolean;
  showRTTLatency?: boolean;
  id?: string;
}

export const SummaryPanel: React.FC<SummaryPanelProps> = ({
  flows,
  metrics,
  type,
  maxChunkAge,
  stats,
  limit,
  range,
  lastRefresh,
  lastDuration,
  warning,
  showDNSLatency,
  showRTTLatency,
  id,
  onClose
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');

  return (
    <DrawerPanelContent
      data-test-id={id}
      id={id}
      className="drawer-panel-content"
      isResizable
      defaultSize={defaultSize}
      minSize={minSize}
      maxSize={maxSize}
    >
      <DrawerHead id={`${id}-drawer-head`} data-test-id="drawer-head" className="drawer-head">
        <Text data-test-id="drawer-head-text" component={TextVariants.h2}>
          {t('Query summary')}
        </Text>
        <DrawerActions>
          <DrawerCloseButton id={`${id ? id : 'summary-panel'}-close-button`} onClick={onClose} />
        </DrawerActions>
      </DrawerHead>
      <Divider />
      <DrawerPanelBody id={`${id}-drawer-body`} className="drawer-body scrollable" data-test-id="drawer-body">
        <SummaryPanelContent
          flows={flows}
          metrics={metrics}
          type={type}
          maxChunkAge={maxChunkAge}
          stats={stats}
          limit={limit}
          range={range}
          lastRefresh={lastRefresh}
          lastDuration={lastDuration}
          warning={warning}
          showDNSLatency={showDNSLatency}
          showRTTLatency={showRTTLatency}
        />
      </DrawerPanelBody>
    </DrawerPanelContent>
  );
};

export default SummaryPanel;
