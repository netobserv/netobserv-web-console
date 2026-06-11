import { K8sResourceKind, useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { Button, Tooltip } from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { flowCollectorStatusPath, useNavigate } from '../../utils/url';
import { getFlowCollectorOverallStatus } from '../forms/utils';
import { FlowCollectorStatusIcon } from './flowcollector-status-icon';

export const FlowCollectorStatusIndicator: React.FC = () => {
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

  return (
    <Tooltip id="flowcollector-status-tooltip" content={tooltipContent} position="bottom">
      <Button
        id="flowcollector-status-indicator"
        variant="plain"
        aria-label={t('FlowCollector status')}
        onClick={() => navigate(flowCollectorStatusPath)}
      >
        <FlowCollectorStatusIcon status={status} />
      </Button>
    </Tooltip>
  );
};

export default FlowCollectorStatusIndicator;
