import { K8sModel } from '@openshift-console/dynamic-plugin-sdk';
import {
  EdgeAnimationSpeed,
  EdgeModel,
  EdgeStyle,
  EdgeTerminalType,
  ElementModel,
  GraphElement,
  LabelPosition,
  Model,
  NodeModel,
  NodeShape,
  NodeStatus,
  Point
} from '@patternfly/react-topology';
import { TFunction } from 'i18next';
import _ from 'lodash';
import { GenericMetricTls, MetricStats, TopologyMetricPeer, TopologyMetrics } from '../api/query-response';
import { TruncateLength } from '../components/dropdowns/truncate-dropdown';
import { getResourceSeverity, HealthStat, HealthStats, Severity } from '../components/health/health-helper';
import {
  createFilterValue,
  Filter,
  FilterCompare,
  FilterDefinition,
  FilterId,
  Filters,
  FilterValue,
  findFromFilters
} from '../model/filters';
import { ContextSingleton } from '../utils/context';
import { findFilter } from '../utils/filter-definitions';
import { getTopologyEdgeId } from '../utils/ids';
import { createPeer, getFormattedValue } from '../utils/metrics';
import { defaultMetricFunction, defaultMetricType } from '../utils/router';
import { aggregateTlsLockSeverity, type TlsLockSeverity } from '../utils/tls-lock-severity';
import {
  FlowScope,
  Groups,
  Match,
  MetricFunction,
  MetricType,
  NodeType,
  showTLSHints,
  StatFunction
} from './flow-query';
import { getStat } from './metrics';
import { getStepInto, isDirectionnal, resolveGroupTypes, ScopeConfigDef } from './scope';

export enum LayoutName {
  threeD = '3d',
  breadthFirst = 'BreadthFirst',
  cola = 'Cola',
  colaNoForce = 'ColaNoForce',
  colaGroups = 'ColaGroups',
  concentric = 'Concentric',
  dagre = 'Dagre',
  dagreGroup = 'DagreGroup',
  force = 'Force',
  grid = 'Grid'
}

export type TopologyGroupTypes = 'none' | 'auto' | Groups;

export interface TopologyOptions {
  maxEdgeStat: number;
  nodeBadges?: boolean;
  edges?: boolean;
  edgeTags?: boolean;
  startCollapsed?: boolean;
  truncateLength: TruncateLength;
  layout: LayoutName;
  groupTypes: TopologyGroupTypes;
  lowScale: number;
  medScale: number;
  metricFunction: StatFunction;
  metricType: MetricType;
  showEmpty?: boolean;
  /** When true, volume edges without TLS labels on the series show an open-lock hint (opt-in). */
  showCleartextEdgeLock?: boolean;
  /** Set at render time from capabilities — not persisted in local storage. */
  isTLSTracking?: boolean;
}

export const DefaultOptions: TopologyOptions = {
  nodeBadges: true,
  edges: true,
  edgeTags: true,
  maxEdgeStat: 0,
  startCollapsed: false,
  truncateLength: TruncateLength.M,
  layout: LayoutName.colaNoForce,
  groupTypes: 'auto',
  lowScale: 0.3,
  medScale: 0.5,
  metricFunction: defaultMetricFunction,
  metricType: defaultMetricType,
  showEmpty: false,
  showCleartextEdgeLock: false
};

export type GraphElementPeer = GraphElement<ElementModel, NodeData>;
export type ElementData = Partial<NodeData>;
export type Decorated<T> = T & {
  id: string;
  isHovered?: boolean;
  hover?: boolean;
  dragging?: boolean;
  highlighted?: boolean;
  match: Match;
  isSrcFiltered?: boolean;
  isDstFiltered?: boolean;
  isClearFilters?: boolean;
  isPinned?: boolean;
  showDecorators?: boolean;
  showStatusDecorator?: boolean;
  point?: Point;
  setPosition?: (location: Point) => void;
  canStepInto?: boolean;
};
export const decorated = <T>(t: T): Decorated<T> => t as Decorated<T>;

const severityMapping: Map<Severity, NodeStatus> = new Map([
  ['critical', NodeStatus.danger],
  ['warning', NodeStatus.warning],
  ['info', NodeStatus.info]
]);

