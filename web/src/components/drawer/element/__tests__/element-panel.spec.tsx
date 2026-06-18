import { Drawer, DrawerContent } from '@patternfly/react-core';
import { BaseEdge, BaseNode, NodeModel } from '@patternfly/react-topology';
import { fireEvent, render, waitFor } from '@testing-library/react';
import * as React from 'react';

import { TopologyMetrics } from '../../../../api/query-response';
import { Filters } from '../../../../model/filters';
import { FlowScope, MetricType } from '../../../../model/flow-query';
import { NodeData } from '../../../../model/topology';
import { createPeer } from '../../../../utils/metrics';
import { FilterDefinitionSample } from '../../../__tests-data__/filters';
import { TruncateLength } from '../../../dropdowns/truncate-dropdown';
import { dataSample } from '../../../tabs/netflow-topology/__tests-data__/metrics';
import { ElementPanel } from '../element-panel';
import { ElementPanelContent } from '../element-panel-content';
import { ElementPanelMetrics } from '../element-panel-metrics';

describe('<ElementPanel />', () => {
  const getNode = (kind: string, name: string, addr: string) => {
    const bn = new BaseNode<NodeModel, NodeData>();
    bn.setData({
      nodeType: 'resource',
      peer: createPeer({
        addr: addr,
        resource: { name, type: kind }
      })
    });
    return bn;
  };

  const getEdge = () => {
    const be = new BaseEdge();
    be.setSource(getNode('Pod', 'flowlogs-pipeline-69b6669d59-f76sh', '10.131.0.18'));
    be.setTarget(getNode('Service', 'dns-default', '172.30.0.10'));
    return be;
  };

  const mocks = {
    element: getNode('Pod', 'loki-distributor-loki-76598c8449-csmh2', '10.129.0.15'),
    metrics: dataSample as TopologyMetrics[],
    droppedMetrics: [],
    metricType: 'Bytes' as MetricType,
    metricScope: 'resource' as FlowScope,
    filters: { list: [], match: 'all' } as Filters,
    filterDefinitions: FilterDefinitionSample,
    setFilters: jest.fn(),
    onClose: jest.fn(),
    truncateLength: TruncateLength.M,
    id: 'element-panel-test'
  };

  it('should render component', async () => {
    const { container } = render(<ElementPanel {...mocks} />);
    expect(container.querySelector('#element-panel-test')).toBeTruthy();
  });

  it('should close on click', async () => {
    render(
      <Drawer isExpanded>
        <DrawerContent panelContent={<ElementPanel {...mocks} />}>
          <div />
        </DrawerContent>
      </Drawer>
    );
    await waitFor(() => {
      expect(document.querySelector('[data-test-id="drawer-close-button"]')).toBeTruthy();
    });
    fireEvent.click(document.querySelector('[data-test-id="drawer-close-button"]')!);
    expect(mocks.onClose).toHaveBeenCalled();
  });

  it('should render element details', async () => {
    const { container, rerender } = render(<ElementPanelContent {...mocks} />);
    await waitFor(() => {
      expect(container.querySelector('#node-info-address')).toBeTruthy();
    });
    expect(container.querySelector('#node-info-address')?.textContent).toContain('10.129.0.15');

    rerender(<ElementPanelContent {...mocks} element={getEdge()} />);
    await waitFor(() => {
      expect(container.querySelector('#source-content')).toBeTruthy();
    });
    expect(container.querySelector('#source-content')?.textContent).toContain('10.131.0.18');
    expect(container.querySelector('#destination-content')?.textContent).toContain('172.30.0.10');
  });

  it('should show TLS block on edge when tagTlsSecure is set', async () => {
    const edge = getEdge();
    edge.setData({ tagTlsSecure: true });
    const { container } = render(<ElementPanelContent {...mocks} element={edge} />);
    await waitFor(() => {
      expect(container.querySelector('#edge-tls-info')).toBeTruthy();
    });
    expect(container.querySelector('#edge-tls-info')?.textContent).toContain('TLS-encrypted traffic was observed');
  });

  it('should list TLS versions on edge when tlsVersionLabels are set', async () => {
    const edge = getEdge();
    edge.setData({ tagTlsSecure: true, tlsVersionLabels: ['TLS 1.3', 'TLS 1.2'] });
    const { container } = render(<ElementPanelContent {...mocks} element={edge} />);
    await waitFor(() => {
      expect(container.querySelector('#edge-tls-info')).toBeTruthy();
    });
    expect(container.querySelector('#edge-tls-info')?.textContent).toContain('TLS 1.3');
    expect(container.querySelector('#edge-tls-info')?.textContent).toContain('TLS 1.2');
  });

  it('should list TLS groups on edge when tlsGroupLabels are set', async () => {
    const edge = getEdge();
    edge.setData({
      tagTlsSecure: true,
      tlsVersionLabels: ['TLS 1.3'],
      tlsGroupLabels: ['X25519MLKEM768', 'X25519']
    });
    const { container } = render(<ElementPanelContent {...mocks} element={edge} />);
    await waitFor(() => {
      expect(container.querySelector('#edge-tls-info')).toBeTruthy();
    });
    expect(container.querySelector('#edge-tls-info')?.textContent).toContain('X25519MLKEM768');
    expect(container.querySelector('#edge-tls-info')?.textContent).toContain('X25519');
  });

  it('should show TLS block on edge when only tlsGroupLabels are set', async () => {
    const edge = getEdge();
    edge.setData({ tlsGroupLabels: ['X25519'] });
    const { container } = render(<ElementPanelContent {...mocks} element={edge} />);
    await waitFor(() => {
      expect(container.querySelector('#edge-tls-info')).toBeTruthy();
    });
    expect(container.querySelector('#edge-tls-info')?.textContent).toContain('X25519');
  });

  it('should render node metrics', async () => {
    const { container } = render(
      <ElementPanelMetrics
        metricType={mocks.metricType}
        metrics={mocks.metrics}
        aData={mocks.element.getData()!}
        truncateLength={TruncateLength.M}
        isGroup={false}
      />
    );
    await waitFor(() => {
      expect(container.querySelector('#metrics-stats-total-in')).toBeTruthy();
    });
    expect(container.querySelector('#metrics-stats-total-in')?.textContent).toBe('94.7 MB');
    expect(container.querySelector('#metrics-stats-avg-in')?.textContent).toBe('332.4 kBps');
    expect(container.querySelector('#metrics-stats-latest-in')?.textContent).toBe('0 Bps');
    expect(container.querySelector('#metrics-stats-total-out')?.textContent).toBe('4.1 MB');
    expect(container.querySelector('#metrics-stats-avg-out')?.textContent).toBe('14.3 kBps');
    expect(container.querySelector('#metrics-stats-latest-out')?.textContent).toBe('0 Bps');
  });

  it('should render edge metrics a->b', async () => {
    const edge = getEdge();
    const { container } = render(
      <ElementPanelMetrics
        metricType={mocks.metricType}
        metrics={mocks.metrics}
        aData={edge.getSource().getData()}
        bData={edge.getTarget().getData()}
        truncateLength={TruncateLength.M}
        isGroup={false}
      />
    );
    await waitFor(() => {
      expect(container.querySelector('#metrics-stats-total-in')).toBeTruthy();
    });
    expect(container.querySelector('#metrics-stats-total-in')?.textContent).toBe('1.1 MB');
    expect(container.querySelector('#metrics-stats-avg-in')?.textContent).toBe('3.9 kBps');
    expect(container.querySelector('#metrics-stats-total-out')?.textContent).toBe('4.5 MB');
    expect(container.querySelector('#metrics-stats-avg-out')?.textContent).toBe('15.9 kBps');
  });
});
