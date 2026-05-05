import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { limitValues, topValues } from '../components/dropdowns/query-options-panel';
import { ViewId } from '../components/netflow-traffic';
import { Config } from '../model/config';
import { Filter, FilterDefinition, Filters, getEnabledFilters } from '../model/filters';
import { DataSource, FlowScope, MetricType, PacketLoss, RecordType, StructuredFlowQuery } from '../model/flow-query';
import { parseQuickFilters, QuickFilter } from '../model/quick-filters';
import { resolveGroupTypes, ScopeConfigDef } from '../model/scope';
import { TopologyOptions } from '../model/topology';
import { getFetchFunctions as getBackAndForthFetch } from './back-and-forth';
import { Column, ColumnsId } from './columns';
import { ContextSingleton } from './context';
import { computeStepInterval, TimeRange } from './datetime';
import { checkFilterAvailable, getFilterDefinitions } from './filter-definitions';
import { dnsIdMatcher, droppedIdMatcher, OverviewPanel, rttIdMatcher, tlsIdMatcher } from './overview-panels';

export interface ConfigCapabilities {
  allowLoki: boolean;
  allowProm: boolean;
  isFlow: boolean;
  isConnectionTracking: boolean;
  isDNSTracking: boolean;
  isFlowRTT: boolean;
  isPktDrop: boolean;
  isTLSTracking: boolean;
  isPromOnly: boolean;
  availableScopes: ScopeConfigDef[];
  allowedMetricTypes: MetricType[];
  availablePanels: OverviewPanel[];
  selectedPanels: OverviewPanel[];
  availableColumns: Column[];
  selectedColumns: Column[];
  filterDefs: FilterDefinition[];
  quickFilters: QuickFilter[];
  defaultFilters: Filter[];
  flowQuery: StructuredFlowQuery;
  fetchFunctions: ReturnType<typeof getBackAndForthFetch>;
}

