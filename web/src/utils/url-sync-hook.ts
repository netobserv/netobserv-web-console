import * as React from 'react';
import { ViewId } from '../components/netflow-traffic';
import { Filters } from '../model/filters';
import { DataSource, MetricType, PacketLoss, RecordType, StatFunction } from '../model/flow-query';
import { ViewPresetId } from '../model/views';
import { TimeRange } from './datetime';
import {
  setURLDatasource,
  setURLFilters,
  setURLLimit,
  setURLMetricFunction,
  setURLMetricType,
  setURLPacketLoss,
  setURLRange,
  setURLRecortType,
  setURLShowDup,
  setURLView
} from './router';
import { getURLParams } from './url';

type InitState = React.MutableRefObject<string[]>;

export function useURLSync(params: {
  initState: InitState;
  filters: Filters;
  forcedFilters?: Filters | null;
  range: number | TimeRange;
  limit: number;
  showDuplicates: boolean;
  topologyMetricFunction: StatFunction;
  topologyMetricType: MetricType;
  selectedViewId: ViewId;
  packetLoss: PacketLoss;
  recordType: RecordType;
  dataSource: DataSource;
  activeView: ViewPresetId;
  setQueryParams: React.Dispatch<React.SetStateAction<string>>;
  setTRModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}): void {
  const {
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
    activeView,
    setQueryParams,
    setTRModalOpen
  } = params;

  React.useEffect(() => {
    if (forcedFilters) {
      setURLFilters(forcedFilters!, true);
    } else if (initState.current.includes('configLoaded')) {
      setURLFilters(filters, !initState.current.includes('configLoaded'));
    }
  }, [filters, forcedFilters, initState]);

  React.useEffect(() => {
    setTRModalOpen(false);
    setURLRange(range, !initState.current.includes('configLoaded'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, initState]);

  React.useEffect(() => {
    setURLLimit(limit, !initState.current.includes('configLoaded'));
  }, [limit, initState]);

  React.useEffect(() => {
    setURLShowDup(showDuplicates, !initState.current.includes('configLoaded'));
  }, [showDuplicates, initState]);

  React.useEffect(() => {
    setURLMetricFunction(
      selectedViewId === 'topology' ? topologyMetricFunction : undefined,
      !initState.current.includes('configLoaded')
    );
    setURLMetricType(
      selectedViewId === 'topology' ? topologyMetricType : undefined,
      !initState.current.includes('configLoaded')
    );
  }, [topologyMetricFunction, selectedViewId, topologyMetricType, initState]);

  React.useEffect(() => {
    setURLPacketLoss(packetLoss);
  }, [packetLoss]);

  React.useEffect(() => {
    setURLRecortType(recordType, !initState.current.includes('configLoaded'));
  }, [recordType, initState]);

  React.useEffect(() => {
    setURLDatasource(dataSource, !initState.current.includes('configLoaded'));
  }, [dataSource, initState]);

  React.useEffect(() => {
    setURLView(activeView, !initState.current.includes('configLoaded'));
  }, [activeView, initState]);

  React.useEffect(() => {
    if (!forcedFilters) {
      setQueryParams(getURLParams().toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters,
    range,
    limit,
    showDuplicates,
    topologyMetricFunction,
    topologyMetricType,
    activeView,
    setQueryParams,
    forcedFilters
  ]);
}
