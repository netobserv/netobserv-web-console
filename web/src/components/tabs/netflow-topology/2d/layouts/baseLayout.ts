/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ADD_CHILD_EVENT as addChildEvent,
  BaseEdge,
  DragEvent,
  DRAG_MOVE_OPERATION as dragMoveOperation,
  DRAG_NODE_END_EVENT as dragNodeEndEvent,
  DragNodeEventListener,
  DRAG_NODE_START_EVENT as dragNodeStartEvent,
  DragOperationWithType,
  Edge,
  ElementChildEventListener,
  ElementVisibilityChangeEvent,
  ELEMENT_VISIBILITY_CHANGE_EVENT as elementVisibilityChangeEvent,
  ElementVisibilityChangeEventListener,
  getClosestVisibleParent,
  Graph,
  GRAPH_LAYOUT_END_EVENT as graphLayoutEndEvent,
  groupNodeElements,
  isNode,
  Layout,
  LayoutGroup,
  LayoutLink,
  LayoutNode,
  LayoutOptions,
  leafNodeElements,
  Node,
  NODE_COLLAPSE_CHANGE_EVENT as nodeCollapseChangeEvent,
  NodeCollapseChangeEventListener,
  REMOVE_CHILD_EVENT as removeChildEvent
} from '@patternfly/react-topology';
import { ForceSimulation } from '@patternfly/react-topology/dist/esm/layouts/ForceSimulation';
import { action, makeObservable } from 'mobx';
import { collectLayoutLinks } from './layout-edges';

export const layoutDefaults: LayoutOptions = {
  linkDistance: 60,
  nodeDistance: 35,
  groupDistance: 35,
  collideDistance: 0,
  simulationSpeed: 10,
  chargeStrength: 0,
  allowDrag: true,
  layoutOnDrag: true
};

// BaseLayout: slightly modified from @patternfly/react-topology/src/layouts/BaseLayout.ts
// to avoid controller calls when not possible
export class BaseLayout implements Layout {
  protected readonly graph: Graph;

  protected forceSimulation: ForceSimulation;

  protected options: LayoutOptions;

  protected scheduleHandle?: number;

  private scheduleRestart = false;

  protected nodes: LayoutNode[] = [];

  protected edges: LayoutLink[] = [];

  protected groups: LayoutGroup[] = [];

  protected nodesMap: { [id: string]: LayoutNode } = {};

  constructor(graph: Graph, options?: Partial<LayoutOptions>) {
    makeObservable<BaseLayout, 'runLayout'>(this, { runLayout: action });

    this.graph = graph;
    this.options = {
      ...layoutDefaults,
      onSimulationEnd: this.onSimulationEnd,
      listenForChanges: true,
      ...options
    };

    if (this.options.allowDrag && graph.hasController()) {
      graph
        .getController()
        .addEventListener<DragNodeEventListener>(dragNodeStartEvent, this.handleDragStart)
        .addEventListener<DragNodeEventListener>(dragNodeEndEvent, this.handleDragEnd);
    }

    this.forceSimulation = new ForceSimulation(this.options);
    this.startListening();
  }

