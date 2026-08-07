import {
  ExpandableSectionToggle,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Tooltip,
  ValidatedOptions
} from '@patternfly/react-core';
import { CompressIcon, ExpandIcon } from '@patternfly/react-icons';
import * as _ from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Filter, FilterCompare, FilterDefinition, Filters, summarizeFilters } from '../../model/filters';
import { useNetflowContext } from '../../model/netflow-context';
import { autoCompleteCache } from '../../utils/autocomplete-cache';
import { findFilter, matcher } from '../../utils/filter-definitions';
import { Indicator } from '../../utils/filters-helper';
import { localStorageShowFiltersKey, useLocalStorage } from '../../utils/local-storage-hook';
import { QueryOptionsDropdown, QueryOptionsProps } from '../dropdowns/query-options-dropdown';
import './filters-toolbar.css';
import { FilterSearchInput } from './filters/filter-search-input';
import { FiltersChips } from './filters/filters-chips';
import { QuickFilters } from './filters/quick-filters';
import { LinksOverflow } from './links-overflow';

export interface FiltersToolbarProps {
  id: string;
  filters?: Filters;
  forcedFilters?: Filters | null;
  skipTipsDelay?: boolean;
  setFilters: (v: Filters) => void;
  clearFilters: () => void;
  resetFilters: () => void;
  queryOptionsProps: QueryOptionsProps;
  isFullScreen: boolean;
  setFullScreen: (b: boolean) => void;
}

export type Direction = 'source' | 'destination' | undefined;

