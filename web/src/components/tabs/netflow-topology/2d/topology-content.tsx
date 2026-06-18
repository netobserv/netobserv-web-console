import { K8sModel } from '@openshift-console/dynamic-plugin-sdk';
import { Bullseye, ValidatedOptions } from '@patternfly/react-core';
import {
  createTopologyControlButtons,
  defaultControlButtonsOptions,
  GRAPH_LAYOUT_END_EVENT as graphLayoutEndEvent,
  GRAPH_POSITION_CHANGE_EVENT as graphPositionChangeEvent,
  Model,
  Node,
  SELECTION_EVENT as selectionEvent,
  SelectionEventListener,
  TopologyControlBar,
  TopologyView,
  useEventListener,
  useVisualizationController,
  VisualizationSurface
} from '@patternfly/react-topology';
import _ from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { TopologyMetrics } from '../../../../api/query-response';
import { HealthStats } from '../../../../components/health/health-helper';
import { Config } from '../../../../model/config';
import { Filter, FilterDefinition, Filters } from '../../../../model/filters';
import { FlowScope, MetricType, StatFunction } from '../../../../model/flow-query';
import { getStat } from '../../../../model/metrics';
import { useNetflowContext } from '../../../../model/netflow-context';
import { getStepInto, resolveGroupTypes, ScopeConfigDef } from '../../../../model/scope';
import {
  Decorated,
  ElementData,
  FilterDir,
  generateDataModel,
  GraphElementPeer,
  isDirElementFiltered,
  LayoutName,
  NodeData,
  toggleDirElementFilter,
  TopologyOptions
} from '../../../../model/topology';
import { usePrevious } from '../../../../utils/previous-hook';
import { Empty } from '../../../messages/empty';
import { SearchEvent, SearchHandle } from '../../../search/search';
import { filterEvent, stepIntoEvent } from './styles/styleDecorators';
import './topology-content.css';

export const hoverEvent = 'hover';

let requestFit = false;
let waitForMetrics = false;
let lastNodeIdsFound: string[] = [];

const zoomIn = 4 / 3;
const zoomOut = 3 / 4;
const fitPadding = 80;

export interface TopologyContentProps {
  containerRef?: React.RefObject<HTMLDivElement>;
  k8sModels: { [key: string]: K8sModel };
  expectedNodes: string[];
  metricFunction: StatFunction;
  metricType: MetricType;
  metricScope: FlowScope;
  setMetricScope: (ms: FlowScope) => void;
  scopes: ScopeConfigDef[];
  metrics: TopologyMetrics[];
  droppedMetrics: TopologyMetrics[];
  options: TopologyOptions;
  filters: Filters;
  filterDefinitions: FilterDefinition[];
  setFilters: (v: Filters) => void;
  selected: GraphElementPeer | undefined;
  onSelect: (e: GraphElementPeer | undefined) => void;
  searchHandle: SearchHandle | null;
  searchEvent?: SearchEvent;
  isDark?: boolean;
  resetDefaultFilters?: (c?: Config) => void;
  clearFilters?: () => void;
  resourceStats: HealthStats;
}

