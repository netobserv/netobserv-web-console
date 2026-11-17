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

const makeWrapper = (getRecords: jest.Mock, setFlows: jest.Mock): React.FC<React.PropsWithChildren> => {
  const context = {
    caps: {
      flowQuery: {},
      fetchFunctions: { getRecords, getMetrics: jest.fn() }
    } as unknown as ConfigCapabilities,
    config: defaultConfig,
    k8sModels: {},
    fetchCallbacks: {
      metricsRef: { current: {} },
      setFlows,
      setMetrics: jest.fn(),
      setError: jest.fn()
    }
  } as unknown as NetflowContextValue;

  const Wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
    <NetflowContext.Provider value={context}>{children}</NetflowContext.Provider>
  );
  Wrapper.displayName = 'NetflowTablePaginationTestProvider';
  return Wrapper;
};

describe('useNetflowTablePagination', () => {
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