  getLayoutOptions(): LayoutOptions {
    return this.options;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  protected onSimulationEnd = () => {};

  destroy(): void {
    if (this.options.allowDrag && this.graph.hasController()) {
      this.graph
        .getController()
        .removeEventListener(dragNodeStartEvent, this.handleDragStart)
        .removeEventListener(dragNodeEndEvent, this.handleDragEnd);
    }

    this.stopListening();

    this.forceSimulation.destroy();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
  protected initDrag(element: Node, event: DragEvent, operation: DragOperationWithType): void {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
  protected endDrag(element: Node, event: DragEvent, operation: DragOperationWithType): void {}

  handleDragStart = (element: Node, event: DragEvent, operation: DragOperationWithType) => {
    this.initDrag(element, event, operation);

    if (!this.options.layoutOnDrag) {
      return;
    }

    if (operation.type !== dragMoveOperation) {
      this.forceSimulation.stopSimulation();
      return;
    }

    const id = element.getId();
    let found = false;
    const dragNode: LayoutNode | undefined = this.nodes.find((node: LayoutNode) => node.id === id);
    if (dragNode) {
      dragNode.isFixed = true;
      found = true;
    } else {
      const dragGroup: LayoutGroup | undefined = this.groups.find((group: LayoutGroup) => group.id === id);
      if (dragGroup) {
        const groupNodes = dragGroup.leaves;
        groupNodes.forEach((node: LayoutNode) => {
          node.isFixed = true;
        });
        found = true;
      }
    }

    if (found) {
      this.forceSimulation.alphaTarget(0.1);
      this.forceSimulation.restart();
    }
  };

  handleDragEnd = (element: Node, event: DragEvent, operation: DragOperationWithType) => {
    this.endDrag(element, event, operation);

    if (!this.options.layoutOnDrag) {
      return;
    }

    if (operation.type !== dragMoveOperation) {
      this.forceSimulation.restart();
      return;
    }

    const id = element.getId();
    const dragNode: LayoutNode | undefined = this.nodes.find((node: LayoutNode) => node.id === id);
    if (dragNode) {
      dragNode.isFixed = false;
    } else {
      const dragGroup: LayoutGroup | undefined = this.groups.find((group: LayoutGroup) => group.id === id);
      if (dragGroup) {
        const groupNodes = dragGroup.leaves;
        groupNodes.forEach((node: LayoutNode) => {
          node.isFixed = false;
        });
      }
    }
    this.forceSimulation.alphaTarget(0);
  };

  layout = () => {
    this.stopListening();

    this.runLayout(true);

    this.startListening();
  };

  private startListening(): void {
    const controller = this.graph.hasController() ? this.graph.getController() : undefined;
    if (controller && this.options.listenForChanges) {
      controller.addEventListener(addChildEvent, this.handleChildAdded);
      controller.addEventListener(removeChildEvent, this.handleChildRemoved);
      controller.addEventListener(elementVisibilityChangeEvent, this.handleElementVisibilityChange);
      controller.addEventListener(nodeCollapseChangeEvent, this.handleNodeCollapse);
    }
  }

  stop(): void {
    this.stopSimulation();
  }

  private stopListening(): void {
    const controller = this.graph.hasController() ? this.graph.getController() : undefined;
    if (this.scheduleHandle) {
      cancelAnimationFrame(this.scheduleHandle);
    }
    if (controller) {
      controller.removeEventListener(addChildEvent, this.handleChildAdded);
      controller.removeEventListener(removeChildEvent, this.handleChildRemoved);
      controller.removeEventListener(elementVisibilityChangeEvent, this.handleElementVisibilityChange);
      controller.removeEventListener(nodeCollapseChangeEvent, this.handleNodeCollapse);
    }
  }

  protected handleChildAdded: ElementChildEventListener = ({ child }): void => {
    if (!this.nodesMap[child.getId()]) {
      this.scheduleRestart = true;
      this.scheduleLayout();
    }
  };

  protected handleChildRemoved: ElementChildEventListener = ({ child }): void => {
    if (this.nodesMap[child.getId()]) {
      this.scheduleRestart = true;
      this.scheduleLayout();
    }
  };

  protected handleElementVisibilityChange: ElementVisibilityChangeEventListener = (
    event: ElementVisibilityChangeEvent
  ): void => {
    if (event.visible === (this.nodesMap[event.target.getId()] === undefined)) {
      this.scheduleRestart = true;
      this.scheduleLayout();
    }
  };

  private handleNodeCollapse: NodeCollapseChangeEventListener = ({ node }): void => {
    if (!node.isCollapsed()) {
      this.scheduleRestart = true;
      this.scheduleLayout();
    }
  };

  private scheduleLayout = (): void => {
    if (!this.scheduleHandle) {
      this.scheduleHandle = requestAnimationFrame(() => {
        delete this.scheduleHandle;
        try {
          this.runLayout(false, this.scheduleRestart);
          this.scheduleRestart = false;
        } catch {
          // intentionally ignored
        }
      });
    }
  };

  protected getFixedNodeDistance = (link: any): number =>
    Math.sqrt((link.sourceNode.x - link.targetNode.x) ** 2 + (link.sourceNode.y - link.targetNode.y) ** 2);

  protected getLayoutNode(nodes: LayoutNode[], node: Node | null): LayoutNode | undefined {
    if (!node) {
      return undefined;
    }

    let layoutNode = nodes.find(n => n.id === node.getId());
    if (!layoutNode && node.getNodes().length) {
      const id = node.getChildren()[0].getId();
      layoutNode = nodes.find(n => n.id === id);
    }
    if (!layoutNode) {
      layoutNode = this.getLayoutNode(nodes, getClosestVisibleParent(node));
    }

    return layoutNode;
  }

  // Faux Edges are used to layout nodes in a group together, as if they had links between them
  protected getFauxEdges(groups: LayoutGroup[], nodes: LayoutNode[]): LayoutLink[] {
    const fauxEdges: LayoutLink[] = [];
    groups.forEach((group: LayoutGroup) => {
      const groupNodes = group.element.getNodes();
      for (let i = 0; i < groupNodes.length; i++) {
        for (let j = i + 1; j < groupNodes.length; j++) {
          const fauxEdge = new BaseEdge();
          const source = this.getLayoutNode(nodes, groupNodes[i]);
          const target = this.getLayoutNode(nodes, groupNodes[j]);
          if (source && target) {
            const link = this.createLayoutLink(fauxEdge, source, target, true);
            fauxEdge.setController(target.element.getController());
            fauxEdges.push(link);
          }
        }
      }
    });

    return fauxEdges;
  }

  protected createLayoutNode(node: Node, nodeDistance: number, index: number) {
    return new LayoutNode(node, nodeDistance, index);
  }

  protected createLayoutLink(edge: Edge, source: LayoutNode, target: LayoutNode, isFalse = false): LayoutLink {
    return new LayoutLink(edge, source, target, isFalse);
  }

  protected createLayoutGroup(node: Node, padding: number, index: number) {
    return new LayoutGroup(node, padding, index);
  }

  protected getNodes(leafNodes: Node[], nodeDistance: number): LayoutNode[] {
    return leafNodes.map((n, index) => this.createLayoutNode(n, nodeDistance, index));
  }

  // Default is to clear any initial bend points
  protected initializeEdgeBendpoints = (edge: Edge): void => {
    // remove any bendpoints
    if (edge.getBendpoints().length > 0) {
      edge.setBendpoints([]);
    }
  };

  protected getLeafNodes = (): Node[] => leafNodeElements(this.graph.getNodes()).filter(n => n.isVisible());

  protected getGroupNodes = (): Node[] => groupNodeElements(this.graph.getNodes()).filter(g => g.isVisible());

  protected getLinks(edges: Edge[]): LayoutLink[] {
    return collectLayoutLinks(
      edges,
      this.nodes,
      (nodes, node) => this.getLayoutNode(nodes, node),
      (edge, source, target) => this.createLayoutLink(edge, source, target),
      this.initializeEdgeBendpoints
    );
  }

  protected hasVisibleChildren = (group: Node): boolean => !!group.getNodes().find(c => isNode(c) && c.isVisible());

  // Turn empty groups into nodes
  protected getNodesFromGroups(groups: Node[], nodeDistance: number, nodeCount: number): LayoutNode[] {
    let count = 0;
    const groupNodes: LayoutNode[] = [];
    groups.forEach((group: Node) => {
      if (!this.hasVisibleChildren(group)) {
        groupNodes.push(this.createLayoutNode(group, nodeDistance, nodeCount + count++));
      }
    });

    return groupNodes;
  }

  protected getGroups(groups: Node[], nodes: LayoutNode[], padding: number): LayoutGroup[] {
    let nodeIndex = 2 * nodes.length;
    // Create groups only for those with children
    const layoutGroups: LayoutGroup[] = groups
      .filter(g => this.hasVisibleChildren(g))
      .map((group: Node) => this.createLayoutGroup(group, padding, nodeIndex++));

    layoutGroups.forEach((groupNode: LayoutGroup) => {
      const leaves: LayoutNode[] = [];
      const leafElements = groupNode.element
        .getNodes()
        .filter((node: any) => !node.isGroup() || !this.hasVisibleChildren(node));
      leafElements.forEach((leaf: any) => {
        const layoutLeaf = nodes.find(n => n.id === leaf.getId());
        if (layoutLeaf) {
          leaves.push(layoutLeaf);
          layoutLeaf.parent = groupNode;
        }
      });
      groupNode.leaves = leaves;
      const childGroups: LayoutGroup[] = [];
      const groupElements = groupNode.element
        .getNodes()
        .filter((node: any) => node.isGroup() && node.isVisible() && !node.isCollapsed());
      groupElements.forEach((group: any) => {
        const layoutGroup = layoutGroups.find(g => g.id === group.getId());
        if (layoutGroup) {
          childGroups.push(layoutGroup);
          layoutGroup.parent = groupNode;
        }
      });
      groupNode.groups = childGroups;
    });

    return layoutGroups;
  }

  protected initializeNodePositions(nodes: LayoutNode[], graph: Graph, force: boolean): void {
    const { width, height } = graph.getBounds();
    const cx = width / 2;
    const cy = height / 2;

    nodes.forEach((node: LayoutNode) => {
      // only init position for nodes that have not been positioned
      if (force || !node.element.isPositioned()) {
        node.setPosition(cx, cy);
      } else {
        node.setFixed(true);
      }
    });
  }

  protected setupLayout(
    graph: Graph, // eslint-disable-line @typescript-eslint/no-unused-vars
    nodes: LayoutNode[], // eslint-disable-line @typescript-eslint/no-unused-vars
    edges: LayoutLink[], // eslint-disable-line @typescript-eslint/no-unused-vars
    groups: LayoutGroup[] // eslint-disable-line @typescript-eslint/no-unused-vars
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  ): void {}

  protected stopSimulation(): void {
    this.forceSimulation.haltForceSimulation();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
  protected startLayout(graph: Graph, initialRun: boolean, addingNodes: boolean, onEnd?: () => void): void {}

  // Interim, remove and update startLayout to public in next breaking change build
  public doStartLayout(graph: Graph, initialRun: boolean, addingNodes: boolean, onEnd?: () => void): void {
    return this.startLayout(graph, initialRun, addingNodes, onEnd);
  }

  protected updateLayout(): void {
    this.forceSimulation.useForceSimulation(this.nodes, this.edges, this.getFixedNodeDistance);
    this.forceSimulation.alpha(0.2);
  }

  private runLayout(initialRun: boolean, restart = true): void {
    const prevGroups = this.groups;

    // create datum
    const leafNodes = this.getLeafNodes();
    const groups = this.getGroupNodes();

    this.nodes = this.getNodes(leafNodes, this.options.nodeDistance);

    const groupNodes: LayoutNode[] = this.getNodesFromGroups(groups, this.options.nodeDistance, this.nodes.length);
    if (groupNodes) {
      this.nodes.push(...groupNodes);
    }

    this.groups = this.getGroups(groups, this.nodes, this.options.groupDistance);

    const newNodes: LayoutNode[] = initialRun
      ? this.nodes
      : this.nodes.filter(node => !this.nodesMap[node.element.getId()]);
    let addingNodes = restart && newNodes.length > 0;

    if (!initialRun && restart && !addingNodes) {
      this.groups.forEach(group => {
        const prevGroup = prevGroups.find(g => g.element.getId() === group.element.getId());
        if (!prevGroup) {
          addingNodes = true;
          newNodes.push(...group.leaves);
        } else {
          group.leaves.forEach(node => {
            if (!prevGroup.leaves.find(l => l.element.getId() === node.element.getId())) {
              newNodes.push(node);
            }
          });
        }
      });
      addingNodes = newNodes.length > 0;
    }

    this.edges = this.getLinks(this.graph.getEdges());

    // initialize new node positions
    this.initializeNodePositions(this.nodes, this.graph, initialRun);

    // re-create the nodes map
    this.nodesMap = this.nodes.reduce((acc, n) => {
      acc[n.id] = n;
      return acc;
    }, {} as any);

    // Add faux edges to keep grouped items together
    this.edges.push(...this.getFauxEdges(this.groups, this.nodes));

    this.setupLayout(this.graph, this.nodes, this.edges, this.groups);

    if (initialRun || addingNodes) {
      // Reset the force simulation
      this.stopSimulation();

      this.startLayout(this.graph, initialRun, addingNodes, () => {
        if (this.graph.hasController()) {
          this.graph.getController().fireEvent(graphLayoutEndEvent, { graph: this.graph });
        }
      });
    } else if (restart && this.options.layoutOnDrag) {
      this.updateLayout();
    }
  }
}