export type FilterDir = 'src' | 'dst';
const getDirFilterDefValue = (
  nodeType: NodeType,
  fields: Partial<TopologyMetricPeer>,
  dir: FilterDir,
  filterDefinitions: FilterDefinition[]
) => {
  let def: FilterDefinition | undefined;
  let value: string | undefined;

  // always look for resource + namespace first
  if (fields.resource && fields.namespace) {
    def = findFilter(filterDefinitions, `${dir}_resource`)!;
    value = `${fields.resource.type}.${fields.namespace}.${fields.resource.name}`;
  } else if (nodeType === 'owner' && fields.owner) {
    def = findFilter(filterDefinitions, `${dir}_owner_name`)!;
    value = `"${fields.owner.name}"`;
  } else {
    // try by scope definitions
    ContextSingleton.getScopes().forEach(sc => {
      if (!def && nodeType === sc.id && (fields[sc.id] || fields.resource)) {
        if (isDirectionnal(sc)) {
          def = findFilter(filterDefinitions, sc.filters!.find(f => f.includes(dir)) as FilterId)!;
          value = `"${fields[sc.id] || fields.resource?.name}"`;
        } else {
          def = findFilter(filterDefinitions, sc.filter! as FilterId)!;
          value = `"${fields[sc.id] || fields.resource?.name}"`;
        }
      }
    });
  }

  // fallback on addr and/or subnet label if not found
  if (!def) {
    if (fields.subnetLabel) {
      def = findFilter(filterDefinitions, `${dir}_subnet_label`)!;
      value = fields.subnetLabel!;
    } else if (fields.addr) {
      def = findFilter(filterDefinitions, `${dir}_address`)!;
      value = fields.addr!;
    }
  }
  return def && value ? { def, value } : undefined;
};

const getFilterDefValue = (fields: Partial<TopologyMetricPeer>, filterDefinitions: FilterDefinition[]) => {
  let def: FilterDefinition | undefined;
  let value: string | undefined;
  if (fields.cluster || fields.resource) {
    // TODO: see if clustername will become directionnal
    def = findFilter(filterDefinitions, `cluster_name`)!;
    value = `"${fields.cluster || fields.resource?.name}"`;
  }
  return def && value ? { def, value } : undefined;
};

export const isDirElementFiltered = (
  nodeType: NodeType,
  fields: Partial<TopologyMetricPeer>,
  dir: FilterDir,
  filters: Filter[],
  filterDefinitions: FilterDefinition[]
) => {
  const defValue = getDirFilterDefValue(nodeType, fields, dir, filterDefinitions);
  if (!defValue) {
    return false;
  }
  const filter = findFromFilters(filters, { def: defValue.def, compare: FilterCompare.equal });
  return filter !== undefined && filter.values.find(v => v.v === defValue.value) !== undefined;
};

export const isElementFiltered = (
  fields: Partial<TopologyMetricPeer>,
  filters: Filter[],
  filterDefinitions: FilterDefinition[]
) => {
  const defValue = getFilterDefValue(fields, filterDefinitions);
  if (!defValue) {
    return false;
  }
  const filter = findFromFilters(filters, { def: defValue.def, compare: FilterCompare.equal });
  return filter !== undefined && filter.values.find(v => v.v === defValue.value) !== undefined;
};

const toggleFilter = (
  result: Filter[],
  defValue: {
    def: FilterDefinition;
    value: string;
    /** When adding, full chip (e.g. display); if omitted, `{ v: value }` is used. */
    filterValue?: FilterValue;
  },
  isFiltered: boolean,
  setFilters: (filters: Filter[]) => void
) => {
  let filter = findFromFilters(result, { def: defValue.def, compare: FilterCompare.equal });
  if (!filter) {
    filter = { def: defValue.def, compare: FilterCompare.equal, values: [] };
    result.push(filter);
  }
  if (isFiltered) {
    // Remove
    filter!.values = filter!.values.filter(v => v.v !== defValue.value);
  } else {
    // Add, or Replace filter for kubeobject
    if (defValue.def.id === 'src_resource' || defValue.def.id === 'dst_resource') {
      filter!.values = [{ v: defValue.value! }];
    } else {
      const toAdd = defValue.filterValue ?? { v: defValue.value };
      if (!filter!.values.some(v => v.v === toAdd.v)) {
        filter!.values.push(toAdd);
      }
    }
  }
  setFilters(result.filter(f => !_.isEmpty(f.values)));
};

