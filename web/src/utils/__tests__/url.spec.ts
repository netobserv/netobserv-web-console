import { flowCollectorPath, getFlowCollectorResourceName, isFlowCollectorCreatePath } from '../url';

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
