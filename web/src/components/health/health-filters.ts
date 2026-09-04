import { getURLParam, syncURLParams, URLParam } from '../../utils/url';
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

// Client-side match mirroring the semantics the Network Traffic namespace filter delegates to Loki:
//  - plain text -> substring ("contains") match (e.g. `dns` matches `openshift-dns`)
//  - "quoted"   -> exact (anchored) match
//  - `*`        -> wildcard; a pattern containing `*` is anchored to the whole name so the `*` marks
//                  the only wildcards. This makes `dns*` mean "starts with dns" (not "contains dns"),
//                  `*-registry` "ends with", and `openshift-*-operator` a positional pattern.
//  - case-sensitive only when the pattern itself has an upper-case letter (k8s names are lower-case,
//    so a lower-case pattern stays case-insensitive, while e.g. "Deployment" is matched exactly).
// This lets the Namespace filter store patterns as values (type `openshift-*` + Enter) instead of
// forcing the user to tick a checkbox per matching namespace.
export const matchesNamespacePattern = (pattern: string, value: string): boolean => {
  let query = pattern.trim();
  if (!query) {
    return true;
  }
  const quoted = query.length >= 2 && query.startsWith('"') && query.endsWith('"');
  if (quoted) {
    query = query.slice(1, -1);
  }
  if (!query) {
    return true;
  }
  const flags = /[A-Z]/.test(query) ? '' : 'i';
  const hasWildcard = query.includes('*');
  const regex = query.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  // Anchor exact ("quoted") matches and any pattern that uses `*`, so the wildcards are the only
  // loose spots. Plain text stays an unanchored substring match.
  const body = quoted || hasWildcard ? `^${regex}$` : regex;
  try {
    return new RegExp(body, flags).test(value);
  } catch {
    // Defensive fallback: if the derived regex somehow fails to compile, fall back to a plain contains.
    return value.toLowerCase().includes(pattern.trim().toLowerCase());
  }
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
    // Each stored value is a pattern (partial / "exact" / `*` wildcard); the item passes if it matches any.
    if (ns !== undefined && !filters.namespaces.some(pattern => matchesNamespacePattern(pattern, ns))) {
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

// Serializes the whole filter state into the URL in a single history entry. syncURLParams compares
// the resulting query string against the current URL and skips the write when they already match,
// so the initial mount (state read back from the URL) doesn't push a duplicate entry, and a change
// touching several params still costs a single Back step.
export const setURLHealthFilters = (f: HealthFilterState, replace?: boolean): void => {
  const params = new Map<URLParam, string>([
    [URLParam.HealthSeverity, f.severities.join(',')],
    [URLParam.HealthStatus, f.statuses.join(',')],
    [URLParam.HealthMode, f.modes.join(',')],
    [URLParam.HealthNamespace, f.namespaces.join(',')],
    [URLParam.HealthName, f.searchText.trim()]
  ]);
  syncURLParams(params, replace);
};