/**
 * Toggle one quick-filter chip by filter definition and user-facing value (TLS drawer, etc.).
 * Uses the same merge/remove rules as {@link toggleElementFilter}: append when adding, drop only this `v` when removing.
 */
export const toggleQuickFilterValue = (
  def: FilterDefinition,
  label: string,
  isFiltered: boolean,
  filters: Filter[],
  setFilters: (filters: Filter[]) => void
) => {
  const fv = createFilterValue(def, label);
  const result = _.cloneDeep(filters);
  toggleFilter(result, { def, value: fv.v, filterValue: fv }, isFiltered, setFilters);
};

export const toggleDirElementFilter = (
  nodeType: NodeType,
  fields: Partial<TopologyMetricPeer>,
  dir: FilterDir,
  isFiltered: boolean,
  filters: Filter[],
  setFilters: (filters: Filter[]) => void,
  filterDefinitions: FilterDefinition[]
) => {
  const result = _.cloneDeep(filters);
  const defValue = getDirFilterDefValue(nodeType, fields, dir, filterDefinitions);
  if (!defValue) {
    console.error("can't find directional filter definition and value for fields", fields);
    return;
  }
  toggleFilter(result, defValue, isFiltered, setFilters);
};

export const toggleElementFilter = (
  fields: Partial<TopologyMetricPeer>,
  isFiltered: boolean,
  filters: Filter[],
  setFilters: (filters: Filter[]) => void,
  filterDefinitions: FilterDefinition[]
) => {
  const result = _.cloneDeep(filters);
  const defValue = getFilterDefValue(fields, filterDefinitions);
  if (!defValue) {
    console.error("can't find filter definition and value for fields", fields);
    return;
  }
  toggleFilter(result, defValue, isFiltered, setFilters);
};

export const defaultNodeTruncateLength = 25;
export const defaultNodeSize = 75;

export type NodeData = {
  nodeType: NodeType;
  peer: TopologyMetricPeer;
  health?: HealthStat;
  canStepInto?: boolean;
  badgeColor?: string;
  noMetrics?: boolean;
};

/** TLS fields on topology edge element data (tags, side panel). */
export type EdgeTlsPanelData = {
  tagTlsSecure?: boolean;
  tlsVersionLabels?: string[];
  tlsGroupLabels?: string[];
  tagTlsLockSeverity?: TlsLockSeverity;
  tagTlsCleartext?: boolean;
};

function tlsPanelFromTopologyTls(tls: GenericMetricTls | undefined): EdgeTlsPanelData | undefined {
  if (!tls) {
    return undefined;
  }
  return tlsPanelFromLabelArrays(tls.versions || [], tls.groups || []);
}

function tlsPanelFromLabelArrays(
  tlsVersionLabels: string[],
  tlsGroupLabels: string[] = []
): EdgeTlsPanelData | undefined {
  const tv = _.uniq(tlsVersionLabels.filter(Boolean));
  const tg = _.uniq(tlsGroupLabels.filter(Boolean));
  if (!tv.length && !tg.length) {
    return undefined;
  }
  return {
    tagTlsSecure: true,
    tlsVersionLabels: tv.length ? tv : undefined,
    tlsGroupLabels: tg.length ? tg : undefined,
    tagTlsLockSeverity: aggregateTlsLockSeverity(tv, tg) ?? 'unknown'
  };
}

function mergedTlsPanelForEdge(
  prior: { tlsVersionLabels?: string[]; tlsGroupLabels?: string[] } | undefined,
  row: EdgeTlsPanelData | undefined
): EdgeTlsPanelData | undefined {
  return tlsPanelFromLabelArrays(
    [...(prior?.tlsVersionLabels || []), ...(row?.tlsVersionLabels || [])],
    [...(prior?.tlsGroupLabels || []), ...(row?.tlsGroupLabels || [])]
  );
}

