import { act, renderHook } from '@testing-library/react';
import * as React from 'react';

import { FlowDirection, Record } from '../../../../api/ipfix';
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
  setError = jest.fn(),
  limit = 1,
  maxEntriesLimit?: number
): React.FC<React.PropsWithChildren> => {
  const context = {
    caps: {
      flowQuery: { limit },
      fetchFunctions: {
        getRecords,
        getMetrics: jest.fn(),
        getLimits:
          maxEntriesLimit === undefined
            ? undefined
            : jest.fn().mockResolvedValue({
                max_entries_limit_per_query: maxEntriesLimit
              })
      }
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
  it('pins the initial relative query bounds and keeps later refreshes relative', async () => {
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
    const getRecords = jest
      .fn()
      .mockReturnValueOnce(initialResponse)
      .mockResolvedValueOnce({ records: [], stats })
      .mockResolvedValueOnce({ records: [initialFlow], stats });
    const wrapper = makeWrapper(getRecords, jest.fn());
    const { result } = renderHook(() => useNetflowTablePagination([]), { wrapper });

    let fetchPromise: Promise<Stats[]> | undefined;
    act(() => {
      fetchPromise = result.current.fetch(60, undefined, false, false);
    });
    expect(getRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        timeRange: undefined,
        startTime: String(initialNow / 1000 - 60),
        endTime: String(initialNow / 1000)
      })
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
    await act(async () => {
      await result.current.fetch(60, undefined, false, false);
    });
    expect(getRecords.mock.calls[2][0]).toEqual(
      expect.objectContaining({ timeRange: 60, startTime: undefined, endTime: undefined })
    );
    nowSpy.mockRestore();
  });

  it('parses Loki nanosecond timestamps without rounding across a second boundary', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_060_000);
    const boundaryFlow: Record = {
      ...FlowsSample[0],
      lokiTimestampNs: '1699999999999999999',
      fields: { ...FlowsSample[0].fields, TimeFlowEndMs: 1_699_999_999_000 }
    };
    const getRecords = jest
      .fn()
      .mockResolvedValueOnce({ records: [boundaryFlow], stats: { ...stats, limitReached: true } })
      .mockResolvedValueOnce({ records: [boundaryFlow], stats });
    const wrapper = makeWrapper(getRecords, jest.fn());
    const { result } = renderHook(() => useNetflowTablePagination([]), { wrapper });

    await act(async () => {
      await result.current.fetch(60, undefined, false, false);
    });
    await act(async () => {
      await result.current.fetchOlder();
    });

    expect(getRecords.mock.calls[1][0]).toEqual(
      expect.objectContaining({ startTime: '1699999999', endTime: '1699999999' })
    );
    nowSpy.mockRestore();
  });

  it('does not exceed the effective Loki entry limit when a boundary second is too large', async () => {
    const timestamp = Math.floor(Date.now() / 1000) - 30;
    const firstFlow: Record = {
      ...FlowsSample[0],
      key: FlowsSample[0].key + 300,
      lokiTimestampNs: String(timestamp * 1_000_000_000)
    };
    const secondFlow: Record = { ...firstFlow, key: firstFlow.key + 1 };
    const getRecords = jest
      .fn()
      .mockResolvedValueOnce({ records: [firstFlow], stats: { ...stats, limitReached: true } })
      .mockResolvedValueOnce({ records: [firstFlow], stats: { ...stats, limitReached: true } })
      .mockResolvedValueOnce({ records: [firstFlow, secondFlow], stats: { ...stats, limitReached: true } });
    const setFlows = jest.fn();
    const setError = jest.fn();
    const wrapper = makeWrapper(getRecords, setFlows, setError, 4000, 5000);
    const { result } = renderHook(() => useNetflowTablePagination([]), { wrapper });

    await act(async () => {
      await result.current.fetch(60, undefined, false, true);
    });
    await act(async () => {
      await result.current.fetchOlder();
    });

    expect(getRecords).toHaveBeenCalledTimes(3);
    expect(getRecords.mock.calls[1][0].limit).toBe(4000);
    expect(getRecords.mock.calls[2][0].limit).toBe(5000);
    expect(result.current.olderError).toBeDefined();
    expect(setError).not.toHaveBeenCalled();
    expect(setFlows).toHaveBeenLastCalledWith([firstFlow]);
  });

  it('keeps newer-page boundary errors local to the table', async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const initialFlow = FlowsSample[0];
    const newerFlow: Record = {
      ...initialFlow,
      key: initialFlow.key + 500,
      lokiTimestampNs: String(timestamp * 1_000_000_000)
    };
    const getRecords = jest
      .fn()
      .mockResolvedValueOnce({ records: [initialFlow], stats })
      .mockResolvedValueOnce({ records: [newerFlow], stats: { ...stats, limitReached: true } })
      .mockResolvedValueOnce({ records: [newerFlow], stats: { ...stats, limitReached: true } });
    const setFlows = jest.fn();
    const setError = jest.fn();
    const wrapper = makeWrapper(getRecords, setFlows, setError, 1, 1);
    const { result } = renderHook(() => useNetflowTablePagination([]), { wrapper });

    await act(async () => {
      await result.current.fetch(60, undefined, false, false);
    });
    await act(async () => {
      await result.current.fetchNewer();
    });

    expect(result.current.newerError).toBeDefined();
    expect(setError).not.toHaveBeenCalled();
    expect(setFlows).toHaveBeenLastCalledWith([initialFlow]);
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

  it('starts the next older page immediately before a completed timestamp second', async () => {
    const initialNow = 1_700_000_200_000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(initialNow);
    const timestamp = initialNow / 1000 - 80;
    const boundaryFlow: Record = {
      ...FlowsSample[0],
      key: FlowsSample[0].key + 600,
      lokiTimestampNs: String(timestamp * 1_000_000_000)
    };
    const previousSecondFlow: Record = {
      ...boundaryFlow,
      key: boundaryFlow.key + 1,
      lokiTimestampNs: String((timestamp - 1) * 1_000_000_000)
    };
    const getRecords = jest
      .fn()
      .mockResolvedValueOnce({ records: [FlowsSample[0]], stats })
      .mockResolvedValueOnce({ records: [boundaryFlow], stats: { ...stats, limitReached: true } })
      .mockResolvedValueOnce({ records: [boundaryFlow], stats })
      .mockResolvedValueOnce({ records: [previousSecondFlow], stats });
    const wrapper = makeWrapper(getRecords, jest.fn());
    const { result } = renderHook(() => useNetflowTablePagination([]), { wrapper });

    await act(async () => {
      await result.current.fetch(60, undefined, false, true);
    });
    await act(async () => {
      await result.current.fetchOlder();
    });
    await act(async () => {
      await result.current.fetchOlder();
    });

    expect(getRecords.mock.calls[3][0]).toEqual(expect.objectContaining({ endTime: String(timestamp - 1) }));
    nowSpy.mockRestore();
  });

  it('replaces provisional boundary reporters with the completed reporter election', async () => {
    const timestamp = Math.floor(Date.now() / 1000) - 30;
    const provisionalFlow: Record = {
      ...FlowsSample[0],
      key: FlowsSample[0].key + 400,
      labels: { ...FlowsSample[0].labels, FlowDirection: FlowDirection.Ingress },
      lokiTimestampNs: String(timestamp * 1_000_000_000)
    };
    const electedFlow: Record = {
      ...provisionalFlow,
      key: provisionalFlow.key + 1,
      labels: { ...provisionalFlow.labels, FlowDirection: FlowDirection.Egress },
      fields: { ...provisionalFlow.fields, PktDropPackets: 2 }
    };
    const getRecords = jest
      .fn()
      .mockResolvedValueOnce({ records: [provisionalFlow], stats: { ...stats, limitReached: true } })
      .mockResolvedValueOnce({ records: [provisionalFlow, electedFlow], stats });
    const setFlows = jest.fn();
    const wrapper = makeWrapper(getRecords, setFlows);
    const { result } = renderHook(() => useNetflowTablePagination([]), { wrapper });

    await act(async () => {
      await result.current.fetch(60, undefined, false, false);
    });
    await act(async () => {
      await result.current.fetchOlder();
    });

    expect(setFlows).toHaveBeenLastCalledWith([electedFlow]);
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

  it('queries the remaining newer boundary when the next end equals the interval start', async () => {
    const now = 1_700_000_060_000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
    const initialFlow: Record = {
      ...FlowsSample[0],
      fields: { ...FlowsSample[0].fields, TimeFlowEndMs: now - 10_000 }
    };
    const boundaryFlow: Record = {
      ...FlowsSample[0],
      key: FlowsSample[0].key + 102,
      fields: { ...FlowsSample[0].fields, TimeFlowEndMs: now - 29_000 }
    };
    const getRecords = jest
      .fn()
      .mockResolvedValueOnce({ records: [initialFlow], stats })
      .mockResolvedValueOnce({ records: [boundaryFlow], stats: { ...stats, limitReached: true } })
      .mockResolvedValueOnce({ records: [], stats });
    const wrapper = makeWrapper(getRecords, jest.fn());
    const { result } = renderHook(() => useNetflowTablePagination([]), { wrapper });

    await act(async () => {
      await result.current.fetch(60, undefined, false, false);
    });
    await act(async () => {
      await result.current.fetchNewer();
    });

    expect(getRecords.mock.calls[2][0]).toEqual(
      expect.objectContaining({ startTime: String(now / 1000 - 30), endTime: String(now / 1000 - 30) })
    );
    nowSpy.mockRestore();
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
