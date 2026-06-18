import { useResolvedExtensions } from '@openshift-console/dynamic-plugin-sdk';
import { render, waitFor } from '@testing-library/react';
import * as React from 'react';
import { AlertsResult, SilencedAlert } from '../../api/alert';
import { FlowMetricsResult, GenericMetricsResult } from '../../api/query-response';
import { getConfig } from '../../api/routes';
import { FullConfigResultSample } from '../__tests-data__/config';
import { extensionsMock } from '../__tests-data__/extensions';
import { PodTabParam, ServiceTabParam, UnknownTabParam } from '../__tests-data__/tabs';
import NetflowTrafficTab from '../netflow-traffic-tab';

const useResolvedExtensionsMock = useResolvedExtensions as jest.Mock;

jest.mock('../../api/routes', () => ({
  getConfig: jest.fn(() => Promise.resolve(FullConfigResultSample)),
  getRole: jest.fn(() => Promise.resolve('admin')),
  getFlowRecords: jest.fn(() => Promise.resolve([])),
  getFlowMetrics: jest.fn(() =>
    Promise.resolve({
      metrics: [],
      stats: { numQueries: 0, limitReached: false, dataSources: ['loki'] }
    } as FlowMetricsResult)
  ),
  getFlowGenericMetrics: jest.fn(() =>
    Promise.resolve({
      metrics: [],
      stats: { numQueries: 0, limitReached: false, dataSources: ['loki'] }
    } as GenericMetricsResult)
  ),
  getAlerts: jest.fn(() => Promise.resolve({ data: { groups: [] }, status: 'success' } as AlertsResult)),
  getSilencedAlerts: jest.fn(() => Promise.resolve([] as SilencedAlert[]))
}));

const getConfigMock = getConfig as jest.Mock;

describe('<NetflowTrafficTab />', () => {
  beforeAll(() => {
    useResolvedExtensionsMock.mockReturnValue(extensionsMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should mount component for Pod', async () => {
    render(<NetflowTrafficTab obj={PodTabParam} />);
    await waitFor(() => {
      expect(getConfigMock).toHaveBeenCalled();
    });
  });

  it('should mount component for Service', async () => {
    render(<NetflowTrafficTab obj={ServiceTabParam} />);
    await waitFor(() => {
      expect(getConfigMock).toHaveBeenCalled();
    });
  });

  it('should handle unknown kind', async () => {
    render(<NetflowTrafficTab obj={UnknownTabParam} />);
    await waitFor(() => {
      expect(getConfigMock).toHaveBeenCalled();
    });
  });
});
