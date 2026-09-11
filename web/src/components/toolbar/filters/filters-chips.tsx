import {
  Button,
  Content,
  ContentVariants,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  MenuToggleElement,
  ToolbarItem,
  Tooltip
} from '@patternfly/react-core';
import { ArrowsAltVIcon, BanIcon, CheckIcon, PencilAltIcon, TimesCircleIcon, TimesIcon } from '@patternfly/react-icons';
import * as _ from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Filter,
  FilterCompare,
  FilterDefinition,
  Filters,
  filtersEqual,
  FilterValue,
  hasEnabledFilterValues,
  removeFromFilters
} from '../../../model/filters';
import { Match } from '../../../model/flow-query';
import { QuickFilter } from '../../../model/quick-filters';
import { autoCompleteCache } from '../../../utils/autocomplete-cache';
import {
  bnfFilterValue,
  hasSrcAndDstFilters,
  hasSrcOrDstFilters,
  setEndpointFilters,
  swapFilters,
  swapFilterValue
} from '../../../utils/filters-helper';
import { getPathWithParams, netflowTrafficPath, useNavigate } from '../../../utils/url';
import { MatchDropdown } from '../../dropdowns/match-dropdown';
import { DestinationIcon, EndpointIcon, SourceIcon } from '../../icons';
import { Direction } from '../filters-toolbar';
import { LinksOverflow } from '../links-overflow';
import './filters-chips.css';

export interface FiltersChipsProps {
  isForced: boolean;
  filters: Filters;
  setFilters: (v: Filters) => void;
  editValue: (f: Filter, v: string) => void;
  clearFilters: () => void;
  resetFilters: () => void;
  quickFilters: QuickFilter[];
  filterDefinitions: FilterDefinition[];
  setDirection: (v: Direction) => void;
}

export interface FiltersGroup {
  id: 'src' | 'dst' | 'common';
  filters: Filter[];
}

