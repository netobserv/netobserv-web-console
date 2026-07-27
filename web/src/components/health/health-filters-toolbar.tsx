import { Button, Label, LabelGroup, SearchInput, Toolbar, ToolbarContent, ToolbarItem } from '@patternfly/react-core';
import * as _ from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { HealthFilterState, isHealthFilterEmpty } from './health-filters';
import './health-filters-toolbar.css';
import { AlertState, HealthMode, Severity } from './health-helper';
import { HealthMultiSelectFilter } from './health-multi-select-filter';

export interface HealthFiltersToolbarProps {
  filters: HealthFilterState;
  setFilters: React.Dispatch<React.SetStateAction<HealthFilterState>>;
  availableNamespaces: string[];
}

export const HealthFiltersToolbar: React.FC<HealthFiltersToolbarProps> = ({
  filters,
  setFilters,
  availableNamespaces
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');

  // Options use literal t('...') calls (rather than t(variable)) so the i18next-parser static scanner
  // can actually discover and extract these keys - see `npm run i18n`.
  // Status intentionally excludes 'inactive': PerState.inactive only stores rule names (no severity / labels /
  // score data), and resources that are 100% inactive are already dropped before display (see
  // groupAndSortByResource in health-helper.ts). Filtering on 'inactive' alone would always render
  // "No violations found".
  const statusOptions: { value: AlertState; label: string }[] = [
    { value: 'firing', label: t('Firing') },
    { value: 'pending', label: t('Pending') },
    { value: 'silenced', label: t('Silenced') }
  ];

  const severityOptions: { value: Severity; label: string }[] = [
    { value: 'critical', label: t('Critical') },
    { value: 'warning', label: t('Warning') },
    { value: 'info', label: t('Info') }
  ];

  // Reuses the existing 'alert'/'recording' translation keys (already used for the "Mode" column
  // in rule-details.tsx) instead of introducing near-duplicate "Alert"/"Recording" catalog entries.
  const modeOptions: { value: HealthMode; label: string }[] = [
    { value: 'alert', label: t('Alert') },
    { value: 'recording', label: t('Recording') }
  ];
  const [searchInput, setSearchInput] = React.useState(filters.searchText);

  // Keep the local (uncontrolled-ish) input in sync when filters are reset from elsewhere
  // (Clear all, browser back/forward navigation).
  React.useEffect(() => {
    setSearchInput(filters.searchText);
  }, [filters.searchText]);

  // setFilters (from useHealthFilters) is the raw React state setter, so it's stable across renders and supports
  // the functional updater form: no need to recreate the debounced callback (and no risk of it closing over stale
  // filters) when other filter dimensions change in between keystrokes.
  const debouncedSetSearch = React.useMemo(
    () => _.debounce((value: string) => setFilters(prev => ({ ...prev, searchText: value })), 300),
    [setFilters]
  );
  React.useEffect(() => () => debouncedSetSearch.cancel(), [debouncedSetSearch]);

  const onSearchChange = (value: string) => {
    setSearchInput(value);
    debouncedSetSearch(value);
  };

  const namespaceOptions = React.useMemo(
    () => availableNamespaces.map(ns => ({ value: ns, label: ns })),
    [availableNamespaces]
  );

  const clearAll = () => {
    debouncedSetSearch.cancel();
    setSearchInput('');
    setFilters({ severities: [], statuses: [], modes: [], namespaces: [], searchText: '' });
  };

  const removeFromArray = <T extends string>(arr: T[], value: T): T[] => arr.filter(v => v !== value);

  const labelLookup = React.useMemo(() => {
    const map = new Map<string, string>();
    severityOptions.forEach(o => map.set(o.value, o.label));
    statusOptions.forEach(o => map.set(o.value, o.label));
    modeOptions.forEach(o => map.set(o.value, o.label));
    return map;
    // Options are static label lists (only their text depends on the locale via t); rebuilding the
    // lookup once is enough, so the per-render array identities are intentionally not dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeChipGroups: { category: string; chips: { key: string; label: string; onClose: () => void }[] }[] =
    React.useMemo(() => {
      const groups: typeof activeChipGroups = [];
      if (filters.severities.length) {
        groups.push({
          category: t('Severity'),
          chips: filters.severities.map(v => ({
            key: v,
            label: labelLookup.get(v) || v,
            onClose: () => setFilters(prev => ({ ...prev, severities: removeFromArray(prev.severities, v) }))
          }))
        });
      }
      if (filters.statuses.length) {
        groups.push({
          category: t('Status'),
          chips: filters.statuses.map(v => ({
            key: v,
            label: labelLookup.get(v) || v,
            onClose: () => setFilters(prev => ({ ...prev, statuses: removeFromArray(prev.statuses, v) }))
          }))
        });
      }
      if (filters.modes.length) {
        groups.push({
          category: t('Mode'),
          chips: filters.modes.map(v => ({
            key: v,
            label: labelLookup.get(v) || v,
            onClose: () => setFilters(prev => ({ ...prev, modes: removeFromArray(prev.modes, v) }))
          }))
        });
      }
      if (filters.namespaces.length) {
        groups.push({
          category: t('Namespace'),
          chips: filters.namespaces.map(v => ({
            key: v,
            label: v,
            onClose: () => setFilters(prev => ({ ...prev, namespaces: removeFromArray(prev.namespaces, v) }))
          }))
        });
      }
      if (filters.searchText.trim()) {
        groups.push({
          category: t('Search'),
          chips: [
            {
              key: 'searchText',
              label: filters.searchText,
              onClose: () => {
                debouncedSetSearch.cancel();
                setSearchInput('');
                setFilters(prev => ({ ...prev, searchText: '' }));
              }
            }
          ]
        });
      }
      return groups;
    }, [filters, labelLookup, setFilters, debouncedSetSearch, t]);

  return (
    <Toolbar data-test="health-filters-toolbar" id="health-filters-toolbar" className="health-filters-toolbar">
      <ToolbarContent id="health-filters-toolbar-content" toolbarId="health-filters-toolbar">
        <ToolbarItem>
          <HealthMultiSelectFilter
            id="health-severity-filter"
            toggleLabel={t('Severity')}
            options={severityOptions}
            selected={filters.severities}
            onChange={severities => setFilters(prev => ({ ...prev, severities }))}
          />
        </ToolbarItem>
        <ToolbarItem>
          <HealthMultiSelectFilter
            id="health-status-filter"
            toggleLabel={t('Status')}
            options={statusOptions}
            selected={filters.statuses}
            onChange={statuses => setFilters(prev => ({ ...prev, statuses }))}
          />
        </ToolbarItem>
        <ToolbarItem>
          <HealthMultiSelectFilter
            id="health-mode-filter"
            toggleLabel={t('Mode')}
            options={modeOptions}
            selected={filters.modes}
            onChange={modes => setFilters(prev => ({ ...prev, modes }))}
          />
        </ToolbarItem>
        {namespaceOptions.length > 0 && (
          <ToolbarItem>
            <HealthMultiSelectFilter
              id="health-namespace-filter"
              toggleLabel={t('Namespace')}
              options={namespaceOptions}
              selected={filters.namespaces}
              onChange={namespaces => setFilters(prev => ({ ...prev, namespaces }))}
            />
          </ToolbarItem>
        )}
        <ToolbarItem className="health-filters-toolbar-name-item">
          <SearchInput
            id="health-name-filter"
            data-test="health-name-filter"
            placeholder={t('Search by name or description')}
            value={searchInput}
            onChange={(_e, value) => onSearchChange(value)}
            onClear={() => onSearchChange('')}
          />
        </ToolbarItem>
        {!isHealthFilterEmpty(filters) && (
          <ToolbarItem>
            <Button data-test="health-filters-clear-all" variant="link" onClick={clearAll}>
              {t('Clear all filters')}
            </Button>
          </ToolbarItem>
        )}
      </ToolbarContent>
      {activeChipGroups.length > 0 && (
        <ToolbarContent id="health-filters-chips-content" toolbarId="health-filters-toolbar">
          {activeChipGroups.map(group => (
            <ToolbarItem key={group.category}>
              <LabelGroup categoryName={group.category} data-test={`health-chip-group-${group.category}`}>
                {group.chips.map(chip => (
                  <Label key={chip.key} onClose={chip.onClose} data-test={`health-chip-${chip.key}`}>
                    {chip.label}
                  </Label>
                ))}
              </LabelGroup>
            </ToolbarItem>
          ))}
        </ToolbarContent>
      )}
    </Toolbar>
  );
};

export default HealthFiltersToolbar;
