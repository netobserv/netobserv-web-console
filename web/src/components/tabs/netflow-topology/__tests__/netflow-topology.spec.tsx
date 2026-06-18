import { render } from '@testing-library/react';
import * as React from 'react';

import { TopologyMetrics } from '../../../../api/query-response';
import { FilterDefinitionSample } from '../../../../components/__tests-data__/filters';
import { ScopeDefSample } from '../../../../components/__tests-data__/scopes';
import { Config } from '../../../../model/config';
import { Filters } from '../../../../model/filters';
import { FlowScope, MetricType, StatFunction } from '../../../../model/flow-query';
import { DefaultOptions, LayoutName } from '../../../../model/topology';
import { defaultTimeRange } from '../../../../utils/router';
import { buildStats } from '../../../health/health-helper';
import { NetflowTopology } from '../netflow-topology';

describe('<NetflowTopology />', () => {
  const mocks = {
    error: undefined as string | undefined,
    loading: false,
    k8sModels: {},
    range: defaultTimeRange,
    metricFunction: 'sum' as StatFunction,
    metricType: 'Bytes' as MetricType,
    metricScope: 'host' as FlowScope,
    setMetricScope: jest.fn(),
    metrics: [] as TopologyMetrics[],
    droppedMetrics: [] as TopologyMetrics[],
    layout: LayoutName.cola,
    options: DefaultOptions,
    setOptions: jest.fn(),
    lowScale: 0.3,
    medScale: 0.5,
    filters: { match: 'all', list: [] } as Filters,
    filterDefinitions: FilterDefinitionSample,
    setFilters: jest.fn(),
    toggleTopologyOptions: jest.fn(),
    selected: undefined,
    onSelect: jest.fn(),
    searchHandle: null,
    searchEvent: undefined,
    scopes: ScopeDefSample,
    expectedNodes: [],
    resourceStats: buildStats([]),
    config: {} as Config
  };

  it('should render component', async () => {
    const { container } = render(<NetflowTopology {...mocks} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('should render loading', async () => {
    const { container } = render(<NetflowTopology {...mocks} loading={true} />);
    expect(container.querySelector('.pf-v5-c-spinner')).toBeTruthy();
  });
});
