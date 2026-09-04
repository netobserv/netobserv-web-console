import { ViewPresetId } from 'src/model/views';
import {
  createFilterValue,
  DisabledFilters,
  Filter,
  FilterCompare,
  FilterDefinition,
  Filters,
  fromFilterKey
} from '../model/filters';
import { DataSource, Match, MetricType, PacketLoss, RecordType, StatFunction } from '../model/flow-query';
import { TimeRange } from './datetime';
import { findFilter } from './filter-definitions';
import {
  getURLParam,
  getURLParamAsBool,
  getURLParamAsNumber,
  removeURLParam,
  setSomeURLParams,
  setURLParam,
  URLParam
} from './url';

const filtersSeparator = ';';
const filterValuesSeparator = ',';
export const defaultTimeRange = 300;
export const defaultRecordType: RecordType = 'flowLog';
export const defaultDataSource: DataSource = 'auto';
export const defaultMatch: Match = 'all';
export const defaultPacketLoss: PacketLoss = 'all';
export const defaultMetricFunction: StatFunction = 'last';
export const defaultMetricType: MetricType = 'Bytes';
export const defaultMetricScope = 'namespace';
const defaultShowDuplicates = false;

export const getRangeFromURL = (): number | TimeRange => {
  const timeRange = getURLParamAsNumber(URLParam.TimeRange);
  const startTime = getURLParamAsNumber(URLParam.StartTime);
  const endTime = getURLParamAsNumber(URLParam.EndTime);
  if (timeRange) {
    return timeRange;
  } else if (startTime && endTime) {
    return { from: startTime, to: endTime };
  }
  return defaultTimeRange;
};

export const getRecordTypeFromURL = (): RecordType => {
  return (getURLParam(URLParam.RecordType) as RecordType | null) || defaultRecordType;
};

export const getDataSourceFromURL = (): DataSource => {
  return (getURLParam(URLParam.DataSource) as DataSource | null) || defaultDataSource;
};

export const getShowDupFromURL = (): boolean => {
  return getURLParamAsBool(URLParam.ShowDuplicates) || defaultShowDuplicates;
};

export const getLimitFromURL = (fallback: number): number => {
  return getURLParamAsNumber(URLParam.Limit) || fallback;
};

export const getPercentileFromURL = (fallback: number): number => {
  return getURLParamAsNumber(URLParam.Percentile) || fallback;
};

export const getMatchFromURL = (): Match => {
  return (getURLParam(URLParam.Match) as Match | null) || defaultMatch;
};

export const getPacketLossFromURL = (): PacketLoss => {
  return (getURLParam(URLParam.PacketLoss) as PacketLoss | null) || defaultPacketLoss;
};

export const getFiltersFromURL = (
  filterDefinitions: FilterDefinition[],
  disabledFilters: DisabledFilters
): Promise<Filters> | undefined => {
  const urlParam = getURLParam(URLParam.Filters);
  //skip filters only if url param is missing
  if (urlParam === null) {
    return undefined;
  }
  const filterPromises: Promise<Filter>[] = [];
  const filters = urlParam.split(filtersSeparator);
  filters.forEach(keyValue => {
    const pair = keyValue.split(/=|~/);
    if (pair.length === 2) {
      const { id } = fromFilterKey(pair[0]);
      const def = findFilter(filterDefinitions, id);
      if (def) {
        const disabledValues = disabledFilters[pair[0]]?.split(',') || [];
        const values = pair[1].split(filterValuesSeparator);
        filterPromises.push(
          Promise.all(values.map(v => createFilterValue(def, v))).then(filterValues => {
            filterValues.forEach(fv => {
              if (disabledValues.includes(fv.v)) {
                fv.disabled = true;
              }
            });
            const f: Filter = {
              def: def,
              compare: keyValue.includes(FilterCompare.moreThanOrEqual)
                ? FilterCompare.moreThanOrEqual
                : keyValue.includes(FilterCompare.notEqual)
                ? FilterCompare.notEqual
                : keyValue.includes(FilterCompare.equal)
                ? FilterCompare.equal
                : keyValue.includes(FilterCompare.notMatch)
                ? FilterCompare.notMatch
                : FilterCompare.match,
              values: filterValues
            };
            return f;
          })
        );
      }
    }
  });
  const match = (getURLParam(URLParam.Match) as Match) || defaultMatch;
  return Promise.all(filterPromises).then(list => ({ match, list }));
};

export const setURLFilters = (filters: Filters, replace?: boolean) => {
  const urlFilters = filters.list
    .map(filter => {
      return filter.def.id + filter.compare + filter.values.map(v => v.v).join(filterValuesSeparator);
    })
    .join(filtersSeparator);
  setSomeURLParams(
    new Map([
      [URLParam.Filters, urlFilters],
      [URLParam.Match, filters.match]
    ]),
    replace
  );
};

export const setURLRange = (range: number | TimeRange, replace?: boolean) => {
  if (typeof range === 'number') {
    setURLParam(URLParam.TimeRange, String(range), replace);
    removeURLParam(URLParam.StartTime, true);
    removeURLParam(URLParam.EndTime, true);
  } else if (typeof range === 'object') {
    setSomeURLParams(
      new Map([
        [URLParam.StartTime, String(range.from)],
        [URLParam.EndTime, String(range.to)]
      ]),
      replace
    );
    removeURLParam(URLParam.TimeRange, true);
  }
};

export const setURLRecortType = (recordType: RecordType, replace?: boolean) => {
  setURLParam(URLParam.RecordType, recordType, replace);
};

export const setURLDatasource = (datasource: DataSource, replace?: boolean) => {
  setURLParam(URLParam.DataSource, datasource, replace);
};

export const setURLLimit = (limit: number, replace?: boolean) => {
  setURLParam(URLParam.Limit, String(limit), replace);
};

export const setURLPercentile = (percentile: number, replace?: boolean) => {
  setURLParam(URLParam.Percentile, String(percentile), replace);
};

export const setURLShowDup = (show: boolean, replace?: boolean) => {
  setURLParam(URLParam.ShowDuplicates, String(show), replace);
};

export const setURLMatch = (match: Match, replace?: boolean) => {
  setURLParam(URLParam.Match, match, replace);
};

export const setURLPacketLoss = (pl: PacketLoss, replace?: boolean) => {
  setURLParam(URLParam.PacketLoss, pl, replace);
};

export const setURLMetricFunction = (metricFunction?: StatFunction, replace?: boolean) => {
  if (metricFunction) {
    setURLParam(URLParam.MetricFunction, metricFunction, replace);
  } else {
    removeURLParam(URLParam.MetricFunction, replace);
  }
};

export const setURLMetricType = (metricType?: MetricType, replace?: boolean) => {
  if (metricType) {
    setURLParam(URLParam.MetricType, metricType, replace);
  } else {
    removeURLParam(URLParam.MetricType, replace);
  }
};

export const getViewFromURL = (): ViewPresetId => {
  return (getURLParam(URLParam.View) as ViewPresetId | null) || 'all';
};

export const setURLView = (viewId: ViewPresetId, replace?: boolean) => {
  if (viewId && viewId !== 'all') {
    setURLParam(URLParam.View, viewId, replace);
  } else {
    removeURLParam(URLParam.View, replace);
  }
};
