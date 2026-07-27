import { EdgeModel, NodeModel } from '@patternfly/react-topology';

/**
 * Vendored from @patternfly/react-topology (PR #320) until Console ships a shared
 * module that supports AggregateEdgesOptions.groupEdges. Console provides
 * react-topology as a singleton shared module (import: false), so a custom
 * package version in the plugin image is ignored at runtime.
 *
 * Local performance tweaks vs upstream:
 * - parentIndex Map (O(1) parent lookup instead of scanning all nodes)
 * - segmentIndex Map (O(1) merge lookup instead of linear find)
 * - stubs store bridgeId for O(1) runtime bridge resolution
 */

export type AggregateEdgeRole = 'exit' | 'bridge' | 'entry';

export interface AggregateEdgesOptions {
  /**
   * Remap edge endpoints to their topmost collapsed ancestor and merge
   * parallel remapped edges into aggregate edges.
   * Defaults to `true`.
   */
  collapsedGroups?: boolean;
  /**
   * Split cross-group edges into an exit stub (node → parent group), a bridge
   * between parent groups (merged across leaf edges), and an entry stub
   * (parent group → node). Defaults to `false`.
   */
  groupEdges?: boolean;
}

interface PathSegment {
  source: string;
  target: string;
  role: AggregateEdgeRole;
  /** When true, merge undirected (A→B same as B→A). Exit/entry stay directed. */
  undirected: boolean;
  /**
   * Stable key for the bridge this segment belongs to (sorted endpoint pair).
   * Exit/entry stubs are scoped to a bridge so paths to different peers stay separate.
   */
  bridgeKey: string;
}

type ParentIndex = Map<string, string>;

const buildParentIndex = (nodes: NodeModel[]): ParentIndex => {
  const parentOf: ParentIndex = new Map();
  nodes.forEach(n => {
    n.children?.forEach(childId => {
      parentOf.set(childId, n.id);
    });
  });
  return parentOf;
};

const getAncestorChain = (nodeId: string, parentOf: ParentIndex): string[] => {
  const chain: string[] = [];
  let current: string | undefined = nodeId;
  while (current) {
    chain.push(current);
    current = parentOf.get(current);
  }
  return chain;
};

const isAncestorOf = (ancestorId: string, nodeId: string, parentOf: ParentIndex): boolean =>
  getAncestorChain(nodeId, parentOf).includes(ancestorId);

const makeBridgeKey = (a: string, b: string): string => [a, b].sort((x, y) => x.localeCompare(y)).join('__');

/**
 * Walk up to the topmost collapsed ancestor (or the node itself if none).
 * Mirrors runtime `getTopCollapsedParent` against the declarative model.
 */
const getCollapsedDisplayedNode = (nodeId: string, parentOf: ParentIndex, collapsedIds: Set<string>): string => {
  let displayedNodeId = nodeId;
  let parentId = parentOf.get(nodeId);
  while (parentId) {
    if (collapsedIds.has(parentId)) {
      displayedNodeId = parentId;
    }
    parentId = parentOf.get(parentId);
  }
  return displayedNodeId;
};

/**
 * Decompose a cross-group leaf edge into exit / bridge / entry segments.
 *
 * Uses the lowest common ancestor so the *bridge* sits at the outermost
 * differing ancestors (e.g. namespaces). Exit/entry paths step through each
 * nested group so the edge touches every hull on the way out/in:
 *
 *   pod → ownerA → namespaceA → namespaceB → ownerB → pod
 *
 * Example (flat groups, no nesting):
 *   exit:   2-1 → Group2
 *   bridge: Group2 → Subgroup3
 *   entry:  Subgroup3 → 3-1
 *
 * When an endpoint is already a group, that group is the bridge terminus
 * (no exit/entry stub beyond it).
 */