const generateNode = (
  data: NodeData,
  scope: FlowScope,
  options: TopologyOptions,
  searchValue: string,
  highlightedId: string,
  filters: Filters,
  t: TFunction,
  filterDefinitions: FilterDefinition[],
  k8sModels: { [key: string]: K8sModel },
  isDark?: boolean,
  resHealth?: HealthStat
): NodeModel => {
  const label = data.peer.getDisplayName(false, false) || (scope === 'host' ? t('External') : t('Unknown'))!;
  const resourceKind = data.peer.resourceKind;
  const secondaryLabel =
    data.nodeType !== 'namespace' && !options.groupTypes.includes('namespaces') ? data.peer.namespace : undefined;
  const shadowed = !_.isEmpty(searchValue) && !(label.includes(searchValue) || secondaryLabel?.includes(searchValue));
  const filtered = !_.isEmpty(searchValue) && !shadowed;
  const highlighted = !shadowed && !_.isEmpty(highlightedId) && highlightedId.includes(data.peer.id);
  const k8sModel = options.nodeBadges && resourceKind ? k8sModels[resourceKind] : undefined;
  const isSrcFiltered = isDirElementFiltered(data.nodeType, data.peer, 'src', filters.list, filterDefinitions);
  const isDstFiltered = isDirElementFiltered(data.nodeType, data.peer, 'dst', filters.list, filterDefinitions);
  const status = getResourceStatus(resHealth);

  return {
    id: data.peer.id,
    type: 'node',
    label,
    width: defaultNodeSize,
    height: defaultNodeSize,
    shape: k8sModel ? NodeShape.ellipse : NodeShape.rect,
    status: status || NodeStatus.default,
    style: { padding: 20 },
    data: {
      ...data,
      shadowed,
      filtered,
      highlighted,
      isDark,
      match: filters.match,
      isSrcFiltered,
      isDstFiltered,
      labelPosition: LabelPosition.bottom,
      badge: k8sModel?.abbr,
      badgeColor: k8sModel?.color ? k8sModel.color : '#2b9af3',
      badgeClassName: 'topology-icon',
      showDecorators: true,
      showStatusDecorator: status !== undefined,
      secondaryLabel,
      truncateLength: options.truncateLength !== TruncateLength.OFF ? options.truncateLength : undefined,
      health: resHealth
    }
  };
};

const getAnimationSpeed = (n: number, total: number) => {
  if (total) {
    const step = total / 5;
    if (n > step * 4) {
      return EdgeAnimationSpeed.fast;
    } else if (n > step * 3) {
      return EdgeAnimationSpeed.mediumFast;
    } else if (n > step * 2) {
      return EdgeAnimationSpeed.medium;
    } else if (n > step) {
      return EdgeAnimationSpeed.mediumSlow;
    } else {
      return EdgeAnimationSpeed.slow;
    }
  } else {
    return EdgeAnimationSpeed.none;
  }
};

const getTagStatus = (n: number, total: number) => {
  if (total) {
    const step = total / 5;
    if (n > step * 3) {
      return NodeStatus.warning;
    } else if (n > step * 2) {
      return NodeStatus.info;
    } else {
      return NodeStatus.default;
    }
  } else {
    return NodeStatus.default;
  }
};

const getEdgeStyle = (count: number) => {
  return count ? EdgeStyle.dashed : EdgeStyle.dotted;
};

const getEdgeTag = (value: number, options: TopologyOptions, t: TFunction) => {
  if (options.edgeTags && value) {
    let metricFunction = options.metricFunction as MetricFunction;
    if (
      options.metricFunction !== 'sum' &&
      ['Bytes', 'Packets', 'PktDropBytes', 'PktDropPackets'].includes(options.metricType)
    ) {
      metricFunction = 'rate';
    }
    return getFormattedValue(value, options.metricType, metricFunction, t);
  }
  return undefined;
};

