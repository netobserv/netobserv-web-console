import {
  Edge,
  Layout,
  LayoutLink,
  LayoutOptions,
  BreadthFirstLayout as PfBreadthFirstLayout
} from '@patternfly/react-topology';
import { collectLayoutLinks } from './layout-edges';

/**
 * BreadthFirst with aggregate-edge-aware link filtering.
 * PF's layout resolves group endpoints to the first leaf child; exit stubs then
 * become self-loops, roots become empty, and every node stays at the center.
 */
export class BreadthFirstLayout extends PfBreadthFirstLayout implements Layout {
  constructor(graph: ConstructorParameters<typeof PfBreadthFirstLayout>[0], options?: Partial<LayoutOptions>) {
    super(graph, options);
  }

  protected getLinks(edges: Edge[]): LayoutLink[] {
    return collectLayoutLinks(
      edges,
      this.nodes,
      (nodes, node) => this.getLayoutNode(nodes, node),
      (edge, source, target) => this.createLayoutLink(edge, source, target, false),
      this.initializeEdgeBendpoints
    );
  }
}
