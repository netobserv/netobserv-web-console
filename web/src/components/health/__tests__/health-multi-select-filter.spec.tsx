import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { HealthMultiSelectFilter } from '../health-multi-select-filter';

describe('<HealthMultiSelectFilter />', () => {
  const options = [
    { value: 'critical', label: 'Critical' },
    { value: 'warning', label: 'Warning' },
    { value: 'info', label: 'Info' }
  ];

  const props = {
    id: 'severity-filter',
    toggleLabel: 'Severity',
    options,
    selected: [] as string[],
    onChange: jest.fn()
  };

  beforeEach(() => {
    props.onChange.mockClear();
  });

  it('should render the toggle with its label and no badge when nothing is selected', () => {
    render(<HealthMultiSelectFilter {...props} />);
    expect(screen.getByText('Severity')).toBeInTheDocument();
    expect(document.querySelector('#severity-filter-toggle .pf-v6-c-badge')).toBeFalsy();
  });

  it('should show a badge with the count when items are selected', () => {
    render(<HealthMultiSelectFilter {...props} selected={['critical', 'warning']} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should open the menu and call onChange when selecting a new option', async () => {
    render(<HealthMultiSelectFilter {...props} />);

    await act(async () => {
      fireEvent.click(document.querySelector('#severity-filter-toggle')!);
    });

    await waitFor(() => {
      expect(document.querySelector('#severity-filter-option-critical')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(document.querySelector('#severity-filter-option-critical')!);
    });

    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(props.onChange).toHaveBeenCalledWith(['critical']);
  });

  it('should call onChange to unselect a value already selected', async () => {
    render(<HealthMultiSelectFilter {...props} selected={['critical']} />);

    await act(async () => {
      fireEvent.click(document.querySelector('#severity-filter-toggle')!);
    });

    await waitFor(() => {
      expect(document.querySelector('#severity-filter-option-critical')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(document.querySelector('#severity-filter-option-critical')!);
    });

    expect(props.onChange).toHaveBeenCalledWith([]);
  });
});
