import { getURLParam, removeURLParam, setURLParam, URLParam } from '../../utils/url';
import { AlertState, getItemMode, HealthMode, NamedItem, Severity } from './health-helper';

export type HealthFilterState = {
  severities: Severity[]; // [] = all
  statuses: AlertState[]; // [] = all
  modes: HealthMode[]; // [] = all
  namespaces: string[]; // [] = all
  searchText: string; // '' = no filter
};

export const emptyHealthFilters: HealthFilterState = {
  severities: [],
  statuses: [],
  modes: [],
  namespaces: [],
  searchText: ''
};

export const isHealthFilterEmpty = (f: HealthFilterState): boolean => {
  return (
    f.severities.length === 0 &&
    f.statuses.length === 0 &&
    f.modes.length === 0 &&
    f.namespaces.length === 0 &&
    f.searchText.trim().length === 0
  );
};

export const countActiveHealthFilters = (f: HealthFilterState): number => {
  return (
    f.severities.length +
    f.statuses.length +
    f.modes.length +
    f.namespaces.length +
    (f.searchText.trim().length > 0 ? 1 : 0)
  );
};

export const matchesHealthFilters = (item: NamedItem, filters: HealthFilterState): boolean => {
  if (filters.severities.length && !filters.severities.includes(item.severity)) {
    return false;
  }
  if (filters.statuses.length && !filters.statuses.includes(item.state)) {
    return false;
  }
  if (filters.modes.length && !filters.modes.includes(getItemMode(item))) {
    return false;
  }
  if (filters.namespaces.length) {
    const ns = item.superKind === 'Namespace' ? item.name : item.superKind === 'Owner' ? item.namespace : undefined;
    // Global / Node items have no namespace dimension: let them through rather than hiding them silently.
    if (ns !== undefined && !filters.namespaces.includes(ns)) {
      return false;
    }
  }
  const search = filters.searchText.trim().toLowerCase();
  if (search) {
    const target = `${item.name} ${item.ruleName} ${item.summary} ${item.description}`.toLowerCase();
    if (!target.includes(search)) {
      return false;
    }
  }
  return true;
};

export const buildHealthPredicate = (filters: HealthFilterState): ((item: NamedItem) => boolean) | undefined => {
  if (isHealthFilterEmpty(filters)) {
    return undefined;
  }
  return (item: NamedItem) => matchesHealthFilters(item, filters);
};

const splitCSV = (v: string | null): string[] => (v ? v.split(',').filter(Boolean) : []);

export const getHealthFiltersFromURL = (): HealthFilterState => ({
  severities: splitCSV(getURLParam(URLParam.HealthSeverity)) as Severity[],
  statuses: splitCSV(getURLParam(URLParam.HealthStatus)) as AlertState[],
  modes: splitCSV(getURLParam(URLParam.HealthMode)) as HealthMode[],
  namespaces: splitCSV(getURLParam(URLParam.HealthNamespace)),
  searchText: getURLParam(URLParam.HealthName) ?? ''
});

export const setURLHealthFilters = (f: HealthFilterState, replace?: boolean): void => {
  const setOrRemove = (param: URLParam, value: string) => {
    if (value) {
      setURLParam(param, value, replace);
    } else {
      removeURLParam(param, replace);
    }
  };
  setOrRemove(URLParam.HealthSeverity, f.severities.join(','));
  setOrRemove(URLParam.HealthStatus, f.statuses.join(','));
  setOrRemove(URLParam.HealthMode, f.modes.join(','));
  setOrRemove(URLParam.HealthNamespace, f.namespaces.join(','));
  setOrRemove(URLParam.HealthName, f.searchText.trim());
};
