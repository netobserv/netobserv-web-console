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
import { DraftView, GenericPrefs, getAvailableViews, getViewPreset, ViewPreset, ViewPresetId } from '../model/views';
import { getFetchFunctions as getBackAndForthFetch } from './back-and-forth';
import { Column, ColumnsId } from './columns';
import { ContextSingleton } from './context';
import { computeStepInterval, TimeRange } from './datetime';
import { checkFilterAvailable, getFilterDefinitions } from './filter-definitions';
import {
  dnsMatcher,
  droppedIdMatcher,
  getPanelFeature,
  OverviewPanel,
  rttIdMatcher,
  tlsIdMatcher
} from './overview-panels';

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
  availableViews: ViewPreset[];
}

export function useConfigCapabilities(params: {
  config: Config;
  selectedViewId: ViewId;
  dataSource: DataSource;
  columns: Column[];
  panels: OverviewPanel[];
  activeView: ViewPresetId;
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
  genericColumnPrefs: GenericPrefs;
  genericPanelPrefs: GenericPrefs;
  draftView: DraftView | null;
}): ConfigCapabilities {
  const {
    config,
    selectedViewId,
    dataSource,
    columns,
    panels,
    activeView,
    metricScope,
    topologyOptions,
    topologyMetricType,
    forcedNamespace,
    forcedFilters,
    filters,
    limit,
    recordType,
    packetLoss,
    range,
    genericColumnPrefs,
    genericPanelPrefs,
    draftView
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
    if (selectedViewId === 'topology' || activeView !== 'all') {
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
  }, [isDNSTracking, isFlowRTT, isPktDrop, selectedViewId, activeView]);

  const availablePanels = React.useMemo(
    () =>
      panels.filter(
        panel =>
          (isPktDrop || !panel.id.includes(droppedIdMatcher)) &&
          (isDNSTracking || !panel.id.includes(dnsMatcher)) &&
          (isFlowRTT || !panel.id.includes(rttIdMatcher)) &&
          (isTLSTracking || !panel.id.includes(tlsIdMatcher))
      ),
    [isDNSTracking, isFlowRTT, isPktDrop, isTLSTracking, panels]
  );

  const selectedPanels = React.useMemo(() => {
    // Draft view overrides when viewing the draft's base view
    if (draftView && draftView.baseViewId === activeView) {
      const draftPanelIds = new Set(draftView.panels);
      return availablePanels.filter(panel => draftPanelIds.has(panel.id));
    }
    // Feature preset view: preset panels + generic prefs
    // Generic prefs override preset inclusion for generic panels
    if (activeView !== 'all') {
      const preset = getViewPreset(activeView);
      if (preset?.panels) {
        const presetPanelSet = new Set(preset.panels as string[]);
        return availablePanels.filter(panel => {
          const isGeneric = !getPanelFeature(panel.id);
          if (isGeneric) {
            if (genericPanelPrefs.removed.includes(panel.id)) return false;
            if (genericPanelPrefs.added.includes(panel.id)) return true;
          }
          if (presetPanelSet.has(panel.id)) return true;
          return false;
        });
      }
    }
    // "All Traffic": user's manual selection + generic prefs override
    return availablePanels.filter(panel => {
      const isGeneric = !getPanelFeature(panel.id);
      if (isGeneric) {
        if (genericPanelPrefs.removed.includes(panel.id)) return false;
        if (genericPanelPrefs.added.includes(panel.id)) return true;
      }
      return panel.isSelected;
    });
  }, [availablePanels, activeView, draftView, genericPanelPrefs]);

  const availableColumns = React.useMemo(
    () =>
      columns.filter(
        col =>
          (isConnectionTracking || ![ColumnsId.recordtype, ColumnsId.hashid].includes(col.id)) &&
          (!col.feature || config.features.includes(col.feature))
      ),
    [columns, config.features, isConnectionTracking]
  );

  const selectedColumns = React.useMemo(() => {
    // Draft view overrides when viewing the draft's base view
    if (draftView && draftView.baseViewId === activeView) {
      const colMap = new Map(availableColumns.map(col => [col.id as string, col]));
      return draftView.columns.map(id => colMap.get(id)).filter((col): col is Column => col !== undefined);
    }
    // Feature preset view: preset columns + generic prefs
    if (activeView !== 'all') {
      const preset = getViewPreset(activeView);
      if (preset?.columns) {
        const presetColSet = new Set(preset.columns);
        return availableColumns.filter(col => {
          const isGeneric = !col.feature;
          if (isGeneric) {
            if (genericColumnPrefs.removed.includes(col.id)) return false;
            if (genericColumnPrefs.added.includes(col.id)) return true;
          }
          if (presetColSet.has(col.id)) return true;
          return false;
        });
      }
    }
    // "All Traffic": user's manual selection + generic prefs override
    return availableColumns.filter(col => {
      const isGeneric = !col.feature;
      if (isGeneric) {
        if (genericColumnPrefs.removed.includes(col.id)) return false;
        if (genericColumnPrefs.added.includes(col.id)) return true;
      }
      return col.isSelected;
    });
  }, [availableColumns, activeView, draftView, genericColumnPrefs]);

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

  const availableViews = React.useMemo(() => getAvailableViews(config.features), [config.features]);

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
    fetchFunctions,
    availableViews
  };
}
