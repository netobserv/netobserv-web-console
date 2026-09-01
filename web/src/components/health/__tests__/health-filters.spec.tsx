import {
  buildHealthPredicate,
  countActiveHealthFilters,
  emptyHealthFilters,
  getHealthFiltersFromURL,
  HealthFilterState,
  isHealthFilterEmpty,
  matchesHealthFilters,
  matchesNamespacePattern,
  setURLHealthFilters
} from '../health-filters';
import { NamedItem } from '../health-helper';

const mockNamedItem = (overrides: Partial<NamedItem> = {}): NamedItem => ({
  ruleName: 'TestRule',
  ruleID: '',
  metadata: { alertThresholdF: 0, upperBoundF: 100, upperBound: '100', unit: '%', links: [] },
  value: 0,
  severity: 'critical',
  state: 'firing',
  threshold: '',
  thresholdF: 0,
  upperBound: '100',
  labels: {},
  summary: 'Something is wrong',
  description: '',
  superKind: 'Namespace',
  name: 'my-namespace',
  k8sKind: 'Namespace',
  ...overrides
});

describe('isHealthFilterEmpty / countActiveHealthFilters', () => {
  it('detects an empty filter state', () => {
    expect(isHealthFilterEmpty(emptyHealthFilters)).toBe(true);
    expect(countActiveHealthFilters(emptyHealthFilters)).toEqual(0);
  });

  it('detects a non-empty filter state', () => {
    const f: HealthFilterState = { ...emptyHealthFilters, severities: ['critical'] };
    expect(isHealthFilterEmpty(f)).toBe(false);
    expect(countActiveHealthFilters(f)).toEqual(1);
  });

  it('counts a non-empty search text as an active filter', () => {
    const f: HealthFilterState = { ...emptyHealthFilters, searchText: 'foo' };
    expect(isHealthFilterEmpty(f)).toBe(false);
    expect(countActiveHealthFilters(f)).toEqual(1);
  });
});

