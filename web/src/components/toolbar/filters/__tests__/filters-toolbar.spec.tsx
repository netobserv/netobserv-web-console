import { act, fireEvent, render, waitFor } from '@testing-library/react';
import * as React from 'react';

import { FilterDefinitionSample } from '../../../../components/__tests-data__/filters';
import { defaultConfig } from '../../../../model/config';
import { NetflowContext, NetflowContextValue } from '../../../../model/netflow-context';
import { ConfigCapabilities } from '../../../../utils/netflow-capabilities-hook';
import FiltersToolbar, { FiltersToolbarProps } from '../../../toolbar/filters-toolbar';

const testCaps = {
  allowLoki: true,
  allowProm: true,
  isFlow: true,
  isConnectionTracking: true,
  isDNSTracking: false,
  isFlowRTT: false,
  isPktDrop: true,
  isTLSTracking: false,
  isPromOnly: false,
  availableScopes: [],
  allowedMetricTypes: [],
  availablePanels: [],
  selectedPanels: [],
  availableColumns: [],
  selectedColumns: [],
  filterDefs: FilterDefinitionSample,
  quickFilters: [],
  defaultFilters: [],
  flowQuery: {},
  fetchFunctions: {}
} as unknown as ConfigCapabilities;

import { defaultNetflowMetrics } from '../../../../api/query-response';
import { FetchCallbacks } from '../../../../model/netflow-context';

const testFetchCallbacks: FetchCallbacks = {
  metricsRef: { current: defaultNetflowMetrics },
  setFlows: jest.fn(),
  setMetrics: jest.fn(),
  setError: jest.fn()
};

const testContext: NetflowContextValue = {
  caps: testCaps,
  config: defaultConfig,
  k8sModels: {},
  fetchCallbacks: testFetchCallbacks
};

describe('<FiltersToolbar />', () => {
  const props: FiltersToolbarProps = {
    filters: { match: 'all', list: [] },
    forcedFilters: undefined,
    skipTipsDelay: true,
    setFilters: jest.fn(),
    clearFilters: jest.fn(),
    resetFilters: jest.fn(),
    id: 'filter-toolbar',
    queryOptionsProps: {
      limit: 100,
      recordType: 'allConnections',
      dataSource: 'auto',
      allowFlow: true,
      allowConnection: true,
      allowProm: true,
      allowLoki: true,
      allowPktDrops: true,
      useTopK: false,
      packetLoss: 'all',
      setLimit: jest.fn(),
      setPacketLoss: jest.fn(),
      setRecordType: jest.fn(),
      setDataSource: jest.fn()
    },
    isFullScreen: false,
    setFullScreen: jest.fn()
  };

  beforeEach(() => {
    props.setFilters = jest.fn();
    props.clearFilters = jest.fn();
  });

  const withContext = (ui: React.ReactElement) => (
    <NetflowContext.Provider value={testContext}>{ui}</NetflowContext.Provider>
  );

  it('should render component', async () => {
    const { container } = render(withContext(<FiltersToolbar {...props} />));
    expect(container.querySelector('.pf-v5-c-toolbar')).toBeTruthy();
  });

  it('should open and close search popper', async () => {
    const { container } = render(withContext(<FiltersToolbar {...props} />));

    await act(async () => {
      fireEvent.click(container.querySelector('[aria-label="Open advanced search"]')!);
    });
    await waitFor(() => {
      expect(document.querySelector('#filter-popper')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(container.querySelector('[aria-label="Open advanced search"]')!);
    });

    expect(props.setFilters).toHaveBeenCalledTimes(0);
  });

  it('should open column dropdown in popper', async () => {
    const { container } = render(withContext(<FiltersToolbar {...props} />));

    await act(async () => {
      fireEvent.click(container.querySelector('[aria-label="Open advanced search"]')!);
    });
    await waitFor(() => {
      expect(document.querySelector('#filter-popper')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(document.querySelector('#column-filter-toggle')!);
    });
    await waitFor(() => {
      expect(document.querySelectorAll('.column-filter-item').length).toBeGreaterThan(0);
    });
  });
});
