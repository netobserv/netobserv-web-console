import { css } from '@patternfly/react-styles';
import {
  AnchorEnd,
  Edge,
  EdgeTerminalType,
  isNode,
  Node,
  NodeStyle,
  observer,
  Point,
  SELECTION_EVENT as selectionEvent,
  SELECTION_STATE as selectionState,
  WithSelectionProps
} from '@patternfly/react-topology';
import { action } from 'mobx';
import * as React from 'react';
import { AggregateEdgeSnapContext } from '../aggregate-edge-snap-context';
import DefaultEdge from '../components/edge';
import StyleEdge from './styleEdge';

type StyleAggregateEdgeProps = {
  element: Edge;
} & WithSelectionProps;

type XY = { x: number; y: number };

/** Coarse threshold while nodes are still moving (approx snaps). */
const MOVE_SNAP_THRESHOLD = 3;
/** Fine threshold for settled hull snaps. */
const HULL_SNAP_THRESHOLD = 2;
/** After geometry stops changing, refine approx → real hull outline. */
const HULL_SETTLE_MS = 100;

const findRelatedBridge = (stub: Edge): Edge | undefined => {
  if (!stub.hasController()) {
    return undefined;
  }
  const bridgeId = stub.getData()?.bridgeId as string | undefined;
  if (bridgeId) {
    try {
      return stub.getController().getEdgeById(bridgeId);
    } catch {
      return undefined;
    }
  }
  const bridgeKey = stub.getData()?.bridgeKey as string | undefined;
  if (!bridgeKey) {
    return undefined;
  }
  return stub
    .getGraph()
    .getEdges()
    .find(e => e.getData()?.role === 'bridge' && e.getData()?.bridgeKey === bridgeKey);
};

const readGroupPadding = (group: Node): number => {
  const padding = group.getStyle<NodeStyle>()?.padding;
  if (typeof padding === 'number') {
    return padding;
  }
  if (padding && typeof padding === 'object') {
    const box = padding as { top?: number; right?: number; bottom?: number; left?: number };
    return Math.max(box.top ?? 0, box.right ?? 0, box.bottom ?? 0, box.left ?? 0);
  }
  return 17;
};

/** Last-resort O(1) ellipse on content bounds (used only when no SVG outline exists). */
const ellipseOnBounds = (group: Node, toward: Node): XY => {
  const b = group.getBounds();
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const reference = toward.getBounds().getCenter();
  const extra = Math.max(10, readGroupPadding(group) * 0.5);
  const width = b.width + extra * 2;
  const height = b.height + extra * 2;

  if (width === 0 || height === 0 || (cx === reference.x && cy === reference.y)) {
    return { x: cx, y: cy };
  }

  const dispX = (cx - reference.x) / (width / 2);
  const dispY = (cy - reference.y) / (height / 2);
  const len = Math.sqrt(dispX * dispX + dispY * dispY);
  if (len === 0) {
    return { x: cx, y: cy };
  }
  const lenProportion = (len - 1) / len;
  return {
    x: (cx - reference.x) * lenProportion + reference.x,
    y: (cy - reference.y) * lenProportion + reference.y
  };
};

type AnchorWithSvg = {
  svgElement?: SVGElement;
  getLocation: (reference: Point) => Point;
};

const getAnchorSvg = (group: Node, end: AnchorEnd): SVGElement | undefined => {
  const anchor = group.getAnchor(end) as AnchorWithSvg | undefined;
  return anchor?.svgElement;
};

/**
 * Motion-time border point on the *real* group outline.
 * - rect/ellipse/circle anchors are O(1) → use full getLocation
 * - path (hull) anchors: sample ~16 points and pick the one on the peer ray
 *   (~5–10× cheaper than PF's up to 100 getPointAtLength calls)
 */
const approxBorderFacing = (group: Node, toward: Node, end: AnchorEnd = AnchorEnd.both): XY => {
  const reference = toward.getBounds().getCenter();
  const svg = getAnchorSvg(group, end);

  // Non-path shapes: getLocation is already cheap and exact.
  if (svg instanceof SVGRectElement || svg instanceof SVGEllipseElement || svg instanceof SVGCircleElement) {
    const loc = group.getAnchor(end).getLocation(reference);
    return { x: loc.x, y: loc.y };
  }

  if (svg instanceof SVGPathElement && svg.viewportElement) {
    try {
      const localRef = reference.clone();
      group.translateFromParent(localRef);

      const pathLength = svg.getTotalLength();
      if (pathLength > 0) {
        const box = svg.getBBox();
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const vx = localRef.x - cx;
        const vy = localRef.y - cy;
        const vLen = Math.hypot(vx, vy) || 1;

        // 16 samples ≈ outline accuracy without the full PF path walk.
        const samples = 16;
        let best: XY | undefined;
        let bestScore = Infinity;
        for (let i = 0; i < samples; i++) {
          const p = svg.getPointAtLength((pathLength * i) / samples);
          const wx = p.x - cx;
          const wy = p.y - cy;
          const dot = vx * wx + vy * wy;
          if (dot <= 0) {
            continue; // opposite side of the hull
          }
          // Perpendicular distance from sample to the center→peer ray.
          const cross = Math.abs(vx * wy - vy * wx) / vLen;
          if (cross < bestScore) {
            bestScore = cross;
            best = { x: p.x, y: p.y };
          }
        }

        if (best) {
          const pt = new Point(best.x, best.y);
          group.translateToParent(pt);
          return { x: pt.x, y: pt.y };
        }
      }
    } catch {
      // Path not ready / detached — fall through.
    }
  }

  return ellipseOnBounds(group, toward);
};

