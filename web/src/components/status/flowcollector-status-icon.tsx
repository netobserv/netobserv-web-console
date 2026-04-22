import { Spinner, Tooltip } from '@patternfly/react-core';
import {
  ConnectedIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  PauseCircleIcon
} from '@patternfly/react-icons';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { FlowCollectorOverallStatus } from '../forms/utils';

export interface FlowCollectorStatusIconProps {
  status: FlowCollectorOverallStatus;
}

export const FlowCollectorStatusIcon: React.FC<FlowCollectorStatusIconProps> = ({ status }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');

  const tooltipContent = React.useMemo(() => {
    switch (status) {
      case 'ready':
        return t('FlowCollector is ready');
      case 'degraded':
        return t('FlowCollector is degraded');
      case 'pending':
        return t('FlowCollector is pending');
      case 'error':
        return t('FlowCollector has errors');
      case 'onHold':
        return t('FlowCollector is on hold');
      case 'loading':
        return t('Loading FlowCollector status...');
    }
  }, [status, t]);

  const icon = React.useMemo(() => {
    switch (status) {
      case 'ready':
        return <ConnectedIcon color="var(--pf-t--global--icon--color--status--success--default)" />;
      case 'degraded':
        return <ExclamationTriangleIcon color="var(--pf-t--global--icon--color--status--warning--default)" />;
      case 'pending':
        return <ExclamationTriangleIcon color="var(--pf-t--global--icon--color--status--warning--default)" />;
      case 'error':
        return <ExclamationCircleIcon color="var(--pf-t--global--icon--color--status--danger--default)" />;
      case 'onHold':
        return <PauseCircleIcon color="var(--pf-t--global--icon--color--status--info--default)" />;
      case 'loading':
        return <Spinner size="md" />;
    }
  }, [status]);

  return (
    <Tooltip content={tooltipContent} position="bottom">
      <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}>{icon}</span>
    </Tooltip>
  );
};

export default FlowCollectorStatusIcon;
