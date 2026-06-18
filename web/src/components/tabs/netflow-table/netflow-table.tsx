import { Bullseye, Spinner } from '@patternfly/react-core';
import { SortByDirection, Table, Tbody } from '@patternfly/react-table';
import * as _ from 'lodash';
import * as React from 'react';

import { Record } from '../../../api/ipfix';
import { defaultNetflowMetrics, Stats } from '../../../api/query-response';
import { Config } from '../../../model/config';
import { useNetflowContext } from '../../../model/netflow-context';
import { Column, ColumnsId, ColumnSizeMap } from '../../../utils/columns';
import { TimeRange } from '../../../utils/datetime';
import { getStructuredHTTPError } from '../../../utils/errors';
import { mergeFlowReporters } from '../../../utils/flows';
import {
  localStorageSortDirectionKey,
  localStorageSortIdKey,
  useLocalStorage
} from '../../../utils/local-storage-hook';
import { convertRemToPixels } from '../../../utils/panel';
import { usePrevious } from '../../../utils/previous-hook';
import { Result } from '../../../utils/result';
import { Size } from '../../dropdowns/table-display-dropdown';
import { Empty } from '../../messages/empty';
import { NetflowTableHeader } from './netflow-table-header';
import NetflowTableRow from './netflow-table-row';
import './netflow-table.css';

export type NetflowTableHandle = {
  fetch: (
    range: number | TimeRange,
    histogramRange: TimeRange | undefined,
    showHistogram: boolean,
    showDuplicates: boolean
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
  resetDefaultFilters?: (c?: Config) => void;
  clearFilters?: () => void;
  isDark?: boolean;
}

// eslint-disable-next-line react/display-name
export const NetflowTable = React.forwardRef<NetflowTableHandle, NetflowTableProps>((props, ref) => {
  const { caps, fetchCallbacks } = useNetflowContext();

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
  const width = props.columns.reduce((prev, cur) => prev + cur.width, 0);

  const fetch = React.useCallback(
    (
      range: number | TimeRange,
      histogramRange: TimeRange | undefined,
      showHistogram: boolean,
      showDuplicates: boolean
    ) => {
      const fq = caps.flowQuery;
      const { getRecords, getMetrics } = caps.fetchFunctions;
      const { metricsRef, setFlows, setMetrics } = fetchCallbacks;

      if (!showHistogram) {
        setMetrics(defaultNetflowMetrics);
      }

      let currentMetrics = metricsRef.current;

      // table query is based on histogram range if available
      const tableQuery = { ...fq };
      if (histogramRange) {
        tableQuery.startTime = histogramRange.from.toString();
        tableQuery.endTime = histogramRange.to.toString();
      }
      const promises: Promise<Stats>[] = [
        getRecords(tableQuery).then(res => {
          const flows = showDuplicates ? res.records : mergeFlowReporters(res.records);
          setFlows(flows);
          return res.stats;
        })
      ];
      if (showHistogram) {
        promises.push(
          Result.fromPromise(getMetrics({ ...fq, function: 'count', aggregateBy: 'app', type: 'Flows' }, range)).then(
            res => {
              const totalFlowCount = res.map(m => m.metrics[0]).mapError(err => getStructuredHTTPError(err));
              currentMetrics = { ...currentMetrics, totalFlowCount };
              setMetrics(currentMetrics);
              return res.map(r => r.stats).or({ numQueries: 0, limitReached: false, dataSources: [] } as Stats);
            }
          )
        );
      } else {
        currentMetrics = { ...currentMetrics, totalRate: Result.empty() };
        setMetrics(currentMetrics);
      }
      return Promise.all(promises);
    },
    [caps.flowQuery, caps.fetchFunctions, fetchCallbacks]
  );

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
    </div>
  );
});

export default NetflowTable;
