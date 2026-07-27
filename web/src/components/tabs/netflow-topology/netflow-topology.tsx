import { K8sModel } from '@openshift-console/dynamic-plugin-sdk';
import { Bullseye, Content, Spinner } from '@patternfly/react-core';
import { Visualization, VisualizationProvider } from '@patternfly/react-topology';
import _ from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  defaultNetflowMetrics,
  FunctionMetrics,
  getFunctionMetricKey,
  getRateMetricKey,
  NetflowMetrics,
  RateMetrics,
  Stats,
  TopologyMetrics
} from '../../../api/query-response';
import { getK8SUDNIds } from '../../../api/routes';
import { Config } from '../../../model/config';
import { FilterDefinition, Filters } from '../../../model/filters';
import {
  aggregateByWithTlsVersion,
  FlowScope,
  isTimeMetric,
  MetricFunction,
  MetricType,
  showTLSHints,
  StatFunction
} from '../../../model/flow-query';
import { useNetflowContext } from '../../../model/netflow-context';
import { ScopeConfigDef } from '../../../model/scope';
import { GraphElementPeer, LayoutName, TopologyOptions } from '../../../model/topology';
import { TimeRange } from '../../../utils/datetime';
import { getStructuredHTTPError } from '../../../utils/errors';
import { mergeTlsIntoTopologyMetrics } from '../../../utils/metrics';
import { observeDOMRect } from '../../../utils/metrics-helper';
import { Result } from '../../../utils/result';
import { fetchNetworkHealth } from '../../health/health-fetcher';
import { buildStats, HealthStats } from '../../health/health-helper';
import { SearchEvent, SearchHandle } from '../../search/search';
import { ScopeSlider } from '../../slider/scope-slider';
import componentFactory from './2d/componentFactories/componentFactory';
import stylesComponentFactory from './2d/componentFactories/stylesComponentFactory';
import layoutFactory from './2d/layouts/layoutFactory';
import { TopologyContent } from './2d/topology-content';
import './netflow-topology.css';

export type NetflowTopologyHandle = {
  fetch: (
    metricType: MetricType,
    metricFunction: StatFunction,
    range: number | TimeRange
  ) => Promise<Stats[]> | undefined;
  fetchUDNs: () => Promise<string[]>;
};

export interface NetflowTopologyProps {
  loading?: boolean;
  k8sModels: { [key: string]: K8sModel };
  metricFunction: StatFunction;
  metricType: MetricType;
  metricScope: FlowScope;
  expectedNodes: string[];
  setMetricScope: (ms: FlowScope) => void;
  metrics: TopologyMetrics[];
  droppedMetrics: TopologyMetrics[];
  options: TopologyOptions;
  setOptions: (o: TopologyOptions) => void;
  filters: Filters;
  filterDefinitions: FilterDefinition[];
  setFilters: (v: Filters) => void;
  selected: GraphElementPeer | undefined;
  onSelect: (e: GraphElementPeer | undefined) => void;
  searchHandle: SearchHandle | null;
  searchEvent?: SearchEvent;
  isDark?: boolean;
  scopes: ScopeConfigDef[];
  resetDefaultFilters?: (c?: Config) => void;
  clearFilters?: () => void;
  isTLSTracking?: boolean;
}