const getGroupPathSegments = (
  sourceId: string,
  targetId: string,
  nodesById: Map<string, NodeModel>,
  parentOf: ParentIndex
): PathSegment[] | null => {
  if (sourceId === targetId) {
    return null;
  }

  if (isAncestorOf(sourceId, targetId, parentOf) || isAncestorOf(targetId, sourceId, parentOf)) {
    return null; // node ↔ ancestor: hide, no segments
  }

  const sourceModel = nodesById.get(sourceId);
  const targetModel = nodesById.get(targetId);
  const sourceIsGroup = !!sourceModel?.group;
  const targetIsGroup = !!targetModel?.group;

  const sourceParent = parentOf.get(sourceId);
  const targetParent = parentOf.get(targetId);

  // Same immediate parent (siblings) or both graph-level non-nested ends — keep the original edge.
  if (sourceParent === targetParent) {
    return [];
  }

  // Leaf→root chains, then root-first for LCA.
  const sourceRootFirst = [...getAncestorChain(sourceId, parentOf)].reverse();
  const targetRootFirst = [...getAncestorChain(targetId, parentOf)].reverse();

  let lcaDepth = -1;
  const shared = Math.min(sourceRootFirst.length, targetRootFirst.length);
  for (let i = 0; i < shared; i++) {
    if (sourceRootFirst[i] === targetRootFirst[i]) {
      lcaDepth = i;
    } else {
      break;
    }
  }

  // First unique ancestor on each side (child of LCA, or root of chain when no shared ancestor).
  const sourceUnique = sourceRootFirst.slice(lcaDepth + 1);
  const targetUnique = targetRootFirst.slice(lcaDepth + 1);
  if (!sourceUnique.length || !targetUnique.length) {
    return null;
  }

  // Bridge between outermost differing groups when present; otherwise the node itself.
  const pickBridgeEnd = (uniqueChain: string[], isGroupEndpoint: boolean, endpointId: string): string => {
    if (isGroupEndpoint) {
      return endpointId;
    }
    // Prefer the topmost group in the unique chain (skip the leaf at the end).
    const top = uniqueChain[0];
    const topModel = nodesById.get(top);
    if (topModel?.group) {
      return top;
    }
    // Unique chain is only the leaf (ungrouped vs grouped peer): use leaf as terminus.
    return endpointId;
  };

  const bridgeSource = pickBridgeEnd(sourceUnique, sourceIsGroup, sourceId);
  const bridgeTarget = pickBridgeEnd(targetUnique, targetIsGroup, targetId);

  if (bridgeSource === bridgeTarget) {
    return [];
  }

  const bridgeKey = makeBridgeKey(bridgeSource, bridgeTarget);
  const segments: PathSegment[] = [];

  // Exit path: step leaf → … → bridgeSource through each nested group.
  if (!sourceIsGroup && bridgeSource !== sourceId) {
    // sourceUnique is root-first ([ns, owner, leaf]); reverse for ascent.
    const ascent = [...sourceUnique].reverse();
    const bridgeIdx = ascent.indexOf(bridgeSource);
    const steps = bridgeIdx >= 0 ? ascent.slice(0, bridgeIdx + 1) : ascent;
    for (let i = 0; i < steps.length - 1; i++) {
      segments.push({ source: steps[i], target: steps[i + 1], role: 'exit', undirected: false, bridgeKey });
    }
  }

  segments.push({ source: bridgeSource, target: bridgeTarget, role: 'bridge', undirected: true, bridgeKey });

  // Entry path: step bridgeTarget → … → leaf through each nested group.
  if (!targetIsGroup && bridgeTarget !== targetId) {
    // targetUnique is root-first ([ns, owner, leaf]).
    const bridgeIdx = targetUnique.indexOf(bridgeTarget);
    const steps = bridgeIdx >= 0 ? targetUnique.slice(bridgeIdx) : targetUnique;
    for (let i = 0; i < steps.length - 1; i++) {
      segments.push({ source: steps[i], target: steps[i + 1], role: 'entry', undirected: false, bridgeKey });
    }
  }

  return segments;
};

const segmentId = (segment: PathSegment, legacyBridgeId = false): string => {
  if (segment.role === 'bridge') {
    if (legacyBridgeId) {
      return `aggregate_${segment.source}_${segment.target}`;
    }
    return `aggregate_bridge_${segment.bridgeKey}`;
  }
  // Scope stubs to their bridge so paths to different peers do not share selection/geometry.
  return `aggregate_${segment.role}_${segment.source}_${segment.target}_${segment.bridgeKey}`;
};

