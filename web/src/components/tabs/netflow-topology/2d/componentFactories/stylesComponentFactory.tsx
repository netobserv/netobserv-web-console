import {
  ComponentFactory,
  GraphComponent,
  graphDropTargetSpec,
  groupDropTargetSpec,
  ModelKind,
  nodeDragSourceSpec,
  NODE_DRAG_TYPE as nodeDragType,
  withDndDrop,
  withDragNode,
  withPanZoom,
  withSelection
} from '@patternfly/react-topology';
import * as React from 'react';
import { AGGREGATE_EDGE_TYPE, GraphElementPeer } from '../../../../../model/topology';

//keep default import here to use observers
import StyleAggregateEdge from '../styles/styleAggregateEdge';
import StyleEdge from '../styles/styleEdge';
import StyleGroup from '../styles/styleGroup';
import StyleNode from '../styles/styleNode';

export const stylesComponentFactory: ComponentFactory = (
  kind: ModelKind,
  type: string
): React.ComponentType<{ element: GraphElementPeer }> | undefined => {
  if (kind === ModelKind.graph) {
    return withDndDrop(graphDropTargetSpec([nodeDragType]))(withPanZoom()(GraphComponent));
  }
  switch (type) {
    case 'node':
      return withDragNode(nodeDragSourceSpec('node', true, true))(withSelection()(StyleNode));
    case 'group':
      return withDndDrop(groupDropTargetSpec)(withDragNode(nodeDragSourceSpec('group'))(withSelection()(StyleGroup)));
    case 'edge':
      return withSelection()(StyleEdge);
    case AGGREGATE_EDGE_TYPE:
      return withSelection()(StyleAggregateEdge);
    default:
      return undefined;
  }
};

export default stylesComponentFactory;