const generateEdge = (
  sourceId: string,
  targetId: string,
  stat: number,
  droppedStat: number,
  options: TopologyOptions,
  shadowed = false,
  filtered = false,
  highlightedId: string,
  t: TFunction,
  isDark?: boolean,
  tls?: EdgeTlsPanelData,
  tagTlsCleartext?: boolean
): EdgeModel => {
  const id = `${sourceId}.${targetId}`;

  const highlighted = !shadowed && !_.isEmpty(highlightedId) && id.includes(highlightedId);
  return {
    id: getTopologyEdgeId(sourceId, targetId),
    type: 'edge',
    source: sourceId,
    target: targetId,
    edgeStyle: getEdgeStyle(stat),
    animationSpeed: getAnimationSpeed(stat, options.maxEdgeStat),
    data: {
      sourceId,
      targetId,
      shadowed,
      filtered,
      highlighted,
      isDark,
      //edges are directed from src to dst. It will become bidirectional if inverted pair is found
      startTerminalType: EdgeTerminalType.none,
      startTerminalStatus: NodeStatus.default,
      endTerminalType: stat > 0 ? EdgeTerminalType.directional : EdgeTerminalType.none,
      endTerminalStatus: NodeStatus.default,
      tag: getEdgeTag(stat, options, t),
      tagStatus: getTagStatus(stat, options.maxEdgeStat),
      bps: stat,
      drops: droppedStat,
      ...(tls
        ? {
            tagTlsSecure: true,
            tagTlsLockSeverity: tls.tagTlsLockSeverity,
            ...(tls.tlsVersionLabels?.length ? { tlsVersionLabels: tls.tlsVersionLabels } : {}),
            ...(tls.tlsGroupLabels?.length ? { tlsGroupLabels: tls.tlsGroupLabels } : {})
          }
        : {}),
      ...(tagTlsCleartext ? { tagTlsCleartext: true } : {})
    }
  };
};

const getResourceHealth = (
  peer: TopologyMetricPeer,
  nodeType: NodeType,
  healthStats: HealthStats
): HealthStat | undefined => {
  if (nodeType === 'host' && peer.host) {
    return healthStats.byNode.find(h => h.name === peer.host);
  } else if (nodeType === 'namespace' && peer.namespace) {
    return healthStats.byNamespace.find(h => h.name === peer.namespace);
  } else if (nodeType === 'owner' && peer.owner) {
    return healthStats.byOwner.find(
      h => h.name === peer.owner?.name && h.namespace === peer.namespace && h.k8sKind === peer.owner?.type
    );
  }
  return undefined;
};

// Find alert status for a specific peer by comparing alert labels to peer fields
const getResourceStatus = (health?: HealthStat): NodeStatus => {
  if (health) {
    const severity = getResourceSeverity(health);
    if (severity) {
      return severityMapping.get(severity) || NodeStatus.default;
    }
  }
  return NodeStatus.default;
};

