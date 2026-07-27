import { Edge, LayoutLink, LayoutNode, Node } from '@patternfly/react-topology';

/**
 * Aggregate exit/entry stubs are leaf↔group visuals. Layout engines resolve a
 * group endpoint to its first leaf child, which often creates a self-loop
 * (leaf→same leaf). That empties BreadthFirst roots (everything stays centered)
 * and adds useless/expensive constraints to Cola.
 *
 * Bridges (group↔group) stay in the layout graph so groups still attract.
 */
export const isLayoutRelevantEdge = (edge: Edge): boolean => {
  if (!edge.isVisible()) {
    return false;
  }
  const role = edge.getData()?.role as string | undefined;
  return role !== 'exit' && role !== 'entry';
};

type GetLayoutNode = (nodes: LayoutNode[], node: Node | null) => LayoutNode | undefined;
type CreateLayoutLink = (edge: Edge, source: LayoutNode, target: LayoutNode, isFalse?: boolean) => LayoutLink;
type InitBendpoints = (edge: Edge) => void;

export const collectLayoutLinks = (
  edges: Edge[],
  nodes: LayoutNode[],
  getLayoutNode: GetLayoutNode,
  createLayoutLink: CreateLayoutLink,
  initializeEdgeBendpoints: InitBendpoints
): LayoutLink[] => {
  const links: LayoutLink[] = [];
  edges.forEach(e => {
    if (!isLayoutRelevantEdge(e)) {
      return;
    }
    const source = getLayoutNode(nodes, e.getSource());
    const target = getLayoutNode(nodes, e.getTarget());
    // Skip unresolved ends and self-loops (group endpoint resolved to the same leaf).
    if (!source || !target || source === target || source.id === target.id) {
      return;
    }
    initializeEdgeBendpoints(e);
    links.push(createLayoutLink(e, source, target));
  });
  return links;
};
