import { Bullseye, Spinner } from '@patternfly/react-core';
import { SortByDirection, Table, Tbody, Td, Tr } from '@patternfly/react-table';
import * as _ from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Record } from '../../../api/ipfix';
import { Stats } from '../../../api/query-response';
import { Config } from '../../../model/config';
import { Column, ColumnsId, ColumnSizeMap } from '../../../utils/columns';
import { TimeRange } from '../../../utils/datetime';
import {
  localStorageSortDirectionKey,
  localStorageSortIdKey,
  useLocalStorage
} from '../../../utils/local-storage-hook';
import { convertRemToPixels } from '../../../utils/panel';
import { usePrevious } from '../../../utils/previous-hook';
import { Size } from '../../dropdowns/table-display-dropdown';
import { Empty } from '../../messages/empty';
import { NetflowTableHeader } from './netflow-table-header';
import NetflowTableRow from './netflow-table-row';
import './netflow-table.css';
import { useNetflowTablePagination } from './use-netflow-table-pagination';

const VIRTUAL_ROWS_OVERSCAN = 10;

type ScrollRoot = HTMLElement | Window;

const getScrollRoot = (element: HTMLElement): ScrollRoot => {
  let ancestor: HTMLElement | null = element;
  while (ancestor && ancestor !== document.body) {
    const overflowY = window.getComputedStyle(ancestor).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return ancestor;
    }
    ancestor = ancestor.parentElement;
  }
  return window;
};

const getViewportMetrics = (container: HTMLElement): { position: number; height: number } | undefined => {
  const table = container.querySelector('table');
  const header = table?.querySelector('thead');
  if (!table || !header) {
    return undefined;
  }

  const scrollRoot = getScrollRoot(container);
  const viewportTop = scrollRoot instanceof Window ? 0 : scrollRoot.getBoundingClientRect().top;
  const height = scrollRoot instanceof Window ? window.innerHeight : scrollRoot.clientHeight;
  return {
    position: Math.max(0, viewportTop - table.getBoundingClientRect().top - header.getBoundingClientRect().height),
    height: height || 300
  };
};

const getDistanceToTableTop = (table: HTMLElement, target: EventTarget | null): number | undefined => {
  let element = target instanceof HTMLElement ? target : null;
  while (element && element !== document.body) {
    const overflowY = window.getComputedStyle(element).overflowY;
    const isScrollable = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
    if (isScrollable && element.scrollHeight > element.clientHeight) {
      if (element === document.documentElement || element === document.scrollingElement) {
        return Math.max(0, -table.getBoundingClientRect().top);
      }
      if (element === table) {
        return Math.max(0, element.scrollTop);
      }
      return Math.max(0, element.getBoundingClientRect().top - table.getBoundingClientRect().top);
    }
    element = element.parentElement;
  }

  const scrollElement = document.scrollingElement;
  return scrollElement ? Math.max(0, -table.getBoundingClientRect().top) : undefined;
};

export type NetflowTableHandle = {
  fetch: (
    range: number | TimeRange,
    histogramRange: TimeRange | undefined,
    showHistogram: boolean,
    showDuplicates: boolean,
    resetPagination?: boolean
  ) => Promise<Stats[]> | undefined;
};

export interface NetflowTableProps {
  allowPktDrops: boolean;
  flows: Record[];
  selectedRecord?: Record;
  columns: Column[];
  setColumns: (v: Column[]) => void;
  columnSizes: ColumnSizeMap;
  setColumnSizes: (v: ColumnSizeMap) => void;
  size: Size;
  onSelect: (record?: Record) => void;
  loading?: boolean;
  onLoadedRangeChange?: (range?: TimeRange) => void;
  resetDefaultFilters?: (c?: Config) => void;
  clearFilters?: () => void;
  isDark?: boolean;
}