/**
 * Full-precision outline (PF anchor, up to ~100 path samples). Settle only.
 */
const hullBorderFacing = (group: Node, toward: Node, end: AnchorEnd = AnchorEnd.both): XY => {
  const reference = toward.getBounds().getCenter();
  const anchor = group.getAnchor(end);
  if (anchor) {
    const loc = anchor.getLocation(reference);
    return { x: loc.x, y: loc.y };
  }
  return approxBorderFacing(group, toward, end);
};

const getPathPeer = (stub: Edge, role: 'exit' | 'entry', bridge: Edge): Node | undefined => {
  const bridgeSource = bridge.getSource();
  const bridgeTarget = bridge.getTarget();
  if (!isNode(bridgeSource) || !isNode(bridgeTarget)) {
    return undefined;
  }

  const endIds = new Set([stub.getSource().getId(), stub.getTarget().getId()]);
  if (endIds.has(bridgeSource.getId())) {
    return bridgeTarget;
  }
  if (endIds.has(bridgeTarget.getId())) {
    return bridgeSource;
  }

  const groupNode = role === 'exit' ? stub.getTarget() : stub.getSource();
  if (!isNode(groupNode)) {
    return undefined;
  }
  const center = groupNode.getBounds().getCenter();
  const sc = bridgeSource.getBounds().getCenter();
  const tc = bridgeTarget.getBounds().getCenter();
  const dSource = (sc.x - center.x) ** 2 + (sc.y - center.y) ** 2;
  const dTarget = (tc.x - center.x) ** 2 + (tc.y - center.y) ** 2;
  return dSource <= dTarget ? bridgeTarget : bridgeSource;
};

const getRelatedSegmentIds = (edge: Edge): string[] => {
  const leafIds = (edge.getData()?.aggregatedEdgeIds as string[] | undefined) || [];
  if (!leafIds.length) {
    return [edge.getId()];
  }

  const leafSet = new Set(leafIds);
  return edge
    .getGraph()
    .getEdges()
    .filter(e => {
      const ids = (e.getData()?.aggregatedEdgeIds as string[] | undefined) || [];
      return ids.some(id => leafSet.has(id));
    })
    .map(e => e.getId());
};

const significantlyMoved = (a: Point, x: number, y: number, threshold: number): boolean =>
  Math.abs(a.x - x) > threshold || Math.abs(a.y - y) > threshold;

/** Quantized bounds fingerprint so tiny float noise does not retrigger work. */
const boundsKey = (node: Node): string => {
  const b = node.getBounds();
  return `${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.width)},${Math.round(b.height)}`;
};

type SnapPlan = {
  start?: XY;
  end?: XY;
};

const applySnapPlan = (edge: Edge, plan: SnapPlan, threshold: number, clearUnset: boolean) => {
  action(() => {
    const startFixed = plan.start != null;
    const endFixed = plan.end != null;
    if (!startFixed && !endFixed) {
      return;
    }
    const startMoved = startFixed
      ? significantlyMoved(edge.getStartPoint(), plan.start!.x, plan.start!.y, threshold)
      : false;
    const endMoved = endFixed ? significantlyMoved(edge.getEndPoint(), plan.end!.x, plan.end!.y, threshold) : false;
    if (!startMoved && !endMoved) {
      return;
    }
    if (startFixed) {
      edge.setStartPoint(Math.round(plan.start!.x), Math.round(plan.start!.y));
    } else if (clearUnset) {
      edge.setStartPoint();
    }
    if (endFixed) {
      edge.setEndPoint(Math.round(plan.end!.x), Math.round(plan.end!.y));
    } else if (clearUnset) {
      edge.setEndPoint();
    }
  })();
};

