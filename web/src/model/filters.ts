import { TFunction } from 'i18next';
import _ from 'lodash';
import { isEqual } from '../utils/base-compare';
import { undefinedValue } from '../utils/filter-definitions';
import { Feature } from './config';
import { Match } from './flow-query';

export type FiltersEncoder = (values: FilterValue[], compare: FilterCompare, matchAny: boolean) => string;

export type FilterComponent = 'autocomplete' | 'text' | 'number';

export type FilterCategory = 'source' | 'destination' | 'endpoint';

export enum FilterCompare {
  match = '~',
  notMatch = '!~',
  equal = '=',
  notEqual = '!=',
  moreThanOrEqual = '>='
}

export const getCompareText = (v: FilterCompare, t: TFunction) => {
  switch (v) {
    case FilterCompare.match:
      return t('Contains');
    case FilterCompare.notMatch:
      return t('Not contains');
    case FilterCompare.notEqual:
      return t('Not equals');
    case FilterCompare.moreThanOrEqual:
      return t('More than');
    case FilterCompare.equal:
    default:
      return t('Equals');
  }
};

export type TargetedFilterId =
  | 'zone'
  | 'namespace'
  | 'name'
  | 'kind'
  | 'owner_name'
  | 'resource'
  | 'address'
  | 'mac'
  | 'port'
  | 'host_address'
  | 'host_name'
  | 'subnet_label';

export type FilterId =
  | 'cluster_name'
  | TargetedFilterId
  | `src_${TargetedFilterId}`
  | `dst_${TargetedFilterId}`
  | 'protocol'
  | 'direction'
  | 'interface'
  | 'type'
  | 'dscp'
  | 'icmp_type'
  | 'icmp_code'
  | 'udns'
  | 'id'
  | 'pkt_drop_state'
  | 'pkt_drop_cause'
  | 'dns_id'
  | 'dns_latency'
  | 'dns_flag_response_code'
  | 'dns_errno'
  | 'dns_name'
  | 'time_flow_rtt'
  | 'network_events'
  | 'xlat_zone_id'
  | 'xlat_src_address'
  | 'xlat_dst_address'
  | 'xlat_src_port'
  | 'xlat_dst_port'
  | 'ipsec_success'
  | 'ipsec_retcode'
  | 'tcp_flags'
  | 'tls_types';

export interface FilterConfigDef {
  id: string;
  name: string;
  component: string;
  category?: string;
  autoCompleteAddsQuotes?: boolean;
  hint?: string;
  examples?: string;
  docUrl?: string;
  placeholder?: string;
  feature?: Feature;
}

export interface FilterDefinition {
  id: FilterId;
  name: string;
  component: FilterComponent;
  category?: FilterCategory;
  findOption: (value: string) => FilterOption | undefined;
  autocomplete: (value: string) => Promise<FilterOption[]>;
  validate: (value: string) => { val?: string; err?: string };
  checkCompletion?: (value: string, selected: string) => { completed: boolean; option: FilterOption };
  autoCompleteAddsQuotes?: boolean;
  hint?: string;
  examples?: string;
  docUrl?: string;
  placeholder?: string;
  encoder: FiltersEncoder;
}

export interface FilterValue {
  v: string;
  disabled?: boolean;
  display?: string;
}

export interface Filter {
  def: FilterDefinition;
  compare: FilterCompare;
  values: FilterValue[];
}

export interface Filters {
  list: Filter[];
  match: Match;
}

export interface FilterOption {
  name: string;
  value: string;
}

export const createFilterValue = (def: FilterDefinition, value: string): FilterValue => {
  const option = def.findOption(value);
  return option
    ? { v: option.value, display: option.name }
    : { v: value, display: value === undefinedValue ? 'n/a' : undefined };
};

export const hasEnabledFilterValues = (filter: Filter) => {
  if (filter.values.find(fv => fv.disabled !== true)) {
    return true;
  }
  return false;
};

export const getEnabledFilters = (filters: Filters): Filters => {
  //clone to avoid values updated in filters
  const clonedFilters = _.cloneDeep(filters.list);
  return {
    list: clonedFilters
      .map(f => {
        f.values = f.values.filter(fv => fv.disabled !== true);
        return f;
      })
      .filter(f => !_.isEmpty(f.values)),
    match: filters.match
  };
};

export type DisabledFilters = Record<string, string>;

export const filterKey = (filter: Filter) =>
  filter.def.id +
  ([FilterCompare.notEqual, FilterCompare.notMatch].includes(filter.compare) ? '!' : '') +
  (filter.compare === FilterCompare.moreThanOrEqual ? '>' : '');

export const fromFilterKey = (key: string) => {
  if (key.endsWith('!')) {
    return { id: key.substring(0, key.length - 1) as FilterId, not: true };
  } else if (key.endsWith('>')) {
    return { id: key.substring(0, key.length - 1) as FilterId, moreThan: true };
  }
  return { id: key as FilterId };
};

export const getDisabledFiltersRecord = (filters: Filter[]) => {
  const disabledFilters: DisabledFilters = {};
  filters.forEach(f => {
    const values = f.values
      .filter(fv => fv.disabled === true)
      .map(fv => fv.v)
      .join(',');
    if (!_.isEmpty(values)) {
      disabledFilters[filterKey(f)] = values;
    }
  });
  return disabledFilters;
};

const isIndexed = (f: Filter) => {
  return f.def.id.includes('namespace') || f.def.id.includes('owner') || f.def.id.includes('resource');
};

export const hasIndexFields = (filters: Filter[]) => {
  return filters.some(isIndexed);
};

export const hasNonIndexFields = (filters: Filter[]) => {
  return filters.some(f => !isIndexed(f));
};

type FilterKey = Omit<Filter, 'values'>;

export const findFromFilters = (activeFilters: Filter[], search: FilterKey): Filter | undefined => {
  return activeFilters.find(f => filterKeyEqual(f, search));
};

export const removeFromFilters = (activeFilters: Filter[], search: FilterKey): Filter[] => {
  return activeFilters.filter(f => !filterKeyEqual(f, search));
};

export const filterKeyEqual = (f1: FilterKey, f2: FilterKey): boolean => {
  return f1.def.id === f2.def.id && f1.compare === f2.compare;
};

type ComparableFilter = { key: string; values: string[] };

const comparableFilter = (f: Filter): ComparableFilter => {
  return {
    key: f.def.id + ([FilterCompare.notEqual, FilterCompare.notMatch].includes(f.compare) ? '!' : ''),
    values: f.values.map(v => v.v).sort()
  };
};

const comparableFilters = (f: Filter[]) => {
  return f.map(comparableFilter).sort((f1, f2) => f1.key.localeCompare(f2.key));
};

export const filtersEqual = (f1: Filter[], f2: Filter[]): boolean => {
  return isEqual(comparableFilters(f1), comparableFilters(f2));
};

export const doesIncludeFilter = (activeFilters: Filter[], search: FilterKey, values: FilterValue[]): boolean => {
  const found = findFromFilters(activeFilters, search);
  if (found) {
    // Return true if every value in "values" is found in "found.values"
    return values.every(mustMatch => found.values.some(v => v.v === String(mustMatch.v)));
  }
  return false;
};

export const addFilters = (current: Filters, newFilters: Filter[]): Filters => {
  return { ...current, list: _.concat(current.list, newFilters) };
};
