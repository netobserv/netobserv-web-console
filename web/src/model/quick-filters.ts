import { findFilter } from '../utils/filter-definitions';
import { Filter, FilterCompare, FilterDefinition, fromFilterKey } from './filters';

export type RawQuickFilter = {
  name: string;
  default: string;
  filter: { [key: string]: string };
};

export type QuickFilter = {
  name: string;
  default: string;
  filters: Filter[];
};

export const parseQuickFilters = (filterDefinitions: FilterDefinition[], raw: RawQuickFilter[]): QuickFilter[] => {
  const ret: QuickFilter[] = [];
  raw.forEach(qf => {
    const filters: (Filter | undefined)[] = Object.entries(qf.filter).map(([key, valuesStr]) => {
      const { id, not, moreThan } = fromFilterKey(key);
      const def = findFilter(filterDefinitions, id);
      if (!def) {
        console.warn(`Configured quick filter "${qf.name}" contains unknown filter id ${id}.`);
        return undefined;
      }
      let compare = moreThan ? FilterCompare.moreThanOrEqual : not ? FilterCompare.notMatch : FilterCompare.match;
      let values = valuesStr.split(',').map(v => ({ v: v }));
      if (!moreThan) {
        // If all values are enclosed in double quotes, it's an exact match
        if (values.every(v => v.v.length >= 2 && v.v.startsWith('"') && v.v.endsWith('"'))) {
          compare = not ? FilterCompare.notEqual : FilterCompare.equal;
          values = values.map(v => ({ v: v.v.substring(1, v.v.length - 1) }));
        }
      }
      return { def, compare, values };
    });
    if (!filters.some(f => f === undefined)) {
      ret.push({
        name: qf.name,
        default: qf.default,
        filters: filters as Filter[]
      });
    }
  });
  return ret;
};
