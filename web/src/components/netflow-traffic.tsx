import { isModelFeatureFlag, ModelFeatureFlag, useResolvedExtensions } from '@openshift-console/dynamic-plugin-sdk';
import { Button, Flex, FlexItem, PageSection, Text, TextVariants, Title } from '@patternfly/react-core';
import { SyncAltIcon } from '@patternfly/react-icons';
import * as _ from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Record } from '../api/ipfix';
import { defaultNetflowMetrics } from '../api/query-response';
import { Config, defaultConfig } from '../model/config';
import { DisabledFilters, Filters, getDisabledFiltersRecord } from '../model/filters';
import {
  DataSource,
  FlowScope,
  isTimeMetric,
  MetricType,
  PacketLoss,
  RecordType,
  StatFunction
} from '../model/flow-query';
import { FetchCallbacks, NetflowContext, NetflowContextValue } from '../model/netflow-context';
import { getGroupsForScope } from '../model/scope';
import { DefaultOptions, GraphElementPeer, TopologyOptions } from '../model/topology';
import { Column, ColumnSizeMap } from '../utils/columns';
import { useConfigValidation } from '../utils/config-validation-hook';
import { ContextSingleton } from '../utils/context';
import { TimeRange } from '../utils/datetime';
import { useFullScreen } from '../utils/fullscreen-hook';
import { useK8sModelsWithColors } from '../utils/k8s-models-hook';
import {
  defaultArraySelectionOptions,
  localStorageColsKey,
  localStorageColsSizesKey,
  localStorageDisabledFiltersKey,
  localStorageLastLimitKey,
  localStorageLastTopKey,
  localStorageMetricFunctionKey,
  localStorageMetricScopeKey,
  localStorageMetricTypeKey,
  localStorageOverviewFocusKey,
  localStorageOverviewIdsKey,
  localStorageOverviewTruncateKey,
  localStorageQueryParamsKey,
  localStorageRefreshKey,
  localStorageShowHistogramKey,
  localStorageShowOptionsKey,
  localStorageSizeKey,
  localStorageTopologyOptionsKey,
  localStorageViewIdKey,
  useLocalStorage
} from '../utils/local-storage-hook';
import { useConfigCapabilities } from '../utils/netflow-capabilities-hook';
import { InitState, useDataFetching } from '../utils/netflow-fetching-hook';
import { OverviewPanel } from '../utils/overview-panels';
import {
  defaultMetricFunction,
  defaultMetricScope,
  defaultMetricType,
  defaultTimeRange,
  getDataSourceFromURL,
  getFiltersFromURL,
  getLimitFromURL,
  getPacketLossFromURL,
  getRangeFromURL,
  getRecordTypeFromURL,
  getShowDupFromURL,
  setURLFilters
} from '../utils/router';
import { useTheme } from '../utils/theme-hook';
import { netflowTrafficPath, useNavigate } from '../utils/url';
import { useURLSync } from '../utils/url-sync-hook';
import NetflowTrafficDrawer, { NetflowTrafficDrawerHandle } from './drawer/netflow-traffic-drawer';
import { rateMetricFunctions, timeMetricFunctions } from './dropdowns/metric-function-dropdown';
import { limitValues, topValues } from './dropdowns/query-options-panel';
import { RefreshDropdown } from './dropdowns/refresh-dropdown';
import TimeRangeDropdown from './dropdowns/time-range-dropdown';
import { TruncateLength } from './dropdowns/truncate-dropdown';
import GuidedTourPopover, { GuidedTourHandle } from './guided-tour/guided-tour';
import Modals from './modals/modals';
import './netflow-traffic.css';
import { SearchEvent, SearchHandle } from './search/search';
import FlowCollectorStatusIndicator from './status/flowcollector-status-indicator';
import TabsContainer from './tabs/tabs-container';
import { FiltersToolbar } from './toolbar/filters-toolbar';
import ChipsPopover from './toolbar/filters/chips-popover';
import HistogramToolbar from './toolbar/histogram-toolbar';
import ViewOptionsToolbar from './toolbar/view-options-toolbar';

