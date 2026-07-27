import { css } from '@patternfly/react-styles';
import {
  ConnectDragSource,
  DefaultConnectorTerminal,
  Edge,
  EdgeStyle,
  EdgeTerminalType,
  getClosestVisibleParent,
  getEdgeAnimationDuration,
  getEdgeStyleClassModifier,
  GraphElement,
  isEdge,
  isNode,
  Layer,
  NodeStatus,
  observer,
  OnSelect,
  Point,
  ScaleDetailsLevel,
  StatusModifier,
  TOP_LAYER as topLayer,
  useHover
} from '@patternfly/react-topology';
import { getConnectorStartPoint } from '@patternfly/react-topology/dist/esm/components/edges/terminals/terminalUtils';
import styles from '@patternfly/react-topology/src/css/topology-components';
import * as React from 'react';
import type { TlsLockSeverity } from '../../../../../utils/tls-lock-severity';
import TopologyConnectorTag from './topology-connector-tag';

interface DefaultEdgeProps {
  /** Additional content added to the edge */
  children?: React.ReactNode;
  /** Additional classes added to the edge */
  className?: string;
  /** The graph edge element to represent */
  element: GraphElement;
  /** Flag indicating if the user is dragging the edge */
  dragging?: boolean;
  /** The style of the edge. Defaults to the style set on the Edge's model */
  edgeStyle?: EdgeStyle;
  /** The duration in seconds for the edge animation. Defaults to the animationSpeed set on the Edge's model */
  animationDuration?: number;
  /** The terminal type to use for the edge start */
  startTerminalType?: EdgeTerminalType;
  /** Additional classes added to the start terminal */
  startTerminalClass?: string;
  /** The status to indicate on the start terminal */
  startTerminalStatus?: NodeStatus;
  /** The size of the start terminal */
  startTerminalSize?: number;
  /** The terminal type to use for the edge end */
  endTerminalType?: EdgeTerminalType;
  /** Additional classes added to the end terminal */
  endTerminalClass?: string;
  /** The status to indicate on the end terminal */
  endTerminalStatus?: NodeStatus;
  /** The size of the end terminal */
  endTerminalSize?: number;
  /** Tag to show for the terminal */
  tag?: string;
  /** Additional classes added to the tag */
  tagClass?: string;
  /** The status to indicate on the tag */
  tagStatus?: NodeStatus;
  /** When true, show a lock icon on the edge tag (TLS observed on aggregated flows). */
  tagTlsSecure?: boolean;
  /** Closed-lock color tier from TLSVersion labels (deprecated / legacy / modern / unknown). */
  tagTlsLockSeverity?: TlsLockSeverity;
  /** Open-lock hint when no TLS in aggregated logs (optional; from edge data if set). */
  tagTlsCleartext?: boolean;
  /** Function to call for showing a remove indicator on the edge. Part of WithRemoveConnectorProps  */
  onShowRemoveConnector?: () => void;
  /** Function to call for removing the remove indicator on the edge. Part of WithRemoveConnectorProps  */
  onHideRemoveConnector?: () => void;
  /** Ref to use to start the drag of the start of the edge. Part of WithSourceDragProps */
  sourceDragRef?: ConnectDragSource;
  /** Ref to use to start the drag of the end of the edge. Part of WithTargetDragProps */
  targetDragRef?: ConnectDragSource;
  /** Flag indicating if the element is selected. Part of WithSelectionProps */
  selected?: boolean;
  /** Function to call when the element should become selected (or deselected). Part of WithSelectionProps */
  onSelect?: OnSelect;
  /** Function to call to show a context menu for the edge  */
  onContextMenu?: (e: React.MouseEvent) => void;
  /** Flag indicating that the context menu for the edge is currently open  */
  contextMenuOpen?: boolean;
  /** Test id for Cypress / RTL targeting */
  'data-test'?: string;
  /** custom netobserv props */
  shadowed?: boolean;
  filtered?: boolean;
  drops?: number;
  highlighted?: boolean;
  isDark?: boolean;
}

type DefaultEdgeInnerProps = Omit<DefaultEdgeProps, 'element'> & { element: Edge };

// DefaultEdgeInner: slightly modified from @patternfly/react-topology/src/components/edges/DefaultEdge.tsx
// to support shadow / hover behaviors