const computeSnapPlan = (edge: Edge, role: string | undefined, precise: boolean): SnapPlan | undefined => {
  const sourceNode = edge.getSource();
  const targetNode = edge.getTarget();
  if (!isNode(sourceNode) || !isNode(targetNode)) {
    return undefined;
  }

  const borderFacing = precise
    ? (group: Node, toward: Node, end?: AnchorEnd) => hullBorderFacing(group, toward, end)
    : (group: Node, toward: Node, end?: AnchorEnd) => approxBorderFacing(group, toward, end ?? AnchorEnd.both);

  if (role === 'bridge') {
    return {
      start: borderFacing(sourceNode, targetNode, AnchorEnd.source),
      end: borderFacing(targetNode, sourceNode, AnchorEnd.target)
    };
  }

  if (role === 'exit' || role === 'entry') {
    const bridge = findRelatedBridge(edge);
    if (!bridge) {
      return undefined;
    }
    const peer = getPathPeer(edge, role, bridge);
    if (!peer) {
      return undefined;
    }
    const plan: SnapPlan = {};
    if (sourceNode.isGroup()) {
      plan.start = borderFacing(sourceNode, peer, AnchorEnd.source);
    }
    if (targetNode.isGroup()) {
      plan.end = borderFacing(targetNode, peer, AnchorEnd.target);
    }
    return plan;
  }

  return undefined;
};

const StyleAggregateEdge: React.FC<StyleAggregateEdgeProps> = ({ element, selected, onSelect: _onSelect, ...rest }) => {
  const snapGeneration = React.useContext(AggregateEdgeSnapContext);
  const edge = element;
  const data = edge.getData() || {};
  const role = data.role as string | undefined;
  const settleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = React.useRef(0);
  const lastSnapGenerationRef = React.useRef(snapGeneration);
  const hasController = edge.hasController();

  // Observe geometry only — do NOT sample SVG hulls during render (Cola tick hot path).
  let geoKey = '';
  let sourceNode: Node | undefined;
  let targetNode: Node | undefined;
  if (hasController) {
    sourceNode = edge.getSource() as Node;
    targetNode = edge.getTarget() as Node;
    geoKey = `${boundsKey(sourceNode)}|${boundsKey(targetNode)}`;
    if (role === 'exit' || role === 'entry') {
      const bridge = findRelatedBridge(edge);
      if (bridge) {
        geoKey += `|${boundsKey(bridge.getSource() as Node)}|${boundsKey(bridge.getTarget() as Node)}`;
      }
    }
  }

  React.useEffect(() => {
    if (!hasController || (role !== 'bridge' && role !== 'exit' && role !== 'entry')) {
      return undefined;
    }

    // Force snap after layout end / collapse; soft threshold while dragging.
    const forceSnap = lastSnapGenerationRef.current !== snapGeneration;
    lastSnapGenerationRef.current = snapGeneration;
    const moveThreshold = forceSnap ? 0 : MOVE_SNAP_THRESHOLD;
    const settleThreshold = forceSnap ? 0 : HULL_SNAP_THRESHOLD;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      if (!edge.hasController()) {
        return;
      }
      const plan = computeSnapPlan(edge, role, false);
      if (plan) {
        applySnapPlan(edge, plan, moveThreshold, true);
      }
    });

    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
    }
    settleTimerRef.current = setTimeout(
      () => {
        if (!edge.hasController()) {
          return;
        }
        const plan = computeSnapPlan(edge, role, true);
        if (plan) {
          applySnapPlan(edge, plan, settleThreshold, true);
        }
      },
      forceSnap ? 0 : HULL_SETTLE_MS
    );

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
      }
    };
  }, [edge, role, geoKey, snapGeneration, hasController]);

  if (!hasController || !sourceNode || !targetNode) {
    return null;
  }

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!edge.hasController()) {
      return;
    }
    const relatedIds = getRelatedSegmentIds(edge);
    const ordered = [edge.getId(), ...relatedIds.filter(id => id !== edge.getId())];
    const state = edge.getController().getState<{ [selectionState]?: string[] }>();
    const allSelected = ordered.every(id => state[selectionState]?.includes(id));
    const selectedIds = allSelected ? [] : ordered;
    action(() => {
      state[selectionState] = selectedIds;
    })();
    edge.getController().fireEvent(selectionEvent, selectedIds);
  };

  if (role === 'bridge' || !role) {
    return <StyleEdge element={element} {...rest} selected={selected} onSelect={handleSelect} />;
  }

  const passedData = { ...data };
  delete passedData.tag;
  delete passedData.tagTlsSecure;
  delete passedData.tagTlsCleartext;
  Object.keys(passedData).forEach(key => {
    if (passedData[key] === undefined) {
      delete passedData[key];
    }
  });

  return (
    <DefaultEdge
      className={css('netobserv')}
      element={element}
      {...rest}
      {...passedData}
      selected={selected}
      onSelect={handleSelect}
      startTerminalType={EdgeTerminalType.none}
      endTerminalType={
        role === 'entry' && isNode(targetNode) && !targetNode.isGroup()
          ? EdgeTerminalType.directional
          : EdgeTerminalType.none
      }
    />
  );
};

export default observer(StyleAggregateEdge);