describe('matchesHealthFilters', () => {
  it('matches on severity', () => {
    const item = mockNamedItem({ severity: 'warning' });
    expect(matchesHealthFilters(item, { ...emptyHealthFilters, severities: ['critical'] })).toBe(false);
    expect(matchesHealthFilters(item, { ...emptyHealthFilters, severities: ['warning'] })).toBe(true);
  });

  it('matches on status', () => {
    const item = mockNamedItem({ state: 'pending' });
    expect(matchesHealthFilters(item, { ...emptyHealthFilters, statuses: ['firing'] })).toBe(false);
    expect(matchesHealthFilters(item, { ...emptyHealthFilters, statuses: ['pending'] })).toBe(true);
  });

  it('matches on mode (alert vs recording)', () => {
    const alertItem = mockNamedItem({ state: 'firing' });
    const recordingItem = mockNamedItem({ state: 'recording' });
    expect(matchesHealthFilters(alertItem, { ...emptyHealthFilters, modes: ['recording'] })).toBe(false);
    expect(matchesHealthFilters(recordingItem, { ...emptyHealthFilters, modes: ['recording'] })).toBe(true);
  });

  it('matches on namespace for Namespace / Owner items', () => {
    const nsItem = mockNamedItem({ superKind: 'Namespace', name: 'ns-a' });
    const ownerItem = mockNamedItem({ superKind: 'Owner', name: 'my-deploy', namespace: 'ns-b' });
    const filters = { ...emptyHealthFilters, namespaces: ['ns-a'] };
    expect(matchesHealthFilters(nsItem, filters)).toBe(true);
    expect(matchesHealthFilters(ownerItem, filters)).toBe(false);
  });

  it('matches on namespace patterns (partial / quoted-exact / wildcard) and any-of semantics', () => {
    const dns = mockNamedItem({ superKind: 'Namespace', name: 'openshift-dns' });
    const monitoring = mockNamedItem({ superKind: 'Namespace', name: 'openshift-monitoring' });
    const myApp = mockNamedItem({ superKind: 'Namespace', name: 'my-app' });

    // Partial (unquoted) contains match.
    expect(matchesHealthFilters(dns, { ...emptyHealthFilters, namespaces: ['dns'] })).toBe(true);
    expect(matchesHealthFilters(myApp, { ...emptyHealthFilters, namespaces: ['dns'] })).toBe(false);

    // `*` wildcard: starts-with filters every matching namespace in one value.
    const startsWith = { ...emptyHealthFilters, namespaces: ['openshift-*'] };
    expect(matchesHealthFilters(dns, startsWith)).toBe(true);
    expect(matchesHealthFilters(monitoring, startsWith)).toBe(true);
    expect(matchesHealthFilters(myApp, startsWith)).toBe(false);

    // Quoted value is an exact (anchored) match.
    expect(matchesHealthFilters(myApp, { ...emptyHealthFilters, namespaces: ['"my-app"'] })).toBe(true);
    expect(matchesHealthFilters(myApp, { ...emptyHealthFilters, namespaces: ['"my"'] })).toBe(false);

    // Several values -> item passes if it matches ANY of them.
    const anyOf = { ...emptyHealthFilters, namespaces: ['*-dns', '"my-app"'] };
    expect(matchesHealthFilters(dns, anyOf)).toBe(true);
    expect(matchesHealthFilters(myApp, anyOf)).toBe(true);
    expect(matchesHealthFilters(monitoring, anyOf)).toBe(false);
  });

  it('lets Global and Node items pass through namespace filters (no namespace dimension)', () => {
    const globalItem = mockNamedItem({ superKind: 'Global', name: '' });
    const nodeItem = mockNamedItem({ superKind: 'Node', name: 'node-1' });
    const filters = { ...emptyHealthFilters, namespaces: ['ns-a'] };
    expect(matchesHealthFilters(globalItem, filters)).toBe(true);
    expect(matchesHealthFilters(nodeItem, filters)).toBe(true);
  });

  it('searches by name, ruleName, summary and description (case-insensitive contains)', () => {
    const item = mockNamedItem({
      superKind: 'Namespace',
      name: 'my-namespace',
      ruleName: 'DNSErrors',
      summary: 'Too many errors',
      description: 'DNS error rate exceeded threshold'
    });
    expect(matchesHealthFilters(item, { ...emptyHealthFilters, searchText: 'my-namespace' })).toBe(true);
    expect(matchesHealthFilters(item, { ...emptyHealthFilters, searchText: 'dnserrors' })).toBe(true);
    expect(matchesHealthFilters(item, { ...emptyHealthFilters, searchText: 'many errors' })).toBe(true);
    expect(matchesHealthFilters(item, { ...emptyHealthFilters, searchText: 'exceeded threshold' })).toBe(true);
    expect(matchesHealthFilters(item, { ...emptyHealthFilters, searchText: 'nope' })).toBe(false);
  });

  it('searches Global items by ruleName, summary and description', () => {
    const item = mockNamedItem({
      superKind: 'Global',
      name: '',
      ruleName: 'PacketDropsByKernel',
      summary: 'Too many drops',
      description: 'Kernel dropped packets above limit'
    });
    expect(matchesHealthFilters(item, { ...emptyHealthFilters, searchText: 'PacketDrops' })).toBe(true);
    expect(matchesHealthFilters(item, { ...emptyHealthFilters, searchText: 'many drops' })).toBe(true);
    expect(matchesHealthFilters(item, { ...emptyHealthFilters, searchText: 'above limit' })).toBe(true);
    expect(matchesHealthFilters(item, { ...emptyHealthFilters, searchText: 'nope' })).toBe(false);
  });

  it('treats special regex characters as literal text', () => {
    const item = mockNamedItem({ ruleName: 'Test[Rule]' });
    expect(matchesHealthFilters(item, { ...emptyHealthFilters, searchText: '[Rule]' })).toBe(true);
  });
});

