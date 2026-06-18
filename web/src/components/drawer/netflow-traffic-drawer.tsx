import { Drawer, DrawerContent, DrawerContentBody, Flex, FlexItem } from '@patternfly/react-core';
import _ from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Record } from '../../api/ipfix';
import { getFunctionMetricKey, getRateMetricKey, NetflowMetrics, Stats } from '../../api/query-response';
import { Config } from '../../model/config';
import { Filter, Filters, filtersEqual, hasIndexFields, hasNonIndexFields } from '../../model/filters';
import { FlowScope, MetricType, RecordType, StatFunction } from '../../model/flow-query';
import { useNetflowContext } from '../../model/netflow-context';
import { GraphElementPeer, TopologyOptions } from '../../model/topology';
import { Warning } from '../../model/warnings';
import { Column, ColumnSizeMap } from '../../utils/columns';
import { TimeRange } from '../../utils/datetime';
import { StructuredError } from '../../utils/errors';
import { useTheme } from '../../utils/theme-hook';
import { TruncateLength } from '../dropdowns/truncate-dropdown';
import { ErrorComponent, Size } from '../messages/error';
import { ViewId } from '../netflow-traffic';
import FlowsQuerySummary from '../query-summary/flows-query-summary';
import MetricsQuerySummary from '../query-summary/metrics-query-summary';
import SummaryPanel from '../query-summary/summary-panel';
import { SearchEvent, SearchHandle } from '../search/search';
import { NetflowOverview, NetflowOverviewHandle } from '../tabs/netflow-overview/netflow-overview';
import { NetflowTable, NetflowTableHandle } from '../tabs/netflow-table/netflow-table';
import { NetflowTopology, NetflowTopologyHandle } from '../tabs/netflow-topology/netflow-topology';
import ElementPanel from './element/element-panel';
import './netflow-traffic-drawer.css';
import RecordPanel from './record/record-panel';

export type NetflowTrafficDrawerHandle = {
  getOverviewHandle: () => NetflowOverviewHandle | null;
  getTableHandle: () => NetflowTableHandle | null;
  getTopologyHandle: () => NetflowTopologyHandle | null;
};

export interface NetflowTrafficDrawerProps {
  error: string | StructuredError | undefined;
  currentState: string[];
  selectedViewId: ViewId;
  limit: number;
  recordType: RecordType;
  metrics: NetflowMetrics;
  loading?: boolean;
  overviewTruncateLength: TruncateLength;
  overviewFocus: boolean;
  setOverviewFocus: (v: boolean) => void;
  flows: Record[];
  selectedRecord?: Record;
  setColumns: (v: Column[]) => void;
  columnSizes: ColumnSizeMap;
  setColumnSizes: (v: ColumnSizeMap) => void;
  size: Size;
  resetDefaultFilters: (c?: Config) => void;
  clearFilters: () => void;
  filters: Filters;
  topologyMetricFunction: StatFunction;
  topologyMetricType: MetricType;
  topologyUDNIds: string[];
  metricScope: FlowScope;
  setMetricScope: (ms: FlowScope) => void;
  topologyOptions: TopologyOptions;
  setTopologyOptions: (o: TopologyOptions) => void;
  setFilters: (v: Filters) => void;
  selectedElement: GraphElementPeer | undefined;
  searchHandle: SearchHandle | null;
  searchEvent?: SearchEvent;
  isShowQuerySummary: boolean;
  lastRefresh: Date | undefined;
  range: TimeRange | number;
  setRange: (tr: TimeRange | number) => void;
  setRecordType: (r: RecordType) => void;
  stats?: Stats;
  lastDuration?: number;
  warning?: Warning;
  setShowQuerySummary: (v: boolean) => void;
  clearSelections: () => void;
  setSelectedRecord: (v: Record | undefined) => void;
  setSelectedElement: (v: GraphElementPeer | undefined) => void;
}

