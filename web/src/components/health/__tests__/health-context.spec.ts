import {
  formatContextTabTitle,
  getHealthContextDefinition,
  getHealthContextTabFromAnnotations,
  getRuleHealthContextId,
  isExcludedFromNetobservHealth,
  isValidHealthContextId,
  NETOBSERV_CONTEXT_NETOBSERV,
  NETOBSERV_CONTEXT_OVN,
  parseHealthContextAnnotation,
  sortContextTabIds
} from '../health-context';

const annotation = (config: object) => ({ netobserv_io_network_health: JSON.stringify(config) });

describe('health-context', () => {
  it('routes rules by their health annotation contextTab', () => {
    expect(getRuleHealthContextId({ annotations: annotation({ contextTab: 'ovn' }) })).toBe(NETOBSERV_CONTEXT_OVN);
    expect(getRuleHealthContextId({ annotations: annotation({ contextTab: 'kiali' }) })).toBe('kiali');
  });

  it('routes rules without a contextTab annotation to the netobserv context', () => {
    expect(getRuleHealthContextId({ annotations: {} })).toBe(NETOBSERV_CONTEXT_NETOBSERV);
    // A legacy OVN allowlisted name alone no longer routes to OVN (annotation is the single source).
    expect(getRuleHealthContextId({ annotations: annotation({}) })).toBe(NETOBSERV_CONTEXT_NETOBSERV);
  });

  it('excludes non-netobserv contexts from scored health', () => {
    expect(isExcludedFromNetobservHealth({ annotations: annotation({ contextTab: 'kiali' }) })).toBe(true);
    expect(isExcludedFromNetobservHealth({ annotations: annotation({ contextTab: 'ovn' }) })).toBe(true);
    expect(isExcludedFromNetobservHealth({ annotations: {} })).toBe(false);
  });

  it('sorts context tabs with netobserv first then the rest alphabetically', () => {
    expect(sortContextTabIds(['kiali', NETOBSERV_CONTEXT_OVN, NETOBSERV_CONTEXT_NETOBSERV])).toEqual([
      NETOBSERV_CONTEXT_NETOBSERV,
      'kiali',
      NETOBSERV_CONTEXT_OVN
    ]);
  });

  it('describes built-in and other contexts', () => {
    expect(getHealthContextDefinition(NETOBSERV_CONTEXT_NETOBSERV).scored).toBe(true);
    expect(getHealthContextDefinition(NETOBSERV_CONTEXT_OVN).scored).toBe(false);
    expect(getHealthContextDefinition('kiali').kind).toBe('readonly-alerts');
    expect(formatContextTabTitle('kiali')).toBe('Kiali');
  });

  it('parses contextTab and displayName from the health annotation', () => {
    expect(getHealthContextTabFromAnnotations(annotation({ contextTab: 'ovn' }))).toBe('ovn');
    expect(parseHealthContextAnnotation(annotation({ contextTab: 'kiali', displayName: 'Kiali Mesh' }))).toEqual({
      contextTab: 'kiali',
      displayName: 'Kiali Mesh'
    });
    expect(parseHealthContextAnnotation({})).toEqual({});
  });

  it('rejects unsafe or invalid context tab identifiers', () => {
    expect(isValidHealthContextId('kiali')).toBe(true);
    expect(isValidHealthContextId('')).toBe(false);
    expect(isValidHealthContextId('__proto__')).toBe(false);
    expect(getRuleHealthContextId({ annotations: annotation({ contextTab: '__proto__' }) })).toBe(
      NETOBSERV_CONTEXT_NETOBSERV
    );
    expect(getRuleHealthContextId({ annotations: annotation({ contextTab: 'bad id' }) })).toBe(
      NETOBSERV_CONTEXT_NETOBSERV
    );
  });
});