describe('matchesNamespacePattern', () => {
  it('does a case-insensitive substring match for a lower-case pattern', () => {
    expect(matchesNamespacePattern('dns', 'openshift-dns')).toBe(true);
    expect(matchesNamespacePattern('DNS', 'openshift-dns')).toBe(false); // upper-case -> case-sensitive
    expect(matchesNamespacePattern('nope', 'openshift-dns')).toBe(false);
  });

  it('anchors quoted patterns to an exact match', () => {
    expect(matchesNamespacePattern('"openshift-dns"', 'openshift-dns')).toBe(true);
    expect(matchesNamespacePattern('"dns"', 'openshift-dns')).toBe(false);
  });

  it('supports `*` wildcards anywhere', () => {
    expect(matchesNamespacePattern('openshift-*', 'openshift-dns')).toBe(true);
    expect(matchesNamespacePattern('*-dns', 'openshift-dns')).toBe(true);
    expect(matchesNamespacePattern('openshift-*-operator', 'openshift-dns-operator')).toBe(true);
    expect(matchesNamespacePattern('openshift-*', 'my-app')).toBe(false);
  });

  it('treats special regex characters in the value/pattern literally', () => {
    expect(matchesNamespacePattern('a.b', 'a.b')).toBe(true);
    expect(matchesNamespacePattern('a.b', 'axb')).toBe(false);
  });

  it('matches everything for an empty pattern', () => {
    expect(matchesNamespacePattern('', 'anything')).toBe(true);
    expect(matchesNamespacePattern('   ', 'anything')).toBe(true);
  });
});

describe('buildHealthPredicate', () => {
  it('returns undefined when filters are empty', () => {
    expect(buildHealthPredicate(emptyHealthFilters)).toBeUndefined();
  });

  it('returns a working predicate for search text', () => {
    const item = mockNamedItem({ ruleName: 'DNSErrors' });
    const predicate = buildHealthPredicate({ ...emptyHealthFilters, searchText: 'dns' });
    expect(predicate).toBeDefined();
    expect(predicate!(item)).toBe(true);
  });
});

describe('Health filters URL codec', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/network-health');
  });

  it('reads empty filters from a clean URL', () => {
    expect(getHealthFiltersFromURL()).toEqual(emptyHealthFilters);
  });

  it('round-trips filters through the URL', () => {
    const f: HealthFilterState = {
      severities: ['critical', 'warning'],
      statuses: ['firing'],
      modes: ['alert'],
      namespaces: ['ns-a'],
      searchText: 'drop'
    };
    setURLHealthFilters(f, true);
    expect(getHealthFiltersFromURL()).toEqual(f);
  });

  it('removes a param entirely once its filter is cleared', () => {
    setURLHealthFilters({ ...emptyHealthFilters, severities: ['critical'] }, true);
    expect(window.location.search).toContain('healthSeverity=critical');
    setURLHealthFilters(emptyHealthFilters, true);
    expect(window.location.search).not.toContain('healthSeverity');
  });

  it('writes a single history entry when several params change at once', () => {
    const pushSpy = jest.spyOn(window.history, 'pushState');
    setURLHealthFilters({
      severities: ['critical', 'warning'],
      statuses: ['firing'],
      modes: ['alert'],
      namespaces: ['ns-a'],
      searchText: 'drop'
    });
    expect(pushSpy).toHaveBeenCalledTimes(1);
    pushSpy.mockRestore();
  });

  it('does not touch history when the serialized filters already match the URL', () => {
    const f: HealthFilterState = { ...emptyHealthFilters, severities: ['critical'], searchText: 'drop' };
    setURLHealthFilters(f, true);
    const pushSpy = jest.spyOn(window.history, 'pushState');
    const replaceSpy = jest.spyOn(window.history, 'replaceState');
    // Re-applying the same state (as happens on mount, when it is read back from the URL) is a no-op.
    setURLHealthFilters(f);
    expect(pushSpy).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
    pushSpy.mockRestore();
    replaceSpy.mockRestore();
  });
});
