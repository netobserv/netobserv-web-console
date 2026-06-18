import * as React from 'react';
import { Record } from '../api/ipfix';
import { defaultNetflowMetrics, NetflowMetrics, Stats } from '../api/query-response';
import { NetflowTrafficDrawerHandle } from '../components/drawer/netflow-traffic-drawer';
import { ViewId } from '../components/netflow-traffic';
import { Config } from '../model/config';
import { Filters } from '../model/filters';
import { FlowScope, MetricType, StatFunction } from '../model/flow-query';
import { TopologyOptions } from '../model/topology';
import { Warning } from '../model/warnings';
import { loadConfig } from './config';
import { TimeRange } from './datetime';
import { getStructuredHTTPError, PromMissingLabels, StructuredError } from './errors';
import { mergeStats } from './metrics';
import { ConfigCapabilities } from './netflow-capabilities-hook';
import { usePoll } from './poll-hook';
import { hasEmptyParams, setURLParams } from './url';

export type InitState = Array<
  'initDone' | 'configLoading' | 'configLoaded' | 'configLoadError' | 'forcedFiltersLoaded' | 'urlFiltersPending'
>;

export function canTick(
  initState: React.MutableRefObject<InitState>,
  modals: { isTRModalOpen: boolean; isOverviewModalOpen: boolean; isColModalOpen: boolean; isExportModalOpen: boolean }
): boolean {
  if (
    !initState.current.includes('forcedFiltersLoaded') ||
    !initState.current.includes('configLoaded') ||
    initState.current.includes('configLoadError')
  ) {
    console.debug('tick skipped', initState.current);
    return false;
  }
  if (modals.isTRModalOpen || modals.isOverviewModalOpen || modals.isColModalOpen || modals.isExportModalOpen) {
    console.debug('tick skipped since modal is open');
    return false;
  }
  return true;
}

export interface DispatchFetchParams {
  selectedViewId: ViewId;
  drawerRef: React.RefObject<NetflowTrafficDrawerHandle | null>;
  range: number | TimeRange;
  histogramRange: TimeRange | undefined;
  showHistogram: boolean;
  showDuplicates: boolean;
  metricScope: FlowScope;
  topologyMetricType: MetricType;
  topologyMetricFunction: StatFunction;
  topologyOptions: TopologyOptions;
  allowLoki: boolean;
  setError: (err?: StructuredError | string) => void;
  setTopologyUDNIds: (ids: string[]) => void;
  setLoading: (v: boolean) => void;
  t: (key: string) => string;
}

export function dispatchFetch(params: DispatchFetchParams): Promise<Stats[]> | undefined {
  const {
    selectedViewId,
    drawerRef,
    range,
    histogramRange,
    showHistogram,
    showDuplicates,
    metricScope,
    topologyMetricType,
    topologyMetricFunction,
    topologyOptions,
    allowLoki,
    setError,
    setTopologyUDNIds,
    setLoading,
    t
  } = params;

  let promises: Promise<Stats[]> | undefined = undefined;
  switch (selectedViewId) {
    case 'table':
      if (allowLoki) {
        promises = drawerRef.current?.getTableHandle()?.fetch(range, histogramRange, showHistogram, showDuplicates);
      } else {
        setError(t('Only available when FlowCollector.loki.enable is true'));
      }
      break;
    case 'overview':
      promises = drawerRef.current?.getOverviewHandle()?.fetch(metricScope, range);
      break;
    case 'topology':
      promises = drawerRef.current?.getTopologyHandle()?.fetch(topologyMetricType, topologyMetricFunction, range);

      if (topologyOptions.showEmpty && metricScope === 'network') {
        drawerRef.current
          ?.getTopologyHandle()
          ?.fetchUDNs()
          .then(ids => setTopologyUDNIds(ids))
          .catch(err => {
            console.error('fetchUDNs error', err);
            setError(getStructuredHTTPError('User-Defined Networks', err));
            setTopologyUDNIds([]);
          });
      } else {
        setTopologyUDNIds([]);
      }
      break;
    default:
      console.error('tick called on not implemented view Id', selectedViewId);
      setLoading(false);
      break;
  }
  return promises;
}

