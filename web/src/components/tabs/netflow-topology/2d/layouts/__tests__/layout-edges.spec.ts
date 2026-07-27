import { Edge, LayoutLink, LayoutNode, Node } from '@patternfly/react-topology';
import { collectLayoutLinks, isLayoutRelevantEdge } from '../layout-edges';

const edgeWith = (partial: { visible?: boolean; role?: string; source?: Node; target?: Node }): Edge =>
  ({
    isVisible: () => partial.visible !== false,
    getData: () => (partial.role ? { role: partial.role } : {}),
    getSource: () => partial.source ?? null,
    getTarget: () => partial.target ?? null
  } as unknown as Edge);

describe('isLayoutRelevantEdge', () => {
  it('rejects hidden edges', () => {
    expect(isLayoutRelevantEdge(edgeWith({ visible: false, role: 'bridge' }))).toBe(false);
  });

  it('rejects exit and entry stubs', () => {
    expect(isLayoutRelevantEdge(edgeWith({ role: 'exit' }))).toBe(false);
    expect(isLayoutRelevantEdge(edgeWith({ role: 'entry' }))).toBe(false);
  });

  it('keeps bridges and plain edges', () => {
    expect(isLayoutRelevantEdge(edgeWith({ role: 'bridge' }))).toBe(true);
    expect(isLayoutRelevantEdge(edgeWith({}))).toBe(true);
  });
});

describe('collectLayoutLinks', () => {
  const sourceNode = { getId: () => 's' } as unknown as Node;
  const targetNode = { getId: () => 't' } as unknown as Node;
  const sourceLayout = { id: 's' } as LayoutNode;
  const targetLayout = { id: 't' } as LayoutNode;

  it('skips exit/entry, unresolved ends, and self-loops while initializing bendpoints', () => {
    const initBendpoints = jest.fn();
    const createLink = jest.fn(
      (_edge: Edge, source: LayoutNode, target: LayoutNode) => ({ source, target } as LayoutLink)
    );
    const getLayoutNode = jest.fn((_nodes: LayoutNode[], node: Node | null) => {
      if (node === sourceNode) {
        return sourceLayout;
      }
      if (node === targetNode) {
        return targetLayout;
      }
      return undefined;
    });

    const edges = [
      edgeWith({ role: 'exit', source: sourceNode, target: targetNode }),
      edgeWith({ role: 'entry', source: sourceNode, target: targetNode }),
      edgeWith({ role: 'bridge', source: sourceNode, target: null as unknown as Node }),
      edgeWith({ role: 'bridge', source: sourceNode, target: sourceNode }),
      edgeWith({ role: 'bridge', source: sourceNode, target: targetNode })
    ];

    const links = collectLayoutLinks(edges, [sourceLayout, targetLayout], getLayoutNode, createLink, initBendpoints);

    expect(links).toHaveLength(1);
    expect(createLink).toHaveBeenCalledTimes(1);
    expect(initBendpoints).toHaveBeenCalledTimes(1);
    expect(initBendpoints).toHaveBeenCalledWith(edges[4]);
  });
});
