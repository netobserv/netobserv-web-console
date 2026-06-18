import { TFunction } from 'i18next';
import { Config } from '../model/config';
import { Filter, FilterDefinition, FilterId, FilterValue } from '../model/filters';
import { findFilter } from './filter-definitions';

export type Indicator = 'default' | 'success' | 'warning' | 'error' | undefined;

export type FilterGroup = {
  title: string;
  filters: FilterDefinition[];
};

export const getFilterFullName = (f: FilterDefinition, t: TFunction) => {
  switch (f.category) {
    case 'source':
      return `${t('From')} ${f.name}`;
    case 'destination':
      return `${t('To')} ${f.name}`;
    default:
      return f.name;
  }
};

export const hasSrcOrDstFilters = (filters: Filter[]): boolean => {
  return filters.some(f => f.def.id.startsWith('src_') || f.def.id.startsWith('dst_'));
};

export const hasSrcAndDstFilters = (filters: Filter[]): boolean => {
  return filters.some(f => f.def.id.startsWith('src_')) && filters.some(f => f.def.id.startsWith('dst_'));
};

export const swapFilterDefinition = (
  filterDefinitions: FilterDefinition[],
  def: FilterDefinition,
  target?: 'src' | 'dst'
): FilterDefinition => {
  let swappedId: FilterId | undefined;
  if (def.id.startsWith('src_')) {
    swappedId = def.id.replace('src_', target ? `${target}_` : 'dst_') as FilterId;
  } else if (def.id.startsWith('dst_')) {
    swappedId = def.id.replace('dst_', target ? `${target}_` : 'src_') as FilterId;
  } else if (def.category === 'endpoint' && target) {
    swappedId = `${target}_${def.id}` as FilterId;
  }
  if (swappedId) {
    return filterDefinitions.find(def => def.id === swappedId) || def;
  }
  return def;
};

export const swapFilter = (filterDefinitions: FilterDefinition[], filter: Filter, target?: 'src' | 'dst'): Filter => {
  const def = swapFilterDefinition(filterDefinitions, filter.def, target);
  if (def) {
    return { ...filter, def };
  }
  return filter;
};

export const swapFilters = (filterDefinitions: FilterDefinition[], filters: Filter[]): Filter[] => {
  return filters.map(f => swapFilter(filterDefinitions, f));
};

export const setEndpointFilters = (
  filterDefinitions: FilterDefinition[],
  filters: Filter[],
  target: 'src' | 'dst'
): Filter[] => {
  return filters.map(f => (f.def.category === 'endpoint' ? swapFilter(filterDefinitions, f, target) : f));
};

export const setEndpointFilterDefinition = (
  filterDefinitions: FilterDefinition[],
  def: FilterDefinition,
  target: 'src' | 'dst'
): FilterDefinition => {
  return def.category === 'endpoint' ? swapFilterDefinition(filterDefinitions, def, target) : def;
};

export const swapFilterValue = (
  filterDefinitions: FilterDefinition[],
  filters: Filter[],
  id: FilterId,
  value: FilterValue,
  target: 'src' | 'dst'
): Filter[] => {
  // remove value from existing filter
  const found = filters.find(f => f.def.id === id);
  if (!found) {
    console.error("Can't find filter id", id);
    return filters;
  }
  found.values = found.values.filter(val => val.v !== value.v);

  // remove filter if no more values
  if (!found.values.length) {
    filters = filters.filter(f => f !== found);
  }

  // add new swapped filter
  const swapped = swapFilter(filterDefinitions, { ...found, values: [value] }, target);
  const existing = filters.find(f => f.def.id === swapped.def.id);
  if (existing) {
    if (!existing.values.includes(swapped.values[0])) {
      existing.values.push(swapped.values[0]);
    }
  } else {
    filters.push(swapped);
  }

  return filters;
};

export const bnfFilterValue = (
  filterDefinitions: FilterDefinition[],
  filters: Filter[],
  id: FilterId,
  value: FilterValue
): Filter[] => {
  // find the base filter definition first (before modifying anything)
  const bnfId = id.replace('src_', '').replace('dst_', '') as FilterId;
  const def = findFilter(filterDefinitions, bnfId);
  if (!def) {
    console.error("Can't find filter def", bnfId);
    return filters;
  }

  // remove value from existing filter
  const found = filters.find(f => f.def.id === id);
  if (!found) {
    console.error("Can't find filter id", id);
    return filters;
  }
  found.values = found.values.filter(val => val.v !== value.v);

  // remove filter if no more values
  if (!found.values.length) {
    filters = filters.filter(f => f !== found);
  }

  // add new back and forth filter value
  const existing = filters.find(f => f.def.id === bnfId);
  if (!existing) {
    filters.push({ ...found, def, values: [value] });
  } else if (!existing.values.includes(value)) {
    existing.values.push(value);
  }

  return filters;
};

export const isLokiLabel = (filter: FilterDefinition, config: Config): boolean => {
  const allowLoki = config.dataSources.some(ds => ds === 'loki');
  if (!allowLoki) {
    return false;
  }

  const colConfig = config.columns.find(c => c.filter === filter.id);
  if (!colConfig) {
    return false;
  }
  if (!filter.category) {
    return config.lokiLabels.includes(colConfig.id);
  } else {
    return config.lokiLabels.includes('Src' + colConfig.id);
  }
  return false;
};
