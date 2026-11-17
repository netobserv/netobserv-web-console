import { Bullseye, Spinner } from '@patternfly/react-core';
import { SortByDirection, Table, Tbody } from '@patternfly/react-table';
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
  const { fetch, fetchOlder, fetchNewer, fetchOlderIfVisible, hasMoreOlder, loadingOlder, loadingNewer, upToDate } =
    useNetflowTablePagination(props.flows, props.onLoadedRangeChange);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.columns, props.size]);

  //update table container height on window resize
  const handleResize = React.useCallback(() => {
    const container = document.getElementById('table-container');
    if (container) {
      setContainerHeight(container.clientHeight);
    }
  }, []);

  const handleScroll = React.useCallback(() => {
    const rowHeight = getRowHeight();
    const container = document.getElementById('table-container');
    const header = container?.children[0]?.children[0]?.children[0];
    if (container && header) {
      const position = container.scrollTop - header.clientHeight;
      //updates only when position moved more than one row height
      if (scrollPosition < position - rowHeight || scrollPosition > position + rowHeight) {
        setScrollPosition(position);
      }
    }
  }, [getRowHeight, scrollPosition]);

  React.useEffect(() => {
    handleScroll();
    handleResize();
    const container = document.getElementById('table-container');
    if (container && container.getAttribute('listener') !== 'true') {
      container.addEventListener('scroll', handleScroll);
    }

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [handleResize, handleScroll, props.loading]);

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

    return getSortedFlows().map((f, i) => (
      <NetflowTableRow
        rowNumber={i}
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
        showContent={scrollPosition <= i * rowHeight && scrollPosition + containerHeight > i * rowHeight}
        tableWidth={width}
        isDark={props.isDark}
      />
    ));
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
    <div id="table-container">
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
      {(loadingOlder || !hasMoreOlder) && (
        <div
          className={`netflow-table-pagination-status ${
            loadingOlder ? 'netflow-table-pagination-status--loading' : 'netflow-table-pagination-status--end'
          }`}
          role="status"
          aria-live="polite"
        >
          {loadingOlder ? (
            <>
              <Spinner size="sm" aria-label={t('Loading older flows')} />
              <span data-test="loading-older-flows">{t('Loading older flows')}</span>
            </>
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
