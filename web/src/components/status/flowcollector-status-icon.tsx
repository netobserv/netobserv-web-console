import { Spinner } from '@patternfly/react-core';
import {
  ConnectedIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  PauseCircleIcon
} from '@patternfly/react-icons';
import * as React from 'react';
import { FlowCollectorOverallStatus } from '../forms/utils';

export interface FlowCollectorStatusIconProps {
  status: FlowCollectorOverallStatus;
}

export const FlowCollectorStatusIcon: React.FC<FlowCollectorStatusIconProps> = ({ status }) => {
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

  return <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}>{icon}</span>;
};

export default FlowCollectorStatusIcon;