// eslint-disable-next-line react/display-name
export const NetflowTrafficDrawer = React.forwardRef<NetflowTrafficDrawerHandle, NetflowTrafficDrawerProps>(
  (props, ref) => {
    const { t } = useTranslation('plugin__netobserv-plugin');
    const isDarkTheme = useTheme();
    const { caps, config, k8sModels } = useNetflowContext();

    const overviewRef = React.useRef<NetflowOverviewHandle>(null);
    const tableRef = React.useRef<NetflowTableHandle>(null);
    const topologyRef = React.useRef<NetflowTopologyHandle>(null);

    const {
      metrics,
      resetDefaultFilters,
      clearFilters,
      filters,
      topologyMetricFunction,
      topologyMetricType,
      setFilters,
      setShowQuerySummary,
      clearSelections,
      setSelectedRecord,
      setSelectedElement
    } = props;

    React.useImperativeHandle(ref, () => ({
      getOverviewHandle: () => overviewRef.current,
      getTableHandle: () => tableRef.current,
      getTopologyHandle: () => topologyRef.current
    }));

    const onRecordSelect = React.useCallback(
      (record?: Record) => {
        clearSelections();
        setSelectedRecord(record);
      },
      [clearSelections, setSelectedRecord]
    );

    const onElementSelect = React.useCallback(
      (element?: GraphElementPeer) => {
        clearSelections();
        setSelectedElement(element);
      },
      [clearSelections, setSelectedElement]
    );

    const onToggleQuerySummary = React.useCallback(
      (v: boolean) => {
        clearSelections();
        setShowQuerySummary(v);
      },
      [clearSelections, setShowQuerySummary]
    );

    const setFiltersList = React.useCallback(
      (list: Filter[]) => {
        setFilters({ ...filters, list: list });
      },
      [filters, setFilters]
    );

    const getResetDefaultFiltersProp = React.useCallback(() => {
      if (caps.defaultFilters.length > 0 && !filtersEqual(filters.list, caps.defaultFilters)) {
        return resetDefaultFilters;
      }
      return undefined;
    }, [caps.defaultFilters, resetDefaultFilters, filters.list]);

    const getClearFiltersProp = React.useCallback(() => {
      if (filters.list.length > 0) {
        return clearFilters;
      }
      return undefined;
    }, [filters.list, clearFilters]);

    const getTopologyMetrics = React.useCallback(() => {
      switch (topologyMetricType) {
        case 'Bytes':
        case 'Packets':
          return metrics.rate?.result?.[getRateMetricKey(topologyMetricType)];
        case 'DnsLatencyMs':
          return metrics.dnsLatency?.result?.[getFunctionMetricKey(topologyMetricFunction)];
        case 'TimeFlowRttNs':
          return metrics.rtt?.result?.[getFunctionMetricKey(topologyMetricFunction)];
        default:
          return undefined;
      }
    }, [metrics.dnsLatency, topologyMetricFunction, topologyMetricType, metrics.rate, metrics.rtt]);

    const getTopologyDroppedMetrics = React.useCallback(() => {
      switch (topologyMetricType) {
        case 'Bytes':
        case 'Packets':
        case 'PktDropBytes':
        case 'PktDropPackets':
          return metrics.droppedRate?.result?.[getRateMetricKey(topologyMetricType)];
        default:
          return undefined;
      }
    }, [metrics.droppedRate, topologyMetricType]);

    const checkSlownessReason = React.useCallback(
      (w: Warning | undefined): Warning | undefined => {
        if (w?.type == 'slow') {
          let reason = '';
          if (filters.match === 'any' && hasNonIndexFields(filters.list)) {
            reason = t(
              // eslint-disable-next-line max-len
              'When in "Match any" mode, try using only Namespace, Owner or Resource filters (which use indexed fields), or decrease limit / range, to improve the query performance'
            );
          } else if (filters.match === 'all' && !hasIndexFields(filters.list)) {
            reason = t(
              // eslint-disable-next-line max-len
              'Add Namespace, Owner or Resource filters (which use indexed fields), or decrease limit / range, to improve the query performance'
            );
          } else {
            reason = t('Add more filters or decrease limit / range to improve the query performance');
          }
          return { ...w, details: reason };
        }
        return w;
      },
      [filters, t]
    );

    const mainContent = () => {
      let content: JSX.Element | null = null;

      // For overview and topology tabs: show error banner and partial metrics when possible
      // For table tab or config errors: show full error page
      // For topology: if main metrics are missing, show full error page
      const err = props.error;
      const hasTopologyMetrics = props.selectedViewId === 'topology' && (getTopologyMetrics()?.length || 0) > 0;
      const showFullError =
        err &&
        (props.currentState.includes('configLoadError') ||
          props.selectedViewId === 'table' ||
          (props.selectedViewId === 'topology' && !hasTopologyMetrics));

      if (showFullError) {
        content = (
          <ErrorComponent
            title={t('Unable to get {{item}}', {
              item: props.currentState.includes('configLoadError') ? t('config') : props.selectedViewId
            })}
            error={err}
          />
        );
      } else {
        switch (props.selectedViewId) {
          case 'overview':
            content = (
              <>
                <NetflowOverview
                  ref={overviewRef}
                  limit={props.limit}
                  panels={caps.selectedPanels}
                  recordType={props.recordType}
                  scopes={caps.availableScopes}
                  metricScope={props.metricScope}
                  setMetricScope={props.setMetricScope}
                  metrics={props.metrics}
                  loading={props.loading}
                  isDark={isDarkTheme}
                  filterDefinitions={caps.filterDefs}
                  resetDefaultFilters={getResetDefaultFiltersProp()}
                  clearFilters={getClearFiltersProp()}
                  truncateLength={props.overviewTruncateLength}
                  focus={props.overviewFocus}
                  setFocus={props.setOverviewFocus}
                />
              </>
            );
            break;
          case 'table':
            content = (
              <NetflowTable
                ref={tableRef}
                loading={props.loading}
                allowPktDrops={caps.isPktDrop}
                flows={props.flows}
                selectedRecord={props.selectedRecord}
                size={props.size}
                onSelect={onRecordSelect}
                columns={caps.selectedColumns}
                setColumns={(v: Column[]) =>
                  props.setColumns(v.concat(caps.availableColumns.filter(col => !col.isSelected)))
                }
                columnSizes={props.columnSizes}
                setColumnSizes={props.setColumnSizes}
                resetDefaultFilters={getResetDefaultFiltersProp()}
                clearFilters={getClearFiltersProp()}
                isDark={isDarkTheme}
              />
            );
            break;
          case 'topology':
            content = (
              <>
                <NetflowTopology
                  ref={topologyRef}
                  loading={props.loading}
                  k8sModels={k8sModels}
                  metricFunction={props.topologyMetricFunction}
                  metricType={props.topologyMetricType}
                  metricScope={props.metricScope}
                  expectedNodes={[...props.topologyUDNIds]}
                  setMetricScope={props.setMetricScope}
                  metrics={getTopologyMetrics() || []}
                  droppedMetrics={getTopologyDroppedMetrics() || []}
                  options={props.topologyOptions}
                  setOptions={props.setTopologyOptions}
                  filters={props.filters}
                  filterDefinitions={caps.filterDefs}
                  setFilters={props.setFilters}
                  selected={props.selectedElement}
                  onSelect={onElementSelect}
                  searchHandle={props.searchHandle}
                  searchEvent={props.searchEvent}
                  isDark={isDarkTheme}
                  scopes={caps.availableScopes}
                  resetDefaultFilters={getResetDefaultFiltersProp()}
                  clearFilters={getClearFiltersProp()}
                  isTLSTracking={caps.isTLSTracking}
                />
              </>
            );
            break;
          default:
            content = null;
            break;
        }
      }
      return content;
    };

    const panelContent = () => {
      if (props.selectedRecord) {
        return (
          <RecordPanel
            id="recordPanel"
            record={props.selectedRecord}
            columns={caps.availableColumns}
            filters={props.filters.list}
            filterDefinitions={caps.filterDefs}
            range={props.range}
            type={props.recordType}
            isDark={isDarkTheme}
            canSwitchTypes={caps.isFlow && caps.isConnectionTracking}
            allowPktDrops={caps.isPktDrop}
            setFilters={setFiltersList}
            setRange={props.setRange}
            setType={props.setRecordType}
            onClose={() => onRecordSelect(undefined)}
          />
        );
      } else if (props.isShowQuerySummary) {
        return (
          <SummaryPanel
            id="summaryPanel"
            flows={props.flows}
            metrics={props.metrics}
            type={props.recordType}
            maxChunkAge={config.maxChunkAgeMs}
            stats={props.stats}
            limit={props.limit}
            lastRefresh={props.lastRefresh}
            lastDuration={props.lastDuration}
            warning={checkSlownessReason(props.warning)}
            range={props.range}
            showDNSLatency={caps.isDNSTracking}
            showRTTLatency={caps.isFlowRTT}
            onClose={() => props.setShowQuerySummary(false)}
          />
        );
      } else if (props.selectedElement) {
        return (
          <ElementPanel
            id="elementPanel"
            element={props.selectedElement}
            metrics={getTopologyMetrics() || []}
            droppedMetrics={getTopologyDroppedMetrics() || []}
            metricType={props.topologyMetricType}
            truncateLength={props.topologyOptions.truncateLength}
            filters={props.filters}
            filterDefinitions={caps.filterDefs}
            setFilters={setFiltersList}
            onClose={() => onElementSelect(undefined)}
            isDark={isDarkTheme}
          />
        );
      } else {
        return null;
      }
    };

    return (
      <Drawer
        id="drawer"
        isInline
        isExpanded={
          props.selectedRecord !== undefined || props.selectedElement !== undefined || props.isShowQuerySummary
        }
      >
        <DrawerContent id="drawerContent" panelContent={panelContent()}>
          <DrawerContentBody id="drawerBody">
            <Flex id="page-content-flex" direction={{ default: 'column' }}>
              <FlexItem
                id={`${props.selectedViewId}-container`}
                flex={{ default: 'flex_1' }}
                className={isDarkTheme ? 'dark' : 'light'}
              >
                {mainContent()}
              </FlexItem>
              <FlexItem>
                {_.isEmpty(props.flows) ? (
                  <MetricsQuerySummary
                    metrics={props.metrics}
                    stats={props.stats}
                    loading={props.loading}
                    lastRefresh={props.lastRefresh}
                    lastDuration={props.lastDuration}
                    warning={checkSlownessReason(props.warning)}
                    isShowQuerySummary={props.isShowQuerySummary}
                    toggleQuerySummary={() => onToggleQuerySummary(!props.isShowQuerySummary)}
                    isDark={isDarkTheme}
                  />
                ) : (
                  <FlowsQuerySummary
                    flows={props.flows}
                    stats={props.stats}
                    loading={props.loading}
                    lastRefresh={props.lastRefresh}
                    lastDuration={props.lastDuration}
                    warning={checkSlownessReason(props.warning)}
                    range={props.range}
                    type={props.recordType}
                    isShowQuerySummary={props.isShowQuerySummary}
                    toggleQuerySummary={() => onToggleQuerySummary(!props.isShowQuerySummary)}
                  />
                )}
              </FlexItem>
            </Flex>
          </DrawerContentBody>
        </DrawerContent>
      </Drawer>
    );
  }
);

export default NetflowTrafficDrawer;
