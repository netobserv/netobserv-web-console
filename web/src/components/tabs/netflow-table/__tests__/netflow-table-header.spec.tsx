import { SortByDirection, Table, Tbody } from '@patternfly/react-table';
import { fireEvent, render } from '@testing-library/react';
import * as _ from 'lodash';
import * as React from 'react';
import { Column, ColumnsId, ColumnSizeMap } from '../../../../utils/columns';
import { AllSelectedColumnSample, DefaultColumnSample } from '../../../__tests-data__/columns';
import { NetflowTableHeader } from '../netflow-table-header';

const filterOrderedColumnsByIds = (ids: ColumnsId[]) => {
  return _.cloneDeep(DefaultColumnSample)
    .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
    .map(c => {
      c.isSelected = ids.includes(c.id);
      return c;
    })
    .filter(c => c.isSelected);
};

const NetflowTableHeaderWrapper: React.FC<{
  onSort: (id: ColumnsId, direction: SortByDirection) => void;
  sortId: ColumnsId;
  sortDirection: SortByDirection;
  columns: Column[];
  setColumns: (v: Column[]) => void;
  columnSizes: ColumnSizeMap;
  setColumnSizes: (v: ColumnSizeMap) => void;
}> = ({ onSort, sortId, sortDirection, columns, setColumns, columnSizes, setColumnSizes }) => {
  return (
    <Table aria-label="Misc table" variant="compact">
      <NetflowTableHeader
        onSort={onSort}
        sortDirection={sortDirection}
        sortId={sortId}
        columns={columns}
        setColumns={setColumns}
        columnSizes={columnSizes}
        setColumnSizes={setColumnSizes}
        tableWidth={100}
      />
      <Tbody></Tbody>
    </Table>
  );
};

describe('<NetflowTableHeader />', () => {
  const mocks = {
    onSort: jest.fn(),
    sortId: ColumnsId.endtime,
    sortDirection: SortByDirection.asc,
    tableWidth: 100,
    setColumns: jest.fn(),
    columnSizes: {},
    setColumnSizes: jest.fn()
  };

  it('should render component', async () => {
    const { container } = render(<NetflowTableHeaderWrapper {...mocks} columns={AllSelectedColumnSample} />);
    expect(container.querySelectorAll('thead')).toHaveLength(1);
    expect(container.querySelectorAll('th').length).toBeGreaterThanOrEqual(AllSelectedColumnSample.length);
  });

  it('should render given columns', async () => {
    const { container } = render(
      <NetflowTableHeaderWrapper {...mocks} columns={filterOrderedColumnsByIds([ColumnsId.endtime])} />
    );
    expect(container.querySelectorAll('thead')).toHaveLength(1);
    expect(container.querySelectorAll('thead tr')).toHaveLength(1);
    expect(container.querySelectorAll('th')).toHaveLength(1);
  });

  it('should call sort function on click', async () => {
    const { container } = render(<NetflowTableHeaderWrapper {...mocks} columns={DefaultColumnSample} />);
    const firstButton = container.querySelector('button')!;
    fireEvent.click(firstButton);
    expect(mocks.onSort).toHaveBeenCalledWith('StartTime', 'asc');
  });

  it('should nested consecutive group columns', async () => {
    const selectedIds = [ColumnsId.endtime, ColumnsId.srcname, ColumnsId.srcport, ColumnsId.dstname, ColumnsId.packets];
    const { container } = render(
      <NetflowTableHeaderWrapper {...mocks} columns={filterOrderedColumnsByIds(selectedIds)} />
    );
    expect(container.querySelectorAll('thead')).toHaveLength(1);
    expect(container.querySelectorAll('thead tr')).toHaveLength(2);
    expect(container.querySelectorAll('th').length).toBeGreaterThanOrEqual(selectedIds.length);
  });

  it('should keep flat non consecutive group columns', async () => {
    const selectedIds = [ColumnsId.endtime, ColumnsId.srcname, ColumnsId.dstname, ColumnsId.packets, ColumnsId.srcport];
    const { container } = render(
      <NetflowTableHeaderWrapper {...mocks} columns={filterOrderedColumnsByIds(selectedIds)} />
    );
    expect(container.querySelectorAll('thead')).toHaveLength(1);
    expect(container.querySelectorAll('thead tr')).toHaveLength(1);
    expect(container.querySelectorAll('th')).toHaveLength(selectedIds.length);
  });
});