const segmentLookupKey = (aggregateEdgeType: string, segment: PathSegment): string => {
  if (segment.undirected) {
    return `${aggregateEdgeType}|${segment.role}|${segment.bridgeKey}`;
  }
  return `${aggregateEdgeType}|${segment.role}|${segment.bridgeKey}|${segment.source}->${segment.target}`;
};

/** Prefer the bridge for labels so multi-part paths show the label once along the path. */
const isLabelBearer = (segments: PathSegment[], segment: PathSegment): boolean => {
  const bearer = segments.find(s => s.role === 'bridge') || segments[0];
  return (
    !!bearer && bearer.role === segment.role && bearer.source === segment.source && bearer.target === segment.target
  );
};

const applyLeafLabel = (aggregate: EdgeModel, leafLabel: string | undefined, carryLabel: boolean): void => {
  if (!carryLabel || !leafLabel) {
    return;
  }
  const labels: string[] = aggregate.data?.labels ? [...aggregate.data.labels] : [];
  if (!labels.includes(leafLabel)) {
    labels.push(leafLabel);
  }
  aggregate.data = { ...aggregate.data, labels };
  aggregate.label = labels.join(', ');
};

const createSegmentEdge = (
  aggregateEdgeType: string,
  segment: PathSegment,
  leafEdgeId: string,
  leafSource: string,
  legacyBridgeId = false,
  leafLabel?: string,
  carryLabel = false
): EdgeModel => {
  const model: EdgeModel = {
    id: segmentId(segment, legacyBridgeId),
    type: aggregateEdgeType,
    source: segment.source,
    target: segment.target,
    data: {
      role: segment.role,
      bridgeKey: segment.bridgeKey,
      // O(1) bridge lookup for exit/entry stub snapping (avoids scanning all graph edges).
      ...(segment.role !== 'bridge' ? { bridgeId: `aggregate_bridge_${segment.bridgeKey}` } : {}),
      bidirectional: false,
      count: 1,
      aggregatedEdgeIds: [leafEdgeId]
    }
  };
  applyLeafLabel(model, leafLabel, carryLabel);
  return model;
};

const mergeSegment = (
  existing: EdgeModel,
  leafEdgeId: string,
  leafSource: string,
  segment: PathSegment,
  leafLabel?: string,
  carryLabel = false
): void => {
  const ids: string[] = existing.data?.aggregatedEdgeIds ? [...existing.data.aggregatedEdgeIds] : [];
  if (!ids.includes(leafEdgeId)) {
    ids.push(leafEdgeId);
  }
  existing.data = {
    ...existing.data,
    role: segment.role,
    bridgeKey: segment.bridgeKey,
    count: ids.length,
    aggregatedEdgeIds: ids,
    bidirectional:
      segment.role === 'bridge'
        ? existing.data?.bidirectional || existing.source !== leafSource
        : existing.data?.bidirectional || false
  };
  applyLeafLabel(existing, leafLabel, carryLabel);
};

/**
 * Collapse-only aggregation (historical behavior): remap endpoints to collapsed
 * ancestors and create a single aggregate when 2+ parallel remapped edges exist.
 */
const aggregateByCollapsedGroups = (
  aggregateEdgeType: string,
  edges: EdgeModel[],
  parentOf: ParentIndex,
  collapsedIds: Set<string>
): EdgeModel[] => {
  const pendingAggregates: EdgeModel[] = [];
  const segmentIndex = new Map<string, EdgeModel>();

  return edges.reduce((newEdges: EdgeModel[], edge: EdgeModel) => {
    edge.visible = 'visible' in edge ? edge.visible : true;

    const source = getCollapsedDisplayedNode(edge.source || '', parentOf, collapsedIds);
    const target = getCollapsedDisplayedNode(edge.target || '', parentOf, collapsedIds);
    const remapped = source !== edge.source || target !== edge.target;

    if (!remapped) {
      newEdges.push(edge);
      return newEdges;
    }

    if (source === target) {
      edge.visible = false;
      newEdges.push(edge);
      return newEdges;
    }

    const segment: PathSegment = {
      source,
      target,
      role: 'bridge',
      undirected: true,
      bridgeKey: makeBridgeKey(source, target)
    };
    const key = segmentLookupKey(aggregateEdgeType, segment);
    const existing = segmentIndex.get(key);

    if (existing) {
      mergeSegment(existing, edge.id, edge.source || '', segment, edge.label, true);
      // Keep children for backward compatibility with prior collapse aggregation.
      existing.children = existing.data.aggregatedEdgeIds;
      edge.visible = false;
      if (!newEdges.includes(existing)) {
        newEdges.push(existing);
      }
    } else {
      const aggregate = createSegmentEdge(
        aggregateEdgeType,
        segment,
        edge.id,
        edge.source || '',
        true,
        edge.label,
        true
      );
      aggregate.children = [edge.id];
      pendingAggregates.push(aggregate);
      segmentIndex.set(key, aggregate);
    }

    newEdges.push(edge);
    return newEdges;
  }, [] as EdgeModel[]);
};

