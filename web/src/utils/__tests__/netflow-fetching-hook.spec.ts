import * as React from 'react';
import { defaultNetflowMetrics, Stats } from '../../api/query-response';
import { canTick, handleQueryError, handleQueryResult, InitState } from '../netflow-fetching-hook';

describe('canTick', () => {
  let consoleDebugSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
  });

  const closedModals = {
    isTRModalOpen: false,
    isOverviewModalOpen: false,
    isColModalOpen: false,
    isExportModalOpen: false
  };

  it('should return true when fully initialized and no modal open', () => {
    const initState = { current: ['initDone', 'configLoaded', 'forcedFiltersLoaded'] as InitState };
    expect(canTick(initState as React.MutableRefObject<InitState>, closedModals)).toBe(true);
  });

  it('should return false when config not loaded', () => {
    const initState = { current: ['initDone', 'forcedFiltersLoaded'] as InitState };
    expect(canTick(initState as React.MutableRefObject<InitState>, closedModals)).toBe(false);
  });

  it('should return false when forcedFilters not loaded', () => {
    const initState = { current: ['initDone', 'configLoaded'] as InitState };
    expect(canTick(initState as React.MutableRefObject<InitState>, closedModals)).toBe(false);
  });

  it('should return false when config load error', () => {
    const initState = {
      current: ['initDone', 'configLoaded', 'forcedFiltersLoaded', 'configLoadError'] as InitState
    };
    expect(canTick(initState as React.MutableRefObject<InitState>, closedModals)).toBe(false);
  });

  it('should return false when time range modal is open', () => {
    const initState = { current: ['initDone', 'configLoaded', 'forcedFiltersLoaded'] as InitState };
    expect(canTick(initState as React.MutableRefObject<InitState>, { ...closedModals, isTRModalOpen: true })).toBe(
      false
    );
  });

  it('should return false when overview modal is open', () => {
    const initState = { current: ['initDone', 'configLoaded', 'forcedFiltersLoaded'] as InitState };
    expect(
      canTick(initState as React.MutableRefObject<InitState>, { ...closedModals, isOverviewModalOpen: true })
    ).toBe(false);
  });

  it('should return false when columns modal is open', () => {
    const initState = { current: ['initDone', 'configLoaded', 'forcedFiltersLoaded'] as InitState };
    expect(canTick(initState as React.MutableRefObject<InitState>, { ...closedModals, isColModalOpen: true })).toBe(
      false
    );
  });

  it('should return false when export modal is open', () => {
    const initState = { current: ['initDone', 'configLoaded', 'forcedFiltersLoaded'] as InitState };
    expect(canTick(initState as React.MutableRefObject<InitState>, { ...closedModals, isExportModalOpen: true })).toBe(
      false
    );
  });
});

describe('handleQueryResult', () => {
  it('should merge stats from multiple queries', () => {
    const setStats = jest.fn();
    const stats1: Stats = { numQueries: 1, limitReached: false, dataSources: ['loki'] };
    const stats2: Stats = { numQueries: 2, limitReached: true, dataSources: ['prom'] };

    handleQueryResult([stats1, stats2], setStats);

    expect(setStats).toHaveBeenCalledWith(
      expect.objectContaining({
        numQueries: 3,
        limitReached: true,
        dataSources: expect.arrayContaining(['loki', 'prom'])
      })
    );
  });

  it('should handle single stats entry', () => {
    const setStats = jest.fn();
    const stats: Stats = { numQueries: 1, limitReached: false, dataSources: ['loki'] };

    handleQueryResult([stats], setStats);

    expect(setStats).toHaveBeenCalledWith(stats);
  });

  it('should set undefined stats for empty array', () => {
    const setStats = jest.fn();
    handleQueryResult([], setStats);
    expect(setStats).toHaveBeenCalledWith(undefined);
  });
});

describe('handleQueryError', () => {
  const makeHandlers = () => ({
    setFlows: jest.fn(),
    setMetrics: jest.fn(),
    setError: jest.fn(),
    setWarning: jest.fn(),
    setChipsPopoverMessage: jest.fn(),
    updateTableFilters: jest.fn()
  });

  const emptyFilters = { match: 'all' as const, list: [] };
  const emptyColumns: never[] = [];

  it('should reset state on generic error', () => {
    const handlers = makeHandlers();
    handleQueryError('Some error', emptyFilters, emptyColumns, undefined, handlers);

    expect(handlers.setFlows).toHaveBeenCalledWith([]);
    expect(handlers.setMetrics).toHaveBeenCalledWith(defaultNetflowMetrics);
    expect(handlers.setError).toHaveBeenCalledWith('Some error');
    expect(handlers.setWarning).toHaveBeenCalledWith(undefined);
    expect(handlers.setChipsPopoverMessage).toHaveBeenCalledWith(undefined);
  });

  it('should handle HTTP error with response data', () => {
    const handlers = makeHandlers();
    const err = { response: { data: 'Server Error' }, toString: () => 'Error' };
    handleQueryError(err, emptyFilters, emptyColumns, undefined, handlers);

    expect(handlers.setFlows).toHaveBeenCalledWith([]);
    expect(handlers.setError).toHaveBeenCalled();
  });
});
