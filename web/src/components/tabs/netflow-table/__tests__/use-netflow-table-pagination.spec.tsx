import { act, renderHook } from '@testing-library/react';
import * as React from 'react';

import { Record } from '../../../../api/ipfix';
import { Stats } from '../../../../api/query-response';
import { defaultConfig } from '../../../../model/config';
import { NetflowContext, NetflowContextValue } from '../../../../model/netflow-context';
import { ConfigCapabilities } from '../../../../utils/netflow-capabilities-hook';
import { FlowsSample } from '../../../__tests-data__/flows';
import { useNetflowTablePagination } from '../use-netflow-table-pagination';

const stats: Stats = { numQueries: 1, limitReached: false, dataSources: ['loki'] };

const makeWrapper = (
  getRecords: jest.Mock,
  setFlows: jest.Mock,
  setError = jest.fn()
): React.FC<React.PropsWithChildren> => {
  const context = {
    caps: {
      flowQuery: { limit: 1 },
      fetchFunctions: { getRecords, getMetrics: jest.fn() }
    } as unknown as ConfigCapabilities,
    config: defaultConfig,
    k8sModels: {},
    fetchCallbacks: {
      metricsRef: { current: {} },
      setFlows,
      setMetrics: jest.fn(),
      setError
    }
  } as unknown as NetflowContextValue;

  const Wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
    <NetflowContext.Provider value={context}>{children}</NetflowContext.Provider>
  );
  Wrapper.displayName = 'NetflowTablePaginationTestProvider';
  return Wrapper;
};

