import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { emptyHealthFilters, HealthFilterState } from '../health-filters';
import { HealthFiltersToolbar } from '../health-filters-toolbar';

// Thin stateful wrapper so the toolbar's functional setFilters(prev => ...) updates behave exactly as they would
// under useHealthFilters (a plain React.useState setter), and assertions can be made on the resulting UI.
const Wrapper: React.FC<{ initial?: HealthFilterState; availableNamespaces?: string[] }> = ({
  initial = emptyHealthFilters,
  availableNamespaces = ['ns-a', 'ns-b']
}) => {
  const [filters, setFilters] = React.useState<HealthFilterState>(initial);
  return <HealthFiltersToolbar filters={filters} setFilters={setFilters} availableNamespaces={availableNamespaces} />;
};

describe('<HealthFiltersToolbar />', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should not show "Clear all filters" when nothing is active', () => {
    render(<Wrapper />);
    expect(screen.queryByText('Clear all filters')).not.toBeInTheDocument();
  });

  it('should show "Clear all filters" once a filter is active, and reset on click', async () => {
    render(<Wrapper initial={{ ...emptyHealthFilters, severities: ['critical'] }} />);
    expect(screen.getByText('Clear all filters')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('Clear all filters'));
    });

    expect(screen.queryByText('Clear all filters')).not.toBeInTheDocument();
  });

  it('should apply a search filter after the debounce delay', async () => {
    render(<Wrapper />);
    const input = document.querySelector('[data-test="health-name-filter"] input') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { value: 'drop' } });
    });
    // Not committed to filters state yet (debounced)
    expect(screen.queryByText('Clear all filters')).not.toBeInTheDocument();

    await act(async () => {
      jest.runAllTimers();
    });

    await waitFor(() => {
      expect(screen.getByText('Clear all filters')).toBeInTheDocument();
    });
  });

  it('should show filter chips when filters are active', () => {
    render(<Wrapper initial={{ ...emptyHealthFilters, severities: ['critical'], statuses: ['firing'] }} />);
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Firing')).toBeInTheDocument();
  });

  it('should remove a chip when its close button is clicked', async () => {
    render(<Wrapper initial={{ ...emptyHealthFilters, severities: ['critical', 'warning'] }} />);
    expect(screen.getByText('Critical')).toBeInTheDocument();

    const closeButton = screen.getByLabelText('Close Critical');
    await act(async () => {
      fireEvent.click(closeButton);
    });

    await waitFor(() => {
      expect(screen.queryByText('Critical')).not.toBeInTheDocument();
      expect(screen.getByText('Warning')).toBeInTheDocument();
    });
  });
});
