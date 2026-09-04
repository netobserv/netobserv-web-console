import _ from 'lodash';
import * as React from 'react';

export const localStoragePluginKey = 'netobserv-plugin-settings';
export const localStorageColsKey = 'netflow-traffic-columns';
export const localStorageColsSizesKey = 'netflow-traffic-column-sizes';
export const localStorageExportColsKey = 'netflow-traffic-export-columns';
export const localStorageRefreshKey = 'netflow-traffic-refresh';
export const localStorageHealthRefreshKey = 'network-health-refresh';
export const localStorageHealthSummaryExpandedKey = 'network-health-summary-expanded';
export const localStorageHealthFiltersKey = 'network-health-filters';
export const localStorageSizeKey = 'netflow-traffic-size-size';
export const localStorageViewIdKey = 'netflow-traffic-view-id';
export const localStorageOverviewTruncateKey = 'netflow-traffic-overview-truncate';
export const localStorageOverviewFocusKey = 'netflow-traffic-overview-focus';
export const localStorageTopologyOptionsKey = 'netflow-traffic-topology-options';
export const localStorageQueryParamsKey = 'netflow-traffic-query-params';
export const localStorageDisabledFiltersKey = 'netflow-traffic-disabled-filters';
export const localStorageSortIdKey = 'netflow-traffic-sort-id';
export const localStorageSortDirectionKey = 'netflow-traffic-sort-direction';
export const localStorageOverviewIdsKey = 'netflows-traffic-overview-ids';
export const localStorageLastLimitKey = 'netflow-traffic-limit';
export const localStorageLastTopKey = 'netflow-traffic-top';
export const localStorageMetricScopeKey = 'netflow-traffic-metric-scope';
export const localStorageMetricFunctionKey = 'netflow-traffic-metric-function';
export const localStorageMetricTypeKey = 'netflow-traffic-metric-type';
export const localStorageShowOptionsKey = 'netflow-traffic-show-options';
export const localStorageShowHistogramKey = 'netflow-traffic-show-histogram';
export const localStorageShowFiltersKey = 'netflow-traffic-show-filters';
export const localStorageHistogramGuidedTourDoneKey = 'netflow-traffic-histogram-guided-tour-done';
export const localStorageOverviewDonutDimensionKey = 'netflow-traffic-overview-donut-dimension';
export const localStorageOverviewMetricsDimensionKey = 'netflow-traffic-overview-metrics-dimension';
export const localStorageOverviewMetricsTotalDimensionKey = 'netflow-traffic-overview-metrics-total-dimension';
export const localStorageOverviewKebabKey = 'netflow-traffic-overview-kebab-map';

export interface ArraySelectionOptions {
  id: string;
  criteria: string;
}

export const defaultArraySelectionOptions = {
  id: 'id',
  criteria: 'isSelected'
};

export function useLocalStorage<T>(
  key: string,
  initialValue?: T,
  opts?: ArraySelectionOptions
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = React.useState<T>(() => getLocalStorage<T>(key, initialValue, opts));

  const setValue: React.Dispatch<React.SetStateAction<T>> = React.useCallback(
    (value: React.SetStateAction<T>) => {
      setStoredValue(prev => {
        try {
          const stateValue = value instanceof Function ? value(prev) : value;

          const item = window.localStorage.getItem(localStoragePluginKey);
          const parsedItem = item ? JSON.parse(item) : {};
          const storeValue =
            stateValue instanceof Map
              ? Object.fromEntries((stateValue as unknown as Map<string, unknown>).entries())
              : stateValue;

          if (opts) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            parsedItem[key] = (storeValue as any[])
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .filter((item: any) => item[opts.criteria])
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((item: any) => item[opts.id]);
          } else {
            parsedItem[key] = storeValue;
          }

          window.localStorage.setItem(localStoragePluginKey, JSON.stringify(parsedItem));
          return stateValue;
        } catch (error) {
          console.error(error);
          clearLocalStorage();
          return prev;
        }
      });
    },
    [key, opts]
  );

  return [storedValue, setValue];
}

export function getLocalStorage<T>(key: string, initialValue?: T, opts?: ArraySelectionOptions) {
  try {
    const item = window.localStorage.getItem(localStoragePluginKey);
    const param = item ? JSON.parse(item)[key] : undefined;

    // Manage array selection by ids if opts is set
    if (opts && Array.isArray(initialValue) && Array.isArray(param)) {
      return !_.isEmpty(param)
        ? initialValue.map(item => {
            item[opts.criteria] = param.includes(item[opts.id]);
            return item;
          })
        : initialValue;
    } else if (initialValue instanceof Map) {
      return param ? new Map(Object.entries(param)) : initialValue;
    } else {
      // Return parsed item if available
      return param ? param : initialValue;
    }
  } catch (error) {
    console.error(error);
    clearLocalStorage();
    return initialValue;
  }
}

export function setLocalStorage<T>(key: string, value: T) {
  try {
    const item = window.localStorage.getItem(localStoragePluginKey);
    const parsedItem = item ? JSON.parse(item) : {};
    parsedItem[key] = value;
    window.localStorage.setItem(localStoragePluginKey, JSON.stringify(parsedItem));
  } catch (error) {
    console.error(error);
    clearLocalStorage();
  }
}

export function clearLocalStorage() {
  try {
    console.info('clearing local storage ' + localStoragePluginKey);
    window.localStorage.removeItem(localStoragePluginKey);
  } catch (error) {
    console.error(error);
  }
}
