/* eslint-disable @typescript-eslint/no-explicit-any */
import { K8sResourceCondition, K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk';
import { Button, Label, Text, TextVariants, Title } from '@patternfly/react-core';
import {
  BanIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  HourglassHalfIcon,
  UnknownIcon
} from '@patternfly/react-icons';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '../../utils/url';
import { ComponentStatus, ExporterStatus } from './pipeline';

/** `FlowCollector.status` fields used by this form (mirrors operator CRD shape). */
export type FlowCollectorStatus = {
  conditions?: K8sResourceCondition[];
  components?: {
    agent?: ComponentStatus;
    processor?: ComponentStatus;
    plugin?: ComponentStatus;
  };
  integrations?: {
    loki?: ComponentStatus;
    monitoring?: ComponentStatus;
    exporters?: ExporterStatus[];
  };
};

function flowCollectorStatus(existing: K8sResourceKind | null): FlowCollectorStatus | undefined {
  const raw = existing?.status;
  if (raw == null || typeof raw !== 'object') {
    return undefined;
  }
  return raw as FlowCollectorStatus;
}

export type ResourceStatusProps = {
  group: string;
  version: string;
  kind: string;
  existing: K8sResourceKind | null;
  selectedTypes: string[];
  setSelectedTypes: (types: string[]) => void;
};

type LabelColor = 'green' | 'orange' | 'red' | 'blue' | 'grey';

const stateColor = (state: string | undefined): LabelColor => {
  switch (state) {
    case 'Ready':
      return 'green';
    case 'Degraded':
      return 'orange';
    case 'Failure':
      return 'red';
    case 'InProgress':
      return 'blue';
    case 'Unused':
      return 'grey';
    default:
      return 'grey';
  }
};

const StateIcon: FC<{ state: string | undefined }> = ({ state }) => {
  switch (state) {
    case 'Ready':
      return <CheckCircleIcon color="var(--pf-v5-global--success-color--100)" />;
    case 'Degraded':
      return <ExclamationTriangleIcon color="var(--pf-v5-global--warning-color--100)" />;
    case 'Failure':
      return <ExclamationCircleIcon color="var(--pf-v5-global--danger-color--100)" />;
    case 'InProgress':
      return <HourglassHalfIcon color="var(--pf-v5-global--info-color--100)" />;
    case 'Unused':
      return <BanIcon color="var(--pf-v5-global--disabled-color--100)" />;
    default:
      return <UnknownIcon color="var(--pf-v5-global--disabled-color--100)" />;
  }
};

interface ComponentRowData {
  id: string;
  name: string;
  status: ComponentStatus;
}

const ComponentStatusTable: FC<{
  components: ComponentRowData[];
  exporters: ExporterStatus[];
  selectedTypes: string[];
  setSelectedTypes: (types: string[]) => void;
}> = ({ components, exporters, selectedTypes, setSelectedTypes }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const activeComponents = components.filter(c => c.status.state !== 'Unused');
  const unusedComponents = components.filter(c => c.status.state === 'Unused');

  if (!activeComponents.length && !exporters.length) {
    return null;
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <Title headingLevel="h3" size="md" style={{ marginBottom: '0.5rem' }}>
        {t('Component statuses')}
      </Title>
      <Table variant="compact">
        <Thead>
          <Tr>
            <Th>{t('Component')}</Th>
            <Th>{t('State')}</Th>
            <Th>{t('Replicas')}</Th>
            <Th>{t('Details')}</Th>
          </Tr>
        </Thead>
        <Tbody>
          {activeComponents.map(c => (
            <Tr
              key={c.id}
              isRowSelected={selectedTypes.includes(c.id)}
              isClickable
              onRowClick={() => setSelectedTypes([c.id])}
            >
              <Td>
                <StateIcon state={c.status.state} /> {c.name}
              </Td>
              <Td>
                <Label color={stateColor(c.status.state)}>{c.status.state}</Label>
              </Td>
              <Td>
                {c.status.desiredReplicas != null ? `${c.status.readyReplicas ?? 0}/${c.status.desiredReplicas}` : '-'}
              </Td>
              <Td>
                {c.status.podIssues ? c.status.podIssues : c.status.message ? c.status.message : c.status.reason || '-'}
              </Td>
            </Tr>
          ))}
          {exporters.map((exp, i) => (
            <Tr
              key={`exporter-${i}`}
              isRowSelected={selectedTypes.includes(`exporter-${i}`)}
              isClickable
              onRowClick={() => setSelectedTypes([`exporter-${i}`])}
            >
              <Td>
                <StateIcon state={exp.state} /> {exp.name || exp.type}
              </Td>
              <Td>
                <Label color={stateColor(exp.state)}>{exp.state}</Label>
              </Td>
              <Td>-</Td>
              <Td>{exp.message || exp.reason || '-'}</Td>
            </Tr>
          ))}
          {unusedComponents.length > 0 && (
            <Tr>
              <Td colSpan={4} style={{ color: 'var(--pf-t--global--text--color--disabled)', fontStyle: 'italic' }}>
                {t('Unused: {{list}}', { list: unusedComponents.map(c => c.name).join(', ') })}
              </Td>
            </Tr>
          )}
        </Tbody>
      </Table>
    </div>
  );
};

/**
 * `Waiting*` FlowCollector conditions use inverted polarity (operator `statuses.go`): `True` means not ready.
 * Component state on the same status object is the source of truth for Failure / Degraded / InProgress.
 */
const WAITING_NO_STATUS_FIELD = new Set(['FlowCollectorController', 'StaticController', 'NetworkPolicy']);

type ConditionTone = 'error' | 'warning' | 'progress' | 'success' | 'unused' | 'unknown';

function waitingComponentState(st: FlowCollectorStatus | undefined, suffix: string): string | undefined {
  if (!st) return undefined;
  const { components, integrations } = st;
  switch (suffix) {
    case 'EBPFAgents':
      return components?.agent?.state;
    case 'WebConsole':
      return components?.plugin?.state;
    case 'FLPMonolith':
    case 'FLPParent':
    case 'FLPTransformer':
      return components?.processor?.state;
    case 'Monitoring':
      return integrations?.monitoring?.state;
    case 'LokiStack':
    case 'DemoLoki':
      return integrations?.loki?.state;
    default:
      return undefined;
  }
}

/** One tone per row: drives icon and message color. */
function conditionTone(c: K8sResourceCondition, fcStatus: FlowCollectorStatus | undefined): ConditionTone {
  const { type, status, reason } = c;

  if (type === 'ConfigurationIssue') {
    if (status === 'True' && reason === 'Error') return 'error';
    if (status === 'True' && reason === 'Warnings') return 'warning';
    return 'unknown';
  }

  if (type.startsWith('Waiting')) {
    const suffix = type.slice('Waiting'.length);
    if (status === 'False' && reason === 'Ready') return 'success';
    // Operator `setUnused` sets reason `ComponentUnused`; `toCondition` default is `Unused`.
    if (status === 'Unknown' && (reason === 'Unused' || reason === 'ComponentUnused')) return 'unused';
    if (status !== 'True') return 'unknown';

    const st = waitingComponentState(fcStatus, suffix);
    if (st === 'Failure') return 'error';
    if (st === 'Degraded') return 'warning';
    if (st === 'InProgress') return 'progress';
    if (st === 'Ready') return 'success';
    return WAITING_NO_STATUS_FIELD.has(suffix) ? 'error' : 'progress';
  }

  if (type === 'Ready' && status === 'True' && reason === 'Ready,Degraded') return 'warning';
  if (status === 'True') return 'success';
  if (status === 'False' && reason === 'Pending') return 'progress';
  if (status === 'False' && reason !== 'Valid') return 'error';
  return 'unknown';
}

export const ResourceStatus: FC<ResourceStatusProps> = ({
  group,
  version,
  kind,
  existing,
  selectedTypes,
  setSelectedTypes
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const navigate = useNavigate();

  if (!existing) {
    return (
      <>
        <Text component={TextVariants.p}>{t("{{kind}} resource doesn't exists yet.", { kind })}</Text>
        <Button
          onClick={() => {
            navigate(`/k8s/cluster/${group}~${version}~${kind}/~new/form`);
          }}
        >
          {t('Create {{kind}}', { kind })}
        </Button>
      </>
    );
  }

  const fcStatus = flowCollectorStatus(existing);

  const components: ComponentRowData[] = [];
  if (fcStatus?.components?.agent) {
    components.push({ id: 'agent', name: t('eBPF Agent'), status: fcStatus.components.agent });
  }
  if (fcStatus?.components?.processor) {
    components.push({ id: 'processor', name: t('Flowlogs Pipeline'), status: fcStatus.components.processor });
  }
  if (fcStatus?.components?.plugin) {
    components.push({ id: 'plugin', name: t('Console Plugin'), status: fcStatus.components.plugin });
  }
  if (fcStatus?.integrations?.loki) {
    components.push({ id: 'loki', name: 'Loki', status: fcStatus.integrations.loki });
  }
  if (fcStatus?.integrations?.monitoring) {
    components.push({ id: 'monitoring', name: t('Monitoring'), status: fcStatus.integrations.monitoring });
  }
  const exporters: ExporterStatus[] = fcStatus?.integrations?.exporters || [];

  const sortConditions = [
    (c: K8sResourceCondition) => c.type === 'Ready',
    (c: K8sResourceCondition) => c.type === 'ConfigurationIssue',
    (c: K8sResourceCondition) => c.type === 'KafkaReady'
  ];
  const conditions = (fcStatus?.conditions || []).sort((a, b) => {
    for (const pred of sortConditions) {
      if (pred(a) && pred(b)) {
        return 0;
      } else if (pred(a)) {
        return -1;
      } else if (pred(b)) {
        return 1;
      }
    }
    return 0;
  });

  return (
    <>
      <ComponentStatusTable
        components={components}
        exporters={exporters}
        selectedTypes={selectedTypes}
        setSelectedTypes={setSelectedTypes}
      />

      <Title headingLevel="h3" size="md" style={{ marginBottom: '0.5rem' }}>
        {t('Conditions')}
      </Title>
      <Table id="resource-status-table" data-test={conditions.find(c => c.type === 'Ready')?.message} variant="compact">
        <Thead>
          <Tr>
            <Th>{t('Type')}</Th>
            <Th>{t('Status')}</Th>
            <Th>{t('Reason')}</Th>
            <Th>{t('Message')}</Th>
            <Th>{t('Changed')}</Th>
          </Tr>
        </Thead>
        <Tbody>
          {conditions.map((condition, i) => {
            const tone = conditionTone(condition, fcStatus);
            return (
              <Tr
                id={`${condition.type}-row`}
                data-test-status={`${condition.status}`}
                data-test-reason={`${condition.reason}`}
                key={i}
              >
                <Td>
                  {tone === 'error' ? (
                    <ExclamationCircleIcon color="var(--pf-v5-global--danger-color--100)" />
                  ) : tone === 'warning' ? (
                    <ExclamationTriangleIcon color="var(--pf-v5-global--warning-color--100)" />
                  ) : tone === 'progress' ? (
                    <HourglassHalfIcon color="var(--pf-v5-global--info-color--100)" />
                  ) : tone === 'unused' ? (
                    <BanIcon color="var(--pf-v5-global--disabled-color--100)" />
                  ) : tone === 'success' ? (
                    <CheckCircleIcon color="var(--pf-v5-global--success-color--100)" />
                  ) : (
                    <UnknownIcon color="var(--pf-v5-global--disabled-color--100)" />
                  )}{' '}
                  {condition.type}
                </Td>
                <Td>{condition.status}</Td>
                <Td>{condition.reason}</Td>
                <Td
                  style={
                    tone === 'warning'
                      ? { color: 'var(--pf-v5-global--warning-color--200)' }
                      : tone === 'error'
                      ? { color: 'var(--pf-v5-global--danger-color--100)' }
                      : undefined
                  }
                >
                  {condition.message}
                </Td>
                <Td>{condition.lastTransitionTime}</Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </>
  );
};

export default ResourceStatus;