export function handleQueryResult(allStats: Stats[], setStats: (s: Stats | undefined) => void): void {
  const stats = allStats.reduce(mergeStats, undefined);
  setStats(stats);
}

export function handleQueryError(
  err: unknown,
  filters: Filters,
  configColumns: Config['columns'],
  chipsPopoverMessage: string | undefined,
  handlers: {
    setFlows: (v: Record[]) => void;
    setMetrics: (v: NetflowMetrics) => void;
    setError: (err?: StructuredError | string) => void;
    setWarning: (w: Warning | undefined) => void;
    setChipsPopoverMessage: (m: string | undefined) => void;
    updateTableFilters: (f: Filters) => void;
  }
): void {
  const genErr = getStructuredHTTPError(err);

  if (PromMissingLabels.isTypeOf(genErr)) {
    const errStr = genErr.toString();
    if (errStr !== chipsPopoverMessage) {
      let filtersDisabled = false;
      filters.list.forEach(filter => {
        const fieldName = configColumns.find(col => col.filter === filter.def.id)?.field;
        if (!fieldName || fieldName in genErr.missing) {
          filtersDisabled = true;
          filter.values.forEach(fv => {
            fv.disabled = true;
          });
        }
      });
      if (filtersDisabled) {
        handlers.updateTableFilters({ ...filters });
        handlers.setChipsPopoverMessage(errStr);
        return;
      }
    }
  }

  handlers.setFlows([]);
  handlers.setMetrics(defaultNetflowMetrics);
  handlers.setError(genErr);
  handlers.setWarning(undefined);
  handlers.setChipsPopoverMessage(undefined);
}

export interface UseDataFetchingParams {
  drawerRef: React.RefObject<NetflowTrafficDrawerHandle | null>;
  initState: React.MutableRefObject<InitState>;
  caps: ConfigCapabilities;
  config: Config;
  selectedViewId: ViewId;
  range: number | TimeRange;
  histogramRange: TimeRange | undefined;
  showHistogram: boolean;
  showDuplicates: boolean;
  metricScope: FlowScope;
  topologyMetricType: MetricType;
  topologyMetricFunction: StatFunction;
  topologyOptions: TopologyOptions;
  interval: number | undefined;
  isTRModalOpen: boolean;
  isOverviewModalOpen: boolean;
  isColModalOpen: boolean;
  isExportModalOpen: boolean;
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  parentConfig?: Config;
  forcedFilters?: Filters | null;
  setConfig: React.Dispatch<React.SetStateAction<Config>>;
  queryParams: string;
}

export interface UseDataFetchingResult {
  loading: boolean;
  error: string | StructuredError | undefined;
  flows: Record[];
  stats: Stats | undefined;
  metrics: NetflowMetrics;
  metricsRef: React.MutableRefObject<NetflowMetrics>;
  lastRefresh: Date | undefined;
  lastDuration: number | undefined;
  warning: Warning | undefined;
  chipsPopoverMessage: string | undefined;
  setChipsPopoverMessage: (m: string | undefined) => void;
  topologyUDNIds: string[];
  tick: () => void;
  updateTableFilters: (f: Filters) => void;
  setFlows: React.Dispatch<React.SetStateAction<Record[]>>;
  setMetrics: React.Dispatch<React.SetStateAction<NetflowMetrics>>;
  setError: React.Dispatch<React.SetStateAction<string | StructuredError | undefined>>;
}