// eslint-disable-next-line react/display-name
export const NetflowTopology = React.forwardRef<NetflowTopologyHandle, NetflowTopologyProps>((props, ref) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const { caps, config, fetchCallbacks } = useNetflowContext();
  const effectiveIsTLSTracking = props.isTLSTracking ?? caps.isTLSTracking;

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = React.useState<DOMRect>({ width: 0, height: 0 } as DOMRect);
  const [controller, setController] = React.useState<Visualization>();
  const [health, setHealth] = React.useState<HealthStats>(buildStats([]));
  const [lastStatsUpdateTime, setLastStatsUpdateTime] = React.useState<number>(0);
  const statsRefreshIntervalMs = 30000; // Refresh stats every 30 seconds if outdated

  // Memoize health to prevent unnecessary getContent re-creation
  const memoizedHealth = React.useMemo(() => health, [health]);

  //show fully dropped metrics if no metrics available
  const displayedMetrics = React.useMemo(
    () => (_.isEmpty(props.metrics) ? props.droppedMetrics : props.metrics),
    [props.metrics, props.droppedMetrics]
  );

  const fetchHealth = React.useCallback(async () => {
    try {
      // matching netobserv="true" catches all alerts designed for netobserv (not necessarily owned by it)
      const res = await fetchNetworkHealth(config.recordingAnnotations || {});
      setHealth(buildStats(res.healthItems));
      setLastStatsUpdateTime(Date.now());
    } catch (err) {
      console.log('Could not fetch topology alerts:', err);
    }
  }, [config.recordingAnnotations]);

  // Trigger stats refresh if outdated
  const refreshResourceStatsIfNeeded = React.useCallback(() => {
    const now = Date.now();
    if (now - lastStatsUpdateTime > statsRefreshIntervalMs) {
      fetchHealth();
    }
  }, [lastStatsUpdateTime, statsRefreshIntervalMs, fetchHealth]);

  const fetch = React.useCallback(
    (metricType: MetricType, metricFunction: StatFunction, range: number | TimeRange) => {
      const fq = caps.flowQuery;
      const features = config.features;
      const { getMetrics } = caps.fetchFunctions;
      const fetchTlsGeneric = effectiveIsTLSTracking && showTLSHints(metricType);
      const { setFlows, setMetrics, setError } = fetchCallbacks;

      setFlows([]);

      // Refresh resource stats if outdated
      refreshResourceStatsIfNeeded();

      const droppedType = features.includes('pktDrop')
        ? fq.type === 'Bytes'
          ? 'PktDropBytes'
          : fq.type === 'Packets'
          ? 'PktDropPackets'
          : undefined
        : undefined;
      const tlsMetricsClear = !fetchTlsGeneric
        ? {
            tlsFlowRate: defaultNetflowMetrics.tlsFlowRate,
            totalFlowRate: defaultNetflowMetrics.totalFlowRate,
            tlsUsagePerCipher: defaultNetflowMetrics.tlsUsagePerCipher,
            tlsUsagePerGroup: defaultNetflowMetrics.tlsUsagePerGroup,
            tlsUsagePerVersion: defaultNetflowMetrics.tlsUsagePerVersion
          }
        : {};

      const promises: Promise<Stats>[] = [
        getMetrics(
          {
            ...fq,
            function: isTimeMetric(metricType) ? (metricFunction as MetricFunction) : 'rate'
          },
          range
        ).then(async res => {
          let metrics = res.metrics;

          // Publish volume / drop metrics immediately so edge stats are not blocked on the TLS follow-up query.
          const commitMainMetrics = (m: TopologyMetrics[]) => {
            if (['Bytes', 'Packets'].includes(metricType)) {
              const rateMetrics = {} as RateMetrics;
              rateMetrics[getRateMetricKey(metricType)] = m;
              setMetrics(prev => ({
                ...prev,
                ...tlsMetricsClear,
                rate: Result.success(rateMetrics),
                dnsLatency: Result.empty(),
                rtt: Result.empty()
              }));
            } else if (['PktDropBytes', 'PktDropPackets'].includes(metricType)) {
              const droppedRateMetrics = {} as RateMetrics;
              droppedRateMetrics[getRateMetricKey(metricType)] = m;
              setMetrics(prev => ({
                ...prev,
                ...tlsMetricsClear,
                droppedRate: Result.success(droppedRateMetrics)
              }));
            } else if (['DnsLatencyMs'].includes(metricType)) {
              const dnsLatencyMetrics = {} as FunctionMetrics;
              dnsLatencyMetrics[getFunctionMetricKey(metricFunction)] = m;
              setMetrics(prev => ({
                ...prev,
                ...tlsMetricsClear,
                rate: Result.empty(),
                dnsLatency: Result.success(dnsLatencyMetrics),
                rtt: Result.empty()
              }));
            } else if (['TimeFlowRttNs'].includes(metricType)) {
              const rttMetrics = {} as FunctionMetrics;
              rttMetrics[getFunctionMetricKey(metricFunction)] = m;
              setMetrics(prev => ({
                ...prev,
                ...tlsMetricsClear,
                rate: Result.empty(),
                dnsLatency: Result.empty(),
                rtt: Result.success(rttMetrics)
              }));
            }
          };

          commitMainMetrics(metrics);

          // Per-edge TLS merge for topology volume edges (Bytes/Packets → rate; PktDrop* as primary → droppedRate).
          if (fetchTlsGeneric && fq.aggregateBy) {
            try {
              const tlsRes = await getMetrics(
                {
                  ...fq,
                  function: 'rate',
                  type: 'TlsFlows',
                  aggregateBy: aggregateByWithTlsVersion(fq.aggregateBy)
                },
                range
              );
              metrics = mergeTlsIntoTopologyMetrics(metrics, tlsRes.metrics);
              setMetrics((prev: NetflowMetrics) => {
                if (['Bytes', 'Packets'].includes(metricType)) {
                  const rateMetrics = {} as RateMetrics;
                  rateMetrics[getRateMetricKey(metricType)] = metrics;
                  return {
                    ...prev,
                    rate: Result.success(rateMetrics),
                    dnsLatency: Result.empty(),
                    rtt: Result.empty()
                  };
                }
                if (['PktDropBytes', 'PktDropPackets'].includes(metricType)) {
                  const droppedRateMetrics = {} as RateMetrics;
                  droppedRateMetrics[getRateMetricKey(metricType)] = metrics;
                  return { ...prev, droppedRate: Result.success(droppedRateMetrics) };
                }
                return prev;
              });
            } catch (err) {
              console.warn('Could not fetch per-edge TLS metrics:', err);
            }
          }

          return res.stats;
        })
      ];

      if (droppedType) {
        promises.push(
          getMetrics({ ...fq, type: droppedType }, range)
            .then(res => {
              setMetrics((prev: NetflowMetrics) => {
                const droppedRateMetrics = {} as RateMetrics;
                droppedRateMetrics[getRateMetricKey(metricType)] = res.metrics;
                return { ...prev, droppedRate: Result.success(droppedRateMetrics) };
              });
              return res.stats;
            })
            .catch(err => {
              // Error might occur for instance when fetching node-based topology with drop feature enabled, and Loki disabled
              // We don't want to break the whole topology due to missing drops enrichement
              const pErr = getStructuredHTTPError(err);
              setError(pErr);
              return { numQueries: 0, dataSources: [], limitReached: false };
            })
        );
      } else if (!['PktDropBytes', 'PktDropPackets'].includes(metricType)) {
        setMetrics((prev: NetflowMetrics) => ({ ...prev, droppedRate: Result.empty() }));
      }
      return Promise.all(promises);
    },
    [
      refreshResourceStatsIfNeeded,
      caps.flowQuery,
      caps.fetchFunctions,
      effectiveIsTLSTracking,
      config.features,
      fetchCallbacks
    ]
  );

  // Initial fetch and setup update trigger
  React.useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const fetchUDNs = React.useCallback(() => {
    // Refresh resource stats if outdated
    refreshResourceStatsIfNeeded();
    return getK8SUDNIds();
  }, [refreshResourceStatsIfNeeded]);

  React.useImperativeHandle(ref, () => ({
    fetch,
    fetchUDNs
  }));

  const getContent = React.useCallback(() => {
    if (props.options.layout === LayoutName.threeD) {
      return <Content component="p">{t('Sorry, 3D view is not implemented anymore.')}</Content>;
    }

    // Always render TopologyContent once controller is ready
    // Show loading overlay instead of unmounting
    if (!controller) {
      return (
        <Bullseye data-test="loading-contents">
          <Spinner size="xl" />
        </Bullseye>
      );
    }

    const showLoadingOverlay = _.isEmpty(props.metrics) && props.loading;

    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {showLoadingOverlay && (
          <Bullseye
            data-test="loading-contents"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'var(--pf-t--global--background--color--primary--default)',
              zIndex: 1000
            }}
          >
            <Spinner size="xl" />
          </Bullseye>
        )}
        <VisualizationProvider data-test="visualization-provider" controller={controller}>
          <TopologyContent
            containerRef={containerRef}
            k8sModels={props.k8sModels}
            expectedNodes={props.expectedNodes}
            metricFunction={props.metricFunction}
            metricType={props.metricType}
            metricScope={props.metricScope}
            setMetricScope={props.setMetricScope}
            scopes={props.scopes}
            metrics={displayedMetrics}
            droppedMetrics={props.droppedMetrics}
            options={props.options}
            filters={props.filters}
            filterDefinitions={props.filterDefinitions}
            setFilters={props.setFilters}
            selected={props.selected}
            onSelect={props.onSelect}
            searchHandle={props.searchHandle}
            searchEvent={props.searchEvent}
            isDark={props.isDark}
            resetDefaultFilters={props.resetDefaultFilters}
            clearFilters={props.clearFilters}
            resourceStats={memoizedHealth}
          />
        </VisualizationProvider>
      </div>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, props, displayedMetrics]);

  //create controller on startup and register factories
  React.useEffect(() => {
    const c = new Visualization();
    c.registerLayoutFactory(layoutFactory);
    c.registerComponentFactory(componentFactory);
    c.registerComponentFactory(stylesComponentFactory);
    setController(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    return observeDOMRect(containerRef, containerSize, setContainerSize);
  }, [containerRef, containerSize, setContainerSize]);

  return (
    <div id="topology-container-div" style={{ width: '100%', height: '100%' }} ref={containerRef}>
      <div id={'topology-scope-slider-div'}>
        <ScopeSlider scope={props.metricScope} setScope={props.setMetricScope} scopeDefs={props.scopes} />
      </div>
      <div id="topology-view-div">{getContent()}</div>
    </div>
  );
});

export default NetflowTopology;
