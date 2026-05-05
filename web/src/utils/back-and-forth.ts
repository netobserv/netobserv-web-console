import { FlowMetricsResult, RecordsResult } from '../api/loki';
import { getFlowMetrics, getFlowRecords } from '../api/routes';
import { Filter, FilterDefinition } from '../model/filters';
import { filtersToString, StructuredFlowQuery, structuredToRawQuery } from '../model/flow-query';
import { computeStepInterval, TimeRange } from './datetime';
import { setEndpointFilters, swapFilters } from './filters-helper';
import { mergeStats, substractMetrics, sumMetrics } from './metrics';

export const getFetchFunctions = (filterDefinitions: FilterDefinition[]) => {
  return {
    getRecords: (q: StructuredFlowQuery) => {
      // check back-and-forth
      if (q.structuredFilters.list.some(f => f.def.category === 'endpoint')) {
        // set endpoint filters as source filters
        const srcList = setEndpointFilters(filterDefinitions, q.structuredFilters.list, 'src');
        // set endpoint filters as dest filters
        const dstList = setEndpointFilters(filterDefinitions, q.structuredFilters.list, 'dst');
        return getFlowsBNF(q, srcList, dstList);
      } else if (q.structuredFilters.match === 'bidirectional') {
        const swapped = swapFilters(filterDefinitions, q.structuredFilters.list);
        if (swapped.length > 0) {
          return getFlowsBNF(q, q.structuredFilters.list, swapped);
        }
      }
      const rawQ = structuredToRawQuery(q);
      return getFlowRecords(rawQ);
    },
    getMetrics: (q: StructuredFlowQuery, range: number | TimeRange) => {
      // check back-and-forth
      if (q.structuredFilters.list.some(f => f.def.category === 'endpoint')) {
        // set endpoint filters as source filters
        const srcList = setEndpointFilters(filterDefinitions, q.structuredFilters.list, 'src');
        // set endpoint filters as dest filters
        const dstList = setEndpointFilters(filterDefinitions, q.structuredFilters.list, 'dst');
        return getMetricsBNF(q, range, srcList, dstList);
      } else if (q.structuredFilters.match === 'bidirectional') {
        const swapped = swapFilters(filterDefinitions, q.structuredFilters.list);
        if (swapped.length > 0) {
          return getMetricsBNF(q, range, q.structuredFilters.list, swapped);
        }
      }
      const rawQ = structuredToRawQuery(q);
      return getFlowMetrics(rawQ, range);
    }
  };
};

const encodedPipe = encodeURIComponent('|');
const getFlowsBNF = (initialQuery: StructuredFlowQuery, orig: Filter[], swapped: Filter[]): Promise<RecordsResult> => {
  // Combine original filters and swapped. Note that we leave any potential overlapping flows: they can be deduped with "showDuplicates: false".
  const matchAny = initialQuery.structuredFilters.match === 'any';
  const newFilters = filtersToString(orig, matchAny) + encodedPipe + filtersToString(swapped, matchAny);
  return getFlowRecords({ ...initialQuery, filters: newFilters });
};

const getMetricsBNF = (
  initialQuery: StructuredFlowQuery,
  range: number | TimeRange,
  orig: Filter[],
  swapped: Filter[]
): Promise<FlowMetricsResult> => {
  // When bnf is on, this replaces the usual getMetrics with a function with same arguments that runs 3 queries and merge their results
  // in order to get the ORIGINAL + SWAPPED - OVERLAP
  // OVERLAP being ORIGINAL AND SWAPPED.
  // E.g: if ORIGINAL is "SrcNs=foo", SWAPPED is "DstNs=foo" and OVERLAP is "SrcNs=foo AND DstNs=foo"
  const matchAny = initialQuery.structuredFilters.match === 'any';
  const overlapFilters = matchAny ? undefined : [...orig, ...swapped];
  const promOrig = getFlowMetrics({ ...initialQuery, filters: filtersToString(orig, matchAny) }, range);
  const promSwapped = getFlowMetrics({ ...initialQuery, filters: filtersToString(swapped, matchAny) }, range);
  const promOverlap = overlapFilters
    ? getFlowMetrics(
        {
          ...initialQuery,
          filters: filtersToString(overlapFilters, matchAny)
        },
        range
      )
    : Promise.resolve(undefined);
  return Promise.all([promOrig, promSwapped, promOverlap]).then(([rsOrig, rsSwapped, rsOverlap]) =>
    mergeMetricsBNF(range, rsOrig, rsSwapped, rsOverlap)
  );
};

// exported for testing
export const mergeMetricsBNF = (
  range: number | TimeRange,
  rsOrig: FlowMetricsResult,
  rsSwapped: FlowMetricsResult,
  rsOverlap?: FlowMetricsResult
): FlowMetricsResult => {
  const { stepSeconds } = computeStepInterval(range);
  // Sum ORIGINAL + SWAPPED
  const metrics = sumMetrics(rsOrig.metrics, rsSwapped.metrics, stepSeconds);
  const stats = mergeStats(rsOrig.stats, rsSwapped.stats);
  if (rsOverlap) {
    // Substract OVERLAP
    return {
      metrics: substractMetrics(metrics, rsOverlap.metrics, stepSeconds),
      stats: mergeStats(stats, rsOverlap.stats)
    };
  }
  return { metrics, stats };
};