/**
 * Group-edge aggregation: split each cross-group leaf into exit / bridge / entry
 * segments and merge bridges (and stubs for the same bridge) across leaf edges.
 */
const aggregateByGroupEdges = (
  aggregateEdgeType: string,
  edges: EdgeModel[],
  nodesById: Map<string, NodeModel>,
  parentOf: ParentIndex,
  collapsedIds: Set<string>,
  collapsedGroups: boolean
): EdgeModel[] => {
  const result: EdgeModel[] = [];
  const segmentIndex = new Map<string, EdgeModel>();

  edges.forEach(edge => {
    edge.visible = 'visible' in edge ? edge.visible : true;

    let source = edge.source || '';
    let target = edge.target || '';

    if (collapsedGroups) {
      source = getCollapsedDisplayedNode(source, parentOf, collapsedIds);
      target = getCollapsedDisplayedNode(target, parentOf, collapsedIds);
    }

    if (source === target) {
      edge.visible = false;
      result.push(edge);
      return;
    }

    const segments = getGroupPathSegments(source, target, nodesById, parentOf);

    if (segments === null) {
      // Ancestor relationship — hide.
      edge.visible = false;
      result.push(edge);
      return;
    }

    if (segments.length === 0) {
      // Same group siblings / both ungrouped — keep leaf (unless collapse remapped).
      if (source !== edge.source || target !== edge.target) {
        // Collapsed remap with no further group split: treat like collapse-only single edge.
        edge.visible = true;
      }
      result.push(edge);
      return;
    }

    edge.visible = false;
    result.push(edge);

    segments.forEach(segment => {
      const carryLabel = isLabelBearer(segments, segment);
      const key = segmentLookupKey(aggregateEdgeType, segment);
      const existing = segmentIndex.get(key);
      if (existing) {
        mergeSegment(existing, edge.id, edge.source || '', segment, edge.label, carryLabel);
      } else {
        const created = createSegmentEdge(
          aggregateEdgeType,
          segment,
          edge.id,
          edge.source || '',
          false,
          edge.label,
          carryLabel
        );
        segmentIndex.set(key, created);
        result.push(created);
      }
    });
  });

  return result;
};

/**
 * Create aggregate edges that replace sets of leaf edges with visible summary edges.
 *
 * @param aggregateEdgeType Type string for created aggregate edges (for component factories).
 * @param edges Leaf edges to process.
 * @param nodes Full node model (including groups) used to resolve parents and collapse.
 * @param options Aggregation modes. Defaults: `{ collapsedGroups: true, groupEdges: false }`.
 */
const createAggregateEdges = (
  aggregateEdgeType: string,
  edges: EdgeModel[] | undefined,
  nodes: NodeModel[] | undefined,
  options: AggregateEdgesOptions = {}
): EdgeModel[] => {
  if (!edges?.length) {
    return [];
  }
  if (!nodes?.length) {
    return edges;
  }

  const collapsedGroups = options.collapsedGroups ?? true;
  const groupEdges = options.groupEdges ?? false;
  const parentOf = buildParentIndex(nodes);
  const nodesById = new Map(nodes.map(n => [n.id, n]));
  const collapsedIds = new Set(nodes.filter(n => n.collapsed).map(n => n.id));

  if (groupEdges) {
    return aggregateByGroupEdges(aggregateEdgeType, edges, nodesById, parentOf, collapsedIds, collapsedGroups);
  }

  if (collapsedGroups) {
    return aggregateByCollapsedGroups(aggregateEdgeType, edges, parentOf, collapsedIds);
  }

  return edges;
};

export { createAggregateEdges };
