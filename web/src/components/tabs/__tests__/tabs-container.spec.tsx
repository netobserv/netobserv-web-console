import { render } from '@testing-library/react';
import * as React from 'react';

import { defaultNetflowMetrics } from '../../../api/query-response';
import { defaultConfig } from '../../../model/config';
import { NetflowContext, NetflowContextValue } from '../../../model/netflow-context';
import { ConfigCapabilities } from '../../../utils/netflow-capabilities-hook';
import { TabsContainer } from '../tabs-container';

const baseCaps = {
  allowLoki: true,
  allowProm: true,
  allowS3: true,
  allowMetrics: true,
  allowRawFlows: true,
  isFlowBufferOnly: false,
  isFlow: true,
  isConnectionTracking: false,
  isDNSTracking: false,
  isFlowRTT: false,
  isPktDrop: false,
  isTLSTracking: false,
  isPromOnly: false,
  availableScopes: [],
  allowedMetricTypes: [],
  availablePanels: [],
  selectedPanels: [],
  availableColumns: [],
  selectedColumns: [],
  filterDefs: [],
  quickFilters: [],
  defaultFilters: [],
  flowQuery: {},
  fetchFunctions: {}
} as unknown as ConfigCapabilities;

const renderTabs = (capsOverrides: Partial<ConfigCapabilities> = {}) => {
  const caps = { ...baseCaps, ...capsOverrides };
  const ctx: NetflowContextValue = {
    caps,
    config: defaultConfig,
    k8sModels: {},
    fetchCallbacks: {
      metricsRef: { current: defaultNetflowMetrics },
      setFlows: jest.fn(),
      setMetrics: jest.fn(),
      setError: jest.fn()
    }
  };
  const selectView = jest.fn();
  const result = render(
    <NetflowContext.Provider value={ctx}>
      <TabsContainer
        selectedViewId="table"
        selectView={selectView}
        showHistogram={false}
        setShowViewOptions={jest.fn()}
        setShowHistogram={jest.fn()}
        setHistogramRange={jest.fn()}
        isShowViewOptions={false}
      />
    </NetflowContext.Provider>
  );
  return { ...result, selectView };
};

describe('<TabsContainer />', () => {
  const isTabAriaDisabled = (container: HTMLElement, tabClass: string) =>
    container.querySelector(`.${tabClass} [aria-disabled="true"]`) !== null ||
    container.querySelector(`.${tabClass}[aria-disabled="true"]`) !== null;

  it('enables Overview and Topology when metrics backends are available', () => {
    const { container } = renderTabs({ allowMetrics: true, allowRawFlows: true });
    expect(isTabAriaDisabled(container, 'overviewTabButton')).toBe(false);
    expect(isTabAriaDisabled(container, 'topologyTabButton')).toBe(false);
    expect(isTabAriaDisabled(container, 'tableTabButton')).toBe(false);
  });

  it('disables Overview and Topology when only S3 raw store is available (no Prom/Loki)', () => {
    const { container } = renderTabs({
      allowMetrics: false,
      allowRawFlows: true,
      allowLoki: false,
      allowProm: false
    });
    expect(isTabAriaDisabled(container, 'overviewTabButton')).toBe(true);
    expect(isTabAriaDisabled(container, 'topologyTabButton')).toBe(true);
    expect(isTabAriaDisabled(container, 'tableTabButton')).toBe(false);
  });

  it('disables Traffic flows when raw flows are unavailable', () => {
    const { container } = renderTabs({ allowMetrics: true, allowRawFlows: false });
    expect(isTabAriaDisabled(container, 'tableTabButton')).toBe(true);
    expect(isTabAriaDisabled(container, 'overviewTabButton')).toBe(false);
  });
});
