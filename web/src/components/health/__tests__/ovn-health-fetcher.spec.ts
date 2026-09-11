import { Rule, RuleStates } from '@openshift-console/dynamic-plugin-sdk';
import { AlertsResult } from '../../../api/alert';
import { discoverOvnPlatformRules, isOvnPlatformRulesGroup, isOvnPlatformTabAvailable } from '../ovn-health-fetcher';

const makeGroup = (
  name: string,
  rules: Rule[],
  file = 'openshift-ovn-kubernetes/alert-rules.yaml'
): AlertsResult['data']['groups'][number] => ({
  name,
  file,
  rules,
  interval: 30
});

const makeRule = (name: string): Rule => ({
  id: name,
  name,
  query: 'vector(1)',
  duration: 600,
  labels: { severity: 'warning' },
  annotations: {},
  state: 'inactive' as RuleStates,
  type: 'alerting',
  alerts: []
});

describe('ovn-health-fetcher discovery', () => {
  it('detects OVN rule groups (downstream group name or any ovn-kubernetes file)', () => {
    expect(isOvnPlatformRulesGroup(makeGroup('cluster-network-operator-ovn.rules', []))).toBe(true);
    expect(isOvnPlatformRulesGroup(makeGroup('other', [], 'foo/openshift-ovn-kubernetes/bar.yaml'))).toBe(true);
    expect(isOvnPlatformRulesGroup(makeGroup('general.rules', [], 'ovn-kubernetes/ovnkube-alerts.yaml'))).toBe(true);
    expect(isOvnPlatformRulesGroup(makeGroup('other', [], 'other.yaml'))).toBe(false);
  });

  it('discovers downstream allowlisted rules by name', () => {
    const groups = [
      makeGroup('cluster-network-operator-ovn.rules', [makeRule('NorthboundStale'), makeRule('UnrelatedAlert')])
    ];
    expect(discoverOvnPlatformRules(groups).map(r => r.name)).toEqual(['NorthboundStale']);
  });

  it('discovers upstream allowlisted rules regardless of group/file', () => {
    // Upstream ovn-kubernetes helm alerts live in the generic general.rules group.
    const groups = [makeGroup('general.rules', [makeRule('OvnKubeNoRunningManager'), makeRule('Unrelated')], 'x.yaml')];
    expect(discoverOvnPlatformRules(groups).map(r => r.name)).toEqual(['OvnKubeNoRunningManager']);
  });

  it('marks tab available when the OVN group exists even without allowlisted rules', () => {
    const groups = [makeGroup('cluster-network-operator-ovn.rules', [makeRule('UnrelatedAlert')])];
    expect(isOvnPlatformTabAvailable(groups, [])).toBe(true);
    expect(isOvnPlatformTabAvailable([], [])).toBe(false);
    expect(isOvnPlatformTabAvailable([], [makeRule('NorthboundStale')])).toBe(true);
  });
});