export const FiltersChips: React.FC<FiltersChipsProps> = ({
  isForced,
  filters,
  setFilters,
  editValue,
  clearFilters,
  resetFilters,
  quickFilters,
  filterDefinitions,
  setDirection
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const navigate = useNavigate();

  const [openedDropdown, setOpenedDropdown] = React.useState<string>();

  const getGroupName = React.useCallback(
    (id: 'src' | 'dst' | 'common') => {
      if (id === 'common') {
        return '';
      }
      if (filters.match === 'bidirectional') {
        if (hasSrcAndDstFilters(filters.list)) {
          return id === 'src' ? t('Endpoint A') : t('Endpoint B');
        }
        return t('Endpoint');
      }
      return id === 'src' ? t('Source') : t('Destination');
    },
    [filters.list, filters.match, t]
  );

  const getGroups = React.useCallback(() => {
    const srcGroup: FiltersGroup = { id: 'src', filters: [] };
    const dstGroup: FiltersGroup = { id: 'dst', filters: [] };
    const commonGroup: FiltersGroup = { id: 'common', filters: [] };
    filters.list.forEach(f => {
      if (f.def.id.startsWith('src_')) {
        srcGroup.filters.push(f);
      } else if (f.def.id.startsWith('dst_')) {
        dstGroup.filters.push(f);
      } else {
        commonGroup.filters.push(f);
      }
    });
    return [srcGroup, dstGroup, commonGroup];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.list, filters.match]);

  const getDefaultFilters = React.useCallback(() => {
    return quickFilters.filter(qf => qf.default).flatMap(qf => qf.filters);
  }, [quickFilters]);

  const setFiltersList = React.useCallback(
    (list: Filter[]) => {
      setFilters({ ...filters, list: list });
    },
    [setFilters, filters]
  );

  const swapAllSrcDst = React.useCallback(() => {
    const swapped = swapFilters(filterDefinitions, filters!.list);
    setFilters({ ...filters!, list: swapped });
  }, [filterDefinitions, filters, setFilters]);

  const swapValue = React.useCallback(
    (filter: Filter, value: FilterValue, target: 'src' | 'dst') => {
      const list = swapFilterValue(filterDefinitions, filters!.list, filter.def.id, value, target);
      setFilters({ ...filters!, list });
      setOpenedDropdown(undefined);
    },
    [filterDefinitions, filters, setFilters]
  );

  const removeValue = React.useCallback(
    (filter: Filter, value: FilterValue) => {
      filter.values = filter.values.filter(val => val.v !== value.v);
      if (_.isEmpty(filter.values)) {
        setFiltersList(removeFromFilters(filters.list, filter));
      } else {
        setFilters(_.cloneDeep(filters));
      }
      setOpenedDropdown(undefined);
    },
    [filters, setFilters, setFiltersList]
  );

  const getFullName = React.useCallback(
    (filter: Filter) => {
      switch (filter.compare) {
        case FilterCompare.notEqual:
          return `${t('Not')} ${filter.def.name} ${t('equals')}`;
        case FilterCompare.equal:
          return `${filter.def.name} ${t('equals')}`;
        case FilterCompare.moreThanOrEqual:
          return `${filter.def.name} ${t('more than')}`;
        case FilterCompare.notMatch:
          return `${t('Not')} ${filter.def.name} ${t('contains')}`;
        case FilterCompare.match:
          return `${filter.def.name} ${t('contains')}`;
      }
    },
    [t]
  );

  const getFilterDisplay = React.useCallback(
    (filter: Filter, cfIndex: number) => {
      const someEnabled = hasEnabledFilterValues(filter);
      return (
        <div key={cfIndex} className={`${filter.def.category ? 'flex-block' : ''} toolbar-item-center`}>
          {getAndOr(filters.match, cfIndex)}
          <div className={`custom-chip-group ${someEnabled ? '' : 'disabled-group'}`}>
            <Tooltip
              content={`${someEnabled ? t('Disable') : t('Enable')} '${getFullName(filter)}' ${t('group filter')}`}
            >
              <Content
                className="custom-chip-text"
                component={ContentVariants.p}
                onClick={() => {
                  //switch all values if no remaining
                  filter.values.forEach(fv => {
                    fv.disabled = someEnabled;
                  });
                  setFilters(_.cloneDeep(filters));
                }}
              >
                {getFullName(filter)}
              </Content>
            </Tooltip>
            <div className="filtervalues">
              {filter.values.map((filterValue, fvIndex) => {
                if (isForced || filterValue.disabled) {
                  return (
                    <div key={fvIndex} className={`flex-block ${fvIndex == 0 ? 'first' : ''}`}>
                      {getAndOr('values', fvIndex)}
                      <div className={`custom-chip ${filterValue.disabled ? 'disabled-value' : ''}`}>
                        <Tooltip
                          content={`${filterValue.disabled ? t('Enable') : t('Disable')} ${getFullName(filter)} '${
                            filterValue.display || filterValue.v
                          }' ${t('filter')}`}
                        >
                          <Content
                            component={ContentVariants.p}
                            onClick={() => {
                              filterValue.disabled = !filterValue.disabled;
                              setFilters(_.cloneDeep(filters));
                            }}
                          >
                            {filterValue.display ? filterValue.display : filterValue.v}
                          </Content>
                        </Tooltip>
                      </div>
                    </div>
                  );
                }

                const dropdownId = `${filter.def.id}-${fvIndex}`;
                return (
                  <div key={fvIndex} className={`flex-block ${fvIndex == 0 ? 'first' : ''}`}>
                    {getAndOr('values', fvIndex)}
                    <Dropdown
                      id={dropdownId}
                      data-test={dropdownId}
                      isOpen={dropdownId === openedDropdown}
                      onOpenChange={(isOpen: boolean) => setOpenedDropdown(isOpen ? dropdownId : undefined)}
                      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                        <MenuToggle
                          id={`${dropdownId}-toggle`}
                          data-test={`${dropdownId}-toggle`}
                          ref={toggleRef}
                          className={`custom-chip ${filterValue.disabled ? 'disabled-value' : ''}`}
                          isExpanded={dropdownId === openedDropdown}
                          onClick={() => setOpenedDropdown(openedDropdown === dropdownId ? undefined : dropdownId)}
                        >
                          {filterValue.display ? filterValue.display : filterValue.v}
                        </MenuToggle>
                      )}
                    >
                      <DropdownList>
                        <DropdownItem
                          id="dropdown-item-edit"
                          data-test="dropdown-item-edit"
                          key="edit"
                          onClick={() => {
                            removeValue(filter, filterValue);
                            editValue(filter, filterValue.v);
                          }}
                        >
                          <PencilAltIcon />
                          &nbsp;{t('Edit')}
                        </DropdownItem>
                        {filters.match !== 'bidirectional' &&
                          (filter.def.id.startsWith('src_') || filter.def.id.startsWith('dst_')) && (
                            <DropdownItem
                              id="dropdown-item-either"
                              data-test="dropdown-item-either"
                              key="bnf"
                              onClick={() => {
                                const bnf = bnfFilterValue(
                                  filterDefinitions,
                                  filters!.list,
                                  filter.def.id,
                                  filterValue
                                );
                                setFilters({ ...filters!, list: bnf });
                                setOpenedDropdown(undefined);
                              }}
                            >
                              <ArrowsAltVIcon style={{ transform: 'rotate(90deg)' }} />
                              &nbsp;{t('Either')}
                            </DropdownItem>
                          )}
                        {(filter.def.category === 'endpoint' || filter.def.id.startsWith('dst_')) && (
                          <DropdownItem
                            id="dropdown-item-src"
                            data-test="dropdown-item-src"
                            key="src"
                            onClick={() => swapValue(filter, filterValue, 'src')}
                          >
                            <SourceIcon />
                            &nbsp;{filters.match === 'bidirectional' ? t('As endpoint A') : t('As source')}
                          </DropdownItem>
                        )}
                        {(filter.def.category === 'endpoint' || filter.def.id.startsWith('src_')) && (
                          <DropdownItem
                            id="dropdown-item-dst"
                            data-test="dropdown-item-dst"
                            key="dst"
                            onClick={() => swapValue(filter, filterValue, 'dst')}
                          >
                            <DestinationIcon />
                            &nbsp;{filters.match === 'bidirectional' ? t('As endpoint B') : t('As destination')}
                          </DropdownItem>
                        )}
                        <DropdownItem
                          id="dropdown-item-disable"
                          data-test="dropdown-item-disable"
                          key="disable"
                          onClick={() => {
                            filterValue.disabled = !filterValue.disabled;
                            setFilters(_.cloneDeep(filters));
                            setOpenedDropdown(undefined);
                          }}
                        >
                          {filterValue.disabled && <CheckIcon />}
                          {!filterValue.disabled && <BanIcon />}
                          &nbsp;{filterValue.disabled ? t('Enable') : t('Disable')}
                        </DropdownItem>
                        <DropdownItem
                          id="dropdown-item-remove"
                          data-test="dropdown-item-remove"
                          key="remove"
                          onClick={() => {
                            removeValue(filter, filterValue);
                          }}
                        >
                          <TimesIcon />
                          &nbsp;{t('Remove')}
                        </DropdownItem>
                      </DropdownList>
                    </Dropdown>
                  </div>
                );
              })}
            </div>
            {!isForced && (
              <Button
                icon={<TimesCircleIcon />}
                id="button-remove-filters"
                data-test="button-remove-filters"
                variant="plain"
                onClick={() => setFiltersList(removeFromFilters(filters.list, filter))}
              />
            )}
          </div>
        </div>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterDefinitions, filters, isForced, openedDropdown, setFilters, setFiltersList, swapValue]
  );

  const setMatch = React.useCallback(
    (v: Match) => {
      const existingFilters = filters;
      // convert all endpoint filters to a single peer
      if (v == 'bidirectional') {
        existingFilters.list = setEndpointFilters(filterDefinitions, existingFilters.list, 'src');
        setDirection('source');
      }
      setFilters({ ...existingFilters, match: v });
    },
    [filters, setFilters, filterDefinitions, setDirection]
  );

  const getAndOr = React.useCallback(
    (match: Match | 'values', index: number, root?: boolean) => {
      if (index == 0) {
        return undefined;
      }

      return (
        <Tooltip
          content={
            match === 'values'
              ? t('the logical OR operator is used between each values of the same filter.')
              : match === 'any'
              ? t('The logical OR operator is used between filters.')
              : match === 'bidirectional'
              ? t(
                  'The logical AND operator is used between Endpoints and common filters. The traffic is matched in both directions.'
                )
              : t('The logical AND operator is used between filters keeping direction source to destination.')
          }
        >
          <div className="match-dropdown-container">
            {match === 'values' && (
              <Content className="and-or-text" component="p">
                {t('OR')}
              </Content>
            )}
            {match !== 'values' && (
              <MatchDropdown
                id={`match-${index}`}
                selected={filters.match}
                setMatch={setMatch}
                allowBidirectional={root && index === 1}
              />
            )}
          </div>
        </Tooltip>
      );
    },
    [filters.match, setMatch, t]
  );

  if (_.isEmpty(filters.list) && _.isEmpty(getDefaultFilters())) {
    return null;
  }
  const isDefaultFilters = filtersEqual(filters.list, getDefaultFilters());

  return (
    <>
      <ToolbarItem
        data-test={`${isForced ? 'forced-' : ''}filters`}
        id={`${isForced ? 'forced-' : ''}filters`}
        className="flex-start"
      >
        {getGroups()
          .filter(gp => gp.filters.length)
          .map((gp, index) => {
            return (
              <div key={gp.id} className="flex-block filters-group">
                {getAndOr(filters.match, index, true)}
                <div className={`custom-chip-box ${gp.id !== 'common' ? 'custom-chip-peer' : ''}`}>
                  {hasSrcOrDstFilters(gp.filters) && (
                    <Content component="p">
                      {filters.match === 'bidirectional' ? (
                        <EndpointIcon />
                      ) : gp.id === 'src' ? (
                        <SourceIcon />
                      ) : gp.id === 'dst' ? (
                        <DestinationIcon />
                      ) : null}
                      &nbsp;{getGroupName(gp.id)}&nbsp;
                    </Content>
                  )}
                  <div className="flex-block">{gp.filters.map(getFilterDisplay)}</div>
                </div>
              </div>
            );
          })}
      </ToolbarItem>
      <ToolbarItem className="flex-start toolbar-item-center">
        {isForced ? (
          <Button
            id="edit-filters-button"
            data-test="edit-filters-button"
            onClick={() => navigate(getPathWithParams(netflowTrafficPath()))}
          >
            {t('Edit filters')}
          </Button>
        ) : (
          <LinksOverflow
            id={'chips-more-options'}
            items={[
              {
                id: 'reset-filters',
                label: t('Reset defaults'),
                onClick: () => {
                  resetFilters();
                  autoCompleteCache.clear();
                },
                enabled: getDefaultFilters().length > 0 && !isDefaultFilters
              },
              {
                id: 'clear-all-filters',
                label: t('Clear all'),
                onClick: () => {
                  clearFilters();
                  autoCompleteCache.clear();
                },
                enabled: !_.isEmpty(filters.list)
              },
              {
                id: 'swap-filters',
                label: t('Swap'),
                tooltip: t('Swap from and to filters'),
                onClick: swapAllSrcDst,
                enabled: hasSrcOrDstFilters(filters.list!) && filters.match !== 'bidirectional'
              }
            ]}
            text={t('More actions')}
          />
        )}
      </ToolbarItem>
    </>
  );
};
