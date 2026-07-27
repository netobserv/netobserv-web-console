import {
  ComponentFactory,
  DefaultEdge,
  DefaultGroup,
  DefaultNode,
  GraphComponent,
  ModelKind
} from '@patternfly/react-topology';
import { ComponentType } from 'react';
import { AGGREGATE_EDGE_TYPE, GraphElementPeer } from '../../../../../model/topology';

export const componentFactory: ComponentFactory = (
  kind: ModelKind,
  type: string
): ComponentType<{ element: GraphElementPeer }> | undefined => {
  switch (type) {
    case 'group':
      return DefaultGroup;
    case AGGREGATE_EDGE_TYPE:
      return DefaultEdge;
    default:
      switch (kind) {
        case ModelKind.graph:
          return GraphComponent;
        case ModelKind.node:
          return DefaultNode;
        case ModelKind.edge:
          return DefaultEdge;
        default:
          return undefined;
      }
  }
};

export default componentFactory;
