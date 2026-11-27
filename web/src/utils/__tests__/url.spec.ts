import { ContextSingleton } from '../context';
import {
  flowCollectorPath,
  flowMetricPath,
  getFlowCollectorResourceName,
  isFlowCollectorCreatePath,
  isFlowCollectorWizardPath,
  isFlowMetricWizardPath
} from '../url';

describe('isFlowCollectorCreatePath', () => {
  it('should recognize ~new and setup as create routes', () => {
    expect(isFlowCollectorCreatePath(flowCollectorPath('new'))).toBe(true);
    expect(isFlowCollectorCreatePath(flowCollectorPath('setup'))).toBe(true);
  });

  it('should not treat status or edit paths as create routes', () => {
    expect(isFlowCollectorCreatePath(flowCollectorPath('status'))).toBe(false);
    expect(isFlowCollectorCreatePath(flowCollectorPath('edit'))).toBe(false);
  });
});

describe('editor view routes', () => {
  it('recognizes FlowCollector setup and operator create routes as wizard views', () => {
    expect(isFlowCollectorWizardPath('/k8s/cluster/flows.netobserv.io~v1beta2~FlowCollector/setup')).toBe(true);
    expect(
      isFlowCollectorWizardPath(
        '/k8s/ns/netobserv/operators.coreos.com~v1alpha1~ClusterServiceVersion/netobserv/flows.netobserv.io~v1beta2~FlowCollector/~new'
      )
    ).toBe(true);
    expect(isFlowCollectorWizardPath('/k8s/cluster/flows.netobserv.io~v1beta2~FlowCollector/edit')).toBe(false);
  });

  it('recognizes FlowMetric operator create routes as wizard views', () => {
    expect(
      isFlowMetricWizardPath(
        '/k8s/ns/netobserv/operators.coreos.com~v1alpha1~ClusterServiceVersion/netobserv/flows.netobserv.io~v1alpha1~FlowMetric/~new'
      )
    ).toBe(true);
    expect(isFlowMetricWizardPath('/k8s/cluster/flows.netobserv.io~v1alpha1~FlowMetric/~new')).toBe(false);
  });
});

describe('getFlowCollectorResourceName', () => {
  it('should return undefined on create routes', () => {
    expect(getFlowCollectorResourceName(flowCollectorPath('new'))).toBeUndefined();
    expect(getFlowCollectorResourceName(flowCollectorPath('setup'))).toBeUndefined();
  });

  it('should resolve edit and cluster segments to cluster', () => {
    expect(getFlowCollectorResourceName('/k8s/cluster/flows.netobserv.io~v1beta2~FlowCollector/edit')).toBe('cluster');
    expect(getFlowCollectorResourceName('/k8s/cluster/flows.netobserv.io~v1beta2~FlowCollector/cluster')).toBe(
      'cluster'
    );
  });
});

describe('resource editor paths', () => {
  it('returns plugin paths by default', () => {
    expect(flowCollectorPath('setup')).toBe('/k8s/cluster/flows.netobserv.io~v1beta2~FlowCollector/setup');
    expect(flowCollectorPath('status')).toBe('/k8s/cluster/flows.netobserv.io~v1beta2~FlowCollector/status');
    expect(flowMetricPath()).toBe('/k8s/cluster/flows.netobserv.io~v1alpha1~FlowMetric/~new');
  });

  it('returns standalone paths when running standalone', () => {
    const isStandaloneSpy = jest.spyOn(ContextSingleton, 'isStandalone').mockReturnValue(true);

    expect(flowCollectorPath('new')).toBe('/console-flowCollector');
    expect(flowCollectorPath('edit')).toBe('/console-flowCollector');
    expect(flowCollectorPath('setup')).toBe('/console-flowCollector-wizard');
    expect(flowCollectorPath('status')).toBe('/console-flowCollector-status');
    expect(flowMetricPath()).toBe('/console-flowMetric');

    isStandaloneSpy.mockRestore();
  });
});
