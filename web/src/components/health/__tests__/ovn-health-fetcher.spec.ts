import { Rule, RuleStates } from '@openshift-console/dynamic-plugin-sdk';
import { AlertsResult } from '../../../api/alert';
import { NETOBSERV_CONTEXT_OVN, NETOBSERV_HEALTH_CONTEXT_LABEL } from '../health-context';
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

const makeRule = (name: string, labels: Record<string, string> = {}): Rule => ({
  id: name,
  name,
  query: 'vector(1)',
  duration: 600,
  labels: { severity: 'warning', ...labels },
  annotations: {},
  state: 'inactive' as RuleStates,
  type: 'alerting',
  alerts: []
});

describe('ovn-health-fetcher discovery', () => {
  it('detects CNO OVN rule groups', () => {
    expect(isOvnPlatformRulesGroup(makeGroup('cluster-network-operator-ovn.rules', []))).toBe(true);
    expect(isOvnPlatformRulesGroup(makeGroup('other', [], 'foo/openshift-ovn-kubernetes/bar.yaml'))).toBe(true);
    expect(isOvnPlatformRulesGroup(makeGroup('other', [], 'other.yaml'))).toBe(false);
  });

  it('discovers legacy allowlisted rules from the OVN group', () => {
    const groups = [
      makeGroup('cluster-network-operator-ovn.rules', [makeRule('NorthboundStale'), makeRule('UnrelatedAlert')])
    ];
    const rules = discoverOvnPlatformRules(groups);
    expect(rules.map(r => r.name)).toEqual(['NorthboundStale']);
  });

  it('discovers labeled platform rules outside the allowlist', () => {
    const groups = [
      makeGroup('third-party.rules', [
        makeRule('FuturePlatformAlert', {
          netobserv: 'true',
          [NETOBSERV_HEALTH_CONTEXT_LABEL]: NETOBSERV_CONTEXT_OVN
        })
      ])
    ];
    const rules = discoverOvnPlatformRules(groups);
    expect(rules.map(r => r.name)).toEqual(['FuturePlatformAlert']);
  });

  it('deduplicates when legacy and labeled discovery match the same rule', () => {
    const groups = [
      makeGroup('cluster-network-operator-ovn.rules', [
        makeRule('NorthboundStale', {
          netobserv: 'true',
          [NETOBSERV_HEALTH_CONTEXT_LABEL]: NETOBSERV_CONTEXT_OVN
        })
      ])
    ];
    expect(discoverOvnPlatformRules(groups)).toHaveLength(1);
  });

  it('marks tab available when the OVN group exists even without allowlisted rules', () => {
    const groups = [makeGroup('cluster-network-operator-ovn.rules', [makeRule('UnrelatedAlert')])];
    expect(isOvnPlatformTabAvailable(groups, [])).toBe(true);
    expect(isOvnPlatformTabAvailable([], [])).toBe(false);
    expect(isOvnPlatformTabAvailable([], [makeRule('NorthboundStale')])).toBe(true);
  });
});
