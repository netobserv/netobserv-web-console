import {
  ConcentricLayout,
  DagreGroupsLayout,
  DagreLayout,
  ForceLayout,
  Graph,
  GridLayout,
  Layout,
  LayoutFactory
} from '@patternfly/react-topology';
import { LayoutName } from '../../../../../model/topology';
import { BreadthFirstLayout } from './breadthFirstLayout';
import { ColaGroupsLayout } from './colaGroupsLayout';
import { ColaLayout } from './colaLayout';

const layoutFactory: LayoutFactory = (type: LayoutName, graph: Graph): Layout | undefined => {
  switch (type) {
    case 'BreadthFirst':
      return new BreadthFirstLayout(graph);
    case 'Cola':
      return new ColaLayout(graph);
    case 'ColaNoForce':
      return new ColaLayout(graph, { layoutOnDrag: false });
    case 'ColaGroups':
      return new ColaGroupsLayout(graph, { layoutOnDrag: false });
    case 'Concentric':
      return new ConcentricLayout(graph);
    case 'Dagre':
      return new DagreLayout(graph);
    case 'DagreGroup':
      return new DagreGroupsLayout(graph);
    case 'Force':
      return new ForceLayout(graph);
    case 'Grid':
      return new GridLayout(graph);
    default:
      return new ColaLayout(graph);
  }
};

export default layoutFactory;
