import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { AlertsResult } from '../../../api/alert';
import { defaultConfig } from '../../../model/config';
import NetworkHealth from '../network-health';

jest.mock('../../../api/routes', () => ({
  getConfig: jest.fn(() => Promise.resolve(defaultConfig)),
  getAlerts: jest.fn(() =>
    Promise.resolve({
      data: {
        groups: [
          {
            file: 'f',
            name: 'g',
            rules: [
              {
                name: 'PacketDropsByKernel',
                id: '',
                query: '',
                duration: 0,
                labels: {},
                annotations: {
                  summary: 'Too many drops',
                  netobserv_io_network_health: JSON.stringify({
                    namespaceLabels: ['namespace'],
                    upperBound: '100',
                    links: []
                  })
                },
                alerts: [
                  {
                    labels: { severity: 'critical', namespace: 'ns-a' },
                    annotations: { summary: 'Too many drops in ns-a' },
                    state: 'firing',
                    value: '10',
                    activeAt: '2024-01-01T00:00:00Z'
                  }
                ],
                state: 'firing',
                type: 'alerting'
              }
            ]
          }
        ]
      },
      status: 'success'
    } as unknown as AlertsResult)
  ),
  getSilencedAlerts: jest.fn(() => Promise.resolve([])),
  getRecordingRules: jest.fn(() => Promise.resolve({ data: { groups: [] }, status: 'success' } as AlertsResult)),
  queryPrometheusMetric: jest.fn(() => Promise.resolve({ data: { result: [] } }))
}));

describe('<NetworkHealth /> filters', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/network-health');
    // Filters are also mirrored to localStorage (so they survive sidebar navigation); reset it too,
    // otherwise one test's filters leak into the next through the persisted state.
    window.localStorage.clear();
  });

  it('should seed the toolbar from URL filters on mount', async () => {
    window.history.replaceState({}, '', '/network-health?healthSeverity=critical');
    render(<NetworkHealth />);

    await waitFor(() => {
      expect(screen.getByText('Clear all filters')).toBeInTheDocument();
    });
  });

  it('should reflect a filter toggled from the UI in the URL, and keep it across tab switches', async () => {
    render(<NetworkHealth />);

    await waitFor(() => {
      expect(document.querySelector('#health-severity-filter-toggle')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(document.querySelector('#health-severity-filter-toggle')!);
    });
    await waitFor(() => {
      expect(document.querySelector('#health-severity-filter-option-critical')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.click(document.querySelector('#health-severity-filter-option-critical')!);
    });

    await waitFor(() => {
      expect(window.location.search).toContain('healthSeverity=critical');
    });

    // Switch to the "Namespaces" tab (its title includes a live count, e.g. "Namespaces (0)"):
    // the filter must survive the tab change.
    await act(async () => {
      fireEvent.click(screen.getByText(/^Namespaces/));
    });

    expect(window.location.search).toContain('healthSeverity=critical');
    expect(screen.getByText('Clear all filters')).toBeInTheDocument();
  });

  it('restores filters from storage on a fresh mount with a clean URL (sidebar navigation)', async () => {
    // First visit: apply a filter, which persists it to localStorage.
    const first = render(<NetworkHealth />);
    await waitFor(() => {
      expect(document.querySelector('#health-severity-filter-toggle')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.click(document.querySelector('#health-severity-filter-toggle')!);
    });
    await waitFor(() => {
      expect(document.querySelector('#health-severity-filter-option-critical')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.click(document.querySelector('#health-severity-filter-option-critical')!);
    });
    await waitFor(() => {
      expect(window.location.search).toContain('healthSeverity=critical');
    });

    // Leaving through the sidebar is a fresh navigation that drops the query string.
    first.unmount();
    window.history.replaceState({}, '', '/network-health');

    // Coming back: the filter is restored from storage (and written back to the URL).
    render(<NetworkHealth />);
    await waitFor(() => {
      expect(screen.getByText('Clear all filters')).toBeInTheDocument();
    });
    expect(window.location.search).toContain('healthSeverity=critical');
  });
});