export const TopologyContent: React.FC<TopologyContentProps> = ({
  containerRef,
  k8sModels,
  expectedNodes,
  metricFunction,
  metricType,
  metricScope,
  setMetricScope,
  scopes,
  metrics,
  droppedMetrics,
  options,
  filters,
  filterDefinitions,
  setFilters,
  selected,
  onSelect,
  searchHandle,
  searchEvent,
  isDark,
  resetDefaultFilters,
  clearFilters,
  resourceStats
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const { caps } = useNetflowContext();
  const controller = useVisualizationController();
  const prevMetrics = usePrevious(metrics);
  const prevMetricFunction = usePrevious(metricFunction);
  const prevMetricType = usePrevious(metricType);
  const prevMetricScope = usePrevious(metricScope);
  const prevOptions = usePrevious(options);

  // Track resolved group types to detect when auto resolution changes
  const resolvedGroupTypes = React.useMemo(
    () => resolveGroupTypes(options.groupTypes, metricScope, scopes),
    [options.groupTypes, metricScope, scopes]
  );
  const prevResolvedGroupTypes = usePrevious(resolvedGroupTypes);

  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [hoveredId, setHoveredId] = React.useState<string>('');

  const onSelectIds = React.useCallback(
    (ids: string[]) => {
      setSelectedIds(ids);
      onSelect(ids.length ? controller.getElementById(ids[0]) : undefined);
    },
    [controller, onSelect]
  );

  //search element by label or secondaryLabel
  const onSearch = React.useCallback(
    (searchValue: string, next = true) => {
      if (!searchHandle || _.isEmpty(searchValue)) {
        return;
      }

      if (controller && controller.hasGraph()) {
        const currentModel = controller.toModel();
        const matchingNodeModels =
          currentModel.nodes?.filter(
            n => n.label?.includes(searchValue) || n.data?.secondaryLabel?.includes(searchValue)
          ) || [];

        if (next) {
          //go back to first match if last item is reached
          if (lastNodeIdsFound.length === matchingNodeModels.length) {
            lastNodeIdsFound = [];
          }
        } else {
          if (lastNodeIdsFound.length === 1) {
            //fill matching ids except last
            lastNodeIdsFound = matchingNodeModels.map(n => n.id);
            lastNodeIdsFound.splice(-1);
          } else {
            //remove previous match
            lastNodeIdsFound.splice(-2);
          }
        }

        const nodeModelsFound = matchingNodeModels.filter(n => !lastNodeIdsFound.includes(n.id));
        const nodeFound = !_.isEmpty(nodeModelsFound) ? controller.getNodeById(nodeModelsFound![0].id) : undefined;
        if (nodeFound) {
          const id = nodeFound.getId();
          onSelectIds([id]);
          lastNodeIdsFound.push(id);
          searchHandle.updateIndicators(
            `${lastNodeIdsFound.length}/${lastNodeIdsFound.length + nodeModelsFound!.length - 1}`,
            ValidatedOptions.success
          );
          const bounds = controller.getGraph().getBounds();
          controller.getGraph().panIntoView(nodeFound, {
            offset: Math.min(bounds.width, bounds.height) / 2,
            minimumVisible: 100
          });
        } else {
          lastNodeIdsFound = [];
          searchHandle.updateIndicators('', ValidatedOptions.error);
          onSelectIds([]);
        }
      } else {
        console.error('searchElement called before controller graph');
      }
    },
    [controller, onSelectIds, searchHandle]
  );

  const setFiltersList = React.useCallback(
    (list: Filter[]) => {
      setFilters({ ...filters, list: list });
    },
    [setFilters, filters]
  );

  const onChangeSearch = () => {
    lastNodeIdsFound = [];
  };

  const onFilter = React.useCallback(
    (id: string, data: NodeData, dir: FilterDir, isFiltered: boolean) => {
      if (data.nodeType && data.peer) {
        toggleDirElementFilter(
          data.nodeType,
          data.peer,
          dir,
          isFiltered,
          filters.list,
          setFiltersList,
          filterDefinitions
        );
        setSelectedIds([id]);
      }
    },
    [filterDefinitions, filters.list, setFiltersList]
  );

  const onStepInto = React.useCallback(
    (data: Decorated<ElementData>) => {
      const scope = getStepInto(
        metricScope,
        scopes.map(sc => sc.id)
      );
      if (data.nodeType && data.peer && scope) {
        setMetricScope(scope);
        if (!isDirElementFiltered(data.nodeType, data.peer, 'src', filters.list, filterDefinitions)) {
          toggleDirElementFilter(
            data.nodeType,
            data.peer,
            'src',
            false,
            filters.list,
            list => {
              setFilters({ list: list, match: 'bidirectional' });
            },
            filterDefinitions
          );
        }
        setSelectedIds([data.id]);
        //clear search
        onChangeSearch();
        //clear selection
        onSelect(undefined);
      }
    },
    [metricScope, setMetricScope, scopes, filters.list, filterDefinitions, onSelect, setFilters]
  );

  const onHover = React.useCallback((data: Decorated<ElementData>) => {
    setHoveredId(data.isHovered ? data.id : '');
  }, []);

  //fit view to elements
  const fitView = React.useCallback(() => {
    if (controller && controller.hasGraph()) {
      controller.getGraph().fit(fitPadding);
    } else {
      console.error('fitView called before controller graph');
    }
  }, [controller]);

  const onLayoutEnd = React.useCallback(() => {
    //fit view to new loaded elements
    if (requestFit) {
      requestFit = false;
      if ([LayoutName.concentric, LayoutName.dagre, LayoutName.grid].includes(options.layout)) {
        fitView();
      } else {
        // Use requestAnimationFrame to fit after elements have settled
        let frameCount = 0;
        const maxFrames = 10; // Allow up to 10 frames for animations to complete
        const fitOnFrame = () => {
          frameCount++;
          fitView();
          if (frameCount < maxFrames) {
            requestAnimationFrame(fitOnFrame);
          }
        };
        requestAnimationFrame(fitOnFrame);
      }
    }
  }, [fitView, options.layout]);

  const onLayoutPositionChange = React.useCallback(() => {
    if (controller && controller.hasGraph()) {
      //hide popovers on pan / zoom
      const popover = document.querySelector('[aria-labelledby="popover-decorator-header"]');
      if (popover) {
        (popover as HTMLElement).style.display = 'none';
      }
    }
  }, [controller]);

  //get options with updated max edge value, metric type and function
  const getOptions = React.useCallback(() => {
    const maxEdgeStat = Math.max(...metrics.map(m => getStat(m.stats, metricFunction)));
    const opts: TopologyOptions = {
      ...options,
      maxEdgeStat,
      metricFunction,
      metricType,
      isTLSTracking: caps.isTLSTracking
    };
    return opts;
  }, [metrics, options, metricFunction, metricType, caps.isTLSTracking]);

  //update graph details level
  const setDetailsLevel = React.useCallback(() => {
    if (controller && controller.hasGraph()) {
      controller.getGraph().setDetailsLevelThresholds({
        low: options.lowScale,
        medium: options.medScale
      });
    }
  }, [controller, options.lowScale, options.medScale]);

  //reset graph and model
  const resetGraph = React.useCallback(() => {
    if (controller) {
      const model: Model = {
        graph: {
          id: 'g1',
          type: 'graph',
          layout: options.layout
        }
      };
      controller.fromModel(model, false);
      setDetailsLevel();
    }
  }, [controller, options.layout, setDetailsLevel]);

  //update details on low / med scale change
  React.useEffect(() => {
    setDetailsLevel();
  }, [controller, options.lowScale, options.medScale, setDetailsLevel]);

  //fit on container resize
  React.useEffect(() => {
    if (containerRef?.current) {
      const resizeObserver = new ResizeObserver(() => {
        setTimeout(() => fitView(), 500); // slight delay to allow for layout settling
      });
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [containerRef, fitView]);

  //update model merging existing nodes / edges
  const updateModel = React.useCallback(() => {
    if (!controller) {
      return;
    } else if (!controller.hasGraph()) {
      console.error('updateModel called while controller has no graph');
    } else if (waitForMetrics && prevMetrics === metrics) {
      return;
    }
    waitForMetrics = false;

    //highlight either hoveredId or selected id
    let highlightedId = hoveredId;
    if (!highlightedId && selectedIds.length === 1) {
      highlightedId = selectedIds[0];
    }

    const updatedModel = generateDataModel(
      metrics,
      droppedMetrics,
      getOptions(),
      metricScope,
      scopes,
      searchEvent?.searchValue || '',
      highlightedId,
      filters,
      t,
      filterDefinitions,
      k8sModels,
      expectedNodes,
      isDark,
      resourceStats
    );
    const allIds = [...(updatedModel.nodes || []), ...(updatedModel.edges || [])].map(item => item.id);
    controller.getElements().forEach(e => {
      if (e.getType() !== 'graph') {
        if (allIds.includes(e.getId())) {
          //keep previous data
          switch (e.getType()) {
            case 'node':
              const updatedNode = updatedModel.nodes?.find(n => n.id === e.getId());
              if (updatedNode) {
                updatedNode.data = { ...e.getData(), ...updatedNode.data };
              }
              break;
            case 'group':
              const updatedGroup = updatedModel.nodes?.find(n => n.id === e.getId());
              if (updatedGroup) {
                updatedGroup.collapsed = (e as Node).isCollapsed();
              }
              break;
          }
        } else {
          controller.removeElement(e);
        }
      }
    });
    controller.fromModel(updatedModel);
  }, [
    controller,
    prevMetrics,
    metrics,
    droppedMetrics,
    hoveredId,
    selectedIds,
    getOptions,
    metricScope,
    scopes,
    searchEvent?.searchValue,
    filters,
    t,
    filterDefinitions,
    k8sModels,
    expectedNodes,
    isDark,
    resourceStats
  ]);

  //update model on layout / metrics / filters change
  React.useEffect(() => {
    //update graph if layout changes or if resolved group types changed (including via 'auto' resolution)
    if (
      !controller.hasGraph() ||
      prevOptions?.layout !== options.layout ||
      prevOptions?.groupTypes !== options.groupTypes ||
      prevResolvedGroupTypes !== resolvedGroupTypes ||
      prevOptions.startCollapsed !== options.startCollapsed
    ) {
      resetGraph();
    }

    //skip refresh if scope changed or if resolved groups changed. It will refresh after getting new metrics
    if (prevOptions && (prevMetricScope !== metricScope || prevResolvedGroupTypes !== resolvedGroupTypes)) {
      waitForMetrics = true;
      return;
    }

    //then update model
    updateModel();
  }, [
    controller,
    metrics,
    filters,
    options,
    prevOptions,
    resetGraph,
    updateModel,
    prevMetricScope,
    metricScope,
    resolvedGroupTypes,
    prevResolvedGroupTypes
  ]);

  //request fit on layout end when filter / options change
  React.useEffect(() => {
    requestFit = true;
  }, [filters, options]);

  //clear existing edge tags on query change before getting new metrics
  React.useEffect(() => {
    if (controller && controller.hasGraph()) {
      if (prevMetricFunction !== metricFunction || prevMetricType !== metricType) {
        //remove edge tags on metrics change
        controller.getElements().forEach(e => {
          if (e.getType() === 'edge') {
            e.setData({
              ...e.getData(),
              tag: undefined,
              tagTlsSecure: undefined,
              tagTlsLockSeverity: undefined,
              tagTlsCleartext: undefined,
              tlsVersionLabels: undefined,
              tlsGroupLabels: undefined
            });
          }
        });
      }
    }
  }, [controller, metricFunction, metricType, prevMetricFunction, prevMetricType]);

  //refresh UI selected items
  React.useEffect(() => {
    const elementId = selected?.getId();
    const selectedId = _.isEmpty(selectedIds) ? undefined : selectedIds[0];
    if (elementId !== selectedId) {
      setSelectedIds(elementId ? [elementId] : []);
    }
  }, [selected, selectedIds]);

  React.useEffect(() => {
    if (searchHandle && searchEvent) {
      switch (searchEvent.type) {
        case 'change':
          onChangeSearch();
          break;
        case 'searchNext':
          onSearch(searchEvent.searchValue, true);
          break;
        case 'searchPrevious':
          onSearch(searchEvent.searchValue, false);
          break;
        default:
          throw new Error('unimplemented search type ' + searchEvent.type);
      }
    }
    // only trigger this on event change to avoid looping
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchEvent]);

  useEventListener<SelectionEventListener>(selectionEvent, onSelectIds);
  useEventListener(filterEvent, onFilter);
  useEventListener(stepIntoEvent, onStepInto);
  useEventListener(hoverEvent, onHover);
  useEventListener(graphLayoutEndEvent, onLayoutEnd);
  useEventListener(graphPositionChangeEvent, onLayoutPositionChange);

  if (_.isEmpty(metrics) && _.isEmpty(droppedMetrics) && _.isEmpty(expectedNodes)) {
    return (
      <Bullseye data-test="no-results-found">
        <Empty showDetails={true} resetDefaultFilters={resetDefaultFilters} clearFilters={clearFilters} />
      </Bullseye>
    );
  }

  return (
    <TopologyView
      data-test="topology-view"
      id="topology-view"
      controlBar={
        <TopologyControlBar
          data-test="topology-control-bar"
          controlButtons={createTopologyControlButtons({
            ...defaultControlButtonsOptions,
            fitToScreen: false,
            zoomInCallback: () => {
              if (controller) {
                controller.getGraph().scaleBy(zoomIn);
              }
            },
            zoomOutCallback: () => {
              if (controller) {
                controller.getGraph().scaleBy(zoomOut);
              }
            },
            resetViewCallback: () => {
              if (controller) {
                requestFit = true;
                controller.getGraph().reset();
                controller.getGraph().layout();
              }
            },
            //TODO: enable legend with display icons and colors
            legend: false
          })}
        />
      }
    >
      <VisualizationSurface data-test="visualization-surface" state={{ selectedIds }} />
    </TopologyView>
  );
};

export default TopologyContent;
