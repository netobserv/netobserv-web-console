import { fireEvent, render } from '@testing-library/react';
import * as React from 'react';

import { ColumnsId } from '../../../../utils/columns';
import {
  localStorageSortDirectionKey,
  localStorageSortIdKey,
  setLocalStorage
} from '../../../../utils/local-storage-hook';
import { ShuffledColumnSample } from '../../../__tests-data__/columns';
import { FlowsSample } from '../../../__tests-data__/flows';
import { Size } from '../../../dropdowns/table-display-dropdown';
import NetflowTable from '../netflow-table';

const mockFetchOlder = jest.fn();
const mockFetchNewer = jest.fn();

jest.mock('../use-netflow-table-pagination', () => ({
  useNetflowTablePagination: () => ({
    fetch: jest.fn(),
    fetchOlder: mockFetchOlder,
    fetchNewer: mockFetchNewer,
    fetchOlderIfVisible: jest.fn(),
    hasMoreOlder: true,
    loadingOlder: false,
    loadingNewer: false,
    upToDate: false
  })
}));

describe('NetflowTable keyboard navigation', () => {
  const mocks = {
    allowPktDrops: true,
    size: 'm' as Size,
    onSelect: jest.fn(),
    setColumns: jest.fn(),
    columnSizes: {},
    setColumnSizes: jest.fn()
  };

  beforeEach(() => {
    mockFetchOlder.mockReset();
    mockFetchNewer.mockReset();
    setLocalStorage(localStorageSortIdKey, ColumnsId.endtime);
    setLocalStorage(localStorageSortDirectionKey, 'asc');
  });

  it('maps Home and End to the newest and oldest page actions', () => {
    const scrollBy = jest.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    const { container } = render(<NetflowTable flows={FlowsSample} columns={ShuffledColumnSample} {...mocks} />);
    const tableContainer = container.querySelector('#table-container') as HTMLDivElement;

    fireEvent.keyDown(tableContainer, { key: 'Home' });
    fireEvent.keyDown(tableContainer, { key: 'End' });

    expect(mockFetchNewer).toHaveBeenCalledWith(true);
    expect(mockFetchOlder).toHaveBeenCalledTimes(1);
    expect(scrollBy).toHaveBeenCalled();
    scrollBy.mockRestore();
  });

  it('moves one viewport and fetches when paging reaches a loaded edge', () => {
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 300 });
    const flows = Array.from({ length: 200 }, (_, index) => ({
      ...FlowsSample[index % FlowsSample.length],
      key: index + 1
    }));
    const { container } = render(<NetflowTable flows={flows} columns={ShuffledColumnSample} {...mocks} />);
    const table = container.querySelector('table') as HTMLTableElement;
    const header = container.querySelector('thead') as HTMLTableSectionElement;
    const makeRect = (top: number): DOMRect => ({
      top,
      bottom: top,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: top,
      toJSON: () => ({})
    });
    const tableRect = jest.spyOn(table, 'getBoundingClientRect').mockReturnValue(makeRect(-400));
    jest.spyOn(header, 'getBoundingClientRect').mockReturnValue(makeRect(0));
    const scrollBy = jest.spyOn(window, 'scrollBy').mockImplementation(() => undefined);

    const tableContainer = container.querySelector('#table-container') as HTMLDivElement;
    fireEvent.keyDown(tableContainer, { key: 'PageUp' });
    expect(scrollBy).toHaveBeenLastCalledWith({ top: -300, behavior: 'smooth' });
    expect(mockFetchNewer).toHaveBeenCalledWith(false);

    const rowHeight = Number.parseFloat(
      (container.querySelector('tbody tr[data-test^="tr-"]') as HTMLElement).style.height
    );
    const lastLoadedPosition = flows.length * rowHeight - 300;
    tableRect.mockReturnValue(makeRect(-lastLoadedPosition));
    fireEvent.keyDown(tableContainer, { key: 'PageDown' });
    expect(mockFetchOlder).toHaveBeenCalledTimes(1);

    scrollBy.mockRestore();
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight });
  });
});
