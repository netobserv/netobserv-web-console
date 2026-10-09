/* eslint-disable @typescript-eslint/no-explicit-any */
import { K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk';

import {
  DEFAULT_EDGE_TYPE as edgeType,
  FinallyNode,
  DEFAULT_FINALLY_NODE_TYPE as finallyNodeType,
  getEdgesFromNodes,
  getSpacerNodes,
  Graph,
  GraphComponent,
  Layout,
  GRAPH_LAYOUT_END_EVENT as layoutEndEvent,
  ModelKind,
  Node,
  PipelineDagreLayout,
  PipelineNodeModel,
  RunStatus,
  SpacerNode,
  DEFAULT_SPACER_NODE_TYPE as spacerNodeType,
  TaskEdge,
  DefaultTaskGroup as taskGroup,
  TaskNode,
  DEFAULT_TASK_NODE_TYPE as taskNodeType,
  Visualization,
  VisualizationProvider,
  VisualizationSurface,
  WhenDecorator,
  DEFAULT_WHEN_OFFSET as whenOffset
} from '@patternfly/react-topology';

import _ from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

export interface ComponentStatus {
  state?: string;
  reason?: string;
  message?: string;
  desiredReplicas?: number;
  readyReplicas?: number;
  unhealthyPodCount?: number;
  podIssues?: string;
}

export interface ExporterStatus {
  name: string;
  type: string;
  state: string;
  reason?: string;
  message?: string;
}

export interface Step {
  id: string;
  type?: string;
  label: string;
  runAfterTasks?: string[];
  data?: any;
}
export interface StepProps {
  element: Node;
}

const stateToRunStatus = (cs: ComponentStatus | undefined): RunStatus => {
  if (!cs) {
    return RunStatus.Pending;
  }
  switch (cs.state) {
    case 'Ready':
      return cs.unhealthyPodCount ? RunStatus.Cancelled : RunStatus.Succeeded;
    case 'Degraded':
      return RunStatus.Cancelled;
    case 'InProgress':
      return RunStatus.Pending;
    case 'Failure':
      return RunStatus.Failed;
    case 'Unused':
      return RunStatus.Skipped;
    default:
      return RunStatus.Pending;
  }
};

const exporterStateToRunStatus = (state: string): RunStatus => {
  switch (state) {
    case 'Ready':
      return RunStatus.Succeeded;
    case 'Failure':
      return RunStatus.Failed;
    case 'Degraded':
      return RunStatus.Cancelled;
    case 'InProgress':
      return RunStatus.Pending;
    default:
      return RunStatus.Skipped;
  }
};

const replicaLabel = (cs: ComponentStatus | undefined, baseLabel: string): string => {
  if (cs?.desiredReplicas != null && cs?.readyReplicas != null) {
    return `${baseLabel} (${cs.readyReplicas}/${cs.desiredReplicas})`;
  }
  return baseLabel;
};

const EMPTY_EXPORTERS: ExporterStatus[] = [];

export const StepNode: React.FunctionComponent<StepProps> = ({ element }) => {
  try {
    const data = element.getData();

    const whenDecorator = data?.whenStatus ? (
      <WhenDecorator element={element} status={data.whenStatus} leftOffset={whenOffset} />
    ) : null;

    return (
      <TaskNode element={element} selected={data?.selected} status={data?.status} onSelect={() => data?.onSelect?.()}>
        {whenDecorator}
      </TaskNode>
    );
  } catch {
    return null;
  }
};

const pipelineComponentFactory = (kind: ModelKind, type: string) => {
  if (kind === ModelKind.graph) {
    return GraphComponent;
  }
  switch (type) {
    case taskNodeType:
      return StepNode;
    case finallyNodeType:
      return FinallyNode;
    case 'task-group':
      return taskGroup;
    case 'finally-group':
      return taskGroup;
    case spacerNodeType:
      return SpacerNode;
    case 'finally-spacer-edge':
    case edgeType:
      return TaskEdge;
    default:
      return undefined;
  }
};

export type FlowCollectorPipelineProps = {
  existing: K8sResourceKind | null;
  selectedTypes: string[];
  setSelectedTypes: (types: string[]) => void;
};

export const Pipeline: React.FC<FlowCollectorPipelineProps> = ({ existing, selectedTypes, setSelectedTypes }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [controller, setController] = React.useState<Visualization>();
  const [isLayouting, setIsLayouting] = React.useState(false);

  const fit = React.useCallback(() => {
    if (controller && controller.hasGraph()) {
      controller.getGraph().fit();
      requestAnimationFrame(() => {
        setIsLayouting(false);
      });
    }
  }, [controller]);

  const agentStatus: ComponentStatus | undefined = existing?.status?.components?.agent;
  const processorStatus: ComponentStatus | undefined = existing?.status?.components?.processor;
  const pluginStatus: ComponentStatus | undefined = existing?.status?.components?.plugin;
  const lokiStatus: ComponentStatus | undefined = existing?.status?.integrations?.loki;
  const monitoringStatus: ComponentStatus | undefined = existing?.status?.integrations?.monitoring;
  const exporterStatuses: ExporterStatus[] = existing?.status?.integrations?.exporters || EMPTY_EXPORTERS;

  const getSteps = React.useCallback(() => {
    const steps: Step[] = [];

    if (existing?.spec?.agent?.type === 'eBPF') {
      steps.push({
        id: 'agent',
        label: replicaLabel(agentStatus, t('eBPF agents')),
        data: {
          status: stateToRunStatus(agentStatus),
          selected: selectedTypes.includes('agent'),
          onSelect: () => setSelectedTypes(['agent'])
        }
      });
    }

    if (existing?.spec?.deploymentModel === 'Kafka') {
      const kafkaCondition = existing?.status?.conditions?.find((c: any) => c.type === 'KafkaReady');
      let kafkaRunStatus = RunStatus.Pending;
      if (kafkaCondition) {
        kafkaRunStatus =
          kafkaCondition.status === 'True'
            ? RunStatus.Succeeded
            : kafkaCondition.status === 'False'
              ? RunStatus.Failed
              : RunStatus.Pending;
      }
      steps.push({
        id: 'kafka',
        label: 'Kafka',
        runAfterTasks: ['agent'],
        data: {
          status: kafkaRunStatus,
          selected: selectedTypes.includes('kafka'),
          onSelect: () => setSelectedTypes(['kafka'])
        }
      });
    }

    if (existing?.spec) {
      steps.push({
        id: 'processor',
        label: replicaLabel(processorStatus, t('Flowlogs pipeline')),
        runAfterTasks: steps.length ? [_.last(steps)!.id] : [],
        data: {
          status: stateToRunStatus(processorStatus),
          selected: selectedTypes.includes('processor'),
          onSelect: () => setSelectedTypes(['processor'])
        }
      });
    }

    const cpRunAfter: string[] = [];
    if (existing?.spec?.loki?.enable) {
      steps.push({
        id: 'loki',
        label: 'Loki',
        runAfterTasks: ['processor'],
        data: {
          status: stateToRunStatus(lokiStatus),
          selected: selectedTypes.includes('loki'),
          onSelect: () => setSelectedTypes(['loki'])
        }
      });
      cpRunAfter.push('loki');
    }

    if (existing?.spec?.prometheus?.querier?.enable) {
      steps.push({
        id: 'monitoring',
        label: t('Monitoring'),
        runAfterTasks: ['processor'],
        data: {
          status: stateToRunStatus(monitoringStatus),
          selected: selectedTypes.includes('monitoring'),
          onSelect: () => setSelectedTypes(['monitoring'])
        }
      });
      cpRunAfter.push('monitoring');
    }

    if (exporterStatuses.length) {
      exporterStatuses.forEach((exp: ExporterStatus, i: number) => {
        steps.push({
          id: `exporter-${i}`,
          label: exp.name || exp.type || t('Unknown'),
          runAfterTasks: ['processor'],
          data: {
            status: exporterStateToRunStatus(exp.state),
            selected: selectedTypes.includes(`exporter-${i}`),
            onSelect: () => setSelectedTypes([`exporter-${i}`])
          }
        });
      });
    }

    if (existing?.spec?.consolePlugin?.enable) {
      steps.push({
        id: 'plugin',
        label: replicaLabel(pluginStatus, t('Console plugin')),
        runAfterTasks: cpRunAfter.length ? cpRunAfter : ['processor'],
        data: {
          status: stateToRunStatus(pluginStatus),
          selected: selectedTypes.includes('plugin'),
          onSelect: () => setSelectedTypes(['plugin'])
        }
      });
    }

    return steps.map(s => ({
      type: s.type || taskNodeType,
      width: 180,
      height: 32,
      style: {
        padding: [45, 15]
      },
      ...s
    })) as PipelineNodeModel[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    existing?.spec,
    agentStatus,
    processorStatus,
    pluginStatus,
    lokiStatus,
    monitoringStatus,
    exporterStatuses,
    selectedTypes,
    setSelectedTypes
  ]);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      setTimeout(() => fit(), 100);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [controller, fit]);

  const { nodes, edges } = React.useMemo(() => {
    const steps = getSteps();
    const spacerNodes = getSpacerNodes(steps);
    const nodes = [...steps, ...spacerNodes];
    const edges = getEdgesFromNodes(steps);
    return { nodes, edges };
  }, [getSteps]);

  React.useEffect(() => {
    if (!controller) {
      return;
    }

    setIsLayouting(true);

    controller.fromModel(
      {
        nodes,
        edges,
        graph: {
          id: 'g1',
          type: 'graph',
          layout: 'pipelineLayout'
        }
      },
      false
    );
  }, [controller, nodes, edges]);

  React.useEffect(() => {
    const c = new Visualization();
    c.registerComponentFactory(pipelineComponentFactory);
    c.registerLayoutFactory((type: string, graph: Graph): Layout | undefined => new PipelineDagreLayout(graph));
    setController(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!controller) return;

    const handleLayoutEnd = () => fit();
    controller.addEventListener(layoutEndEvent, handleLayoutEnd);

    return () => {
      controller.removeEventListener(layoutEndEvent, handleLayoutEnd);
    };
  }, [controller, fit]);

  return (
    <div
      id="pipeline-container-div"
      style={{ width: '100%', height: '100%', opacity: isLayouting ? 0 : 1, transition: 'opacity 0.15s ease-in-out' }}
      ref={containerRef}
    >
      <VisualizationProvider controller={controller}>
        <VisualizationSurface />
      </VisualizationProvider>
    </div>
  );
};

export default Pipeline;
