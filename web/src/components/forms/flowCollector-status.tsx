import React, { FC } from 'react';

import {
  Alert,
  AlertVariant,
  Button,
  Content,
  Flex,
  FlexItem,
  PageSection,
  Title,
  Tooltip
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { flowCollectorEditPath, flowCollectorNewPath, netflowTrafficPath, useNavigate } from '../../utils/url';
import FlowCollectorStatusIndicator from '../status/flowcollector-status-indicator';
import './forms.css';
import { Pipeline } from './pipeline';
import { ResourceStatus } from './resource-status';
import { Consumer, ResourceWatcher } from './resource-watcher';
import { getFlowCollectorOverallStatus } from './utils';

export type FlowCollectorStatusProps = {};

export const FlowCollectorStatus: FC<FlowCollectorStatusProps> = () => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const navigate = useNavigate();
  const [selectedTypes, setSelectedTypes] = React.useState<string[]>([]);

  return (
    <ResourceWatcher
      group="flows.netobserv.io"
      version="v1beta2"
      kind="FlowCollector"
      name="cluster"
      skipErrors
      defaultFrom="None"
    >
      <Consumer>
        {ctx => {
          const { status } = getFlowCollectorOverallStatus(ctx.data, ctx.loadError);
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
                  <FlexItem>
                    <FlowCollectorStatusIndicator handleClick={false} />
                  </FlexItem>
                </Flex>
              </div>
              {ctx.data && (
                <Flex className="status-container" direction={{ default: 'column' }}>
                  {configIssue && (
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
                    {status === 'onHold' ? (
                      <Alert variant={AlertVariant.info} isInline title={t('Network Observability is on hold')}>
                        {t(
                          // eslint-disable-next-line max-len
                          'Execution mode is set to OnHold. All operator-managed workloads have been deleted, while preserving other resources. To change execution mode, update or remove "spec.execution.mode" in the FlowCollector resource.'
                        )}
                      </Alert>
                    ) : (
                      <Pipeline existing={ctx.data} selectedTypes={selectedTypes} setSelectedTypes={setSelectedTypes} />
                    )}
                  </FlexItem>
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
                  <FlexItem>
                    <Flex>
                      <FlexItem>
                        <Button
                          id="edit-flow-collector"
                          data-test-id="edit-flow-collector"
                          variant="primary"
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
                    </Flex>
                  </FlexItem>
                </Flex>
              )}
              {ctx.loadError && (
                <Flex direction={{ default: 'column' }}>
                  <FlexItem>
                    <Content>
                      {t('An error occured while retreiving FlowCollector: {{error}}', { error: ctx.loadError })}
                    </Content>
                  </FlexItem>
                  <FlexItem alignSelf={{ default: 'alignSelfCenter' }}>
                    <Button
                      id="create-flow-collector"
                      data-test-id="create-flow-collector"
                      onClick={() => navigate(flowCollectorNewPath)}
                    >
                      {t('Create FlowCollector')}
                    </Button>
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
