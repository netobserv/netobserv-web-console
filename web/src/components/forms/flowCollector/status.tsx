import React, { FC } from 'react';

import {
  Alert,
  AlertVariant,
  Bullseye,
  Button,
  Content,
  Flex,
  FlexItem,
  PageSection,
  Spinner,
  Title,
  Tooltip
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { flowCollectorEditPath, flowCollectorSetupPath, netflowTrafficPath, useNavigate } from '../../../utils/url';
import FlowCollectorStatusIndicator from '../../status/flowcollector-status-indicator';
import '../forms.css';
import { Pipeline } from '../pipeline';
import { ResourceDeleteModal } from '../resource-delete-modal';
import { ResourceStatus } from '../resource-status';
import { Consumer, ResourceWatcher } from '../resource-watcher';
import { getFlowCollectorOverallStatus, isK8sNotFoundError, k8sErrorMessage } from '../utils';

export type FlowCollectorStatusProps = {};

export const FlowCollectorStatus: FC<FlowCollectorStatusProps> = () => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const navigate = useNavigate();
  const [selectedTypes, setSelectedTypes] = React.useState<string[]>([]);
  const [isDeleteModalOpen, setDeleteModalOpen] = React.useState(false);

  return (
    <ResourceWatcher
      group="flows.netobserv.io"
      version="v1beta2"
      kind="FlowCollector"
      name="cluster"
      skipErrors
      skipCRLoading
      defaultFrom="None"
      onSuccess={() => setDeleteModalOpen(false)}
    >
      <Consumer>
        {ctx => {
          const flowCollectorExists = ctx.isUpdate;
          const flowCollectorPending = !ctx.crResolved;
          const flowCollectorMissing = ctx.crResolved && !flowCollectorExists;
          const hasLoadError = Boolean(ctx.loadError && !isK8sNotFoundError(ctx.loadError));
          const { status, message } = flowCollectorExists
            ? getFlowCollectorOverallStatus(ctx.data, ctx.loadError)
            : hasLoadError
            ? { status: 'error' as const }
            : { status: 'pending' as const };
          const isDeleting = status === 'deleting';
          const showTrafficButton = status === 'ready' || status === 'degraded';
          const configIssue = (
            (ctx.data?.status?.conditions as Array<{
              type: string;
              status: string;
              reason?: string;
              message?: string;
            }>) || []
          ).find(c => c.type === 'ConfigurationIssue' && c.status === 'True');

          return (
            <PageSection hasBodyWrapper={false} id="pageSection">
              <div id="pageHeader">
                <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
                  <FlexItem>
                    <Title headingLevel="h1" size="2xl">
                      {t('Network Observability FlowCollector status')}
                    </Title>
                  </FlexItem>
                  {flowCollectorExists && (
                    <FlexItem>
                      <FlowCollectorStatusIndicator
                        handleClick={false}
                        overallStatus={status}
                        overallMessage={message}
                      />
                    </FlexItem>
                  )}
                </Flex>
              </div>
              {flowCollectorPending && (
                <Bullseye>
                  <Spinner size="xl" />
                </Bullseye>
              )}
              {flowCollectorExists && (
                <Flex className="status-container" direction={{ default: 'column' }}>
                  {ctx.errors.length > 0 && (
                    <FlexItem>
                      <Alert variant={AlertVariant.danger} isInline title={t('Error')}>
                        {ctx.errors.join('; ')}
                      </Alert>
                    </FlexItem>
                  )}
                  {isDeleting && (
                    <FlexItem>
                      <Alert variant={AlertVariant.info} isInline title={t('FlowCollector is being deleted')}>
                        {t(
                          // eslint-disable-next-line max-len
                          'The FlowCollector resource has been marked for deletion. Remaining operator-managed workloads are being cleaned up.'
                        )}
                      </Alert>
                    </FlexItem>
                  )}
                  {configIssue && !isDeleting && (
                    <FlexItem>
                      <Alert
                        variant={configIssue.reason === 'Error' ? AlertVariant.danger : AlertVariant.warning}
                        isInline
                        title={configIssue.reason === 'Error' ? t('Configuration error') : t('Configuration warnings')}
                      >
                        {configIssue.message}
                      </Alert>
                    </FlexItem>
                  )}
                  <FlexItem flex={{ default: 'flex_1' }}>
                    {!isDeleting &&
                      (status === 'onHold' ? (
                        <Alert variant={AlertVariant.info} isInline title={t('Network Observability is on hold')}>
                          {t(
                            // eslint-disable-next-line max-len
                            'Execution mode is set to OnHold. All operator-managed workloads have been deleted, while preserving other resources. To change execution mode, update or remove "spec.execution.mode" in the FlowCollector resource.'
                          )}
                        </Alert>
                      ) : (
                        <Pipeline
                          existing={ctx.data}
                          selectedTypes={selectedTypes}
                          setSelectedTypes={setSelectedTypes}
                        />
                      ))}
                  </FlexItem>
                  {!isDeleting && (
                    <FlexItem className="status-list-container" flex={{ default: 'flex_1' }}>
                      <ResourceStatus
                        group={ctx.group}
                        version={ctx.version}
                        kind={ctx.kind}
                        existing={ctx.data}
                        selectedTypes={selectedTypes}
                        setSelectedTypes={setSelectedTypes}
                      />
                    </FlexItem>
                  )}
                  <FlexItem>
                    <Flex>
                      <FlexItem>
                        <Button
                          id="edit-flow-collector"
                          data-test-id="edit-flow-collector"
                          variant="primary"
                          isDisabled={isDeleting}
                          onClick={() => navigate(flowCollectorEditPath)}
                        >
                          {t('Edit FlowCollector')}
                        </Button>
                      </FlexItem>
                      <FlexItem>
                        <Tooltip
                          content={t('FlowCollector must be ready to open Network Traffic')}
                          trigger={showTrafficButton ? 'manual' : 'mouseenter focus'}
                        >
                          <Button
                            id="open-network-traffic"
                            data-test-id="open-network-traffic"
                            variant="link"
                            isAriaDisabled={!showTrafficButton}
                            onClick={() => showTrafficButton && navigate(netflowTrafficPath)}
                          >
                            {t('Open Network Traffic page')}
                          </Button>
                        </Tooltip>
                      </FlexItem>
                      <FlexItem>
                        <Button
                          id="delete-flow-collector"
                          data-test-id="delete-flow-collector"
                          variant="danger"
                          isDisabled={isDeleting}
                          onClick={() => setDeleteModalOpen(true)}
                        >
                          {t('Delete FlowCollector')}
                        </Button>
                      </FlexItem>
                    </Flex>
                  </FlexItem>
                  {isDeleteModalOpen && (
                    <ResourceDeleteModal
                      data={ctx.data}
                      kind={ctx.kind}
                      onDelete={() => ctx.onSubmit(ctx.data, true)}
                      onCancel={() => setDeleteModalOpen(false)}
                    />
                  )}
                </Flex>
              )}
              {flowCollectorMissing && (
                <Flex className="status-container" direction={{ default: 'column' }}>
                  <FlexItem>
                    <Content>
                      {hasLoadError
                        ? t('An error occurred while retrieving FlowCollector: {{error}}', {
                            error: k8sErrorMessage(ctx.loadError)
                          })
                        : t('No FlowCollector resource was found. Create one to enable network flow collection.')}
                    </Content>
                  </FlexItem>
                  <FlexItem>
                    <Flex>
                      <FlexItem>
                        <Button
                          id="create-flow-collector"
                          data-test-id="create-flow-collector"
                          variant="primary"
                          onClick={() => navigate(flowCollectorSetupPath)}
                        >
                          {t('Create FlowCollector')}
                        </Button>
                      </FlexItem>
                    </Flex>
                  </FlexItem>
                </Flex>
              )}
            </PageSection>
          );
        }}
      </Consumer>
    </ResourceWatcher>
  );
};

export default FlowCollectorStatus;
