import {
  DEFAULT_LAYER as defaultLayer,
  Layer,
  Node,
  NodeModel,
  NodeShape,
  observer,
  ScaleDetailsLevel,
  ShapeProps,
  TOP_LAYER as topLayer,
  TopologyQuadrant,
  useHover,
  WithDragNodeProps,
  WithSelectionProps
} from '@patternfly/react-topology';
import useDetailsLevel from '@patternfly/react-topology/dist/esm/hooks/useDetailsLevel';
import * as _ from 'lodash';
import * as React from 'react';
import { FaQuestion } from 'react-icons/fa';
import { TbWorldWww } from 'react-icons/tb';
import { TopologyMetricPeer } from '../../../../../api/query-response';
import { Match } from '../../../../../model/flow-query';
import { Decorated, NodeData } from '../../../../../model/topology';
import { useTheme } from '../../../../../utils/theme-hook';
import { getK8sResourceIcon } from '../../../../icons/kubernetes-icons';
import DefaultNode from '../components/node';
import { NodeDecorators } from './styleDecorators';

export enum DataTypes {
  Default
}
const iconPadding = 20;

type NodePeer = Node<NodeModel, Decorated<NodeData>>;

type StyleNodeProps = {
  element: NodePeer;
  getCustomShape?: (node: Node) => React.FC<ShapeProps>;
  getShapeDecoratorCenter?: (quadrant: TopologyQuadrant, node: NodePeer, radius?: number) => { x: number; y: number };
  showLabel?: boolean;
  showStatusDecorator?: boolean;
  regrouping?: boolean;
  dragging?: boolean;
} & WithDragNodeProps &
  WithSelectionProps;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getTypeIcon = (peer: TopologyMetricPeer): React.ComponentType<any> => {
  const icon = getK8sResourceIcon(peer.resourceKind);
  if (icon === null) {
    if (peer.addr || peer.subnetLabel) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return TbWorldWww as any;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return FaQuestion as any;
    }
  }
  return icon;
};

const renderIcon = (data: Decorated<NodeData>, element: NodePeer, isDarkTheme: boolean): React.ReactNode => {
  const { width, height } = element.getDimensions();
  const shape = element.getNodeShape();
  const iconSize =
    (shape === NodeShape.trapezoid ? width : Math.min(width, height)) -
    (shape === NodeShape.stadium ? 5 : iconPadding) * 2;
  const Component = getTypeIcon(data.peer);

  return (
    <g transform={`translate(${(width - iconSize) / 2}, ${(height - iconSize) / 2})`}>
      <Component
        width={iconSize}
        height={iconSize}
        size={iconSize}
        style={{ color: isDarkTheme ? '#ffffff' : '#393f44' }}
      />
    </g>
  );
};

const StyleNode: React.FC<StyleNodeProps> = ({ element, showLabel, dragging, getShapeDecoratorCenter, ...rest }) => {
  const isDarkTheme = useTheme();

  const nodeElement = element as Node;
  const data = element.getData() as Decorated<NodeData> | undefined;
  //TODO: check if we can have intelligent pin on view change
  const [isPinned, setPinned] = React.useState<boolean>(data?.isPinned === true);
  const [match, setMatch] = React.useState<Match>(data?.match || 'all');
  const [isSrcFiltered, setSrcFiltered] = React.useState<boolean>(data?.isSrcFiltered === true);
  const [isDstFiltered, setDstFiltered] = React.useState<boolean>(data?.isDstFiltered === true);
  const detailsLevel = useDetailsLevel();
  const [hover, hoverRef] = useHover();

  const passedData = React.useMemo(() => {
    return _.omitBy(data, _.isUndefined) as Decorated<NodeData> | undefined;
  }, [data]);

  React.useEffect(() => {
    setMatch(data?.match || 'all');
    setSrcFiltered(data?.isSrcFiltered === true);
    setDstFiltered(data?.isDstFiltered === true);
  }, [data?.isSrcFiltered, data?.isDstFiltered, data?.match]);

  if (!data || !passedData) {
    return null;
  }

  const updatedRest = { ...rest };
  if (isPinned) {
    //check if position has changed = controller reset element and is not pinned anymore
    if (element.getPosition() !== data.point) {
      setPinned(false);
    } else {
      updatedRest.dragNodeRef = undefined;
    }
  }

  return (
    <Layer id={passedData.dragging ? topLayer : defaultLayer}>
      <g ref={hoverRef as never}>
        <DefaultNode
          className="netobserv"
          element={element}
          scaleLabel={detailsLevel !== ScaleDetailsLevel.low}
          scaleNode={hover && detailsLevel === ScaleDetailsLevel.low}
          {...updatedRest}
          {...passedData}
          dragging={isPinned ? false : dragging}
          showLabel={hover || (detailsLevel !== ScaleDetailsLevel.low && showLabel)}
          showStatusBackground={!hover && detailsLevel === ScaleDetailsLevel.low}
          showStatusDecorator={detailsLevel === ScaleDetailsLevel.high && passedData.showStatusDecorator}
          statusDecoratorTooltip={nodeElement.getNodeStatus()}
          attachments={
            (hover || updatedRest.selected) && (
              <NodeDecorators
                element={element}
                data={data}
                isPinned={isPinned}
                setPinned={setPinned}
                match={match}
                isSrcFiltered={isSrcFiltered}
                setSrcFiltered={setSrcFiltered}
                isDstFiltered={isDstFiltered}
                setDstFiltered={setDstFiltered}
                getShapeDecoratorCenter={getShapeDecoratorCenter}
              />
            )
          }
        >
          {(hover || detailsLevel !== ScaleDetailsLevel.low) && renderIcon(passedData, element, isDarkTheme)}
        </DefaultNode>
      </g>
    </Layer>
  );
};

export default observer(StyleNode);
