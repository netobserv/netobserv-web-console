import {
  Edge,
  Layout,
  LayoutLink,
  LayoutOptions,
  ColaGroupsLayout as PfColaGroupsLayout
} from '@patternfly/react-topology';
import { collectLayoutLinks } from './layout-edges';

/**
 * ColaGroups with aggregate-edge-aware link filtering (skip exit/entry stubs and
 * self-loops). Reduces first-layout work when groupEdges is on.
 */
export class ColaGroupsLayout extends PfColaGroupsLayout implements Layout {
  constructor(graph: ConstructorParameters<typeof PfColaGroupsLayout>[0], options?: Partial<LayoutOptions>) {
    super(graph, options);
  }

  protected getLinks(edges: Edge[]): LayoutLink[] {
    return collectLayoutLinks(
      edges,
      this.nodes,
      (nodes, node) => this.getLayoutNode(nodes, node),
      (edge, source, target) => this.createLayoutLink(edge, source, target),
      this.initializeEdgeBendpoints
    );
  }
}
