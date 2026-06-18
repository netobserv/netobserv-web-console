import { useResolvedExtensions } from '@openshift-console/dynamic-plugin-sdk';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import * as React from 'react';
import { AlertsResult, SilencedAlert } from '../../api/alert';
import { FlowMetricsResult, GenericMetricsResult } from '../../api/query-response';
import { getConfig, getFlowGenericMetrics, getFlowMetrics, getFlowRecords, getRole } from '../../api/routes';
import { FlowQuery } from '../../model/flow-query';
import { FullConfigResultSample, SimpleConfigResultSample } from '../__tests-data__/config';
import { extensionsMock } from '../__tests-data__/extensions';
import { FlowsResultSample } from '../__tests-data__/flows';
import NetflowTraffic from '../netflow-traffic';
import NetflowTrafficParent from '../netflow-traffic-parent';

const useResolvedExtensionsMock = useResolvedExtensions as jest.Mock;

jest.mock('../../api/routes', () => ({
  getConfig: jest.fn(() => Promise.resolve(FullConfigResultSample)),
  getRole: jest.fn(() => Promise.resolve('admin')),
  getFlowRecords: jest.fn(() => Promise.resolve(FlowsResultSample)),
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
const getRoleMock = getRole as jest.Mock;
const getFlowsMock = getFlowRecords as jest.Mock;
const getMetricsMock = getFlowMetrics as jest.Mock;
const getGenericMetricsMock = getFlowGenericMetrics as jest.Mock;

const defaultQuery = {
  aggregateBy: 'namespace',
  filters: '',
  groups: undefined,
  limit: 5,
  packetLoss: 'all',
  rateInterval: '30s',
  recordType: 'flowLog',
  dataSource: 'auto',
  step: '15s',
  timeRange: 300
} as FlowQuery;

describe('<NetflowTraffic />', () => {
  beforeAll(() => {
    useResolvedExtensionsMock.mockReturnValue(extensionsMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render component', async () => {
    const { container } = render(<NetflowTrafficParent />);
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });
    expect(container.firstChild).toBeTruthy();
  });

  it('should render refresh components', async () => {
    const { container } = render(<NetflowTraffic />);
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });
    expect(container.querySelector('#refresh-dropdown-container')).toBeTruthy();
    expect(container.querySelector('#refresh-button')).toBeTruthy();
  });

  it('should load default metrics on button click', async () => {
    const { container } = render(<NetflowTrafficParent />);
    const expectedMetricsQueries: FlowQuery[] = [
      { ...defaultQuery, function: 'rate', type: 'Bytes' },
      { ...defaultQuery, function: 'rate', type: 'Packets' },
      { ...defaultQuery, function: 'rate', aggregateBy: 'app', type: 'Bytes' },
      { ...defaultQuery, function: 'rate', aggregateBy: 'app', type: 'Packets' },
      { ...defaultQuery, function: 'rate', type: 'PktDropPackets' },
      { ...defaultQuery, function: 'rate', aggregateBy: 'app', type: 'PktDropPackets' },
      { ...defaultQuery, function: 'avg', type: 'DnsLatencyMs' },
      { ...defaultQuery, function: 'p90', type: 'DnsLatencyMs' },
      { ...defaultQuery, function: 'avg', aggregateBy: 'app', type: 'DnsLatencyMs' },
      { ...defaultQuery, function: 'p90', aggregateBy: 'app', type: 'DnsLatencyMs' },
      { ...defaultQuery, function: 'avg', type: 'TimeFlowRttNs' },
      { ...defaultQuery, function: 'min', type: 'TimeFlowRttNs' },
      { ...defaultQuery, function: 'p90', type: 'TimeFlowRttNs' },
      { ...defaultQuery, function: 'avg', aggregateBy: 'app', type: 'TimeFlowRttNs' },
      { ...defaultQuery, function: 'min', aggregateBy: 'app', type: 'TimeFlowRttNs' },
      { ...defaultQuery, function: 'p90', aggregateBy: 'app', type: 'TimeFlowRttNs' }
    ];
    const expectedGenericMetricsQueries: FlowQuery[] = [
      { ...defaultQuery, function: 'rate', type: 'PktDropPackets', aggregateBy: 'PktDropLatestState' },
      { ...defaultQuery, function: 'rate', type: 'PktDropPackets', aggregateBy: 'PktDropLatestDropCause' },
      { ...defaultQuery, function: 'count', type: 'DnsFlows', aggregateBy: 'DnsName' },
      { ...defaultQuery, function: 'count', type: 'DnsFlows', aggregateBy: 'DnsFlagsResponseCode' },
      { ...defaultQuery, function: 'count', type: 'DnsFlows', aggregateBy: 'app' }
    ];

    await waitFor(() => {
      expect(getConfigMock).toHaveBeenCalledTimes(1);
      expect(getRoleMock).toHaveBeenCalledTimes(1);
      expect(getFlowsMock).toHaveBeenCalledTimes(0);
      expect(getMetricsMock).toHaveBeenCalledTimes(expectedMetricsQueries.length);
      expectedMetricsQueries.forEach((q, i) =>
        expect(getMetricsMock).toHaveBeenNthCalledWith(i + 1, q, defaultQuery.timeRange)
      );
      expect(getGenericMetricsMock).toHaveBeenCalledTimes(expectedGenericMetricsQueries.length);
    });

    await act(async () => {
      fireEvent.click(container.querySelector('#refresh-button')!);
    });

    await waitFor(() => {
      expect(getConfigMock).toHaveBeenCalledTimes(1);
      expect(getRoleMock).toHaveBeenCalledTimes(1);
      expect(getFlowsMock).toHaveBeenCalledTimes(0);
      expect(getMetricsMock).toHaveBeenCalledTimes(expectedMetricsQueries.length * 2);
      expect(getGenericMetricsMock).toHaveBeenCalledTimes(expectedGenericMetricsQueries.length * 2);
    });
  });

  it('should render toolbar components when config loaded', async () => {
    const { container } = render(<NetflowTrafficParent />);
    await waitFor(() => {
      expect(getConfigMock).toHaveBeenCalled();
      expect(getRoleMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(container.querySelector('#filter-toolbar')).toBeTruthy();
    });
  });

  it('should load basic metrics on button click', async () => {
    getConfigMock.mockReturnValue(Promise.resolve(SimpleConfigResultSample));

    const { container } = render(<NetflowTrafficParent />);
    await waitFor(() => {
      expect(getConfigMock).toHaveBeenCalledTimes(1);
      expect(getRoleMock).toHaveBeenCalledTimes(1);
      expect(getFlowsMock).toHaveBeenCalledTimes(0);
      expect(getMetricsMock).toHaveBeenCalledTimes(2);
      expect(getGenericMetricsMock).toHaveBeenCalledTimes(0);
    });

    await act(async () => {
      fireEvent.click(container.querySelector('#refresh-button')!);
    });

    await waitFor(() => {
      expect(getConfigMock).toHaveBeenCalledTimes(1);
      expect(getRoleMock).toHaveBeenCalledTimes(1);
      expect(getFlowsMock).toHaveBeenCalledTimes(0);
      expect(getMetricsMock).toHaveBeenCalledTimes(4);
      expect(getGenericMetricsMock).toHaveBeenCalledTimes(0);
    });
  });
});