export const FiltersToolbar: React.FC<FiltersToolbarProps> = ({
  id,
  filters,
  forcedFilters,
  skipTipsDelay,
  setFilters,
  clearFilters,
  resetFilters,
  isFullScreen,
  setFullScreen,
  ...props
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const { caps, config } = useNetflowContext();
  const quickFilters = caps.quickFilters;
  const filterDefinitions = caps.filterDefs;

  const [message, setMessage] = React.useState<string | undefined>();
  const [indicator, setIndicator] = React.useState<Indicator>(ValidatedOptions.default);

  const [searchInputValue, setSearchInputValue] = React.useState('');

  const getDefaultFilter = React.useCallback((defs: FilterDefinition[]): FilterDefinition => {
    // Parent guarantees non-empty definitions
    return findFilter(defs, 'src_namespace') || defs[0];
  }, []);

  const getDefaultDirection = React.useCallback((filter: FilterDefinition): Direction => {
    // Set direction based on filter's category or id prefix
    if (filter.category === 'source' || filter.id.startsWith('src_')) {
      return 'source';
    } else if (filter.category === 'destination' || filter.id.startsWith('dst_')) {
      return 'destination';
    }
    return undefined;
  }, []);

  const [filter, setFilter] = React.useState<FilterDefinition>(() => getDefaultFilter(filterDefinitions));
  const [direction, setDirection] = React.useState<Direction>(() =>
    getDefaultDirection(getDefaultFilter(filterDefinitions))
  );
  const [compare, setCompare] = React.useState<FilterCompare>(FilterCompare.equal);
  const [value, setValue] = React.useState<string>('');

  const [showFilters, setShowFilters] = useLocalStorage<boolean>(localStorageShowFiltersKey, true);

  // Safe filter setter that validates the filter exists in filterDefinitions
  const setSafeFilter = React.useCallback(
    (f: FilterDefinition | null | undefined) => {
      if (!f) {
        // If null/undefined, use default filter
        setFilter(getDefaultFilter(filterDefinitions));
      } else if (filterDefinitions.find(fd => fd.id === f.id)) {
        // If filter exists in definitions, use it
        setFilter(f);
      } else {
        // If filter doesn't exist, fallback to default
        setFilter(getDefaultFilter(filterDefinitions));
      }
    },
    [filterDefinitions, getDefaultFilter]
  );

  // Update filter if filterDefinitions changes and current filter is no longer valid
  React.useEffect(() => {
    if (!filterDefinitions.find(fd => fd.id === filter.id)) {
      const newFilter = getDefaultFilter(filterDefinitions);
      setFilter(newFilter);
      // Sync direction with the new filter
      setDirection(getDefaultDirection(newFilter));
    }
  }, [filterDefinitions, filter, getDefaultFilter, getDefaultDirection]);

  // reset and delay message state to trigger tooltip properly
  const setMessageWithDelay = React.useCallback(
    (m: string | undefined) => {
      if (skipTipsDelay) {
        setMessage(m);
      } else {
        setMessage(undefined);
        setTimeout(() => {
          setMessage(m);
        }, 100);
      }
    },
    [skipTipsDelay]
  );

  const editValue = React.useCallback((f: Filter, v: string) => {
    setSearchInputValue(matcher(f.def.id, [v], f.compare));
  }, []);

  const getFilterToolbar = React.useCallback(() => {
    return (
      <ToolbarItem className="flex-start">
        <Tooltip
          //css hide tooltip here to avoid render issue
          className={`filters-tooltip${_.isEmpty(message) ? '-empty' : ''}`}
          isVisible={!_.isEmpty(message)}
          content={message}
          trigger={_.isEmpty(message) ? 'manual' : 'click'}
          enableFlip={false}
          position={'top'}
        >
          <FilterSearchInput
            config={config}
            filterDefinitions={filterDefinitions}
            filters={filters}
            indicator={indicator}
            direction={direction}
            filter={filter}
            compare={compare}
            value={value}
            setValue={setValue}
            setCompare={setCompare}
            setFilter={setSafeFilter}
            setDirection={setDirection}
            setIndicator={setIndicator}
            searchInputValue={searchInputValue}
            setSearchInputValue={setSearchInputValue}
            setFilters={setFilters}
            setMessage={setMessageWithDelay}
          />
        </Tooltip>
      </ToolbarItem>
    );
  }, [
    config,
    compare,
    direction,
    filter,
    filterDefinitions,
    filters,
    indicator,
    message,
    searchInputValue,
    setFilters,
    setMessageWithDelay,
    setSafeFilter,
    value
  ]);

  const isForced = !_.isEmpty(forcedFilters);
  const filtersOrForced = isForced ? forcedFilters : filters;
  const defaultFilters = quickFilters.filter(qf => qf.default).flatMap(qf => qf.filters);

  const countActiveFilters = (filtersOrForced?.list || []).reduce((prev, cur) => prev + cur.values.length, 0);
  let showHideText: string | undefined;
  if (countActiveFilters > 0) {
    showHideText = showFilters ? t('Hide filters') : t('Show {{countActiveFilters}} filters', { countActiveFilters });
  } else if (defaultFilters.length > 0) {
    showHideText = showFilters ? t('Hide filters') : t('Show filters');
  }
  const showHideItem = (
    <ToolbarItem className="flex-start">
      <ExpandableSectionToggle
        data-test="show-filters-button"
        id="show-filters-button"
        className="overflow-button"
        isExpanded={showFilters}
        onToggle={isExpanded => setShowFilters(isExpanded)}
      >
        {showHideText}
      </ExpandableSectionToggle>
    </ToolbarItem>
  );
  const showHideTooltip = showFilters ? (
    showHideItem
  ) : (
    <Tooltip content={summarizeFilters(filtersOrForced)}>{showHideItem}</Tooltip>
  );
  return (
    <>
      <Toolbar data-test={id} id={id}>
        <ToolbarContent data-test={`${id}-search-filters`} id={`${id}-search-filters`} toolbarId={id}>
          <ToolbarItem className="flex-start">
            <QueryOptionsDropdown {...props.queryOptionsProps} />
          </ToolbarItem>
          {!isForced && quickFilters.length > 0 && (
            <ToolbarItem className="flex-start">
              <QuickFilters
                quickFilters={quickFilters}
                activeFilters={filters?.list || []}
                setFilters={list => setFilters({ ...filters!, list })}
              />
            </ToolbarItem>
          )}
          {!isForced && getFilterToolbar()}
          {showHideText && countActiveFilters > 0 && <>{showHideTooltip}</>}
          <ToolbarItem className="flex-start">
            <LinksOverflow
              id={'filters-more-options'}
              items={[
                {
                  id: 'fullscreen',
                  label: isFullScreen ? t('Collapse') : t('Expand'),
                  onClick: () => setFullScreen(!isFullScreen),
                  icon: isFullScreen ? <CompressIcon /> : <ExpandIcon />
                },
                {
                  id: 'set-default-filters',
                  label: t('Default filters'),
                  onClick: () => {
                    resetFilters();
                    autoCompleteCache.clear();
                  },
                  enabled: countActiveFilters === 0
                }
              ]}
            />
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>
      {showFilters && countActiveFilters > 0 && (
        <Toolbar data-test={`${id}-chips`} id={`${id}-chips`}>
          <ToolbarContent toolbarId={`${id}-chips`}>
            <FiltersChips
              isForced={isForced}
              filters={filtersOrForced!}
              setDirection={setDirection}
              setFilters={setFilters}
              editValue={editValue}
              clearFilters={clearFilters}
              resetFilters={resetFilters}
              quickFilters={quickFilters}
              filterDefinitions={filterDefinitions}
            />
          </ToolbarContent>
        </Toolbar>
      )}
    </>
  );
};

export default FiltersToolbar;
