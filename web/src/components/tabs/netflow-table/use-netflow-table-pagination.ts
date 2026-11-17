import * as React from 'react';

import { getRecordValue, Record } from '../../../api/ipfix';
import { defaultNetflowMetrics, Stats } from '../../../api/query-response';
import { StructuredFlowQuery } from '../../../model/flow-query';
import { useNetflowContext } from '../../../model/netflow-context';
import {
  computeStepInterval,
  extendTimeRangeToStart,
  getTimeRangeBounds,
  getTimeRangeDuration,
  TimeRange
} from '../../../utils/datetime';
import { getStructuredHTTPError } from '../../../utils/errors';
import { mergeFlowReporters } from '../../../utils/flows';
import { Result } from '../../../utils/result';

interface FlowPagingState {
  signature: string;
  query: StructuredFlowQuery;
  olderFlows: Record[];
  currentStart: number;
  nextEnd: number;
  newerUntil: number;
  pendingNewerStart?: number;
  pendingNewerEnd?: number;
  pendingNewerUntil?: number;
  canFetchNewer: boolean;
  windowDuration: number;
  maxOlderStart: number;
  range: number | TimeRange;
  metricBaseStart: number;
  initializedFromResult: boolean;
  metricsStart?: number;
  loadedStart?: number;
  showHistogram: boolean;
  showDuplicates: boolean;
  hasMore: boolean;
  blockedByError: boolean;
}

// The flows handler rounds its endTime parameter up by one second. Subtract two
// seconds to make the cursor exclusive and avoid fetching the oldest flow from
// the previous page again.
const getExclusiveEndTime = (timestamp: number): number => timestamp - 2;
const MAX_OLDER_LOOKBACK_SECONDS = 14 * 24 * 60 * 60;
const NEWER_QUERY_OVERLAP_SECONDS = 30;
const MAX_NEWER_PAGES_PER_PULL = 20;
const NEWER_REQUEST_COOLDOWN_MS = 750;

const movePagingWindowBack = (paging: FlowPagingState, expand = false): void => {
  const previousEnd = paging.currentStart;
  if (previousEnd <= paging.maxOlderStart + 2) {
    paging.hasMore = false;
    return;
  }

  if (expand) {
    paging.windowDuration = Math.min(paging.windowDuration * 2, previousEnd - paging.maxOlderStart);
  }
  paging.currentStart = Math.max(paging.maxOlderStart, previousEnd - paging.windowDuration);
  paging.nextEnd = getExclusiveEndTime(previousEnd);
};

const getRecordTimeSeconds = (record: Record): number | undefined => {
  const flowEndTime = Number(getRecordValue(record, 'TimeFlowEndMs'));
  if (Number.isFinite(flowEndTime) && flowEndTime > 0) {
    return Math.floor(flowEndTime / 1000);
  }
  const receivedTime = Number(getRecordValue(record, 'TimeReceived'));
  if (Number.isFinite(receivedTime) && receivedTime > 0) {
    return Math.floor(receivedTime);
  }
  return undefined;
};

const getLoadedFlowsRange = (flows: Record[]): TimeRange | undefined => {
  const times = flows.map(getRecordTimeSeconds).filter((value): value is number => value !== undefined);
  if (times.length === 0) {
    return undefined;
  }
  const from = Math.min(...times);
  return { from, to: Math.max(from + 1, Math.max(...times)) };
};

const getFlowCountQuery = (query: StructuredFlowQuery, range: number | TimeRange): StructuredFlowQuery => {
  const { rateIntervalSeconds, stepSeconds } = computeStepInterval(range);
  const countQuery: StructuredFlowQuery = {
    ...query,
    function: 'count',
    aggregateBy: 'app',
    type: 'Flows',
    timeRange: undefined,
    startTime: undefined,
    endTime: undefined,
    rateInterval: `${rateIntervalSeconds}s`,
    step: `${stepSeconds}s`
  };
  if (typeof range === 'number') {
    countQuery.timeRange = range;
  } else {
    countQuery.startTime = String(range.from);
    countQuery.endTime = String(range.to);
  }
  return countQuery;
};

