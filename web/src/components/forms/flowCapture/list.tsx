import { k8sDelete, K8sResourceKind, useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import {
  Button,
  Dropdown,
  DropdownItem,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Flex,
  FlexItem,
  Label,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Modal,
  ModalVariant,
  MenuToggle,
  MenuToggleElement,
  PageSection,
  Progress,
  Spinner,
  Tooltip
} from '@patternfly/react-core';
import { EllipsisVIcon } from '@patternfly/react-icons';
import { Table, TableVariant, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { flowCaptureEditPath, flowCaptureNewPath, flowCapturePath, useNavigate, useParams } from '../../../utils/url';
import { ContextSingleton } from '../../../utils/context';
import { useK8sModel } from '../../../utils/k8s-models-hook';
import '../forms.css';
import { FlowCaptureResource } from './types';

type CapturePhase = 'Pending' | 'Running' | 'Completed' | 'Failed';

const phaseColor = (phase: string): 'blue' | 'green' | 'red' | 'orange' | 'grey' => {
  switch (phase) {
    case 'Completed':
      return 'green';
    case 'Failed':
      return 'red';
    case 'Running':
      return 'blue';
    case 'Pending':
      return 'orange';
    default:
      return 'grey';
  }
};

const progressValue = (phase: string): number => {
  switch (phase) {
    case 'Completed':
    case 'Failed':
      return 100;
    case 'Running':
      return 50;
    default:
      return 10;
  }
};

const resourceKey = (namespace: string, name: string) => `${namespace}/${name}`;

const replicaCount = (daemonSet: K8sResourceKind | undefined): string => {
  if (!daemonSet?.status) return '-';
  return `${Number(daemonSet.status.numberReady || 0)}/${Number(daemonSet.status.desiredNumberScheduled || 0)}`;
};

const collectorState = (pod: K8sResourceKind | undefined): string => {
  if (!pod) return '-';
  if (pod.status?.phase === 'Running') return 'Running';
  return pod.status?.phase || 'Pending';
};

export const FlowCaptureList: React.FC = () => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const navigate = useNavigate();
  const { namespace: routeNamespace } = useParams<{ namespace?: string }>();
  // An absent namespace is intentional for the OpenShift all-namespaces route.
  // Standalone has no namespace selector, so keep its existing default namespace behavior.
  const namespace = routeNamespace || (ContextSingleton.isStandalone() ? 'default' : undefined);
  const model = useK8sModel('flows.netobserv.io', 'v1alpha1', 'FlowCapture');
  const [phaseFilter, setPhaseFilter] = React.useState<'All' | CapturePhase>('All');
  const [outputFilter, setOutputFilter] = React.useState<'All' | 'flows' | 'packets' | 'metrics'>('All');
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<FlowCaptureResource>();
  const [openActionMenu, setOpenActionMenu] = React.useState<string>();
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string>();

  const [captures, loaded, error] = useK8sWatchResource<FlowCaptureResource[]>({
    groupVersionKind: { group: 'flows.netobserv.io', version: 'v1alpha1', kind: 'FlowCapture' },
    kind: 'FlowCapture',
    namespace,
    isList: true
  });
  const [daemonSets] = useK8sWatchResource<K8sResourceKind[]>({
    groupVersionKind: { group: 'apps', version: 'v1', kind: 'DaemonSet' },
    kind: 'DaemonSet',
    isList: true,
    selector: { matchLabels: { component: 'agent' } }
  });
  const [collectorPods] = useK8sWatchResource<K8sResourceKind[]>({
    groupVersionKind: { group: '', version: 'v1', kind: 'Pod' },
    kind: 'Pod',
    isList: true,
    selector: { matchLabels: { component: 'collector' } }
  });

  const agentByCapture = React.useMemo(() => {
    const map = new Map<string, K8sResourceKind>();
    (daemonSets || [])
      .filter(ds => ds.metadata?.labels?.['flows.netobserv.io/flowcapture-name'])
      .forEach(ds => {
        const labels = ds.metadata?.labels || {};
        const key = resourceKey(
          String(labels['flows.netobserv.io/flowcapture-namespace'] || ''),
          String(labels['flows.netobserv.io/flowcapture-name'])
        );
        map.set(key, ds);
      });
    return map;
  }, [daemonSets]);

  const collectorByCapture = React.useMemo(() => {
    const map = new Map<string, K8sResourceKind>();
    (collectorPods || [])
      .filter(pod => pod.metadata?.labels?.['flows.netobserv.io/flowcapture-name'])
      .forEach(pod => {
        const labels = pod.metadata?.labels || {};
        const key = resourceKey(
          String(labels['flows.netobserv.io/flowcapture-namespace'] || ''),
          String(labels['flows.netobserv.io/flowcapture-name'])
        );
        map.set(key, pod);
      });
    return map;
  }, [collectorPods]);

  const allCaptures = captures || [];
  const completedCaptures = allCaptures.filter(c => ['Completed', 'Failed'].includes(String(c.status?.phase)));
  const activeCaptures = allCaptures.filter(c => ['Pending', 'Running'].includes(String(c.status?.phase)));
  const filteredCaptures = allCaptures.filter(c => {
    const matchesPhase = phaseFilter === 'All' || c.status?.phase === phaseFilter;
    const matchesOutput = outputFilter === 'All' || c.spec?.outputType === outputFilter;
    return matchesPhase && matchesOutput;
  });

  const deleteCompleted = async () => {
    if (!model) return;
    setDeleting(true);
    setDeleteError(undefined);
    try {
      const targets = deleteTarget ? [deleteTarget] : completedCaptures;
      await Promise.all(
        targets.map(c =>
          k8sDelete({
            model,
            resource: {
              apiVersion: 'flows.netobserv.io/v1alpha1',
              kind: 'FlowCapture',
              metadata: { name: c.metadata?.name, namespace: c.metadata?.namespace || namespace || 'default' }
            }
          })
        )
      );
      setDeleteModalOpen(false);
      setDeleteTarget(undefined);
    } catch (deleteErr) {
      setDeleteError(String(deleteErr));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PageSection hasBodyWrapper={false} id="pageSection" className="flowcapture-list-page">
      <div id="pageHeader">
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }}>
          <FlexItem>
            <h1 className="pf-v6-c-title pf-m-2xl">{t('FlowCaptures')}</h1>
          </FlexItem>
          <FlexItem>
            <Flex spaceItems={{ default: 'spaceItemsSm' }}>
              <Button
                variant="danger"
                isDisabled={!completedCaptures.length || deleting}
                onClick={() => {
                  setDeleteTarget(undefined);
                  setDeleteModalOpen(true);
                }}
              >
                {t('Delete completed captures')}
              </Button>
              <Button variant="primary" onClick={() => navigate(flowCaptureNewPath())}>
                {t('Create FlowCapture')}
              </Button>
            </Flex>
          </FlexItem>
        </Flex>
      </div>
      <div className="flowcapture-list-content">
        <Flex className="flowcapture-list-toolbar" spaceItems={{ default: 'spaceItemsMd' }}>
          <FlexItem>
            <strong>{t('Active captures')}:</strong> {activeCaptures.length}
          </FlexItem>
          <FlexItem>
            <strong>{t('Completed captures')}:</strong> {completedCaptures.length}
          </FlexItem>
        </Flex>
        <Flex className="flowcapture-list-filters" spaceItems={{ default: 'spaceItemsSm' }}>
          <FlexItem>
            <strong>{t('Phase')}:</strong>{' '}
            {(['All', 'Pending', 'Running', 'Completed', 'Failed'] as const).map(phase => (
              <Button
                key={phase}
                variant={phaseFilter === phase ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setPhaseFilter(phase)}
              >
                {phase === 'All' ? t('All') : t(phase)}
              </Button>
            ))}
          </FlexItem>
          <FlexItem>
            <strong>{t('Output')}:</strong>{' '}
            {(['All', 'flows', 'packets', 'metrics'] as const).map(output => (
              <Button
                key={output}
                variant={outputFilter === output ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setOutputFilter(output)}
              >
                {output === 'All' ? t('All') : output}
              </Button>
            ))}
          </FlexItem>
        </Flex>
        {error && <p>{String(error)}</p>}
        {!loaded ? (
          <Spinner size="xl" />
        ) : !filteredCaptures.length ? (
          <EmptyState variant={EmptyStateVariant.sm} titleText={t('No FlowCaptures found')}>
            <EmptyStateBody>{t('Create a FlowCapture to start collecting a targeted capture.')}</EmptyStateBody>
          </EmptyState>
        ) : (
          <div className="flowcapture-list-table-container">
            <Table variant={TableVariant.compact} borders>
              <Thead>
                <Tr>
                  <Th>{t('Name')}</Th>
                  <Th>{t('Status')}</Th>
                  <Th>{t('Progress')}</Th>
                  <Th>{t('Output')}</Th>
                  <Th>{t('Agent replicas')}</Th>
                  <Th>{t('Collector')}</Th>
                  <Th>{t('Created')}</Th>
                  <Th>{t('Details')}</Th>
                  <Th>{t('Actions')}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredCaptures.map(capture => {
                  const name = String(capture.metadata?.name || '');
                  const captureNamespace = String(capture.metadata?.namespace || namespace || 'default');
                  const key = resourceKey(captureNamespace, name);
                  const phase = String(capture.status?.phase || 'Pending');
                  const agent = agentByCapture.get(key);
                  const collector = collectorByCapture.get(key);
                  const details = String(capture.status?.message || capture.status?.reason || '-');
                  return (
                    <Tr key={key}>
                      <Td>
                        <Button variant="link" isInline onClick={() => navigate(flowCapturePath(name, captureNamespace))}>
                          {name}
                        </Button>
                      </Td>
                      <Td>
                        <Label color={phaseColor(phase)}>{phase}</Label>
                      </Td>
                      <Td className="flowcapture-progress-cell">
                        <Progress
                          value={progressValue(phase)}
                          variant={phase === 'Completed' ? 'success' : phase === 'Failed' ? 'danger' : undefined}
                        />
                      </Td>
                      <Td>{capture.spec?.outputType || '-'}</Td>
                      <Td>{replicaCount(agent)}</Td>
                      <Td>{collectorState(collector)}</Td>
                      <Td>{capture.metadata?.creationTimestamp || '-'}</Td>
                      <Td className="flowcapture-details-cell">
                        <Tooltip content={details} position="top">
                          <span>{details}</span>
                        </Tooltip>
                      </Td>
                      <Td className="flowcapture-actions-cell">
                        <Dropdown
                          isOpen={openActionMenu === key}
                          onOpenChange={isOpen => setOpenActionMenu(isOpen ? key : undefined)}
                          onSelect={() => setOpenActionMenu(undefined)}
                          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                            <MenuToggle
                              ref={toggleRef}
                              variant="plain"
                              aria-label={t('Actions')}
                              icon={<EllipsisVIcon />}
                              isExpanded={openActionMenu === key}
                              onClick={() => setOpenActionMenu(openActionMenu === key ? undefined : key)}
                            />
                          )}
                        >
                          <DropdownItem onClick={() => navigate(flowCapturePath(name, captureNamespace))}>
                            {t('View')}
                          </DropdownItem>
                          <DropdownItem onClick={() => navigate(flowCaptureEditPath(name, captureNamespace))}>
                            {t('Edit')}
                          </DropdownItem>
                          <DropdownItem
                            isDanger
                            onClick={() => {
                              setDeleteTarget(capture);
                              setDeleteModalOpen(true);
                            }}
                          >
                            {t('Delete')}
                          </DropdownItem>
                        </Dropdown>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </div>
        )}
      </div>
      <Modal
        variant={ModalVariant.small}
        isOpen={deleteModalOpen}
        onClose={() => !deleting && setDeleteModalOpen(false)}
      >
        <ModalHeader title={deleteTarget ? t('Delete FlowCapture') : t('Delete completed captures')} />
        <ModalBody>
          {deleteError && <p>{deleteError}</p>}
          <p>
            {deleteTarget
              ? t('This will delete FlowCapture {{name}}.', { name: deleteTarget.metadata?.name })
              : t('This will delete {{count}} completed or failed captures. Running captures will not be affected.', {
                  count: completedCaptures.length
                })}
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="danger" isLoading={deleting} isDisabled={deleting} onClick={deleteCompleted}>
            {deleteTarget ? t('Delete FlowCapture') : t('Delete {{count}} captures', { count: completedCaptures.length })}
          </Button>
          <Button variant="link" isDisabled={deleting} onClick={() => setDeleteModalOpen(false)}>
            {t('Cancel')}
          </Button>
        </ModalFooter>
      </Modal>
    </PageSection>
  );
};

export default FlowCaptureList;
