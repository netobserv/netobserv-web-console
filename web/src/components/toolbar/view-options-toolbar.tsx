import {
  Button,
  Dropdown,
  DropdownGroup,
  DropdownItem,
  MenuToggle,
  MenuToggleElement,
  OverflowMenu,
  OverflowMenuContent,
  OverflowMenuControl,
  OverflowMenuGroup,
  OverflowMenuItem,
  Toolbar,
  ToolbarItem
} from '@patternfly/react-core';
import { CameraIcon, ColumnsIcon, EllipsisVIcon, ExportIcon } from '@patternfly/react-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FlowScope, MetricType, StatFunction } from '../../model/flow-query';
import { useNetflowContext } from '../../model/netflow-context';
import { TopologyOptions } from '../../model/topology';
import { areChartsSizedForExport, exportToPng, waitForExportLayout } from '../../utils/export';
import { useTheme } from '../../utils/theme-hook';
import OverviewDisplayDropdown, { Size } from '../dropdowns/overview-display-dropdown';
import TableDisplayDropdown from '../dropdowns/table-display-dropdown';
import TopologyDisplayDropdown from '../dropdowns/topology-display-dropdown';
import { TruncateLength } from '../dropdowns/truncate-dropdown';
import { ViewId } from '../netflow-traffic';
import SearchComponent, { SearchEvent, SearchHandle } from '../search/search';
import './view-options-toolbar.css';

export interface ViewOptionsToolbarProps {
  overviewFocus: boolean;
  setOverviewFocus: (v: boolean) => void;
  selectedViewId: ViewId;
  setOverviewModalOpen: (v: boolean) => void;
  setColModalOpen: (v: boolean) => void;
  setExportModalOpen: (v: boolean) => void;
  setMetricsExportModalOpen: (v: boolean) => void;
  isViewOptionOverflowMenuOpen: boolean;
  setViewOptionOverflowMenuOpen: (v: boolean) => void;
  metricScope: FlowScope;
  setMetricScope: (s: FlowScope) => void;
  overviewTruncateLength: TruncateLength;
  setOverviewTruncateLength: (v: TruncateLength) => void;
  topologyMetricFunction: StatFunction;
  setTopologyMetricFunction: (f: StatFunction) => void;
  topologyMetricType: MetricType;
  setTopologyMetricType: (t: MetricType) => void;
  topologyOptions: TopologyOptions;
  setTopologyOptions: (o: TopologyOptions) => void;
  size: Size;
  setSize: (v: Size) => void;
  showDuplicates: boolean;
  setShowDuplicates: (showDuplicates: boolean) => void;
  setSearchEvent: (se: SearchEvent) => void;
}

