import { render } from '@testing-library/react';
import * as React from 'react';

import { NamedMetric } from '../../../api/query-response';
import { metrics } from '../../__tests-data__/metrics';
import { MetricsDonut, MetricsDonutProps } from '../metrics-donut';

describe('<StatDonut />', () => {
  const props: MetricsDonutProps = {
    id: 'donut-test',
    limit: 5,
    metricType: 'Bytes',
    metricFunction: 'rate',
    topKMetrics: metrics.map(m => ({ ...m, fullName: 'whatever', shortName: 'whatever', isInternal: false })),
    totalMetric: { stats: { avg: 500 } } as NamedMetric,
    showInternal: true,
    showOthers: true,
    showOutOfScope: false
  };

  it('should render donut', async () => {
    const { container } = render(<MetricsDonut {...props} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.textContent).toMatch(/500 Bps/);
    expect(container.textContent).toMatch(/Total/);
  });
});
