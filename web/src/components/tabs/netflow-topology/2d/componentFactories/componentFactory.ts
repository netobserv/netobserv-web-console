import {
  ComponentFactory,
  DefaultEdge,
  DefaultGroup,
  DefaultNode,
  GraphComponent,
  ModelKind
} from '@patternfly/react-topology';
import { ComponentType } from 'react';
import { GraphElementPeer } from '../../../../../model/topology';

export const componentFactory: ComponentFactory = (
  kind: ModelKind,
  type: string
): ComponentType<{ element: GraphElementPeer }> | undefined => {
  switch (type) {
    case 'group':
      return DefaultGroup;
    case 'aggregate-edge':
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