// eslint-disable-next-line react/display-name
export const NetflowTable = React.forwardRef<NetflowTableHandle, NetflowTableProps>((props, ref) => {
  const { t } = useTranslation('plugin__netobserv-plugin');

  //default to 300 to allow content to be rendered in tests
  const [containerHeight, setContainerHeight] = React.useState(300);
  const previousContainerHeight = usePrevious(containerHeight);
  const [scrollPosition, setScrollPosition] = React.useState(0);
  const previousScrollPosition = usePrevious(scrollPosition);
  const [lastRender, setLastRender] = React.useState<string>('');
  // index of the currently active column
  const [activeSortId, setActiveSortId] = useLocalStorage<ColumnsId>(localStorageSortIdKey, ColumnsId.endtime);
  const previousActiveSortIndex = usePrevious(activeSortId);
  // sort direction of the currently active column
  const [activeSortDirection, setActiveSortDirection] = useLocalStorage<SortByDirection>(
    localStorageSortDirectionKey,
    SortByDirection.asc
  );
  const previousActiveSortDirection = usePrevious(activeSortDirection);
  const firstRender = React.useRef(true);
  const paginationSentinelRef = React.useRef<HTMLDivElement>(null);
  const touchStartYRef = React.useRef<number | undefined>(undefined);
  const {
    fetch,
    fetchOlder,
    fetchNewer,
    fetchOlderIfVisible,
    hasMoreOlder,
    loadingOlder,
    loadingNewer,
    olderError,
    upToDate
  } = useNetflowTablePagination(props.flows, props.onLoadedRangeChange);
  const width = props.columns.reduce((prev, cur) => prev + cur.width, 0);

  React.useImperativeHandle(ref, () => ({
    fetch
  }));

  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = firstRender.current && props.flows.length == 0;
      return;
    }
    setLastRender(String(Date.now()));
  }, [props.flows]);

  /* remove rows from previous rendering that should not appear anymore in body
   * this fix a bug in PF TableComposable when refresh occurs after scroll
   * without rebuilding the entire table */
  React.useEffect(() => {
    const tbody = document.getElementById('table-body');
    if (tbody) {
      const children = Array.from(tbody.children);
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const childLastRender = child.getAttribute('data-last-render');
        if (childLastRender !== lastRender) {
          child.remove();
        }
      }
    }
  }, [lastRender]);

  //reset sort index & directions to default on columns update
  React.useEffect(() => {
    const found = props.columns.find(c => c.id === activeSortId);
    if (!found) {
      setActiveSortId(ColumnsId.endtime);
      setActiveSortDirection(SortByDirection.asc);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.columns]);

  //get row height from display size
  const getRowHeight = React.useCallback(() => {
    const doubleSizeColumnIds = props.columns.filter(c => c.isCommon).map(c => c.id);
    const containsDoubleLine = props.columns.find(c => doubleSizeColumnIds.includes(c.id)) !== undefined;

    switch (props.size) {
      case 'l':
        return convertRemToPixels(containsDoubleLine ? 8 : 4.5);
      case 'm':
        return convertRemToPixels(containsDoubleLine ? 6 : 3.5);
      case 's':
      default:
        return convertRemToPixels(containsDoubleLine ? 4 : 2.5);
    }
  }, [props.columns, props.size]);

  // Keep mounted rows aligned with the actual scroll viewport. The table can
  // scroll inside a page section in both Console and standalone mode.
  const updateViewport = React.useCallback(() => {
    const container = document.getElementById('table-container');
    const metrics = container && getViewportMetrics(container);
    if (metrics) {
      setContainerHeight(previous => (previous === metrics.height ? previous : metrics.height));
      setScrollPosition(previous =>
        Math.abs(previous - metrics.position) > getRowHeight() ? metrics.position : previous
      );
    }
  }, [getRowHeight]);

  React.useEffect(() => {
    updateViewport();
    document.addEventListener('scroll', updateViewport, true);
    window.addEventListener('resize', updateViewport);
    return () => {
      document.removeEventListener('scroll', updateViewport, true);
      window.removeEventListener('resize', updateViewport);
    };
  }, [props.flows.length, props.loading, loadingNewer, upToDate, updateViewport]);

  React.useEffect(() => {
    document.addEventListener('scroll', fetchOlderIfVisible, true);
    window.addEventListener('resize', fetchOlderIfVisible);
    fetchOlderIfVisible();
    return () => {
      document.removeEventListener('scroll', fetchOlderIfVisible, true);
      window.removeEventListener('resize', fetchOlderIfVisible);
    };
  }, [fetchOlderIfVisible, loadingOlder, props.flows.length]);

  React.useEffect(() => {
    const sentinel = paginationSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          void fetchOlder();
        }
      },
      { rootMargin: '0px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchOlder, props.flows.length]);

  const fetchNewerOnPull = React.useCallback(
    (deltaY: number, target: EventTarget | null) => {
      const table = document.getElementById('table-container');
      if (!table || !(target instanceof Node) || !table.contains(target)) {
        return;
      }
      const distanceToTop = getDistanceToTableTop(table, target);
      if (
        deltaY < 0 &&
        distanceToTop !== undefined &&
        distanceToTop <= 200 &&
        activeSortId === ColumnsId.endtime &&
        activeSortDirection === SortByDirection.asc
      ) {
        void fetchNewer(distanceToTop <= 1);
      }
    },
    [activeSortDirection, activeSortId, fetchNewer]
  );

  const canFetchNewerInCurrentSort = activeSortId === ColumnsId.endtime && activeSortDirection === SortByDirection.asc;

  const handleStart = React.useCallback(() => {
    const container = document.getElementById('table-container');
    const metrics = container && getViewportMetrics(container);
    if (!container || !metrics) {
      return;
    }

    getScrollRoot(container).scrollBy({ top: -metrics.position, behavior: 'auto' });
    if (canFetchNewerInCurrentSort) {
      void fetchNewer(true);
    }
  }, [canFetchNewerInCurrentSort, fetchNewer]);

  const handlePageUp = React.useCallback(() => {
    const container = document.getElementById('table-container');
    const metrics = container && getViewportMetrics(container);
    if (!container || !metrics) {
      return;
    }

    const targetPosition = Math.max(0, metrics.position - metrics.height);
    getScrollRoot(container).scrollBy({ top: targetPosition - metrics.position, behavior: 'smooth' });
    if (targetPosition <= 200 && canFetchNewerInCurrentSort) {
      void fetchNewer(targetPosition <= 1);
    }
  }, [canFetchNewerInCurrentSort, fetchNewer]);

  const handlePageDown = React.useCallback(() => {
    const container = document.getElementById('table-container');
    const metrics = container && getViewportMetrics(container);
    if (!container || !metrics) {
      return;
    }

    const maxPosition = Math.max(0, props.flows.length * getRowHeight() - metrics.height);
    const currentPosition = Math.min(metrics.position, maxPosition);
    const targetPosition = Math.min(maxPosition, currentPosition + metrics.height);
    getScrollRoot(container).scrollBy({ top: targetPosition - metrics.position, behavior: 'smooth' });
    if (maxPosition - targetPosition <= 200) {
      void fetchOlder();
    }
  }, [fetchOlder, getRowHeight, props.flows.length]);

  const handleEnd = React.useCallback(() => {
    paginationSentinelRef.current?.scrollIntoView?.({ behavior: 'auto', block: 'end' });
    void fetchOlder();
  }, [fetchOlder]);

  const handleTableKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const target = event.target;
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        !(target instanceof HTMLElement) ||
        target.closest(
          'input, textarea, select, button, a[href], [contenteditable="true"], [role="button"], [role="combobox"]'
        )
      ) {
        return;
      }

      switch (event.key) {
        case 'PageUp':
          event.preventDefault();
          handlePageUp();
          break;
        case 'PageDown':
          event.preventDefault();
          handlePageDown();
          break;
        case 'Home':
          event.preventDefault();
          handleStart();
          break;
        case 'End':
          event.preventDefault();
          handleEnd();
          break;
      }
    },
    [handleEnd, handlePageDown, handlePageUp, handleStart]
  );

  React.useEffect(() => {
    const handleWheel = (event: WheelEvent) => fetchNewerOnPull(event.deltaY, event.target);
    const handleTouchStart = (event: TouchEvent) => {
      touchStartYRef.current = event.touches[0]?.clientY;
    };
    const handleTouchMove = (event: TouchEvent) => {
      const startY = touchStartYRef.current;
      const currentY = event.touches[0]?.clientY;
      if (startY !== undefined && currentY !== undefined && startY - currentY <= -20) {
        fetchNewerOnPull(startY - currentY, event.target);
      }
    };
    const resetTouch = () => {
      touchStartYRef.current = undefined;
    };

    document.addEventListener('wheel', handleWheel, { capture: true, passive: true });
    document.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true });
    document.addEventListener('touchmove', handleTouchMove, { capture: true, passive: true });
    document.addEventListener('touchend', resetTouch, true);
    return () => {
      document.removeEventListener('wheel', handleWheel, true);
      document.removeEventListener('touchstart', handleTouchStart, true);
      document.removeEventListener('touchmove', handleTouchMove, true);
      document.removeEventListener('touchend', resetTouch, true);
    };
  }, [fetchNewerOnPull]);

  // sort function
  const getSortedFlows = React.useCallback(() => {
    const found = activeSortId && props.columns.find(c => c.id === activeSortId);
    if (!found) {
      return props.flows;
    } else {
      return activeSortDirection === 'desc'
        ? props.flows.sort((a: Record, b: Record) => found.sort(a, b, found))
        : props.flows.sort((a: Record, b: Record) => found.sort(b, a, found));
    }
  }, [activeSortDirection, activeSortId, props.columns, props.flows]);

  // sort handler
  const onSort = React.useCallback(
    (columnId: ColumnsId, direction: SortByDirection) => {
      setActiveSortId(columnId);
      setActiveSortDirection(direction);
    },
    [setActiveSortDirection, setActiveSortId]
  );

  const getBody = React.useCallback(() => {
    const rowHeight = getRowHeight();
    const flows = getSortedFlows();
    const visibleRowCount = Math.ceil(containerHeight / rowHeight) + VIRTUAL_ROWS_OVERSCAN * 2;
    const maxStartIndex = Math.max(0, flows.length - visibleRowCount);
    const startIndex = Math.min(
      maxStartIndex,
      Math.max(0, Math.floor(scrollPosition / rowHeight) - VIRTUAL_ROWS_OVERSCAN)
    );
    const endIndex = Math.min(
      flows.length,
      Math.max(startIndex, Math.ceil((scrollPosition + containerHeight) / rowHeight) + VIRTUAL_ROWS_OVERSCAN)
    );
    const rows = flows
      .slice(startIndex, endIndex)
      .map((f, index) => (
        <NetflowTableRow
          rowNumber={startIndex + index}
          key={f.key}
          allowPktDrops={props.allowPktDrops}
          flow={f}
          lastRender={lastRender}
          columns={props.columns}
          size={props.size}
          selectedRecord={props.selectedRecord}
          onSelect={props.onSelect}
          highlight={
            previousContainerHeight === containerHeight &&
            previousScrollPosition === scrollPosition &&
            previousActiveSortDirection === activeSortDirection &&
            previousActiveSortIndex === activeSortId &&
            !firstRender.current
          }
          height={rowHeight}
          tableWidth={width}
          isDark={props.isDark}
        />
      ));
    const spacerProps = {
      'aria-hidden': true,
      'data-last-render': lastRender,
      className: 'netflow-table-virtual-spacer'
    };
    const topSpacerHeight = startIndex * rowHeight;
    const bottomSpacerHeight = Math.max(0, (flows.length - endIndex) * rowHeight);

    return (
      <>
        {topSpacerHeight > 0 && (
          <Tr {...spacerProps} data-test="table-top-spacer" style={{ height: topSpacerHeight }}>
            <Td colSpan={props.columns.length} style={{ height: topSpacerHeight, padding: 0, border: 0 }} />
          </Tr>
        )}
        {rows}
        {bottomSpacerHeight > 0 && (
          <Tr {...spacerProps} data-test="table-bottom-spacer" style={{ height: bottomSpacerHeight }}>
            <Td colSpan={props.columns.length} style={{ height: bottomSpacerHeight, padding: 0, border: 0 }} />
          </Tr>
        )}
      </>
    );
  }, [
    props.allowPktDrops,
    lastRender,
    activeSortDirection,
    activeSortId,
    props.columns,
    containerHeight,
    getRowHeight,
    getSortedFlows,
    props.onSelect,
    previousActiveSortDirection,
    previousActiveSortIndex,
    previousContainerHeight,
    previousScrollPosition,
    scrollPosition,
    props.selectedRecord,
    props.size,
    width,
    props.isDark
  ]);

  if (width === 0) {
    return null;
  } else if (_.isEmpty(props.flows)) {
    if (props.loading) {
      return (
        <Bullseye data-test="loading-contents">
          <Spinner size="xl" />
        </Bullseye>
      );
    } else {
      return (
        <Bullseye data-test="no-results-found">
          <Empty showDetails={true} resetDefaultFilters={props.resetDefaultFilters} clearFilters={props.clearFilters} />
        </Bullseye>
      );
    }
  }

  return (
    <div
      id="table-container"
      role="region"
      aria-label={t('Flow table navigation')}
      aria-keyshortcuts="PageUp PageDown Home End"
      tabIndex={0}
      onKeyDown={handleTableKeyDown}
    >
      {(loadingNewer || upToDate) && (
        <div
          className="netflow-table-pagination-status netflow-table-pagination-status--top-loading"
          role="status"
          aria-live="polite"
        >
          {loadingNewer ? (
            <>
              <Spinner size="sm" aria-label={t('Loading newer flows')} />
              <span data-test="loading-newer-flows">{t('Loading newer flows')}</span>
            </>
          ) : (
            <span data-test="flows-up-to-date">{t('Already up to date')}</span>
          )}
        </div>
      )}
      <Table
        data-test="table-composable"
        data-test-cols-count={props.columns.length}
        data-test-rows-count={props.flows.length}
        aria-label="Netflow table"
        variant="compact"
        style={{ minWidth: `${width}em` }}
        isStickyHeader
      >
        <NetflowTableHeader
          data-test="table-header"
          onSort={onSort}
          sortDirection={activeSortDirection}
          sortId={activeSortId}
          columns={props.columns}
          setColumns={props.setColumns}
          columnSizes={props.columnSizes}
          setColumnSizes={props.setColumnSizes}
          tableWidth={width}
        />
        <Tbody id="table-body" data-test="table-body">
          {getBody()}
        </Tbody>
      </Table>
      {(loadingOlder || olderError || !hasMoreOlder) && (
        <div
          className={`netflow-table-pagination-status ${
            loadingOlder
              ? 'netflow-table-pagination-status--loading'
              : olderError
                ? 'netflow-table-pagination-status--error'
                : 'netflow-table-pagination-status--end'
          }`}
          role={olderError && !loadingOlder ? 'alert' : 'status'}
          aria-live="polite"
        >
          {loadingOlder ? (
            <>
              <Spinner size="sm" aria-label={t('Loading older flows')} />
              <span data-test="loading-older-flows">{t('Loading older flows')}</span>
            </>
          ) : olderError ? (
            <span data-test="older-flows-error">
              {t('Unable to load older flows')}: {typeof olderError === 'string' ? olderError : olderError.toString()}
            </span>
          ) : (
            <span data-test="no-older-flows">{t('End of available flows')}</span>
          )}
        </div>
      )}
      <div ref={paginationSentinelRef} aria-hidden="true" style={{ height: '1px' }} />
    </div>
  );
});

export default NetflowTable;
