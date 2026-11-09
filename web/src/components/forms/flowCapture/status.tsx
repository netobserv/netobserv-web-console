import { k8sDelete, K8sResourceKind, useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  AlertVariant,
  Badge,
  Bullseye,
  Button,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Flex,
  FlexItem,
  PageSection,
  Progress,
  Spinner,
  Title
} from '@patternfly/react-core';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { getFlowCaptureOutputURL } from '../../../api/routes';
import { useK8sModel } from '../../../utils/k8s-models-hook';
import { useFillViewportBelow } from '../../../utils/use-fill-viewport-below';
import { flowCaptureEditPath, flowCaptureListPath, flowCaptureYamlPath, useNavigate, useParams } from '../../../utils/url';
import { ComponentStatus, Pipeline } from '../pipeline';
import { ResourceDeleteModal } from '../resource-delete-modal';
import { ResourceStatus } from '../resource-status';
import { isK8sNotFoundError } from '../utils';

const phaseState = (phase: string): ComponentStatus['state'] => {
  switch (phase) {
    case 'Completed':
      return 'Ready';
    case 'Failed':
      return 'Failure';
    case 'Running':
      return 'InProgress';
    default:
      return 'InProgress';
  }
};

type ContainerState = { message?: string; reason?: string };
type ContainerStatus = { state?: { waiting?: ContainerState; terminated?: ContainerState } };

const agentStatus = (
  daemonSet: K8sResourceKind | undefined,
  phase: string,
  replicaDetails?: string
): ComponentStatus => {
  const desiredReplicas = Number(daemonSet?.status?.desiredNumberScheduled || 0);
  const readyReplicas = Number(daemonSet?.status?.numberReady || 0);
  const hasReplicaStatus = daemonSet?.status != null;
  let state = phaseState(phase);
  if (phase !== 'Completed' && phase !== 'Failed') {
    state = desiredReplicas > 0 && readyReplicas >= desiredReplicas ? 'Ready' : 'InProgress';
    if (Number(daemonSet?.status?.numberUnavailable || 0) > 0) state = 'Degraded';
  }
  return {
    state,
    desiredReplicas: hasReplicaStatus ? desiredReplicas : undefined,
    readyReplicas: hasReplicaStatus ? readyReplicas : undefined,
    message: daemonSet?.status?.conditions?.at(-1)?.message || replicaDetails
  };
};

const collectorStatus = (pod: K8sResourceKind | undefined, phase: string): ComponentStatus => {
  const podPhase = pod?.status?.phase;
  const ready = pod?.status?.conditions?.some(
    (condition: { type?: string; status?: string }) => condition.type === 'Ready' && condition.status === 'True'
  );
  const containerIssue = pod?.status?.containerStatuses
    ?.map((container: ContainerStatus) => container.state?.waiting || container.state?.terminated)
    ?.find((state: ContainerState | undefined): state is ContainerState => Boolean(state));
  return {
    state:
      podPhase === 'Failed' ? 'Failure' : podPhase === 'Running' || phase === 'Completed' ? 'Ready' : phaseState(phase),
    desiredReplicas: 1,
    readyReplicas: ready ? 1 : 0,
    message: pod?.status?.message || containerIssue?.message || containerIssue?.reason || podPhase
  };
};