export function useConfigCapabilities(params: {
  config: Config;
  selectedViewId: ViewId;
  dataSource: DataSource;
  columns: Column[];
  panels: OverviewPanel[];
  metricScope: FlowScope;
  topologyOptions: TopologyOptions;
  topologyMetricType: MetricType;
  forcedNamespace?: string;
  forcedFilters?: Filters | null;
  filters: Filters;
  limit: number;
  recordType: RecordType;
  packetLoss: PacketLoss;
  range: number | TimeRange;
}): ConfigCapabilities {
  const {
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
  } = params;

  const { t } = useTranslation('plugin__netobserv-plugin');

  // Boolean capabilities
  const allowLoki = React.useMemo(() => config.dataSources.some(ds => ds === 'loki'), [config.dataSources]);

  const allowProm = React.useMemo(
    () => config.dataSources.some(ds => ds === 'prom') && selectedViewId !== 'table',
    [config.dataSources, selectedViewId]
  );

  const isFlow = React.useMemo(() => config.recordTypes.some(rt => rt === 'flowLog'), [config.recordTypes]);

  const isConnectionTracking = React.useMemo(
    () => config.recordTypes.some(rt => rt === 'newConnection' || rt === 'heartbeat' || rt === 'endConnection'),
    [config.recordTypes]
  );

  const isDNSTracking = React.useMemo(() => config.features.includes('dnsTracking'), [config.features]);

  const isFlowRTT = React.useMemo(() => config.features.includes('flowRTT'), [config.features]);

  const isPktDrop = React.useMemo(() => config.features.includes('pktDrop'), [config.features]);

  const isTLSTracking = React.useMemo(() => config.features.includes('tlsTracking'), [config.features]);

  const isPromOnly = React.useMemo(() => !allowLoki || dataSource === 'prom', [allowLoki, dataSource]);

  // Derived collections
  const availableScopes = React.useMemo(
    () =>
      config.scopes.filter(sc => {
        if (sc.feature) {
          return config.features.includes(sc.feature);
        }
        if (isPromOnly) {
          return sc.labels.every(label => config.promLabels.includes(label));
        }
        return true;
      }),
    [config.scopes, config.features, config.promLabels, isPromOnly]
  );

  React.useEffect(() => {
    ContextSingleton.setScopes(config.scopes);
  }, [config.scopes]);

  const allowedMetricTypes = React.useMemo(() => {
    let options: MetricType[] = ['Bytes', 'Packets'];
    if (selectedViewId === 'topology') {
      if (isPktDrop) {
        options = options.concat('PktDropBytes', 'PktDropPackets');
      }
      if (isDNSTracking) {
        options.push('DnsLatencyMs');
      }
      if (isFlowRTT) {
        options.push('TimeFlowRttNs');
      }
    }
    return options;
  }, [isDNSTracking, isFlowRTT, isPktDrop, selectedViewId]);

  const availablePanels = React.useMemo(
    () =>
      panels.filter(
        panel =>
          (isPktDrop || !panel.id.includes(droppedIdMatcher)) &&
          (isDNSTracking || !panel.id.includes(dnsIdMatcher)) &&
          (isFlowRTT || !panel.id.includes(rttIdMatcher)) &&
          (isTLSTracking || !panel.id.includes(tlsIdMatcher))
      ),
    [isDNSTracking, isFlowRTT, isPktDrop, isTLSTracking, panels]
  );

  const selectedPanels = React.useMemo(() => availablePanels.filter(panel => panel.isSelected), [availablePanels]);

  const availableColumns = React.useMemo(
    () =>
      columns.filter(
        col =>
          (isConnectionTracking || ![ColumnsId.recordtype, ColumnsId.hashid].includes(col.id)) &&
          (!col.feature || config.features.includes(col.feature))
      ),
    [columns, config.features, isConnectionTracking]
  );

  const selectedColumns = React.useMemo(() => availableColumns.filter(column => column.isSelected), [availableColumns]);

  const filterDefs = React.useMemo(() => {
    const allFilterDefs = getFilterDefinitions(config.filters, config.columns, t);
    return allFilterDefs.filter(fd => {
      if (fd.id === 'id') {
        return isConnectionTracking;
      }
      return checkFilterAvailable(fd, config, dataSource, allFilterDefs);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, dataSource, isConnectionTracking]);

  const quickFilters = React.useMemo(
    () => parseQuickFilters(filterDefs, config.quickFilters),
    [filterDefs, config.quickFilters]
  );

  const defaultFilters = React.useMemo(() => {
    // skip default quick filters until https://issues.redhat.com/browse/NETOBSERV-1690
    if (forcedNamespace) {
      return [];
    }
    return quickFilters.filter(qf => qf.default).flatMap(qf => qf.filters);
  }, [forcedNamespace, quickFilters]);

  const flowQuery = React.useMemo((): StructuredFlowQuery => {
    const query: StructuredFlowQuery = {
      namespace: forcedNamespace,
      structuredFilters: getEnabledFilters(forcedFilters || filters),
      limit: limitValues.includes(limit) ? limit : limitValues[0],
      recordType: recordType,
      dataSource: dataSource,
      packetLoss: packetLoss
    };
    if (range) {
      if (typeof range === 'number') {
        query.timeRange = range;
      } else if (typeof range === 'object') {
        query.startTime = range.from.toString();
        query.endTime = range.to.toString();
      }

      const info = computeStepInterval(range);
      query.rateInterval = `${info.rateIntervalSeconds}s`;
      query.step = `${info.stepSeconds}s`;
    }
    if (selectedViewId === 'table') {
      query.type = 'Flows';
    } else {
      query.aggregateBy = metricScope;
      if (selectedViewId === 'topology') {
        query.type = topologyMetricType;
        const resolvedGroup = resolveGroupTypes(topologyOptions.groupTypes, metricScope, availableScopes);
        query.groups = resolvedGroup !== 'none' ? resolvedGroup : undefined;
      } else if (selectedViewId === 'overview') {
        query.limit = topValues.includes(limit) ? limit : topValues[0];
        query.groups = undefined;
      }
    }
    return query;
  }, [
    forcedNamespace,
    forcedFilters,
    filters,
    limit,
    recordType,
    dataSource,
    packetLoss,
    range,
    selectedViewId,
    topologyMetricType,
    metricScope,
    topologyOptions.groupTypes,
    availableScopes
  ]);

  const fetchFunctions = React.useMemo(() => {
    return getBackAndForthFetch(filterDefs);
  }, [filterDefs]);

  return {
    allowLoki,
    allowProm,
    isFlow,
    isConnectionTracking,
    isDNSTracking,
    isFlowRTT,
    isPktDrop,
    isTLSTracking,
    isPromOnly,
    availableScopes,
    allowedMetricTypes,
    availablePanels,
    selectedPanels,
    availableColumns,
    selectedColumns,
    filterDefs,
    quickFilters,
    defaultFilters,
    flowQuery,
    fetchFunctions
  };
}
