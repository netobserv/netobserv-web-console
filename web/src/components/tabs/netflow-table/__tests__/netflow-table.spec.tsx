import { fireEvent, render, waitFor } from '@testing-library/react';
import * as React from 'react';

import { ShuffledColumnSample } from '../../../__tests-data__/columns';
import { FlowsMock, FlowsSample } from '../../../__tests-data__/flows';
import { Size } from '../../../dropdowns/table-display-dropdown';
import NetflowTable from '../netflow-table';

describe('<NetflowTable />', () => {
  const mocks = {
    allowPktDrops: true,
    size: 'm' as Size,
    onSelect: jest.fn(),
    setColumns: jest.fn(),
    columnSizes: {},
    setColumnSizes: jest.fn()
  };

  it('should render component', async () => {
    const flows = FlowsSample.slice(0, FlowsSample.length);
    const { container } = render(<NetflowTable flows={flows} columns={ShuffledColumnSample} {...mocks} />);
    expect(container.querySelector('thead')).toBeTruthy();
  });

  it('should have table rows with sample', async () => {
    const flows = FlowsSample.slice(0, FlowsSample.length);
    const { container } = render(<NetflowTable flows={flows} columns={ShuffledColumnSample} {...mocks} />);
    await waitFor(() => {
      expect(container.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
    });
  });

  it('should have table rows with mock', async () => {
    const flows = FlowsMock.slice(0, FlowsMock.length);
    const { container } = render(<NetflowTable flows={flows} columns={ShuffledColumnSample} {...mocks} />);
    await waitFor(() => {
      expect(container.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
    });
  });

  it('keeps only the visible rows and overscan mounted', () => {
    const flows = Array.from({ length: 200 }, (_, index) => ({
      ...FlowsSample[index % FlowsSample.length],
      key: index + 1
    }));
    const { container } = render(<NetflowTable flows={flows} columns={ShuffledColumnSample} {...mocks} />);
    const table = container.querySelector('table');
    const header = container.querySelector('thead');
    expect(table).toBeTruthy();
    expect(header).toBeTruthy();

    expect(container.querySelectorAll('tbody tr[data-test^="tr-"]').length).toBeLessThan(flows.length);
    expect(container.querySelector('[data-test="table-bottom-spacer"]')).toBeTruthy();

    jest.spyOn(table as HTMLTableElement, 'getBoundingClientRect').mockReturnValue({
      top: -10000,
      bottom: 0,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: -10000,
      toJSON: () => ({})
    });
    jest.spyOn(header as HTMLTableSectionElement, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({})
    });
    fireEvent.scroll(document);

    expect(container.querySelector('[data-test="table-top-spacer"]')).toBeTruthy();
    expect(container.querySelectorAll('tbody tr[data-test^="tr-"]').length).toBeLessThan(flows.length);
  });

  it('should update rows on props update', async () => {
    const flows = FlowsSample.slice(0, 1);
    const { container, rerender } = render(<NetflowTable flows={flows} columns={ShuffledColumnSample} {...mocks} />);
    await waitFor(() => {
      expect(container.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
    });

    const flowsupdated = FlowsSample.slice(0, FlowsSample.length);
    rerender(<NetflowTable flows={flowsupdated} columns={ShuffledColumnSample} {...mocks} />);
    await waitFor(() => {
      expect(container.querySelectorAll('tbody tr').length).toBeGreaterThanOrEqual(flowsupdated.length);
    });
  });

  it('should render a spinning slide and then the netflow rows', async () => {
    const { container, rerender } = render(
      <NetflowTable loading={true} flows={[]} columns={ShuffledColumnSample} {...mocks} />
    );
    expect(container.querySelector('[data-test="loading-contents"]')).toBeTruthy();

    rerender(
      <NetflowTable
        flows={FlowsSample.slice(0, FlowsSample.length)}
        loading={false}
        columns={ShuffledColumnSample}
        {...mocks}
      />
    );
    expect(container.querySelector('[data-test="loading-contents"]')).toBeNull();
    expect(container.querySelector('[data-test="no-results-found"]')).toBeNull();
    expect(container.querySelector('[data-test="error-state"]')).toBeNull();
  });

  it('should render a spinning slide and then a NoResultsFound message if no flows are found', async () => {
    const { container, rerender } = render(
      <NetflowTable loading={true} flows={[]} columns={ShuffledColumnSample} {...mocks} />
    );
    expect(container.querySelector('[data-test="loading-contents"]')).toBeTruthy();

    rerender(<NetflowTable loading={false} flows={[]} columns={ShuffledColumnSample} {...mocks} />);
    expect(container.querySelector('[data-test="loading-contents"]')).toBeNull();
    expect(container.querySelector('[data-test="no-results-found"]')).toBeTruthy();
    expect(container.querySelector('[data-test="error-state"]')).toBeNull();
  });
});
