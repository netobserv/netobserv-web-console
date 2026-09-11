import { K8sResourceKind, useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { Button, Spinner, Tooltip } from '@patternfly/react-core';
import {
  ConnectedIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  PauseCircleIcon
} from '@patternfly/react-icons';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { flowCollectorPath, useNavigate } from '../../utils/url';
import { FlowCollectorOverallStatus, getFlowCollectorOverallStatus } from '../forms/utils';

export const FlowCollectorStatusIndicator: React.FC<{
  handleClick?: boolean;
  /** When set (e.g. from status page context), skip the independent watch. */
  overallStatus?: FlowCollectorOverallStatus;
  overallMessage?: string;
}> = ({ handleClick, overallStatus, overallMessage }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const navigate = useNavigate();

  const [fc, , loadError] = useK8sWatchResource<K8sResourceKind>(
    overallStatus
      ? null
      : {
          groupVersionKind: {
            group: 'flows.netobserv.io',
            version: 'v1beta2',
            kind: 'FlowCollector'
          },
          name: 'cluster',
          isList: false
        }
  );

  const watched = getFlowCollectorOverallStatus(fc, loadError);
  const status = overallStatus ?? watched.status;
  const message = overallStatus ? overallMessage : watched.message;
  const appendMsg = message ? ': ' + message : '';

  const tooltipContent = React.useMemo(() => {
    switch (status) {
      case 'ready':
        return t('FlowCollector is ready');
      case 'degraded':
        return t('FlowCollector is degraded') + appendMsg;
      case 'pending':
        return t('FlowCollector is pending');
      case 'error':
        return t('FlowCollector has errors') + appendMsg;
      case 'onHold':
        return t('FlowCollector is on hold');
      case 'deleting':
        return t('FlowCollector is being deleted');
      case 'loading':
        return t('Loading FlowCollector status...');
    }
  }, [status, appendMsg, t]);

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
      case 'deleting':
      case 'loading':
        return <Spinner size="md" />;
    }
  }, [status]);

  const statusPath = flowCollectorPath('status');

  return (
    <Tooltip id="flowcollector-status-tooltip" content={tooltipContent} position="bottom">
      <Button
        id="flowcollector-status-indicator"
        variant="plain"
        aria-label={t('FlowCollector status')}
        onClick={statusPath && handleClick !== false ? () => navigate(statusPath) : undefined}
        style={statusPath && handleClick !== false ? undefined : { cursor: 'default' }}
      >
        <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}>{icon}</span>
      </Button>
    </Tooltip>
  );
};

export default FlowCollectorStatusIndicator;
