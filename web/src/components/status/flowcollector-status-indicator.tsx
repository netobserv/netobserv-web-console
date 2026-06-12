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
import { flowCollectorStatusPath, useNavigate } from '../../utils/url';
import { getFlowCollectorOverallStatus } from '../forms/utils';

export const FlowCollectorStatusIndicator: React.FC<{ handleClick?: boolean }> = ({ handleClick }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const navigate = useNavigate();

  const [fc, , loadError] = useK8sWatchResource<K8sResourceKind>({
    groupVersionKind: {
      group: 'flows.netobserv.io',
      version: 'v1beta2',
      kind: 'FlowCollector'
    },
    name: 'cluster',
    isList: false
  });

  const { status, message } = getFlowCollectorOverallStatus(fc, loadError);
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
      case 'loading':
        return <Spinner size="md" />;
    }
  }, [status]);

  return (
    <Tooltip id="flowcollector-status-tooltip" content={tooltipContent} position="bottom">
      <Button
        id="flowcollector-status-indicator"
        variant="plain"
        aria-label={t('FlowCollector status')}
        onClick={handleClick !== false ? () => navigate(flowCollectorStatusPath) : undefined}
        style={handleClick === false ? { cursor: 'default' } : undefined}
      >
        <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}>{icon}</span>
      </Button>
    </Tooltip>
  );
};

export default FlowCollectorStatusIndicator;