export const FlowCaptureStatus: React.FC = () => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const pageFillRef = useFillViewportBelow(true);
  const navigate = useNavigate();
  const { name, namespace = 'default' } = useParams<{ name?: string; namespace?: string }>();
  const model = useK8sModel('flows.netobserv.io', 'v1alpha1', 'FlowCapture');
  const [capture, loaded, error] = useK8sWatchResource<K8sResourceKind>(
    name && model
      ? {
          groupVersionKind: { group: 'flows.netobserv.io', version: 'v1alpha1', kind: 'FlowCapture' },
          kind: 'FlowCapture',
          name,
          namespace,
          isList: false
        }
      : null
  );
  const [collectorPod, , collectorError] = useK8sWatchResource<K8sResourceKind>(
    name
      ? {
          groupVersionKind: { group: '', version: 'v1', kind: 'Pod' },
          kind: 'Pod',
          name: `${name}-collector`,
          namespace,
          isList: false
        }
      : null
  );
  const [isDeleteModalOpen, setDeleteModalOpen] = React.useState(false);
  const [selectedCollectorTypes, setSelectedCollectorTypes] = React.useState<string[]>([]);
  const [agentResources, , agentError] = useK8sWatchResource<K8sResourceKind[]>(
    name
      ? {
          groupVersionKind: { group: 'apps', version: 'v1', kind: 'DaemonSet' },
          kind: 'DaemonSet',
          isList: true,
          selector: {
            matchLabels: {
              'flows.netobserv.io/flowcapture-name': name,
              'flows.netobserv.io/flowcapture-namespace': namespace
            }
          }
        }
      : null
  );
  const agent = agentResources?.[0];
  const phase = capture?.status?.phase || 'Pending';
  const captureStatusResource = React.useMemo(() => {
    if (!capture) return null;
    const components: { agent: ComponentStatus; processor?: ComponentStatus } = {
      agent: agentStatus(
        agent,
        phase,
        agent?.status
          ? t('{{ready}}/{{desired}} replicas ready', {
              ready: Number(agent.status.numberReady || 0),
              desired: Number(agent.status.desiredNumberScheduled || 0)
            })
          : undefined
      )
    };
    components.processor = collectorStatus(collectorPod, phase);
    return {
      ...capture,
      status: {
        ...capture.status,
        components
      }
    };
  }, [agent, capture, collectorPod, phase, t]);
  const collectorLoadError = collectorError && !isK8sNotFoundError(collectorError) ? collectorError : undefined;
  const agentLoadError = agentError && !isK8sNotFoundError(agentError) ? agentError : undefined;
  if (!loaded)
    return (
      <Bullseye>
        <Spinner size="xl" />
      </Bullseye>
    );
  if (error || !capture)
    return (
      <PageSection>
        <Title headingLevel="h1">{t('FlowCapture')}</Title>
        <p>{String(error || t('Capture not found'))}</p>
      </PageSection>
    );
  const variant = phase === 'Completed' ? 'success' : phase === 'Failed' ? 'danger' : undefined;
  const progress = phase === 'Completed' || phase === 'Failed' ? 100 : phase === 'Running' ? 50 : 10;
  const hasDownloadableOutput = capture.spec?.outputType === 'flows' || capture.spec?.outputType === 'packets';
  const canDownloadOutput =
    hasDownloadableOutput && (phase === 'Running' || phase === 'Completed' || phase === 'Failed');
  const isPartialOutput = phase === 'Running';
  return (
    <PageSection ref={pageFillRef} hasBodyWrapper={false} id="pageSection" className="flowcapture-status-page">
      <div id="pageHeader">
        <div className="flowcapture-detail-breadcrumb">
          <Button variant="link" isInline onClick={() => navigate(flowCaptureListPath(namespace))}>
            {t('FlowCaptures')}
          </Button>
          <span aria-hidden="true"> / </span>
          <span>{capture.metadata?.name}</span>
        </div>
        <Title headingLevel="h1" size="2xl">
          {capture.metadata?.name}
        </Title>
      </div>
      <Flex className="status-container" direction={{ default: 'column' }}>
        <FlexItem className="flowcapture-progress-section">
          <Title headingLevel="h3" size="md">
            {t('Capture progress')} <Badge isRead>{phase}</Badge>
          </Title>
          {capture.status?.reason === 'CaptureConflict' && (
            <Alert variant={AlertVariant.warning} isInline title={t('Maximum concurrent captures reached')}>
              {capture.status.message || t('Another FlowCapture is still active. It must finish before this capture can start.')}
            </Alert>
          )}
          {isPartialOutput && hasDownloadableOutput && (
            <Alert variant={AlertVariant.info} isInline title={t('Partial output')}>
              {t('The download contains output collected so far and may be incomplete while the capture is running.')}
            </Alert>
          )}
          <Progress value={progress} label={phase} variant={variant} />
          <DescriptionList isHorizontal>
            <DescriptionListGroup>
              <DescriptionListTerm>{t('Output type')}</DescriptionListTerm>
              <DescriptionListDescription>
                <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
                  <FlexItem>{capture.spec?.outputType}</FlexItem>
                  {hasDownloadableOutput && (
                    <FlexItem>
                      <Button
                        component="a"
                        size="sm"
                        variant="secondary"
                        href={canDownloadOutput ? getFlowCaptureOutputURL(namespace, name!) : undefined}
                        download={canDownloadOutput ? true : undefined}
                        isDisabled={!canDownloadOutput}
                      >
                        {t('Download output')}
                      </Button>
                    </FlexItem>
                  )}
                </Flex>
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>{t('Message')}</DescriptionListTerm>
              <DescriptionListDescription>{capture.status?.message || '-'}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>{t('Completion time')}</DescriptionListTerm>
              <DescriptionListDescription>{capture.status?.completionTime || '-'}</DescriptionListDescription>
            </DescriptionListGroup>
          </DescriptionList>
        </FlexItem>
        <FlexItem flex={{ default: 'flex_1' }} className="flowcapture-pipeline-container">
          {collectorLoadError || agentLoadError ? (
            <Alert variant={AlertVariant.warning} isInline title={t('Capture component status unavailable')}>
              {String(collectorLoadError || agentLoadError)}
            </Alert>
          ) : captureStatusResource ? (
            <div className="flowcapture-collector-pipeline">
              <Pipeline
                existing={captureStatusResource}
                selectedTypes={selectedCollectorTypes}
                setSelectedTypes={setSelectedCollectorTypes}
                flowCapture
              />
            </div>
          ) : null}
        </FlexItem>
        {captureStatusResource && (
          <FlexItem
            flex={{ default: 'flex_1' }}
            className="flowcapture-component-status-container status-list-container"
          >
            <ResourceStatus
              group="flows.netobserv.io"
              version="v1alpha1"
              kind="FlowCapture"
              existing={captureStatusResource}
              selectedTypes={selectedCollectorTypes}
              setSelectedTypes={setSelectedCollectorTypes}
              componentLabels={{ agent: t('Agents'), processor: t('Collector') }}
            />
          </FlexItem>
        )}
        <FlexItem className="flowcapture-detail-actions-container">
          <Flex className="flowcapture-detail-actions" spaceItems={{ default: 'spaceItemsSm' }}>
            <FlexItem>
              <Button variant="primary" onClick={() => navigate(flowCaptureEditPath(name!, namespace))}>
                {t('Edit FlowCapture')}
              </Button>
            </FlexItem>
            <FlexItem>
              <Button variant="secondary" onClick={() => navigate(flowCaptureYamlPath(name!, namespace))}>
                {t('YAML view')}
              </Button>
            </FlexItem>
            <FlexItem>
              <Button variant="danger" onClick={() => setDeleteModalOpen(true)}>
                {t('Delete FlowCapture')}
              </Button>
            </FlexItem>
          </Flex>
        </FlexItem>
      </Flex>
      {isDeleteModalOpen && (
        <ResourceDeleteModal
          data={capture}
          kind="FlowCapture"
          onDelete={() => {
            if (!model || !name) return;
            k8sDelete({
              model,
              resource: {
                apiVersion: 'flows.netobserv.io/v1alpha1',
                kind: 'FlowCapture',
                metadata: { name, namespace }
              }
            })
              .then(() => navigate(-1))
              .catch(() => setDeleteModalOpen(false));
          }}
          onCancel={() => setDeleteModalOpen(false)}
        />
      )}
    </PageSection>
  );
};
export default FlowCaptureStatus;