export function useDataFetching(params: UseDataFetchingParams): UseDataFetchingResult {
  const {
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
  } = params;

  // Data-fetching state
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | StructuredError | undefined>();
  const [flows, setFlows] = React.useState<Record[]>([]);
  const [stats, setStats] = React.useState<Stats | undefined>(undefined);
  const [metrics, setMetrics] = React.useState<NetflowMetrics>(defaultNetflowMetrics);
  const metricsRef = React.useRef(metrics);
  const [lastRefresh, setLastRefresh] = React.useState<Date | undefined>(undefined);
  const [lastDuration, setLastDuration] = React.useState<number | undefined>(undefined);
  const [warning, setWarning] = React.useState<Warning | undefined>();
  const [chipsPopoverMessage, setChipsPopoverMessage] = React.useState<string | undefined>();
  const [topologyUDNIds, setTopologyUDNIds] = React.useState<string[]>([]);

  const updateTableFilters = React.useCallback(
    (f: Filters) => {
      initState.current = initState.current.filter(s => s !== 'urlFiltersPending');
      setFilters(f);
      setFlows([]);
      setMetrics(defaultNetflowMetrics);
      setWarning(undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setFilters]
  );

  const manageWarnings = React.useCallback((query: Promise<unknown>) => {
    setLastRefresh(undefined);
    setLastDuration(undefined);
    setWarning(undefined);
    Promise.race([query, new Promise((resolve, reject) => setTimeout(reject, 4000, 'slow'))]).then(
      null,
      (reason: string) => {
        if (reason === 'slow') {
          setWarning({ type: 'slow', summary: 'Query is slow' });
        }
      }
    );
  }, []);

  const errorHandlers = React.useMemo(
    () => ({
      setFlows,
      setMetrics,
      setError,
      setWarning,
      setChipsPopoverMessage,
      updateTableFilters
    }),
    // setState functions are stable; updateTableFilters is wrapped in useCallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateTableFilters]
  );

  const tick = React.useCallback(() => {
    const modals = { isTRModalOpen, isOverviewModalOpen, isColModalOpen, isExportModalOpen };
    if (!canTick(initState, modals)) return;

    if (drawerRef.current == null) {
      console.debug('tick called before drawer rendering. Retrying after render');
      setTimeout(tick);
      return;
    }

    setLoading(true);
    setError(undefined);

    const promises = dispatchFetch({
      selectedViewId,
      drawerRef,
      range,
      histogramRange,
      showHistogram,
      showDuplicates,
      metricScope,
      topologyMetricType,
      topologyMetricFunction,
      topologyOptions,
      allowLoki: caps.allowLoki,
      setError,
      setTopologyUDNIds,
      setLoading,
      t: (key: string) => key
    });

    if (promises) {
      const startDate = new Date();
      setStats(undefined);
      manageWarnings(
        promises
          .then(allStats => handleQueryResult(allStats, setStats))
          .catch(err => handleQueryError(err, filters, config.columns, chipsPopoverMessage, errorHandlers))
          .finally(() => {
            const endDate = new Date();
            setLoading(false);
            setLastRefresh(endDate);
            setLastDuration(endDate.getTime() - startDate.getTime());
          })
      );
    } else if (error) {
      setTimeout(tick);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isTRModalOpen,
    isOverviewModalOpen,
    isColModalOpen,
    isExportModalOpen,
    showHistogram,
    range,
    histogramRange,
    showDuplicates,
    metricScope,
    topologyMetricType,
    topologyMetricFunction,
    topologyOptions,
    selectedViewId,
    caps.allowLoki,
    manageWarnings,
    errorHandlers
  ]);

  usePoll(tick, interval);

  // Init effect: load config and trigger first tick
  React.useEffect(() => {
    if (!initState.current.includes('initDone')) {
      initState.current.push('initDone');

      if (hasEmptyParams() && queryParams) {
        setURLParams(queryParams);
      }

      if (parentConfig) {
        initState.current.push('configLoaded');
        setConfig(parentConfig);
      } else {
        if (!initState.current.includes('configLoading')) {
          initState.current.push('configLoading');
          loadConfig().then(v => {
            initState.current.push('configLoaded');
            setConfig(v.config);
            if (v.error) {
              initState.current.push('configLoadError');
              setError(v.error);
            }
          });
        }
      }

      return;
    }

    if (!initState.current.includes('forcedFiltersLoaded') && forcedFilters !== undefined) {
      initState.current.push('forcedFiltersLoaded');
      if (forcedFilters === null) {
        return;
      }
    }

    if (!initState.current.includes('urlFiltersPending')) {
      tick();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, forcedFilters, config, tick, setConfig]);

  return {
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
  };
}
