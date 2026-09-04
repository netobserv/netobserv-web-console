import {
  formatContextTabTitle,
  getHealthContextDefinition,
  getHealthContextTabFromAnnotations,
  getRuleHealthContextId,
  isExcludedFromNetobservHealth,
  isValidHealthContextId,
  NETOBSERV_CONTEXT_NETOBSERV,
  NETOBSERV_CONTEXT_OVN,
  sortContextTabIds
} from '../health-context';

describe('health-context', () => {
  it('routes legacy OVN allowlisted names to the ovn tab', () => {
    expect(getRuleHealthContextId({ name: 'NorthboundStale', labels: {}, annotations: {} })).toBe(
      NETOBSERV_CONTEXT_OVN
    );
    expect(getRuleHealthContextId({ name: 'NetObservNoFlows', labels: {}, annotations: {} })).toBe(
      NETOBSERV_CONTEXT_NETOBSERV
    );
  });

  it('routes label and annotation context tabs', () => {
    expect(
      getRuleHealthContextId({
        name: 'FutureOvnAlert',
        labels: { netobserv_io_health_context: NETOBSERV_CONTEXT_OVN, netobserv: 'true' },
        annotations: {}
      })
    ).toBe(NETOBSERV_CONTEXT_OVN);
    expect(
      getRuleHealthContextId({
        name: 'KialiControlPlaneDown',
        labels: { netobserv_io_health_context: 'kiali', netobserv: 'true' },
        annotations: {}
      })
    ).toBe('kiali');
    expect(
      getRuleHealthContextId({
        name: 'ThirdPartyAlert',
        labels: {},
        annotations: {
          netobserv_io_network_health: JSON.stringify({ contextTab: 'kiali' })
        }
      })
    ).toBe('kiali');
  });

  it('excludes non-netobserv contexts from scored health', () => {
    expect(
      isExcludedFromNetobservHealth({
        name: 'KialiControlPlaneDown',
        labels: { netobserv_io_health_context: 'kiali' },
        annotations: {}
      })
    ).toBe(true);
    expect(
      isExcludedFromNetobservHealth({
        name: 'NetObservNoFlows',
        labels: { netobserv: 'true' },
        annotations: { netobserv_io_network_health: '{}' }
      })
    ).toBe(false);
  });

  it('sorts context tabs with netobserv first, ovn second, then others', () => {
    expect(sortContextTabIds(['kiali', NETOBSERV_CONTEXT_OVN, NETOBSERV_CONTEXT_NETOBSERV])).toEqual([
      NETOBSERV_CONTEXT_NETOBSERV,
      NETOBSERV_CONTEXT_OVN,
      'kiali'
    ]);
  });

  it('describes built-in and third-party contexts', () => {
    expect(getHealthContextDefinition(NETOBSERV_CONTEXT_NETOBSERV).scored).toBe(true);
    expect(getHealthContextDefinition(NETOBSERV_CONTEXT_OVN).scored).toBe(false);
    expect(getHealthContextDefinition('kiali').kind).toBe('readonly-alerts');
    expect(formatContextTabTitle('kiali')).toBe('Kiali');
  });

  it('parses contextTab from health metadata annotation', () => {
    expect(
      getHealthContextTabFromAnnotations({
        netobserv_io_network_health: JSON.stringify({ contextTab: 'ovn' })
      })
    ).toBe('ovn');
  });

  it('rejects unsafe or invalid context tab identifiers', () => {
    expect(isValidHealthContextId('kiali')).toBe(true);
    expect(isValidHealthContextId('')).toBe(false);
    expect(isValidHealthContextId('__proto__')).toBe(false);
    expect(
      getRuleHealthContextId({
        name: 'BadLabel',
        labels: { netobserv_io_health_context: '__proto__' },
        annotations: {}
      })
    ).toBe(NETOBSERV_CONTEXT_NETOBSERV);
    expect(
      getRuleHealthContextId({
        name: 'BadAnnotation',
        labels: {},
        annotations: { netobserv_io_network_health: JSON.stringify({ contextTab: 'bad id' }) }
      })
    ).toBe(NETOBSERV_CONTEXT_NETOBSERV);
  });
});
