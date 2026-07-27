import * as React from 'react';
import { getHealthFiltersFromURL, HealthFilterState, setURLHealthFilters } from './health-filters';

// Syncs HealthFilterState with the URL so filters persist across tab switches, page reloads and deep links.
// Simpler than Traffic's useURLSync: Health filters don't depend on any config loaded asynchronously after mount,
// so the initial state can be read from the URL synchronously.
export const useHealthFilters = (): [HealthFilterState, React.Dispatch<React.SetStateAction<HealthFilterState>>] => {
  const [filters, setFilters] = React.useState<HealthFilterState>(() => getHealthFiltersFromURL());
  const prevFiltersRef = React.useRef(filters);

  React.useEffect(() => {
    const prev = prevFiltersRef.current;
    prevFiltersRef.current = filters;
    // Debounced search text fires on every keystroke — replace to avoid cluttering history.
    // Discrete filter changes (severity, status, mode, namespace) push so Back undoes them.
    const onlySearchChanged =
      prev.severities === filters.severities &&
      prev.statuses === filters.statuses &&
      prev.modes === filters.modes &&
      prev.namespaces === filters.namespaces &&
      prev.searchText !== filters.searchText;
    setURLHealthFilters(filters, onlySearchChanged);
  }, [filters]);

  React.useEffect(() => {
    const onPopState = () => setFilters(getHealthFiltersFromURL());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return [filters, setFilters];
};
