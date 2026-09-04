import * as React from 'react';
import { getLocalStorage, localStorageHealthFiltersKey, setLocalStorage } from '../../utils/local-storage-hook';
import {
  emptyHealthFilters,
  getHealthFiltersFromURL,
  HealthFilterState,
  isHealthFilterEmpty,
  setURLHealthFilters
} from './health-filters';

// Reads the initial filter state, preferring the URL (deep links, reload, Back/Forward) and falling
// back to localStorage. Leaving and re-entering the page through the sidebar is a fresh navigation
// that drops the query string, so without the fallback the filters would be lost; persisting them
// lets them survive that round-trip (the URL is rewritten from the restored state on mount).
const readInitialFilters = (): HealthFilterState => {
  const fromURL = getHealthFiltersFromURL();
  if (!isHealthFilterEmpty(fromURL)) {
    return fromURL;
  }
  const stored = getLocalStorage<HealthFilterState>(localStorageHealthFiltersKey, emptyHealthFilters);
  return { ...emptyHealthFilters, ...stored };
};

// Syncs HealthFilterState with the URL (and mirrors it to localStorage) so filters persist across tab
// switches, sidebar navigation, page reloads and deep links.
// Simpler than Traffic's useURLSync: Health filters don't depend on any config loaded asynchronously after mount,
// so the initial state can be read synchronously.
export const useHealthFilters = (): [HealthFilterState, React.Dispatch<React.SetStateAction<HealthFilterState>>] => {
  const [filters, setFilters] = React.useState<HealthFilterState>(readInitialFilters);
  const prevFiltersRef = React.useRef(filters);
  const initializedRef = React.useRef(false);

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
    // On mount we may have restored filters from storage into a URL that doesn't carry them yet:
    // replace rather than push so we don't add a spurious history entry.
    const replace = !initializedRef.current || onlySearchChanged;
    initializedRef.current = true;
    setURLHealthFilters(filters, replace);
    setLocalStorage(localStorageHealthFiltersKey, filters);
  }, [filters]);

  React.useEffect(() => {
    const onPopState = () => setFilters(getHealthFiltersFromURL());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return [filters, setFilters];
};