export const generateDataModel = (
  metrics: TopologyMetrics[],
  droppedMetrics: TopologyMetrics[],
  options: TopologyOptions,
  metricScope: FlowScope,
  scopes: ScopeConfigDef[],
  searchValue: string,
  highlightedId: string,
  filters: Filters,
  t: TFunction,
  filterDefinitions: FilterDefinition[],
  k8sModels: { [key: string]: K8sModel },
  expectedNodes: string[],
  isDark: boolean | undefined,
  resourceStats: HealthStats
): Model => {
  let nodes: NodeModel[] = [];
  const edges: EdgeModel[] = [];
  const opts = { ...DefaultOptions, ...options };

  const addGroup = (
    fields: Partial<TopologyMetricPeer>,
    scope: FlowScope,
    parent?: NodeModel,
    secondaryLabelPadding = false
  ): NodeModel => {
    const groupDef = createPeer(fields);
    const groupName = groupDef.getDisplayName(false, false);
    let group = nodes.find(g => g.type === 'group' && g.id === groupDef.id);
    if (!group) {
      const data: NodeData = {
        nodeType: scope,
        peer: groupDef
      };
      group = {
        id: groupDef.id,
        children: [],
        type: 'group',
        group: true,
        collapsed: options.startCollapsed,
        label: groupName,
        style: { padding: secondaryLabelPadding ? 35 : 10 },
        data: {
          ...data,
          name: groupName,
          isDark,
          labelPosition: LabelPosition.bottom,
          collapsible: true,
          collapsedWidth: 75,
          collapsedHeight: 75,
          truncateLength:
            options.truncateLength !== TruncateLength.OFF
              ? //match node label length according to badge
                options.nodeBadges
                ? options.truncateLength + 2
                : options.truncateLength - 3
              : undefined
        }
      };
      nodes.push(group);
    }

    if (parent) {
      if (parent.id == group.id) {
        console.error('addGroup parent === group', parent, group);
      } else if (!parent.children!.includes(group.id)) {
        parent.children!.push(group.id);
      }
    }

    return group;
  };

  const addNode = (data: NodeData): NodeModel => {
    const parent = data.nodeType !== 'unknown' ? addPossibleGroups(data.peer) : undefined;
    let node = nodes.find(n => n.type === 'node' && n.id === data.peer.id);
    if (!node) {
      const resHealth = getResourceHealth(data.peer, data.nodeType, resourceStats);
      node = generateNode(
        data,
        metricScope,
        opts,
        searchValue,
        highlightedId,
        filters,
        t,
        filterDefinitions,
        k8sModels,
        isDark,
        resHealth
      );
      nodes.push(node);
    }

    if (parent) {
      if (parent.id == node.id) {
        console.error('addNode parent === node', parent, node);
      } else if (!parent.children!.includes(node.id)) {
        parent.children!.push(node.id);
      }
    }

    return node;
  };

  const addEdge = (
    sourceId: string,
    targetId: string,
    stats: MetricStats,
    droppedStats: MetricStats | undefined,
    shadowed = false,
    filtered = false,
    t: TFunction,
    rowTls: EdgeTlsPanelData | undefined,
    cleartextHint: boolean
  ): EdgeModel => {
    const stat = getStat(stats, options.metricFunction);
    const droppedStat = droppedStats ? getStat(droppedStats, options.metricFunction) : 0;
    let edge = edges.find(
      e =>
        (e.data.sourceId === sourceId && e.data.targetId === targetId) ||
        (e.data.sourceId === targetId && e.data.targetId === sourceId)
    );
    const tls = mergedTlsPanelForEdge(edge?.data, rowTls);
    if (edge) {
      const mergedStat = edge.data.bps + stat;
      const mergedDrops = edge.data.drops + droppedStat;
      const mergedSecure = Boolean(tls?.tagTlsSecure);
      const mergedCleartext =
        Boolean(opts.isTLSTracking) &&
        Boolean(opts.showCleartextEdgeLock) &&
        showTLSHints(opts.metricType) &&
        !mergedSecure &&
        mergedStat > 0 &&
        (Boolean(edge.data.tagTlsCleartext) || cleartextHint);
      edge.edgeStyle = getEdgeStyle(mergedStat);
      edge.animationSpeed = getAnimationSpeed(mergedStat, options.maxEdgeStat);
      edge.data = {
        ...edge.data,
        shadowed,
        filtered,
        isDark,
        //edges are directed from src to dst. It will become bidirectional if inverted pair is found
        startTerminalType: edge.data.sourceId !== sourceId ? EdgeTerminalType.directional : edge.data.startTerminalType,
        tag: getEdgeTag(mergedStat, options, t),
        tagStatus: getTagStatus(mergedStat, options.maxEdgeStat),
        bps: mergedStat,
        drops: mergedDrops,
        ...(tls || { tagTlsSecure: false, tagTlsLockSeverity: undefined }),
        tagTlsCleartext: mergedCleartext ? true : undefined
      };
      if (!tls) {
        delete edge.data.tlsVersionLabels;
        delete edge.data.tlsGroupLabels;
      }
    } else {
      const showCleartextOnNewEdge =
        Boolean(opts.isTLSTracking) &&
        Boolean(opts.showCleartextEdgeLock) &&
        showTLSHints(opts.metricType) &&
        cleartextHint &&
        stat > 0 &&
        !tls?.tagTlsSecure;
      edge = generateEdge(
        sourceId,
        targetId,
        stat,
        droppedStat,
        opts,
        shadowed,
        filtered,
        highlightedId,
        t,
        isDark,
        tls,
        showCleartextOnNewEdge
      );
      edges.push(edge);
    }

    return edge;
  };

  // addPossibleGroups adds peer to one or more groups when relevant, and returns the smallest one
  const addPossibleGroups = (peer: TopologyMetricPeer): NodeModel | undefined => {
    // groups are all possible scopes except last one
    const parentScopes = ContextSingleton.getScopes().slice(0, -1);
    const resolvedGroups = resolveGroupTypes(options.groupTypes, metricScope, scopes);

    // build parent tree from biggest to smallest group
    let parent: NodeModel | undefined = undefined;
    parentScopes.forEach(sc => {
      if (resolvedGroups.includes(`${sc.id}s`) && !_.isEmpty(peer[sc.id])) {
        parent = addGroup(
          { [sc.id]: peer[sc.id], namespace: ['namespace', 'owner'].includes(sc.id) ? peer.namespace : undefined },
          sc.id,
          parent,
          true
        );
      }
    });

    // return smallest parent set
    return parent;
  };

  const peerToNodeData = (p: TopologyMetricPeer): NodeData => {
    const canStepInto =
      getStepInto(
        metricScope,
        scopes.map(sc => sc.id)
      ) !== undefined;
    switch (metricScope) {
      case 'owner':
        return p.owner ? { peer: p, nodeType: 'owner', canStepInto } : { peer: p, nodeType: 'unknown' };
      case 'resource':
        return { peer: p, nodeType: 'resource' };
      default:
        const value = (p as never)[metricScope] as string;
        return _.isEmpty(value) ? { peer: p, nodeType: 'unknown' } : { peer: p, nodeType: metricScope, canStepInto };
    }
  };

  // link pods to nodes instead of external if possible as routing will duplicate flows as follow:
  // - pod -> destination
  // - node -> destination
  // the output will be pod -> node -> destination if all the metrics are present
  // else the original display will be kept
  const manageRouting = (peer: TopologyMetricPeer, opposite: TopologyMetricPeer): TopologyMetricPeer => {
    if (peer.cluster === opposite.cluster && opposite.resource?.type === 'Pod' && peer.resource === undefined) {
      const nodePeer =
        metrics.find(m => m.source.resource?.name === opposite.host && m.destination.addr === peer.addr)?.source ||
        metrics.find(m => m.destination.resource?.name === opposite.host && m.source.addr === peer.addr)?.destination;
      return nodePeer || peer;
    }
    return peer;
  };

  metrics.forEach(m => {
    const srcNode = addNode(peerToNodeData(manageRouting(m.source, m.destination)));
    const dstNode = addNode(peerToNodeData(manageRouting(m.destination, m.source)));

    if (options.edges && srcNode && dstNode && srcNode.id !== dstNode.id) {
      const drops = droppedMetrics.find(dm => dm.source.id === m.source.id && dm.destination.id === m.destination.id);
      const showHint = showTLSHints(opts.metricType);
      const perEdgeTlsInfo = showHint ? tlsPanelFromTopologyTls(m.tls) : undefined;
      const cleartextHint =
        Boolean(opts.isTLSTracking) && Boolean(opts.showCleartextEdgeLock) && showHint && !perEdgeTlsInfo?.tagTlsSecure;
      addEdge(
        srcNode.id,
        dstNode.id,
        m.stats,
        drops?.stats,
        srcNode.data.shadowed || dstNode.data.shadowed,
        srcNode.data.filtered || dstNode.data.filtered,
        t,
        perEdgeTlsInfo,
        cleartextHint
      );
    }
  });

  //remove empty groups
  nodes = nodes.filter(n => n.type !== 'group' || (n.children && n.children.length));

  // add missing nodes to the view if available
  if (!_.isEmpty(expectedNodes)) {
    const currentNodes = nodes.map(n => n.label);
    const missingNodes = expectedNodes.filter(n => !currentNodes.includes(n));
    missingNodes.forEach(n => {
      const fields: Partial<TopologyMetricPeer> = { id: n };
      fields[metricScope] = n;
      addNode({ peer: createPeer(fields), nodeType: metricScope, canStepInto: false, noMetrics: true });
    });
  }

  return { nodes, edges };
};
