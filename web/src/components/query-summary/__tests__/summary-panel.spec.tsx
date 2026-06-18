import { render, waitFor } from '@testing-library/react';
import * as React from 'react';

import { defaultNetflowMetrics } from '../../../api/query-response';
import { FlowsSample } from '../../../components/__tests-data__/flows';
import { RecordType } from '../../../model/flow-query';
import { SummaryPanelContent } from '../summary-panel-content';

describe('<SummaryPanel />', () => {
  const now = new Date();

  const mocks = {
    onClose: jest.fn(),
    flows: FlowsSample,
    metrics: defaultNetflowMetrics,
    type: 'flowLog' as RecordType,
    stats: {
      limitReached: false,
      numQueries: 1,
      dataSources: ['loki']
    },
    appStats: undefined,
    limit: 5,
    range: 300,
    lastRefresh: now,
    id: 'summary-panel'
  };

  it('should show cardinality', async () => {
    const { container } = render(<SummaryPanelContent {...mocks} />);
    await waitFor(() => {
      expect(container.querySelector('#addresses')).toBeTruthy();
    });

    expect(container.querySelector('#addresses')?.textContent).toBe('5 IP(s)');
    expect(container.querySelector('#ports')?.textContent).toBe('4 Port(s)');
    expect(container.querySelector('#protocols')?.textContent).toBe('1 Protocol(s)');
    expect(container.querySelector('#Pod')?.textContent).toBe('2 Pod(s)');
    expect(container.querySelector('#Namespace')?.textContent).toBe('1 Namespace(s)');
  });
});
