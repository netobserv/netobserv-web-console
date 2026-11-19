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
import { getStructuredHTTPError, StructuredError } from '../../../utils/errors';
import { mergeFlowReporters } from '../../../utils/flows';
import { get7Tuple } from '../../../utils/ids';
import { Result } from '../../../utils/result';

interface FlowPagingState {
  signature: string;
  query: StructuredFlowQuery;
  initialRange: TimeRange;
  sessionFlows: Record[];
  currentStart: number;
  nextEnd: number;
  newerUntil: number;
  pendingNewerStart?: number;
  pendingNewerEnd?: number;
  pendingNewerUntil?: number;
  pendingOlderBoundary?: number;
  pendingOlderNeedsCursorAdvance?: boolean;
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

// The flows handler rounds its endTime parameter up by one second. Subtract one
// second so the next query ends immediately before the completed second.
const getExclusiveEndTime = (timestamp: number): number => timestamp - 1;
const MAX_OLDER_LOOKBACK_SECONDS = 14 * 24 * 60 * 60;
const NEWER_QUERY_OVERLAP_SECONDS = 30;
const MAX_NEWER_PAGES_PER_PULL = 20;
const NEWER_REQUEST_COOLDOWN_MS = 750;
const DEFAULT_LOKI_MAX_ENTRIES_LIMIT = 5000;
const MAX_BOUNDARY_QUERY_LIMIT = 100_000;
const BOUNDARY_QUERY_LIMIT_FALLBACK_TTL_MS = 30_000;

interface CachedBoundaryQueryLimit {
  limit: number;
  expiresAt?: number;
}

const movePagingWindowBack = (paging: FlowPagingState, expand = false): void => {
  const previousEnd = paging.currentStart;
  if (previousEnd <= paging.maxOlderStart) {
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

const getLokiTimestampSeconds = (record: Record): number | undefined => {
  const timestamp = record.lokiTimestampNs;
  if (!timestamp || !/^\d+$/.test(timestamp)) {
    return undefined;
  }
  const seconds = Number(timestamp.slice(0, -9) || '0');
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : undefined;
};

const getPagingTimeSeconds = (record: Record): number | undefined =>
  getLokiTimestampSeconds(record) ?? getRecordTimeSeconds(record);

const getOldestTimeSeconds = (records: Record[]): number | undefined => {
  const times = records.map(getPagingTimeSeconds).filter((value): value is number => value !== undefined);
  return times.length > 0 ? Math.min(...times) : undefined;
};

const getCompleteTimestampSecond = async (
  query: StructuredFlowQuery,
  timestamp: number,
  getRecords: (query: StructuredFlowQuery) => Promise<{ records: Record[]; stats: Stats }>,
  maxEntriesLimit: number
): Promise<Record[]> => {
  const queryLimit = Math.max(1, Math.min(maxEntriesLimit, MAX_BOUNDARY_QUERY_LIMIT));
  let limit = Math.min(Math.max(1, query.limit), queryLimit);
  let previousRecordCount = -1;
  while (true) {
    const response = await getRecords({
      ...query,
      timeRange: undefined,
      startTime: String(timestamp),
      endTime: String(timestamp),
      limit
    });
    if (!response.stats.limitReached) {
      return response.records;
    }
    if (limit >= queryLimit || response.records.length <= previousRecordCount) {
      throw new Error(`Unable to retrieve all flows at ${timestamp}; the query limit was reached.`);
    }
    previousRecordCount = response.records.length;
    limit = Math.min(limit * 2, queryLimit);
  }
};

const advanceOlderCursor = (paging: FlowPagingState, oldestTime: number): void => {
  if (oldestTime <= paging.currentStart) {
    movePagingWindowBack(paging);
    return;
  }
  const nextEnd = Math.min(paging.nextEnd - 1, getExclusiveEndTime(oldestTime));
  if (nextEnd < paging.currentStart) {
    movePagingWindowBack(paging);
  } else {
    paging.nextEnd = nextEnd;
  }
};

const appendSessionFlows = (paging: FlowPagingState, records: Record[]): Record[] => {
  const existingKeys = new Set(paging.sessionFlows.map(flow => flow.key));
  const newFlows = records.filter(flow => !existingKeys.has(flow.key));
  paging.sessionFlows = paging.sessionFlows.concat(newFlows);
  return newFlows;
};

const replaceSessionBoundaryFlows = (
  paging: FlowPagingState,
  timestamp: number,
  records: Record[],
  sessionFlowsAtRequestStart: Record[]
): Record[] => {
  if (paging.showDuplicates) {
    return appendSessionFlows(paging, records);
  }

  const firstBoundaryIndex = paging.sessionFlows.findIndex(flow => getPagingTimeSeconds(flow) === timestamp);
  const insertIndex =
    firstBoundaryIndex < 0
      ? paging.sessionFlows.length
      : paging.sessionFlows.slice(0, firstBoundaryIndex).filter(flow => getPagingTimeSeconds(flow) !== timestamp)
          .length;
  const outsideBoundary = paging.sessionFlows.filter(flow => getPagingTimeSeconds(flow) !== timestamp);
  const outsideKeys = new Set(outsideBoundary.map(flow => flow.key));
  const requestStartKeys = new Set(sessionFlowsAtRequestStart.map(flow => flow.key));
  const concurrentBoundaryFlows = paging.sessionFlows.filter(
    flow => getPagingTimeSeconds(flow) === timestamp && !requestStartKeys.has(flow.key)
  );
  const boundaryByKey = new Map(records.map(flow => [flow.key, flow]));
  concurrentBoundaryFlows.forEach(flow => {
    if (!boundaryByKey.has(flow.key)) {
      boundaryByKey.set(flow.key, flow);
    }
  });
  const completedBoundary = mergeFlowReporters([...boundaryByKey.values()]).filter(flow => !outsideKeys.has(flow.key));
  const previousBoundaryKeys = new Set(
    paging.sessionFlows.filter(flow => getPagingTimeSeconds(flow) === timestamp).map(flow => flow.key)
  );
  paging.sessionFlows = [
    ...outsideBoundary.slice(0, insertIndex),
    ...completedBoundary,
    ...outsideBoundary.slice(insertIndex)
  ];
  return completedBoundary.filter(flow => !previousBoundaryKeys.has(flow.key));
};

const getLoadedFlowsRange = (flows: Record[]): TimeRange | undefined => {
  let from: number | undefined;
  let to: number | undefined;
  flows.forEach(flow => {
    const time = getRecordTimeSeconds(flow);
    if (time === undefined) {
      return;
    }
    from = from === undefined ? time : Math.min(from, time);
    to = to === undefined ? time : Math.max(to, time);
  });
  if (from === undefined || to === undefined) {
    return undefined;
  }
  return { from, to: Math.max(from + 1, to) };
};

const isFlowInRange = (flow: Record, range: TimeRange): boolean => {
  const time = getPagingTimeSeconds(flow);
  return time !== undefined && time >= range.from && time <= range.to;
};

const mergeRefreshedSessionFlows = (
  sessionFlows: Record[],
  currentFlows: Record[],
  refreshedRange: TimeRange,
  showDuplicates: boolean
): Record[] => {
  if (showDuplicates) {
    const currentFlowsByKey = new Map(currentFlows.map(flow => [flow.key, flow]));
    const sessionKeys = new Set(sessionFlows.map(flow => flow.key));
    const refreshedSessionFlows = sessionFlows.map(flow => currentFlowsByKey.get(flow.key) ?? flow);
    const newCurrentFlows = currentFlows.filter(flow => !sessionKeys.has(flow.key));
    return [...newCurrentFlows, ...refreshedSessionFlows];
  }

  const currentFlowsByTuple = new Map(currentFlows.map(flow => [get7Tuple(flow), flow]));
  const sessionTuples = new Set(sessionFlows.map(get7Tuple));
  const insertedTuples = new Set<string>();
  const refreshedSessionFlows: Record[] = [];

  sessionFlows.forEach(flow => {
    const tuple = get7Tuple(flow);
    const refreshedFlow = isFlowInRange(flow, refreshedRange) ? currentFlowsByTuple.get(tuple) : undefined;
    if (!refreshedFlow) {
      refreshedSessionFlows.push(flow);
      return;
    }
    if (!insertedTuples.has(tuple)) {
      refreshedSessionFlows.push(refreshedFlow);
      insertedTuples.add(tuple);
    }
  });

  const newCurrentFlows = currentFlows.filter(flow => {
    const tuple = get7Tuple(flow);
    return !sessionTuples.has(tuple) && !insertedTuples.has(tuple);
  });
  return [...newCurrentFlows, ...refreshedSessionFlows];
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
  const [olderError, setOlderError] = React.useState<StructuredError | string>();
  const [loadingNewer, setLoadingNewer] = React.useState(false);
  const [newerError, setNewerError] = React.useState<StructuredError | string>();
  const [upToDate, setUpToDate] = React.useState(false);
  const upToDateTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const upToDateUntilRef = React.useRef(0);
  const newerRequestCooldownUntilRef = React.useRef(0);
  const [hasMoreOlder, setHasMoreOlder] = React.useState(true);
  const pagingRef = React.useRef<FlowPagingState | undefined>(undefined);
  const boundaryQueryLimitRef = React.useRef<CachedBoundaryQueryLimit | undefined>(undefined);

  const clearUpToDateBadge = React.useCallback(() => {
    if (upToDateTimeoutRef.current !== undefined) {
      clearTimeout(upToDateTimeoutRef.current);
      upToDateTimeoutRef.current = undefined;
    }
    upToDateUntilRef.current = 0;
    setUpToDate(false);
  }, []);

  React.useEffect(
    () => () => {
      if (upToDateTimeoutRef.current !== undefined) {
        clearTimeout(upToDateTimeoutRef.current);
      }
      pagingRef.current = undefined;
      metricsRequestIdRef.current++;
    },
    []
  );

  React.useEffect(() => {
    flowsRef.current = flows;
  }, [flows]);

  const getBoundaryQueryLimit = React.useCallback(async () => {
    const cachedLimit = boundaryQueryLimitRef.current;
    if (cachedLimit && (cachedLimit.expiresAt === undefined || cachedLimit.expiresAt > Date.now())) {
      return cachedLimit.limit;
    }
    boundaryQueryLimitRef.current = undefined;
    try {
      const response = (await caps.fetchFunctions.getLimits?.()) as
        | { max_entries_limit_per_query?: unknown; limits_config?: { max_entries_limit_per_query?: unknown } }
        | undefined;
      const configuredLimit = Number(
        response?.max_entries_limit_per_query ?? response?.limits_config?.max_entries_limit_per_query
      );
      if (Number.isSafeInteger(configuredLimit) && configuredLimit > 0) {
        boundaryQueryLimitRef.current = { limit: configuredLimit };
        return configuredLimit;
      }
    } catch {
      // The limits endpoint is admin-only in some deployments. Use Loki's
      // default limit when the effective value cannot be read.
    }
    boundaryQueryLimitRef.current = {
      limit: DEFAULT_LOKI_MAX_ENTRIES_LIMIT,
      expiresAt: Date.now() + BOUNDARY_QUERY_LIMIT_FALLBACK_TTL_MS
    };
    return DEFAULT_LOKI_MAX_ENTRIES_LIMIT;
  }, [caps.fetchFunctions]);

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

  const fetchOlder = React.useCallback(
    async (retryBlockedByError = false) => {
      const paging = pagingRef.current;
      if (paging?.blockedByError && retryBlockedByError) {
        paging.blockedByError = false;
      }
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
      setOlderError(undefined);
      setLoadingOlder(true);
      try {
        if (paging.pendingOlderBoundary !== undefined) {
          const boundaryTime = paging.pendingOlderBoundary;
          const maxEntriesLimit = await getBoundaryQueryLimit();
          const sessionFlowsAtRequestStart = paging.sessionFlows.slice();
          const boundaryFlows = await getCompleteTimestampSecond(
            paging.query,
            boundaryTime,
            caps.fetchFunctions.getRecords,
            maxEntriesLimit
          );
          const newFlows = replaceSessionBoundaryFlows(paging, boundaryTime, boundaryFlows, sessionFlowsAtRequestStart);
          if (newFlows.length > 0) {
            paging.loadedStart = Math.min(paging.loadedStart ?? boundaryTime, boundaryTime);
          }
          paging.pendingOlderBoundary = undefined;
          if (paging.pendingOlderNeedsCursorAdvance) {
            advanceOlderCursor(paging, boundaryTime);
          }
          paging.pendingOlderNeedsCursorAdvance = undefined;

          if (pagingRef.current === paging) {
            if (!paging.hasMore) {
              setHasMoreOlder(false);
            }
            flowsRef.current = paging.sessionFlows;
            fetchCallbacks.setFlows(paging.sessionFlows);
            onLoadedRangeChange?.(getLoadedFlowsRange(paging.sessionFlows));

            if (paging.showHistogram && paging.loadedStart !== undefined) {
              const currentMetricsStart = paging.metricsStart ?? paging.metricBaseStart;
              const metricsStart = Math.min(currentMetricsStart, paging.loadedStart);
              const shouldExtendRange = metricsStart < currentMetricsStart;
              const shouldPinRelativeRange = paging.metricsStart === undefined && typeof paging.range === 'number';
              if (shouldExtendRange || shouldPinRelativeRange) {
                paging.metricsStart = metricsStart;
                await fetchTotalFlowCount(paging.query, extendTimeRangeToStart(paging.range, metricsStart));
              }
            }
          }
          return;
        }

        const requestStart = paging.currentStart;
        const query = {
          ...paging.query,
          timeRange: undefined,
          startTime: String(paging.currentStart),
          endTime: String(paging.nextEnd)
        };
        const res = await caps.fetchFunctions.getRecords(query);
        const older = paging.showDuplicates ? res.records : mergeFlowReporters(res.records);
        const newFlows = appendSessionFlows(paging, older);
        if (newFlows.length > 0) {
          paging.loadedStart = Math.min(paging.loadedStart ?? requestStart, requestStart);
        }

        if (res.stats.limitReached) {
          const oldestTime = getOldestTimeSeconds(res.records);
          const boundaryTimes = res.records
            .map(getLokiTimestampSeconds)
            .filter((value): value is number => value !== undefined);
          if (boundaryTimes.length > 0) {
            const boundarySecond = Math.min(...boundaryTimes);
            paging.pendingOlderBoundary = boundarySecond;
            paging.pendingOlderNeedsCursorAdvance = true;
            const maxEntriesLimit = await getBoundaryQueryLimit();
            const sessionFlowsAtRequestStart = paging.sessionFlows.slice();
            const boundaryFlows = await getCompleteTimestampSecond(
              paging.query,
              boundarySecond,
              caps.fetchFunctions.getRecords,
              maxEntriesLimit
            );
            const boundaryNewFlows = replaceSessionBoundaryFlows(
              paging,
              boundarySecond,
              boundaryFlows,
              sessionFlowsAtRequestStart
            );
            if (boundaryNewFlows.length > 0) {
              paging.loadedStart = Math.min(paging.loadedStart ?? boundarySecond, boundarySecond);
            }
            paging.pendingOlderBoundary = undefined;
            advanceOlderCursor(paging, boundarySecond);
            paging.pendingOlderNeedsCursorAdvance = undefined;
          } else if (oldestTime !== undefined) {
            advanceOlderCursor(paging, oldestTime);
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
          const combinedFlows = paging.sessionFlows;
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
          setOlderError(getStructuredHTTPError(err));
        }
      } finally {
        isFetchingPageRef.current = false;
        setLoadingOlder(false);
      }
    },
    [caps.fetchFunctions, fetchCallbacks, fetchTotalFlowCount, getBoundaryQueryLimit, onLoadedRangeChange]
  );

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
      setNewerError(undefined);
      newerRequestCooldownUntilRef.current = Date.now() + NEWER_REQUEST_COOLDOWN_MS;
      isFetchingPageRef.current = true;
      setLoadingNewer(true);
      try {
        const isContinuing = paging.pendingNewerStart !== undefined && paging.pendingNewerEnd !== undefined;
        let snapshotEnd = isContinuing ? paging.pendingNewerUntil : undefined;
        const fallbackSnapshotEnd = Math.max(paging.newerUntil, Math.floor(Date.now() / 1000));
        const intervalStart = isContinuing
          ? paging.pendingNewerStart!
          : Math.max(0, Math.min(paging.newerUntil, fallbackSnapshotEnd) - NEWER_QUERY_OVERLAP_SECONDS);
        let queryEnd = isContinuing ? paging.pendingNewerEnd! : fallbackSnapshotEnd;
        if (isContinuing && queryEnd < intervalStart) {
          return;
        }
        let complete = false;
        let pageCount = 0;
        const receivedRecords: Record[] = [];

        while (pageCount < MAX_NEWER_PAGES_PER_PULL) {
          const query = {
            ...paging.query,
            timeRange: undefined,
            startTime: String(intervalStart),
            endTime: !isContinuing && pageCount === 0 ? undefined : String(queryEnd)
          };
          const res = await caps.fetchFunctions.getRecords(query);
          if (snapshotEnd === undefined) {
            snapshotEnd =
              Number.isSafeInteger(res.unixTimestamp) && res.unixTimestamp! > 0
                ? Math.max(paging.newerUntil, res.unixTimestamp!)
                : fallbackSnapshotEnd;
            queryEnd = Math.max(queryEnd, snapshotEnd);
          }
          receivedRecords.push(...res.records);
          pageCount++;

          if (!res.stats.limitReached) {
            complete = true;
            break;
          }

          const oldestTime = getOldestTimeSeconds(res.records);
          if (oldestTime === undefined) {
            complete = true;
            break;
          }

          const boundaryTimes = res.records
            .map(getLokiTimestampSeconds)
            .filter((value): value is number => value !== undefined);
          if (boundaryTimes.length > 0) {
            receivedRecords.push(
              ...(await getCompleteTimestampSecond(
                paging.query,
                Math.min(...boundaryTimes),
                caps.fetchFunctions.getRecords,
                await getBoundaryQueryLimit()
              ))
            );
          }
          const nextEnd = Math.min(queryEnd - 1, getExclusiveEndTime(oldestTime));
          if (nextEnd < intervalStart) {
            complete = true;
            break;
          }
          queryEnd = nextEnd;
        }

        if (pagingRef.current === paging) {
          const newer = paging.showDuplicates ? receivedRecords : mergeFlowReporters(receivedRecords);
          const existingKeys = new Set(paging.sessionFlows.map(flow => flow.key));
          const newFlows = newer.filter(flow => {
            if (existingKeys.has(flow.key)) {
              return false;
            }
            existingKeys.add(flow.key);
            return true;
          });
          if (newFlows.length > 0) {
            upToDateUntilRef.current = 0;
            const combinedFlows = [...newFlows, ...paging.sessionFlows];
            paging.sessionFlows = combinedFlows;
            flowsRef.current = combinedFlows;
            fetchCallbacks.setFlows(combinedFlows);
            onLoadedRangeChange?.(getLoadedFlowsRange(combinedFlows));
          }

          if (complete) {
            paging.newerUntil = Math.max(paging.newerUntil, snapshotEnd ?? fallbackSnapshotEnd);
            paging.pendingNewerStart = undefined;
            paging.pendingNewerEnd = undefined;
            paging.pendingNewerUntil = undefined;
          } else {
            paging.pendingNewerStart = intervalStart;
            paging.pendingNewerEnd = queryEnd;
            paging.pendingNewerUntil = Math.max(paging.newerUntil, snapshotEnd ?? fallbackSnapshotEnd);
          }

          if (paging.showHistogram) {
            const metricsRange = extendTimeRangeToStart(paging.range, paging.metricsStart ?? paging.metricBaseStart);
            await fetchTotalFlowCount(paging.query, metricsRange);
          }
          if (pagingRef.current !== paging) {
            return;
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
          setNewerError(getStructuredHTTPError(err));
        }
      } finally {
        isFetchingPageRef.current = false;
        setLoadingNewer(false);
      }
    },
    [caps.fetchFunctions, fetchCallbacks, fetchTotalFlowCount, getBoundaryQueryLimit, onLoadedRangeChange]
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
      const requestNow = Math.floor(Date.now() / 1000);
      const rangeBounds = getTimeRangeBounds(range, requestNow);
      const tableRange = getTimeRangeBounds(histogramRange ?? range, requestNow);

      if (!showHistogram) {
        setMetrics(defaultNetflowMetrics);
      }

      const tableQuery = { ...fq };
      if (histogramRange) {
        tableQuery.timeRange = undefined;
        tableQuery.startTime = histogramRange.from.toString();
        tableQuery.endTime = histogramRange.to.toString();
      } else if (typeof range === 'number') {
        tableQuery.timeRange = range;
        tableQuery.startTime = undefined;
        tableQuery.endTime = undefined;
      } else {
        tableQuery.timeRange = undefined;
        tableQuery.startTime = rangeBounds.from.toString();
        tableQuery.endTime = rangeBounds.to.toString();
      }
      const signature = JSON.stringify([tableQuery, range, histogramRange, showDuplicates]);
      let paging = pagingRef.current;
      if (resetPagination || !paging || paging.signature !== signature) {
        setNewerError(undefined);
        clearUpToDateBadge();
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
        const pageDuration = Math.max(1, getTimeRangeDuration(tableRange));
        paging = {
          signature,
          query: tableQuery,
          initialRange: { ...tableRange },
          sessionFlows: [],
          currentStart: tableRange.from - pageDuration,
          nextEnd: getExclusiveEndTime(tableRange.from),
          newerUntil: tableRange.to,
          canFetchNewer: typeof range === 'number' && histogramRange === undefined,
          windowDuration: pageDuration,
          maxOlderStart: tableRange.from - MAX_OLDER_LOOKBACK_SECONDS,
          range,
          metricBaseStart: rangeBounds.from,
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
            if (
              typeof range === 'number' &&
              histogramRange === undefined &&
              Number.isSafeInteger(res.unixTimestamp) &&
              res.unixTimestamp! > 0
            ) {
              const resolvedEnd = res.unixTimestamp!;
              const resolvedStart = resolvedEnd - range;
              paging.initialRange = { from: resolvedStart, to: resolvedEnd };
              paging.currentStart = resolvedStart - paging.windowDuration;
              paging.nextEnd = getExclusiveEndTime(resolvedStart);
              paging.newerUntil = resolvedEnd;
              paging.maxOlderStart = resolvedStart - MAX_OLDER_LOOKBACK_SECONDS;
              paging.metricBaseStart = resolvedStart;
            }
            const pageStart = paging.initialRange.from;
            if (res.stats.limitReached) {
              const oldestTime = getOldestTimeSeconds(res.records);
              const boundaryTimes = res.records
                .map(getLokiTimestampSeconds)
                .filter((value): value is number => value !== undefined);
              if (boundaryTimes.length > 0) {
                paging.pendingOlderBoundary = Math.min(...boundaryTimes);
                paging.pendingOlderNeedsCursorAdvance = false;
              }
              if (oldestTime !== undefined) {
                if (oldestTime > pageStart) {
                  paging.currentStart = pageStart;
                  paging.nextEnd = getExclusiveEndTime(oldestTime);
                }
              }
            }
            paging.initializedFromResult = true;
          }
          if (pagingRef.current === paging) {
            const refreshedRange =
              typeof range === 'number' &&
              histogramRange === undefined &&
              Number.isSafeInteger(res.unixTimestamp) &&
              res.unixTimestamp! > 0
                ? { from: res.unixTimestamp! - range, to: res.unixTimestamp! }
                : tableRange;
            const combinedFlows = mergeRefreshedSessionFlows(
              paging.sessionFlows,
              currentFlows,
              refreshedRange,
              showDuplicates
            );
            paging.sessionFlows = combinedFlows;
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
    [caps.flowQuery, caps.fetchFunctions, fetchCallbacks, fetchTotalFlowCount, clearUpToDateBadge, onLoadedRangeChange]
  );

  return {
    fetch,
    fetchOlder,
    fetchNewer,
    fetchOlderIfVisible,
    hasMoreOlder,
    loadingOlder,
    loadingNewer,
    olderError,
    newerError,
    upToDate
  };
};
