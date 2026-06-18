import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';

import { defaultNetflowMetrics, NetflowMetrics } from '../../../api/query-response';
import { Result } from '../../../utils/result';
import { metrics } from '../../__tests-data__/metrics';
import { MetricsQuerySummary } from '../metrics-query-summary';

describe('<MetricsQuerySummary />', () => {
  const now = new Date();

  const m: NetflowMetrics = { ...defaultNetflowMetrics, rate: Result.success({ bytes: metrics }) };
  const mocks = {
    toggleQuerySummary: jest.fn(),
    metrics: m,
    stats: {
      limitReached: false,
      numQueries: 1,
      dataSources: ['loki']
    },
    lastRefresh: now
  };

  it('should render component', async () => {
    const { container } = render(<MetricsQuerySummary {...mocks} />);
    await waitFor(() => {
      expect(container.querySelector('#query-summary-content')).toBeTruthy();
    });
  });

  it('should show summary', async () => {
    const { container } = render(<MetricsQuerySummary {...mocks} />);
    await waitFor(() => {
      expect(container.querySelector('#bytesCount')).toBeTruthy();
    });

    expect(container.querySelector('#bytesCount')?.textContent).toBe('6.8 MB');
    expect(container.querySelector('#packetsCount')).toBeNull();
    expect(container.querySelector('#bytesPerSecondsCount')?.textContent).toBe('22.79 kBps');
    expect(container.querySelector('#lastRefresh')?.textContent).toBe(now.toLocaleTimeString());
  });

  it('should toggle panel', async () => {
    const user = userEvent.setup();
    const { container } = render(<MetricsQuerySummary {...mocks} />);
    await waitFor(() => {
      expect(container.querySelector('#query-summary-toggle')).toBeTruthy();
    });

    await user.click(container.querySelector('#query-summary-toggle')!);
    expect(mocks.toggleQuerySummary).toHaveBeenCalledTimes(1);
  });
});