const DefaultEdgeInner: React.FunctionComponent<DefaultEdgeInnerProps> = observer(
  ({
    element,
    dragging,
    sourceDragRef,
    targetDragRef,
    edgeStyle,
    animationDuration,
    onShowRemoveConnector,
    onHideRemoveConnector,
    startTerminalType = EdgeTerminalType.none,
    startTerminalClass,
    startTerminalStatus,
    startTerminalSize = 14,
    endTerminalType = EdgeTerminalType.directional,
    endTerminalClass,
    endTerminalStatus,
    endTerminalSize = 14,
    tag,
    tagClass,
    tagStatus,
    tagTlsSecure,
    tagTlsLockSeverity,
    tagTlsCleartext,
    children,
    className,
    selected,
    onSelect,
    onContextMenu,
    shadowed,
    filtered,
    drops,
    highlighted,
    isDark,
    'data-test': dataTest
  }) => {
    const [hover, hoverRef] = useHover();
    const startPoint = element.getStartPoint();
    const endPoint = element.getEndPoint();

    React.useLayoutEffect(() => {
      if (hover && !dragging) {
        if (onShowRemoveConnector) {
          onShowRemoveConnector();
        }
      } else {
        if (onHideRemoveConnector) {
          onHideRemoveConnector();
        }
      }
    }, [hover, dragging, onShowRemoveConnector, onHideRemoveConnector]);

    // If the edge connects to nodes in a collapsed group don't draw
    const sourceParent = getClosestVisibleParent(element.getSource());
    const targetParent = getClosestVisibleParent(element.getTarget());
    if (sourceParent && isNode(sourceParent) && sourceParent.isCollapsed() && sourceParent === targetParent) {
      return null;
    }

    const detailsLevel = element.getGraph().getDetailsLevel();

    const groupClassName = css(
      styles.topologyEdge,
      className,
      dragging && 'pf-m-dragging',
      hover && !dragging && 'pf-m-hover',
      selected && !dragging && 'pf-m-selected',
      endTerminalStatus && StatusModifier[endTerminalStatus],
      'topology',
      hover && 'pf-m-hover',
      shadowed && 'shadowed',
      filtered && 'edge-filtered',
      drops && 'edge-has-drops',
      highlighted && 'edge-highlighted',
      isDark && 'dark'
    );

    const edgeAnimationDuration = animationDuration ?? getEdgeAnimationDuration(element.getEdgeAnimationSpeed());
    const linkClassName = css(styles.topologyEdgeLink, getEdgeStyleClassModifier(edgeStyle || element.getEdgeStyle()));

    const bendpoints = element.getBendpoints();

    const d = `M${startPoint.x} ${startPoint.y} ${bendpoints.map((b: Point) => `L${b.x} ${b.y} `).join('')}L${
      endPoint.x
    } ${endPoint.y}`;

    const bgStartPoint =
      !startTerminalType || startTerminalType === EdgeTerminalType.none
        ? [startPoint.x, startPoint.y]
        : getConnectorStartPoint(bendpoints?.[0] || endPoint, startPoint, startTerminalSize);
    const bgEndPoint =
      !endTerminalType || endTerminalType === EdgeTerminalType.none
        ? [endPoint.x, endPoint.y]
        : getConnectorStartPoint(bendpoints?.[bendpoints.length - 1] || startPoint, endPoint, endTerminalSize);
    const backgroundPath = `M${bgStartPoint[0]} ${bgStartPoint[1]} ${bendpoints
      .map((b: Point) => `L${b.x} ${b.y} `)
      .join('')}L${bgEndPoint[0]} ${bgEndPoint[1]}`;

    const showTag = (tag || tagTlsSecure || tagTlsCleartext) && (detailsLevel === ScaleDetailsLevel.high || hover);
    const scale = element.getGraph().getScale();
    const tagScale = hover && !(detailsLevel === ScaleDetailsLevel.high) ? Math.max(1, 1 / scale) : 1;
    const tagPositionScale = hover && !(detailsLevel === ScaleDetailsLevel.high) ? Math.min(1, scale) : 1;

    return (
      <Layer id={dragging || hover ? topLayer : undefined}>
        <g
          ref={hoverRef as React.LegacyRef<SVGGElement> | undefined}
          data-test-id="edge-handler"
          data-test={dataTest}
          className={groupClassName}
          onClick={onSelect}
          onContextMenu={onContextMenu}
        >
          <path
            className={css(styles.topologyEdgeBackground)}
            d={backgroundPath}
            onMouseEnter={onShowRemoveConnector}
            onMouseLeave={onHideRemoveConnector}
          />
          <path className={linkClassName} d={d} style={{ animationDuration: `${edgeAnimationDuration}s` }} />
          {showTag && (
            <g transform={`scale(${hover ? tagScale : 1})`}>
              <TopologyConnectorTag
                className={tagClass}
                startPoint={element.getStartPoint().scale(tagPositionScale)}
                endPoint={element.getEndPoint().scale(tagPositionScale)}
                tag={tag || ''}
                status={tagStatus}
                showLeadingLock={tagTlsSecure}
                showCleartextLock={tagTlsCleartext}
                lockSeverity={tagTlsLockSeverity}
              />
            </g>
          )}
          <DefaultConnectorTerminal
            className={startTerminalClass}
            isTarget={false}
            edge={element}
            size={startTerminalSize}
            dragRef={sourceDragRef}
            terminalType={startTerminalType}
            status={startTerminalStatus}
            highlight={dragging || hover}
          />
          <DefaultConnectorTerminal
            className={endTerminalClass}
            isTarget
            dragRef={targetDragRef}
            edge={element}
            size={endTerminalSize}
            terminalType={endTerminalType}
            status={endTerminalStatus}
            highlight={dragging || hover}
          />
          {children}
        </g>
      </Layer>
    );
  }
);

const DefaultEdge: React.FunctionComponent<DefaultEdgeProps> = ({
  element,
  startTerminalType = EdgeTerminalType.none,
  startTerminalSize = 14,
  endTerminalType = EdgeTerminalType.directional,
  endTerminalSize = 14,
  ...rest
}: DefaultEdgeProps) => {
  if (!isEdge(element)) {
    throw new Error('DefaultEdge must be used only on Edge elements');
  }
  return (
    <DefaultEdgeInner
      element={element}
      startTerminalType={startTerminalType}
      startTerminalSize={startTerminalSize}
      endTerminalType={endTerminalType}
      endTerminalSize={endTerminalSize}
      {...rest}
    />
  );
};

export default DefaultEdge;