export const useNetflowTablePagination = (flows: Record[], onLoadedRangeChange?: (range?: TimeRange) => void) => {
  const { caps, fetchCallbacks } = useNetflowContext();
  const flowsRef = React.useRef(flows);
  const isFetchingPageRef = React.useRef(false);
  const metricsRequestIdRef = React.useRef(0);
  const [loadingOlder, setLoadingOlder] = React.useState(false);
  const [loadingNewer, setLoadingNewer] = React.useState(false);
  const [upToDate, setUpToDate] = React.useState(false);
  const upToDateTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const upToDateUntilRef = React.useRef(0);
  const newerRequestCooldownUntilRef = React.useRef(0);
  const [hasMoreOlder, setHasMoreOlder] = React.useState(true);
  const pagingRef = React.useRef<FlowPagingState | undefined>(undefined);

  React.useEffect(
    () => () => {
      if (upToDateTimeoutRef.current !== undefined) {
        clearTimeout(upToDateTimeoutRef.current);
      }
    },
    []
  );

  React.useEffect(() => {
    flowsRef.current = flows;
  }, [flows]);

  const fetchTotalFlowCount = React.useCallback(
    (query: StructuredFlowQuery, range: number | TimeRange): Promise<Stats> => {
      const requestId = ++metricsRequestIdRef.current;
      return Result.fromPromise(caps.fetchFunctions.getMetrics(getFlowCountQuery(query, range), range)).then(res => {
        const totalFlowCount = res.map(metrics => metrics.metrics[0]).mapError(err => getStructuredHTTPError(err));
        if (requestId === metricsRequestIdRef.current) {
          fetchCallbacks.setMetrics(previous => ({ ...previous, totalFlowCount }));
        }
        return res.map(response => response.stats).or({ numQueries: 0, limitReached: false, dataSources: [] } as Stats);
      });
    },
    [caps.fetchFunctions, fetchCallbacks]
  );

  const fetchOlder = React.useCallback(async () => {
    const paging = pagingRef.current;
    if (
      !paging ||
      !paging.initializedFromResult ||
      !paging.hasMore ||
      paging.blockedByError ||
      isFetchingPageRef.current
    ) {
      return;
    }

    isFetchingPageRef.current = true;
    setLoadingOlder(true);
    try {
      const requestStart = paging.currentStart;
      const query = {
        ...paging.query,
        timeRange: undefined,
        startTime: String(paging.currentStart),
        endTime: String(paging.nextEnd)
      };
      const res = await caps.fetchFunctions.getRecords(query);
      const older = paging.showDuplicates ? res.records : mergeFlowReporters(res.records);
      const existingKeys = new Set(paging.olderFlows.map(flow => flow.key));
      const newFlows = older.filter(flow => !existingKeys.has(flow.key));
      paging.olderFlows = paging.olderFlows.concat(newFlows);
      if (newFlows.length > 0) {
        paging.loadedStart = Math.min(paging.loadedStart ?? requestStart, requestStart);
      }

      if (res.stats.limitReached) {
        const receivedTimes = res.records
          .map(getRecordTimeSeconds)
          .filter((value): value is number => value !== undefined);
        if (receivedTimes.length > 0) {
          const oldestTime = Math.min(...receivedTimes);
          if (oldestTime <= paging.currentStart) {
            movePagingWindowBack(paging);
          } else {
            // Always move the cursor backwards, even if the response only
            // contains the inclusive boundary record from the previous page.
            const nextEnd = Math.min(paging.nextEnd - 1, getExclusiveEndTime(oldestTime));
            if (nextEnd < paging.currentStart) {
              movePagingWindowBack(paging);
            } else {
              paging.nextEnd = nextEnd;
            }
          }
        } else {
          movePagingWindowBack(paging);
        }
      } else if (res.records.length === 0) {
        // Loki can have gaps between flows. Widen the next lookback window
        // instead of treating one empty interval as the end of its history.
        movePagingWindowBack(paging, true);
      } else {
        movePagingWindowBack(paging);
      }

      if (pagingRef.current === paging) {
        if (!paging.hasMore) {
          setHasMoreOlder(false);
        }
        const allKeys = new Set<number>();
        const combinedFlows = [...flowsRef.current, ...newFlows].filter(flow => {
          if (allKeys.has(flow.key)) return false;
          allKeys.add(flow.key);
          return true;
        });
        flowsRef.current = combinedFlows;
        fetchCallbacks.setFlows(combinedFlows);
        onLoadedRangeChange?.(getLoadedFlowsRange(combinedFlows));

        if (paging.showHistogram && paging.loadedStart !== undefined) {
          const currentMetricsStart = paging.metricsStart ?? paging.metricBaseStart;
          const metricsStart = Math.min(currentMetricsStart, paging.loadedStart);
          const shouldExtendRange = metricsStart < currentMetricsStart;
          const shouldPinRelativeRange = paging.metricsStart === undefined && typeof paging.range === 'number';
          const shouldRefresh = shouldExtendRange || shouldPinRelativeRange;
          if (shouldRefresh) {
            paging.metricsStart = metricsStart;
            await fetchTotalFlowCount(paging.query, extendTimeRangeToStart(paging.range, metricsStart));
          }
        }
      }
    } catch (err) {
      if (pagingRef.current === paging) {
        // A failed query doesn't prove that Loki has no older flows. Pause
        // automatic retries and let the next user scroll retry the request.
        paging.blockedByError = true;
        fetchCallbacks.setError(getStructuredHTTPError(err));
      }
    } finally {
      isFetchingPageRef.current = false;
      setLoadingOlder(false);
    }
  }, [caps.fetchFunctions, fetchCallbacks, fetchTotalFlowCount, onLoadedRangeChange]);

  const fetchNewer = React.useCallback(
    async (showUpToDateIfEmpty = false) => {
      const paging = pagingRef.current;
      if (
        !paging ||
        !paging.initializedFromResult ||
        !paging.canFetchNewer ||
        Date.now() < Math.max(upToDateUntilRef.current, newerRequestCooldownUntilRef.current) ||
        isFetchingPageRef.current
      ) {
        return;
      }

      if (upToDateTimeoutRef.current !== undefined) {
        clearTimeout(upToDateTimeoutRef.current);
        upToDateTimeoutRef.current = undefined;
      }
      setUpToDate(false);
      newerRequestCooldownUntilRef.current = Date.now() + NEWER_REQUEST_COOLDOWN_MS;
      isFetchingPageRef.current = true;
      setLoadingNewer(true);
      try {
        const isContinuing = paging.pendingNewerStart !== undefined && paging.pendingNewerEnd !== undefined;
        const intervalStart = isContinuing
          ? paging.pendingNewerStart!
          : Math.max(0, paging.newerUntil - NEWER_QUERY_OVERLAP_SECONDS);
        const snapshotEnd = paging.pendingNewerUntil ?? Math.floor(Date.now() / 1000);
        let queryEnd = isContinuing ? paging.pendingNewerEnd! : snapshotEnd;
        let complete = false;
        let pageCount = 0;
        const receivedRecords: Record[] = [];

        while (pageCount < MAX_NEWER_PAGES_PER_PULL) {
          const query = {
            ...paging.query,
            timeRange: undefined,
            startTime: String(intervalStart),
            endTime: String(queryEnd)
          };
          const res = await caps.fetchFunctions.getRecords(query);
          receivedRecords.push(...res.records);
          pageCount++;

          if (!res.stats.limitReached) {
            complete = true;
            break;
          }

          const receivedTimes = res.records
            .map(getRecordTimeSeconds)
            .filter((value): value is number => value !== undefined);
          if (receivedTimes.length === 0) {
            complete = true;
            break;
          }

          const oldestTime = Math.min(...receivedTimes);
          const nextEnd = Math.min(queryEnd - 1, getExclusiveEndTime(oldestTime));
          if (nextEnd <= intervalStart) {
            complete = true;
            break;
          }
          queryEnd = nextEnd;
        }

        if (pagingRef.current === paging) {
          const newer = paging.showDuplicates ? receivedRecords : mergeFlowReporters(receivedRecords);
          const existingKeys = new Set(flowsRef.current.map(flow => flow.key));
          const newFlows = newer.filter(flow => {
            if (existingKeys.has(flow.key)) {
              return false;
            }
            existingKeys.add(flow.key);
            return true;
          });
          if (newFlows.length > 0) {
            upToDateUntilRef.current = 0;
            const combinedFlows = [...newFlows, ...flowsRef.current];
            flowsRef.current = combinedFlows;
            fetchCallbacks.setFlows(combinedFlows);
            onLoadedRangeChange?.(getLoadedFlowsRange(combinedFlows));
          }

          if (complete) {
            paging.newerUntil = snapshotEnd;
            paging.pendingNewerStart = undefined;
            paging.pendingNewerEnd = undefined;
            paging.pendingNewerUntil = undefined;
          } else {
            paging.pendingNewerStart = intervalStart;
            paging.pendingNewerEnd = queryEnd;
            paging.pendingNewerUntil = snapshotEnd;
          }

          if (paging.showHistogram) {
            const metricsRange = extendTimeRangeToStart(paging.range, paging.metricsStart ?? paging.metricBaseStart);
            await fetchTotalFlowCount(paging.query, metricsRange);
          }

          if (complete && newFlows.length === 0 && showUpToDateIfEmpty) {
            upToDateUntilRef.current = Date.now() + 3000;
            setUpToDate(true);
            upToDateTimeoutRef.current = setTimeout(() => {
              setUpToDate(false);
              upToDateUntilRef.current = 0;
              upToDateTimeoutRef.current = undefined;
            }, 3000);
          }
        }
      } catch (err) {
        if (pagingRef.current === paging) {
          fetchCallbacks.setError(getStructuredHTTPError(err));
        }
      } finally {
        isFetchingPageRef.current = false;
        setLoadingNewer(false);
      }
    },
    [caps.fetchFunctions, fetchCallbacks, fetchTotalFlowCount, onLoadedRangeChange]
  );

  const fetchOlderIfVisible = React.useCallback(
    (event?: Event) => {
      const paging = pagingRef.current;
      if (event?.type === 'scroll' && paging?.blockedByError) {
        paging.blockedByError = false;
      }
      const container = document.getElementById('table-container');
      const eventTarget = event?.target;
      const scrollTarget =
        eventTarget instanceof HTMLElement ? eventTarget : (document.scrollingElement as HTMLElement | null);
      const isTableScrollTarget = Boolean(container && scrollTarget?.contains(container));
      const scrollTargetNearBottom = Boolean(
        isTableScrollTarget &&
        scrollTarget &&
        scrollTarget.scrollHeight > scrollTarget.clientHeight &&
        scrollTarget.scrollHeight - scrollTarget.scrollTop - scrollTarget.clientHeight <= 200
      );
      if (scrollTargetNearBottom) {
        void fetchOlder();
      }
    },
    [fetchOlder]
  );

  const fetch = React.useCallback(
    (
      range: number | TimeRange,
      histogramRange: TimeRange | undefined,
      showHistogram: boolean,
      showDuplicates: boolean,
      resetPagination = false
    ) => {
      const fq = caps.flowQuery;
      const { getRecords } = caps.fetchFunctions;
      const { setFlows, setMetrics } = fetchCallbacks;

      if (!showHistogram) {
        setMetrics(defaultNetflowMetrics);
      }

      const tableQuery = { ...fq };
      if (histogramRange) {
        tableQuery.startTime = histogramRange.from.toString();
        tableQuery.endTime = histogramRange.to.toString();
      }
      const signature = JSON.stringify([tableQuery, range, histogramRange, showDuplicates]);
      let paging = pagingRef.current;
      if (resetPagination || !paging || paging.signature !== signature) {
        if (resetPagination) {
          // A manual refresh starts a new browsing session from the newest
          // query result; carrying older pages forward can leave gaps as a
          // relative time range moves.
          pagingRef.current = undefined;
          flowsRef.current = [];
          setFlows([]);
          document.getElementById('table-container')?.scrollTo(0, 0);
        }
        onLoadedRangeChange?.(undefined);
        const tableRange = getTimeRangeBounds(histogramRange ?? range);
        const pageDuration = Math.max(1, getTimeRangeDuration(tableRange));
        paging = {
          signature,
          query: tableQuery,
          olderFlows: [],
          currentStart: tableRange.from - pageDuration,
          nextEnd: getExclusiveEndTime(tableRange.from),
          newerUntil: tableRange.to,
          canFetchNewer: typeof range === 'number' && histogramRange === undefined,
          windowDuration: pageDuration,
          maxOlderStart: tableRange.from - MAX_OLDER_LOOKBACK_SECONDS,
          range,
          metricBaseStart: getTimeRangeBounds(range).from,
          initializedFromResult: false,
          showHistogram,
          showDuplicates,
          hasMore: true,
          blockedByError: false
        };
        pagingRef.current = paging;
        setHasMoreOlder(true);
      } else {
        paging.showHistogram = showHistogram;
      }
      if (showHistogram && paging.loadedStart !== undefined) {
        paging.metricsStart = Math.min(paging.metricsStart ?? paging.metricBaseStart, paging.loadedStart);
      }
      const metricsRange =
        showHistogram && paging.metricsStart !== undefined ? extendTimeRangeToStart(range, paging.metricsStart) : range;
      const promises: Promise<Stats>[] = [
        getRecords(tableQuery).then(res => {
          const currentFlows = showDuplicates ? res.records : mergeFlowReporters(res.records);
          if (!paging.initializedFromResult) {
            const pageStart = getTimeRangeBounds(histogramRange ?? range).from;
            if (res.stats.limitReached) {
              const receivedTimes = res.records
                .map(getRecordTimeSeconds)
                .filter((value): value is number => value !== undefined);
              if (receivedTimes.length > 0) {
                const oldestTime = Math.min(...receivedTimes);
                if (oldestTime > pageStart) {
                  paging.currentStart = pageStart;
                  paging.nextEnd = getExclusiveEndTime(oldestTime);
                }
              }
            }
            paging.initializedFromResult = true;
          }
          if (pagingRef.current === paging) {
            const allKeys = new Set<number>();
            const combinedFlows = [...currentFlows, ...paging.olderFlows].filter(flow => {
              if (allKeys.has(flow.key)) return false;
              allKeys.add(flow.key);
              return true;
            });
            flowsRef.current = combinedFlows;
            setFlows(combinedFlows);
            onLoadedRangeChange?.(getLoadedFlowsRange(combinedFlows));
          }
          return res.stats;
        })
      ];
      if (showHistogram) {
        promises.push(fetchTotalFlowCount(fq, metricsRange));
      }
      return Promise.all(promises);
    },
    [caps.flowQuery, caps.fetchFunctions, fetchCallbacks, fetchTotalFlowCount, onLoadedRangeChange]
  );

  return { fetch, fetchOlder, fetchNewer, fetchOlderIfVisible, hasMoreOlder, loadingOlder, loadingNewer, upToDate };
};