export type ViewId = 'overview' | 'table' | 'topology';
export type Size = 's' | 'm' | 'l';

export interface NetflowTrafficProps {
  forcedNamespace?: string;
  forcedFilters?: Filters | null;
  isTab?: boolean;
  hideTitle?: boolean;
  parentConfig?: Config;
}

export const NetflowTraffic: React.FC<NetflowTrafficProps> = ({
  forcedNamespace,
  forcedFilters,
  isTab,
  hideTitle,
  parentConfig
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const navigate = useNavigate();
  const isDarkTheme = useTheme();
  const [extensions] = useResolvedExtensions<ModelFeatureFlag>(isModelFeatureFlag);
  ContextSingleton.setContext(forcedNamespace);

  // ===== STATE MANAGEMENT =====
  // Config state
  const [config, setConfig] = React.useState<Config>(defaultConfig);
  const k8sModels = useK8sModelsWithColors();

  // Local storage hooks
  const [queryParams, setQueryParams] = useLocalStorage<string>(localStorageQueryParamsKey);
  const [disabledFilters, setDisabledFilters] = useLocalStorage<DisabledFilters>(localStorageDisabledFiltersKey, {});
  const [size, setSize] = useLocalStorage<Size>(localStorageSizeKey, 'm');
  const [selectedViewId, setSelectedViewId] = useLocalStorage<ViewId>(localStorageViewIdKey, 'overview');
  const [lastLimit, setLastLimit] = useLocalStorage<number>(localStorageLastLimitKey, limitValues[0]);
  const [lastTop, setLastTop] = useLocalStorage<number>(localStorageLastTopKey, topValues[0]);
  const [metricScope, setMetricScope] = useLocalStorage<FlowScope>(localStorageMetricScopeKey, defaultMetricScope);
  const [topologyMetricFunction, setTopologyMetricFunction] = useLocalStorage<StatFunction>(
    localStorageMetricFunctionKey,
    defaultMetricFunction
  );
  const [topologyMetricType, setTopologyMetricType] = useLocalStorage<MetricType>(
    localStorageMetricTypeKey,
    defaultMetricType
  );
  const [interval, setInterval] = useLocalStorage<number | undefined>(localStorageRefreshKey);
  const [showViewOptions, setShowViewOptions] = useLocalStorage<boolean>(localStorageShowOptionsKey, false);
  const [showHistogram, setShowHistogram] = useLocalStorage<boolean>(localStorageShowHistogramKey, false);
  const [overviewTruncateLength, setOverviewTruncateLength] = useLocalStorage<TruncateLength>(
    localStorageOverviewTruncateKey,
    TruncateLength.M
  );
  const [overviewFocus, setOverviewFocus] = useLocalStorage<boolean>(localStorageOverviewFocusKey, false);
  const [topologyOptions, setTopologyOptions] = useLocalStorage<TopologyOptions>(
    localStorageTopologyOptionsKey,
    DefaultOptions
  );
  const [panels, setPanels] = useLocalStorage<OverviewPanel[]>(
    localStorageOverviewIdsKey,
    [],
    defaultArraySelectionOptions
  );
  const [columns, setColumns] = useLocalStorage<Column[]>(localStorageColsKey, [], defaultArraySelectionOptions);
  const [_columnSizes, setColumnSizes] = useLocalStorage<ColumnSizeMap>(localStorageColsSizesKey, {});

  // Display state
  const [isViewOptionOverflowMenuOpen, setViewOptionOverflowMenuOpen] = React.useState(false);
  const [isFullScreen, setFullScreen] = useFullScreen();
  const [isShowQuerySummary, setShowQuerySummary] = React.useState<boolean>(false);
  const [isTRModalOpen, setTRModalOpen] = React.useState(false);
  const [isOverviewModalOpen, setOverviewModalOpen] = React.useState(false);
  const [isColModalOpen, setColModalOpen] = React.useState(false);
  const [isExportModalOpen, setExportModalOpen] = React.useState(false);
  const [filters, setFilters] = React.useState<Filters>({ list: [], match: 'all' });
  const [packetLoss, setPacketLoss] = React.useState<PacketLoss>(getPacketLossFromURL());
  const [recordType, setRecordType] = React.useState<RecordType>(getRecordTypeFromURL());
  const [dataSource, setDataSource] = React.useState<DataSource>(getDataSourceFromURL());
  const [showDuplicates, setShowDuplicates] = React.useState<boolean>(getShowDupFromURL());
  const [limit, setLimit] = React.useState<number>(
    getLimitFromURL(selectedViewId === 'table' ? limitValues[0] : topValues[0])
  );
  const [range, setRange] = React.useState<number | TimeRange>(getRangeFromURL());
  const [histogramRange, setHistogramRange] = React.useState<TimeRange>();
  const [_selectedRecord, setSelectedRecord] = React.useState<Record | undefined>(undefined);
  const [_selectedElement, setSelectedElement] = React.useState<GraphElementPeer | undefined>(undefined);
  const [_searchEvent, setSearchEvent] = React.useState<SearchEvent | undefined>(undefined);

  // ===== SIDE EFFECTS =====
  // Set FlowCollector model in ContextSingleton when k8sModels change
  React.useEffect(() => {
    const flowCollectorModelKey = Object.keys(k8sModels).find(k => k.includes('FlowCollector'));
    if (flowCollectorModelKey) {
      ContextSingleton.setFlowCollectorK8SModel(k8sModels[flowCollectorModelKey]);
    }
  }, [k8sModels]);

  // ===== CONFIG CAPABILITIES =====
  const caps = useConfigCapabilities({
    config,
    selectedViewId,
    dataSource,
    columns,
    panels,
    metricScope,
    topologyOptions,
    topologyMetricType,
    forcedNamespace,
    forcedFilters,
    filters,
    limit,
    recordType,
    packetLoss,
    range
  });

  // ===== WRAPPED SETTERS FOR COMPLEX LOGIC =====
  const updateMetricScope = React.useCallback(
    (scope: FlowScope) => {
      setMetricScope(scope);
      // Invalidate groups if necessary, when metrics scope changed
      setTopologyOptions(prevOptions => {
        const groups = getGroupsForScope(scope, config.scopes);
        if (!groups.includes(prevOptions.groupTypes)) {
          return { ...prevOptions, groupTypes: 'auto' };
        }
        return prevOptions;
      });
    },
    [setMetricScope, config.scopes, setTopologyOptions]
  );

  const updateTopologyMetricType = React.useCallback(
    (metricType: MetricType) => {
      if (isTimeMetric(metricType)) {
        // fallback on average if current function not available for time queries
        setTopologyMetricFunction(prevFunc => {
          if (!timeMetricFunctions.includes(prevFunc)) {
            return 'avg';
          }
          return prevFunc;
        });
      } else {
        // fallback on average if current function not available for rate queries
        setTopologyMetricFunction(prevFunc => {
          if (!rateMetricFunctions.includes(prevFunc)) {
            return 'avg';
          }
          return prevFunc;
        });
      }
      setTopologyMetricType(metricType);
    },
    [setTopologyMetricFunction, setTopologyMetricType]
  );

  // Refs
  const drawerRef = React.useRef<NetflowTrafficDrawerHandle>(null);
  const searchRef = React.useRef<SearchHandle>(null);
  const guidedTourRef = React.useRef<GuidedTourHandle>(null);
  const initState = React.useRef<InitState>([]);

  // Data-fetching hook
  const {
    loading,
    error,
    flows,
    stats,
    metrics,
    metricsRef,
    lastRefresh,
    lastDuration,
    warning,
    chipsPopoverMessage,
    setChipsPopoverMessage,
    topologyUDNIds,
    tick,
    updateTableFilters,
    setFlows,
    setMetrics,
    setError
  } = useDataFetching({
    drawerRef,
    initState,
    caps,
    config,
    selectedViewId,
    range,
    histogramRange,
    showHistogram,
    showDuplicates,
    metricScope,
    topologyMetricType,
    topologyMetricFunction,
    topologyOptions,
    interval,
    isTRModalOpen,
    isOverviewModalOpen,
    isColModalOpen,
    isExportModalOpen,
    filters,
    setFilters,
    parentConfig,
    forcedFilters,
    setConfig,
    queryParams
  });

  const resetDefaultFilters = React.useCallback(() => {
    updateTableFilters({ match: filters.match, list: caps.defaultFilters });
  }, [filters.match, caps.defaultFilters, updateTableFilters]);

  const setFiltersFromURL = React.useCallback(() => {
    if (forcedFilters === null) {
      const filtersPromise = getFiltersFromURL(caps.filterDefs, disabledFilters);
      if (filtersPromise) {
        initState.current.push('urlFiltersPending');
        filtersPromise.then(updateTableFilters);
      } else {
        resetDefaultFilters();
      }
    }
  }, [disabledFilters, forcedFilters, caps.filterDefs, resetDefaultFilters, updateTableFilters]);

  const clearFilters = React.useCallback(() => {
    if (forcedFilters) {
      navigate(netflowTrafficPath);
    } else if (filters) {
      //set URL Param to empty value to be able to restore state coming from another page
      const empty: Filters = { ...filters, list: [], match: 'all' };
      setURLFilters(empty);
      updateTableFilters(empty);
    }
  }, [forcedFilters, filters, navigate, updateTableFilters]);

  // Effects

  // Validate and coerce state when config/capabilities change
  useConfigValidation({
    initState,
    config,
    caps,
    filters,
    updateTableFilters,
    recordType,
    setRecordType,
    dataSource,
    setDataSource,
    packetLoss,
    setPacketLoss,
    metricScope,
    setMetricScope,
    topologyMetricType,
    setTopologyMetricType,
    setColumns,
    setPanels,
    setFiltersFromURL
  });

  // Sync state to URL params
  useURLSync({
    initState,
    filters,
    forcedFilters,
    range,
    limit,
    showDuplicates,
    topologyMetricFunction,
    topologyMetricType,
    selectedViewId,
    packetLoss,
    recordType,
    dataSource,
    setQueryParams,
    setTRModalOpen
  });

  // update local storage enabled filters
  React.useEffect(() => {
    if (initState.current.includes('configLoaded')) {
      setDisabledFilters(getDisabledFiltersRecord(filters.list));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Functions
  const clearSelections = () => {
    setTRModalOpen(false);
    setOverviewModalOpen(false);
    setColModalOpen(false);
    setSelectedRecord(undefined);
    setShowQuerySummary(false);
    setSelectedElement(undefined);
  };

  const selectView = (view: ViewId) => {
    clearSelections();
    //save / restore top / limit parameter according to selected view
    if (view === 'overview' && selectedViewId !== 'overview') {
      setLastLimit(limit);
      setLimit(lastTop);
    } else if (view !== 'overview' && selectedViewId === 'overview') {
      setLastTop(limit);
      setLimit(lastLimit);
    }

    if (view !== selectedViewId) {
      setFlows([]);
      setMetrics(defaultNetflowMetrics);
      if (!initState.current.includes('configLoadError')) {
        setError(undefined);
      }
    }
    setSelectedViewId(view);
  };

  // Views
  const actions = () => {
    return (
      <Flex direction={{ default: 'row' }}>
        <FlexItem>
          <Flex direction={{ default: 'column' }}>
            <FlexItem className="netobserv-action-title">
              <Text component={TextVariants.h4}>{t('Time range')}</Text>
            </FlexItem>
            <FlexItem flex={{ default: 'flex_1' }}>
              <TimeRangeDropdown
                data-test="time-range-dropdown"
                id="time-range-dropdown"
                range={range}
                setRange={setRange}
                openCustomModal={() => setTRModalOpen(true)}
              />
            </FlexItem>
          </Flex>
        </FlexItem>
        <FlexItem className="netobserv-refresh-interval-container">
          <Flex direction={{ default: 'column' }}>
            <FlexItem className="netobserv-action-title">
              <Text component={TextVariants.h4}>{t('Refresh interval')}</Text>
            </FlexItem>
            <FlexItem flex={{ default: 'flex_1' }}>
              <RefreshDropdown
                data-test="refresh-dropdown"
                id="refresh-dropdown"
                disabled={showHistogram || typeof range !== 'number'}
                interval={interval}
                setInterval={setInterval}
              />
            </FlexItem>
          </Flex>
        </FlexItem>
        <FlexItem className="netobserv-refresh-container">
          <Button
            data-test="refresh-button"
            id="refresh-button"
            className="co-action-refresh-button"
            variant="primary"
            onClick={() => tick()}
            icon={<SyncAltIcon style={{ animation: `spin ${loading ? 1 : 0}s linear infinite` }} />}
          />
        </FlexItem>
      </Flex>
    );
  };

  const pageHeader = () => {
    return (
      <div id="pageHeader">
        <Flex direction={{ default: 'row' }}>
          <FlexItem flex={{ default: 'flex_1' }}>
            <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
              <FlexItem>
                <Title headingLevel={TextVariants.h1}>{t('Network Traffic')}</Title>
              </FlexItem>
              <FlexItem>
                <FlowCollectorStatusIndicator />
              </FlexItem>
            </Flex>
          </FlexItem>
          <FlexItem>{actions()}</FlexItem>
        </Flex>
      </div>
    );
  };

  const isShowViewOptions = selectedViewId === 'table' ? showViewOptions && !showHistogram : showViewOptions;

  const fetchCallbacks: FetchCallbacks = React.useMemo(
    () => ({ metricsRef, setFlows, setMetrics, setError }),
    [metricsRef, setFlows, setMetrics, setError]
  );

  const contextValue: NetflowContextValue = React.useMemo(
    () => ({ caps, config, k8sModels, fetchCallbacks }),
    [caps, config, k8sModels, fetchCallbacks]
  );

  return extensions && !_.isEmpty(extensions) ? (
    <NetflowContext.Provider value={contextValue}>
      <PageSection id="pageSection" className={`${isDarkTheme ? 'dark' : 'light'} ${isTab ? 'tab' : ''}`}>
        {!hideTitle && pageHeader()}
        {!_.isEmpty(caps.filterDefs) && (
          <Flex direction={{ default: 'row' }} style={{ paddingRight: hideTitle ? '1.5rem' : undefined }}>
            <FlexItem style={{ paddingTop: hideTitle ? '1.8rem' : undefined }} flex={{ default: 'flex_1' }}>
              <FiltersToolbar
                id="filter-toolbar"
                filters={filters}
                forcedFilters={forcedFilters}
                setFilters={updateTableFilters}
                clearFilters={clearFilters}
                resetFilters={resetDefaultFilters}
                queryOptionsProps={{
                  limit,
                  recordType,
                  dataSource,
                  packetLoss,
                  setLimit,
                  setRecordType,
                  setDataSource,
                  setPacketLoss,
                  allowLoki: caps.allowLoki,
                  allowProm: caps.allowProm,
                  allowFlow: caps.isFlow,
                  allowConnection: caps.isConnectionTracking,
                  allowPktDrops: caps.isPktDrop,
                  useTopK: selectedViewId === 'overview'
                }}
                isFullScreen={isFullScreen}
                setFullScreen={setFullScreen}
              />
            </FlexItem>
            {hideTitle && <FlexItem style={{ alignSelf: 'flex-start' }}>{actions()}</FlexItem>}
          </Flex>
        )}
        {
          <TabsContainer
            selectedViewId={selectedViewId}
            showHistogram={showHistogram}
            setShowViewOptions={setShowViewOptions}
            setShowHistogram={setShowHistogram}
            setHistogramRange={setHistogramRange}
            selectView={selectView}
            isShowViewOptions={isShowViewOptions}
            style={{ paddingRight: hideTitle ? '1.5rem' : undefined }}
          />
        }
        {selectedViewId === 'table' && showHistogram && (
          <HistogramToolbar
            loading={loading}
            lastRefresh={lastRefresh}
            limit={limit}
            range={range}
            setRange={setRange}
            histogramRange={histogramRange}
            setHistogramRange={setHistogramRange}
            totalMetric={metrics.totalFlowCount?.result}
            guidedTourHandle={guidedTourRef.current}
            resetRange={() => setRange(defaultTimeRange)}
            tick={tick}
          />
        )}
        {isShowViewOptions && (
          <ViewOptionsToolbar
            size={size}
            overviewFocus={overviewFocus}
            setOverviewFocus={setOverviewFocus}
            selectedViewId={selectedViewId}
            setOverviewModalOpen={setOverviewModalOpen}
            overviewTruncateLength={overviewTruncateLength}
            setOverviewTruncateLength={setOverviewTruncateLength}
            setSize={setSize}
            metricScope={metricScope}
            setMetricScope={updateMetricScope}
            topologyMetricType={topologyMetricType}
            setTopologyMetricType={updateTopologyMetricType}
            topologyMetricFunction={topologyMetricFunction}
            setTopologyMetricFunction={setTopologyMetricFunction}
            topologyOptions={topologyOptions}
            setTopologyOptions={setTopologyOptions}
            setColModalOpen={setColModalOpen}
            setExportModalOpen={setExportModalOpen}
            isViewOptionOverflowMenuOpen={isViewOptionOverflowMenuOpen}
            setViewOptionOverflowMenuOpen={setViewOptionOverflowMenuOpen}
            showDuplicates={showDuplicates}
            setShowDuplicates={setShowDuplicates}
            setSearchEvent={setSearchEvent}
            ref={searchRef}
          />
        )}
        {
          <NetflowTrafficDrawer
            ref={drawerRef}
            error={error}
            currentState={initState.current}
            selectedViewId={selectedViewId}
            limit={limit}
            recordType={recordType}
            metrics={metrics}
            loading={loading}
            overviewTruncateLength={overviewTruncateLength}
            overviewFocus={overviewFocus}
            setOverviewFocus={setOverviewFocus}
            flows={flows}
            selectedRecord={_selectedRecord}
            setColumns={setColumns}
            columnSizes={_columnSizes}
            setColumnSizes={setColumnSizes}
            size={size}
            resetDefaultFilters={resetDefaultFilters}
            clearFilters={clearFilters}
            filters={filters}
            topologyMetricFunction={topologyMetricFunction}
            topologyMetricType={topologyMetricType}
            topologyUDNIds={topologyUDNIds}
            metricScope={metricScope}
            setMetricScope={updateMetricScope}
            topologyOptions={topologyOptions}
            setTopologyOptions={setTopologyOptions}
            setFilters={updateTableFilters}
            selectedElement={_selectedElement}
            searchHandle={searchRef.current}
            searchEvent={_searchEvent}
            isShowQuerySummary={isShowQuerySummary}
            lastRefresh={lastRefresh}
            range={range}
            setRange={setRange}
            setRecordType={setRecordType}
            stats={stats}
            lastDuration={lastDuration}
            warning={warning}
            setShowQuerySummary={setShowQuerySummary}
            clearSelections={clearSelections}
            setSelectedRecord={setSelectedRecord}
            setSelectedElement={setSelectedElement}
          />
        }
        {initState.current.includes('initDone') && (
          <Modals
            isTRModalOpen={isTRModalOpen}
            setTRModalOpen={setTRModalOpen}
            range={range}
            setRange={setRange}
            isOverviewModalOpen={isOverviewModalOpen}
            setOverviewModalOpen={setOverviewModalOpen}
            setPanels={setPanels}
            isColModalOpen={isColModalOpen}
            setColModalOpen={setColModalOpen}
            isExportModalOpen={isExportModalOpen}
            setExportModalOpen={setExportModalOpen}
            recordType={recordType}
            setColumnSizes={setColumnSizes}
            setColumns={setColumns}
            filters={(forcedFilters || filters).list}
          />
        )}
        <GuidedTourPopover id="netobserv" ref={guidedTourRef} isDark={isDarkTheme} />
        <ChipsPopover chipsPopoverMessage={chipsPopoverMessage} setChipsPopoverMessage={setChipsPopoverMessage} />
      </PageSection>
    </NetflowContext.Provider>
  ) : null;
};

export default NetflowTraffic;
