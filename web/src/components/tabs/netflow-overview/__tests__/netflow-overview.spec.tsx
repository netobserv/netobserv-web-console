import { render, waitFor } from '@testing-library/react';
import * as React from 'react';

import { defaultNetflowMetrics } from '../../../../api/query-response';
import { droppedMetrics, metrics } from '../../../../components/__tests-data__/metrics';
import { ScopeDefSample } from '../../../../components/__tests-data__/scopes';
import { TruncateLength } from '../../../../components/dropdowns/truncate-dropdown';
import { FlowScope, RecordType } from '../../../../model/flow-query';
import { Result } from '../../../../utils/result';
import { FilterDefinitionSample } from '../../../__tests-data__/filters';
import { ShuffledDefaultPanels } from '../../../__tests-data__/panels';
import { NetflowOverview, NetflowOverviewProps } from '../netflow-overview';

describe('<NetflowOverview />', () => {
  const props: NetflowOverviewProps = {
    limit: 5,
    panels: ShuffledDefaultPanels,
    loading: false,
    recordType: 'flowLog' as RecordType,
    metrics: defaultNetflowMetrics,
    truncateLength: TruncateLength.M,
    forcedSize: { width: 800, height: 800 } as DOMRect,
    scopes: ScopeDefSample,
    metricScope: 'host' as FlowScope,
    filterDefinitions: FilterDefinitionSample,
    setMetricScope: jest.fn()
  };

  it('should render component', async () => {
    const { container } = render(<NetflowOverview {...props} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('should render empty states', async () => {
    const { container } = render(<NetflowOverview {...props} />);
    await waitFor(() => {
      const emptyStates = container.querySelectorAll('[data-test="empty-state"]');
      expect(emptyStates.length).toBeGreaterThan(0);
    });
  });

  it('should render panels with metrics', async () => {
    const { container, rerender } = render(
      <NetflowOverview
        {...props}
        metrics={{
          ...props.metrics,
          rate: Result.success({ bytes: metrics }),
          droppedRate: Result.success({ bytes: droppedMetrics }),
          totalRate: Result.success({ bytes: metrics[0] }),
          totalDroppedRate: Result.success({ bytes: droppedMetrics[0] })
        }}
      />
    );
    await waitFor(() => {
      expect(container.querySelector('.overview-card')).toBeTruthy();
    });

    rerender(
      <NetflowOverview
        {...props}
        panels={[ShuffledDefaultPanels[0]]}
        metrics={{
          ...props.metrics,
          rate: Result.success({ bytes: metrics }),
          droppedRate: Result.success({ bytes: droppedMetrics }),
          totalRate: Result.success({ bytes: metrics[0] }),
          totalDroppedRate: Result.success({ bytes: droppedMetrics[0] })
        }}
      />
    );
    await waitFor(() => {
      expect(container.querySelectorAll('.overview-card').length).toBe(1);
    });
  });
});
