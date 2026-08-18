import * as React from 'react';
import { Config } from '../model/config';
import { Filters } from '../model/filters';
import { DataSource, FlowScope, MetricType, PacketLoss, RecordType } from '../model/flow-query';
import { Column, getDefaultColumns } from './columns';
import {
  defaultArraySelectionOptions,
  getLocalStorage,
  localStorageColsKey,
  localStorageOverviewIdsKey
} from './local-storage-hook';
import { ConfigCapabilities } from './netflow-capabilities-hook';
import { getAvailablePanels, OverviewPanel } from './overview-panels';
import { defaultMetricScope, defaultMetricType, setURLFilters } from './router';

type InitState = React.MutableRefObject<string[]>;

export function useConfigValidation(params: {
  initState: InitState;
  config: Config;
  caps: ConfigCapabilities;
  filters: Filters;
  updateTableFilters: (f: Filters) => void;
  recordType: RecordType;
  setRecordType: React.Dispatch<React.SetStateAction<RecordType>>;
  dataSource: DataSource;
  setDataSource: React.Dispatch<React.SetStateAction<DataSource>>;
  packetLoss: PacketLoss;
  setPacketLoss: React.Dispatch<React.SetStateAction<PacketLoss>>;
  metricScope: FlowScope;
  setMetricScope: React.Dispatch<React.SetStateAction<FlowScope>>;
  topologyMetricType: MetricType;
  setTopologyMetricType: React.Dispatch<React.SetStateAction<MetricType>>;
  setColumns: React.Dispatch<React.SetStateAction<Column[]>>;
  setPanels: React.Dispatch<React.SetStateAction<OverviewPanel[]>>;
  setFiltersFromURL: () => void;
}): void {
  const {
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
  } = params;

  // invalidate match filters if not set to all when filters are empty
  React.useEffect(() => {
    if (!filters || (filters.match !== 'all' && filters.list.length === 0)) {
      const matchAll: Filters = { ...filters, match: 'all' };
      setURLFilters(matchAll);
      updateTableFilters(matchAll);
    }
  }, [filters, updateTableFilters]);

  // invalidate record type if not available
  React.useEffect(() => {
    if (initState.current.includes('configLoaded')) {
      if (recordType === 'flowLog' && !caps.isFlow && caps.isConnectionTracking) {
        setRecordType('allConnections');
      } else if (recordType === 'allConnections' && caps.isFlow && !caps.isConnectionTracking) {
        setRecordType('flowLog');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.recordTypes, caps.isConnectionTracking, caps.isFlow, recordType]);

  // invalidate datasource if not available
  React.useEffect(() => {
    if (
      initState.current.includes('configLoaded') &&
      ((dataSource === 'loki' && !caps.allowLoki && caps.allowProm) ||
        (dataSource === 'prom' && caps.allowLoki && !caps.allowProm))
    ) {
      setDataSource('auto');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caps.allowLoki, caps.allowProm, dataSource]);

  // invalidate packet loss if not available
  React.useEffect(() => {
    if (initState.current.includes('configLoaded') && !caps.isPktDrop && packetLoss !== 'all') {
      setPacketLoss('all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caps.isPktDrop, packetLoss, setPacketLoss]);

  // invalidate metric scope / group if not available
  React.useEffect(() => {
    if (initState.current.includes('configLoaded') && !caps.availableScopes.map(sc => sc.id).includes(metricScope)) {
      setMetricScope(defaultMetricScope);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caps.availableScopes, metricScope, setMetricScope]);

  // invalidate metric type / function if not available
  React.useEffect(() => {
    if (initState.current.includes('configLoaded') && !caps.allowedMetricTypes.includes(topologyMetricType)) {
      setTopologyMetricType(defaultMetricType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caps.allowedMetricTypes, topologyMetricType, setTopologyMetricType]);

  // select columns / panels from local storage on config change
  React.useEffect(() => {
    if (initState.current.includes('configLoaded')) {
      setColumns(
        getLocalStorage(
          localStorageColsKey,
          getDefaultColumns(config.columns, config.fields),
          defaultArraySelectionOptions
        )
      );
      setPanels(
        getLocalStorage(localStorageOverviewIdsKey, getAvailablePanels(config.panels), defaultArraySelectionOptions)
      );
      setFiltersFromURL();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);
}