// eslint-disable-next-line react/display-name
export const ViewOptionsToolbar = React.forwardRef<SearchHandle, ViewOptionsToolbarProps>((props, ref) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const isDarkTheme = useTheme();
  const { caps } = useNetflowContext();

  const onTopologyExport = React.useCallback(() => {
    const topology_svg = document.querySelector<SVGSVGElement>('.pf-topology-visualization-surface__svg');
    exportToPng('topology', topology_svg ?? undefined, isDarkTheme);
  }, [isDarkTheme]);

  const onOverviewExport = React.useCallback(() => {
    const prevFocusState = props.overviewFocus;
    const overviewRoot = document.getElementById('overview-flex');
    const layoutRoot = document.getElementById('overview-graph-list') ?? overviewRoot;

    const runExport = async () => {
      try {
        if (prevFocusState) {
          props.setOverviewFocus(false);
          await waitForExportLayout(layoutRoot, { requireResize: true });
        } else if (!areChartsSizedForExport(layoutRoot ?? document.body)) {
          await waitForExportLayout(layoutRoot);
        }
        await exportToPng('overview_page', overviewRoot ?? undefined, isDarkTheme);
      } finally {
        props.setOverviewFocus(prevFocusState);
      }
    };

    void runExport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDarkTheme, props.overviewFocus, props.setOverviewFocus]);

  const viewOptionsContent = () => {
    const items: JSX.Element[] = [];

    if (props.selectedViewId === 'overview') {
      items.push(
        <OverflowMenuItem key="panels">
          <Button
            data-test="manage-overview-panels-button"
            id="manage-overview-panels-button"
            variant="link"
            className="overflow-button"
            icon={<ColumnsIcon />}
            onClick={() => props.setOverviewModalOpen(true)}
          >
            {t('Manage panels')}
          </Button>
        </OverflowMenuItem>
      );
      items.push(
        <OverflowMenuItem key="export-metrics">
          <Button
            data-test="export-metrics-button"
            id="export-metrics-button"
            variant="link"
            className="overflow-button"
            icon={<ExportIcon />}
            onClick={() => props.setMetricsExportModalOpen(true)}
          >
            {t('Export metrics report')}
          </Button>
        </OverflowMenuItem>
      );
      items.push(
        <OverflowMenuItem key="export-image">
          <Button
            data-test="export-image-button"
            id="export-button"
            variant="link"
            className="overflow-button"
            icon={<CameraIcon />}
            onClick={() => onOverviewExport()}
          >
            {t('Save as image')}
          </Button>
        </OverflowMenuItem>
      );
    } else if (props.selectedViewId === 'table') {
      items.push(
        <OverflowMenuItem key="columns">
          <Button
            data-test="manage-columns-button"
            id="manage-columns-button"
            variant="link"
            className="overflow-button"
            icon={<ColumnsIcon />}
            onClick={() => props.setColModalOpen(true)}
          >
            {t('Manage columns')}
          </Button>
        </OverflowMenuItem>
      );
      items.push(
        <OverflowMenuItem key="export">
          <Button
            data-test="export-button"
            id="export-button"
            variant="link"
            className="overflow-button"
            icon={<ExportIcon />}
            onClick={() => props.setExportModalOpen(true)}
          >
            {t('Export data')}
          </Button>
        </OverflowMenuItem>
      );
    } else if (props.selectedViewId === 'topology') {
      items.push(
        <OverflowMenuItem key="export-metrics">
          <Button
            data-test="export-metrics-button"
            id="export-metrics-button"
            variant="link"
            className="overflow-button"
            icon={<ExportIcon />}
            onClick={() => props.setMetricsExportModalOpen(true)}
          >
            {t('Export metrics report')}
          </Button>
        </OverflowMenuItem>
      );
      items.push(
        <OverflowMenuItem key="export-image">
          <Button
            data-test="export-image-button"
            id="export-button"
            variant="link"
            className="overflow-button"
            icon={<CameraIcon />}
            onClick={() => onTopologyExport()}
          >
            {t('Save as image')}
          </Button>
        </OverflowMenuItem>
      );
    }
    return items;
  };

  const viewOptionsControl = () => {
    const dropdownItems: JSX.Element[] = [];

    if (props.selectedViewId === 'overview') {
      dropdownItems.push(
        <DropdownGroup key="panels-group" label={t('Manage')}>
          <DropdownItem
            key="panels"
            id="manage-overview-panels-button"
            onClick={() => props.setOverviewModalOpen(true)}
          >
            {t('Panels')}
          </DropdownItem>
        </DropdownGroup>
      );
      dropdownItems.push(
        <DropdownGroup key="export-group" label={t('Actions')}>
          <DropdownItem
            key="export-metrics"
            id="export-metrics-button"
            onClick={() => props.setMetricsExportModalOpen(true)}
          >
            {t('Export metrics report')}
          </DropdownItem>
          <DropdownItem key="export-image" id="export-button" onClick={() => onOverviewExport()}>
            {t('Save as image')}
          </DropdownItem>
        </DropdownGroup>
      );
    } else if (props.selectedViewId === 'table') {
      dropdownItems.push(
        <DropdownGroup key="columns-group" label={t('Manage')}>
          <DropdownItem key="columns" id="manage-columns-button" onClick={() => props.setColModalOpen(true)}>
            {t('Columns')}
          </DropdownItem>
        </DropdownGroup>
      );
      dropdownItems.push(
        <DropdownGroup key="export-group" label={t('Actions')}>
          <DropdownItem key="export" id="export-button" onClick={() => props.setExportModalOpen(true)}>
            {t('Export')}
          </DropdownItem>
        </DropdownGroup>
      );
    } else if (props.selectedViewId === 'topology') {
      dropdownItems.push(
        <DropdownGroup key="export-group" label={t('Actions')}>
          <DropdownItem
            key="export-metrics"
            id="export-metrics-button"
            onClick={() => props.setMetricsExportModalOpen(true)}
          >
            {t('Export metrics report')}
          </DropdownItem>
          <DropdownItem key="export-image" id="export-button" onClick={() => onTopologyExport()}>
            {t('Save as image')}
          </DropdownItem>
        </DropdownGroup>
      );
    }

    return (
      <Dropdown
        data-test="view-options-dropdown"
        id="view-options-dropdown"
        onSelect={() => props.setViewOptionOverflowMenuOpen(false)}
        isOpen={props.isViewOptionOverflowMenuOpen}
        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle
            ref={toggleRef}
            data-test="view-options-button"
            id="view-options-button"
            variant="plain"
            className="overflow-button"
            icon={<EllipsisVIcon />}
            isExpanded={props.isViewOptionOverflowMenuOpen}
            onClick={() => props.setViewOptionOverflowMenuOpen(!props.isViewOptionOverflowMenuOpen)}
            onBlur={() => props.setViewOptionOverflowMenuOpen(false)}
          >
            {t('More options')}
          </MenuToggle>
        )}
      >
        {dropdownItems}
      </Dropdown>
    );
  };

  return (
    <Toolbar data-test-id="view-options-toolbar" id="view-options-toolbar" className={isDarkTheme ? 'dark' : ''}>
      <ToolbarItem className="flex-start view-options-first">
        <OverflowMenuItem key="display">
          {props.selectedViewId === 'overview' && (
            <OverviewDisplayDropdown
              metricScope={props.metricScope}
              setMetricScope={props.setMetricScope}
              truncateLength={props.overviewTruncateLength}
              setTruncateLength={props.setOverviewTruncateLength}
              focus={props.overviewFocus}
              setFocus={props.setOverviewFocus}
              scopes={caps.availableScopes}
            />
          )}
          {props.selectedViewId === 'table' && (
            <TableDisplayDropdown
              size={props.size}
              setSize={props.setSize}
              showDuplicates={props.showDuplicates}
              setShowDuplicates={props.setShowDuplicates}
            />
          )}
          {props.selectedViewId === 'topology' && (
            <TopologyDisplayDropdown
              metricFunction={props.topologyMetricFunction}
              setMetricFunction={props.setTopologyMetricFunction}
              metricType={props.topologyMetricType}
              setMetricType={props.setTopologyMetricType}
              metricScope={props.metricScope}
              setMetricScope={props.setMetricScope}
              topologyOptions={props.topologyOptions}
              setTopologyOptions={props.setTopologyOptions}
              allowedTypes={caps.allowedMetricTypes}
              scopes={caps.availableScopes}
              isTLSTracking={caps.isTLSTracking}
            />
          )}
        </OverflowMenuItem>
      </ToolbarItem>
      {props.selectedViewId === 'topology' && (
        <ToolbarItem className="flex-start" id="search-container" data-test="search-container">
          <SearchComponent ref={ref} setSearchEvent={props.setSearchEvent} isDark={isDarkTheme} />
        </ToolbarItem>
      )}
      <ToolbarItem className="flex-start view-options-last" align={{ default: 'alignEnd' }}>
        <OverflowMenu breakpoint="2xl">
          <OverflowMenuContent isPersistent>
            <OverflowMenuGroup groupType="button" isPersistent className="view-options-group flex-start">
              {viewOptionsContent()}
            </OverflowMenuGroup>
          </OverflowMenuContent>
          <OverflowMenuControl className="flex-start">{viewOptionsControl()}</OverflowMenuControl>
        </OverflowMenu>
      </ToolbarItem>
    </Toolbar>
  );
});

export default ViewOptionsToolbar;