describe('useNetflowTablePagination', () => {
  it('uses the relative time range and keeps its initial lower bound for paging', async () => {
    const initialNow = 1_700_000_000_000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(initialNow);
    const initialFlow: Record = {
      ...FlowsSample[0],
      fields: { ...FlowsSample[0].fields, TimeFlowEndMs: initialNow - 30_000 }
    };
    let resolveInitial: ((value: { records: Record[]; stats: Stats }) => void) | undefined;
    const initialResponse = new Promise<{ records: Record[]; stats: Stats }>(resolve => {
      resolveInitial = resolve;
    });
    const getRecords = jest.fn().mockReturnValueOnce(initialResponse).mockResolvedValueOnce({ records: [], stats });
    const wrapper = makeWrapper(getRecords, jest.fn());
    const { result } = renderHook(() => useNetflowTablePagination([]), { wrapper });

    let fetchPromise: Promise<Stats[]> | undefined;
    act(() => {
      fetchPromise = result.current.fetch(60, undefined, false, false);
    });
    expect(getRecords).toHaveBeenCalledWith(
      expect.objectContaining({ timeRange: 60, startTime: undefined, endTime: undefined })
    );
    nowSpy.mockReturnValue(initialNow + 60_000);
    await act(async () => {
      resolveInitial?.({ records: [initialFlow], stats: { ...stats, limitReached: true } });
      await fetchPromise;
    });
    await act(async () => {
      await result.current.fetchOlder();
    });

    expect(getRecords.mock.calls[1][0]).toEqual(expect.objectContaining({ startTime: String(initialNow / 1000 - 60) }));
    nowSpy.mockRestore();
  });

  it('fetches the remainder of a partially returned Loki timestamp second before paging older', async () => {
    const timestamp = Math.floor(Date.now() / 1000) - 30;
    const firstBoundaryFlow: Record = {
      ...FlowsSample[0],
      key: FlowsSample[0].key + 200,
      lokiTimestampNs: String(timestamp * 1_000_000_000),
      fields: { ...FlowsSample[0].fields, SrcAddr: '10.0.0.200', TimeFlowEndMs: timestamp * 1000 }
    };
    const remainingBoundaryFlow: Record = {
      ...firstBoundaryFlow,
      key: firstBoundaryFlow.key + 1,
      fields: { ...firstBoundaryFlow.fields, SrcAddr: '10.0.0.201' }
    };
    const getRecords = jest
      .fn()
      .mockResolvedValueOnce({ records: [firstBoundaryFlow], stats: { ...stats, limitReached: true } })
      .mockResolvedValueOnce({ records: [firstBoundaryFlow], stats: { ...stats, limitReached: true } })
      .mockResolvedValueOnce({ records: [firstBoundaryFlow, remainingBoundaryFlow], stats });
    const setFlows = jest.fn();
    const wrapper = makeWrapper(getRecords, setFlows);
    const { result } = renderHook(() => useNetflowTablePagination([]), { wrapper });

    await act(async () => {
      await result.current.fetch(60, undefined, false, true);
    });
    await act(async () => {
      await result.current.fetchOlder();
    });

    expect(getRecords.mock.calls[1][0]).toEqual(
      expect.objectContaining({ startTime: String(timestamp), endTime: String(timestamp), limit: 1 })
    );
    expect(getRecords.mock.calls[2][0]).toEqual(
      expect.objectContaining({ startTime: String(timestamp), endTime: String(timestamp), limit: 2 })
    );
    expect(setFlows).toHaveBeenLastCalledWith(expect.arrayContaining([firstBoundaryFlow, remainingBoundaryFlow]));
  });

  it('adds newer flows while keeping the loaded flows', async () => {
    const initialFlow = FlowsSample[0];
    const newerFlow: Record = {
      ...initialFlow,
      key: initialFlow.key + 100,
      fields: { ...initialFlow.fields, SrcAddr: '10.0.0.100', TimeFlowEndMs: Date.now() }
    };
    const getRecords = jest
      .fn()
      .mockResolvedValueOnce({ records: [initialFlow], stats })
      .mockResolvedValueOnce({ records: [newerFlow], stats });
    const setFlows = jest.fn();
    const wrapper = makeWrapper(getRecords, setFlows);
    const { result } = renderHook(() => useNetflowTablePagination([]), { wrapper });

    await act(async () => {
      await result.current.fetch(60, undefined, false, false);
    });
    await act(async () => {
      await result.current.fetchNewer();
    });

    expect(setFlows).toHaveBeenLastCalledWith([newerFlow, initialFlow]);
  });

  it('keeps newer flows in the session when the base range refreshes', async () => {
    const initialFlow = FlowsSample[0];
    const newerFlow: Record = {
      ...initialFlow,
      key: initialFlow.key + 101,
      fields: { ...initialFlow.fields, SrcAddr: '10.0.0.101', TimeFlowEndMs: Date.now() }
    };
    const getRecords = jest
      .fn()
      .mockResolvedValueOnce({ records: [initialFlow], stats })
      .mockResolvedValueOnce({ records: [newerFlow], stats })
      .mockResolvedValueOnce({ records: [initialFlow], stats });
    const setFlows = jest.fn();
    const wrapper = makeWrapper(getRecords, setFlows);
    const { result } = renderHook(() => useNetflowTablePagination([]), { wrapper });

    await act(async () => {
      await result.current.fetch(60, undefined, false, false);
    });
    await act(async () => {
      await result.current.fetchNewer();
    });
    await act(async () => {
      await result.current.fetch(60, undefined, false, false);
    });

    expect(setFlows).toHaveBeenLastCalledWith([newerFlow, initialFlow]);
  });

  it('reports older-page errors locally and keeps the loaded flows', async () => {
    const initialFlow = FlowsSample[0];
    const getRecords = jest
      .fn()
      .mockResolvedValueOnce({ records: [initialFlow], stats: { ...stats, limitReached: true } })
      .mockRejectedValueOnce(new Error('older page failed'));
    const setFlows = jest.fn();
    const setError = jest.fn();
    const wrapper = makeWrapper(getRecords, setFlows, setError);
    const { result } = renderHook(() => useNetflowTablePagination([]), { wrapper });

    await act(async () => {
      await result.current.fetch(60, undefined, false, false);
    });
    await act(async () => {
      await result.current.fetchOlder();
    });

    expect(result.current.olderError).toBeDefined();
    expect(setError).not.toHaveBeenCalled();
    expect(setFlows).toHaveBeenLastCalledWith([initialFlow]);
  });

  it('does not publish an older-page response after unmount', async () => {
    const initialFlow = FlowsSample[0];
    const olderFlow: Record = { ...initialFlow, key: initialFlow.key + 102 };
    let resolveOlder: ((value: { records: Record[]; stats: Stats }) => void) | undefined;
    const olderPage = new Promise<{ records: Record[]; stats: Stats }>(resolve => {
      resolveOlder = resolve;
    });
    const getRecords = jest
      .fn()
      .mockResolvedValueOnce({ records: [initialFlow], stats: { ...stats, limitReached: true } })
      .mockReturnValueOnce(olderPage);
    const setFlows = jest.fn();
    const wrapper = makeWrapper(getRecords, setFlows);
    const { result, unmount } = renderHook(() => useNetflowTablePagination([]), { wrapper });

    await act(async () => {
      await result.current.fetch(60, undefined, false, false);
    });
    let pendingFetch: Promise<void> | undefined;
    act(() => {
      pendingFetch = result.current.fetchOlder();
    });
    unmount();

    await act(async () => {
      resolveOlder?.({ records: [olderFlow], stats });
      await pendingFetch;
    });

    expect(setFlows).toHaveBeenCalledTimes(1);
  });

  it('shows the up-to-date status after an empty check at the top', async () => {
    const getRecords = jest
      .fn()
      .mockResolvedValueOnce({ records: [FlowsSample[0]], stats })
      .mockResolvedValueOnce({ records: [], stats });
    const wrapper = makeWrapper(getRecords, jest.fn());
    const { result, unmount } = renderHook(() => useNetflowTablePagination([]), { wrapper });

    await act(async () => {
      await result.current.fetch(60, undefined, false, false);
    });
    await act(async () => {
      await result.current.fetchNewer(true);
    });

    expect(result.current.upToDate).toBe(true);
    unmount();
  });
});
