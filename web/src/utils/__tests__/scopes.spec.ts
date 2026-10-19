import { ColumnConfigSampleDefs } from '../../components/__tests-data__/columns';
import { ScopeDefSample } from '../../components/__tests-data__/scopes';
import { Feature } from '../../model/config';
import { isScopeAvailable } from '../scopes';

const allFeats: Feature[] = [
  'dnsTracking',
  'flowRTT',
  'ipsec',
  'multiCluster',
  'networkEvents',
  'packetTranslation',
  'pktDrop',
  'tlsTracking',
  'udnMapping',
  'zones',
  'subnetLabels',
  'multiNetworks'
];

const promLabelsNoFeat = [
  'SrcK8S_HostName',
  'DstK8S_HostName',
  'SrcK8S_Namespace',
  'DstK8S_Namespace',
  'K8S_FlowLayer',
  'SrcSubnetLabel',
  'DstSubnetLabel',
  'SrcK8S_OwnerName',
  'DstK8S_OwnerName',
  'SrcK8S_OwnerType',
  'DstK8S_OwnerType',
  'SrcK8S_Type',
  'DstK8S_Type'
];

const promLabelsAllFeats = promLabelsNoFeat.concat(
  'K8S_ClusterName',
  'SrcK8S_Zone',
  'DstK8S_Zone',
  'SrcK8S_NetworkName',
  'DstK8S_NetworkName'
);

describe('Getting all available scopes', () => {
  it('should have all standard scopes available with Loki', () => {
    const scopes = ScopeDefSample.filter(sc => isScopeAvailable(sc, [], [], ColumnConfigSampleDefs, false));
    expect(scopes.map(sc => sc.id)).toEqual(['host', 'namespace', 'owner', 'resource']);
  });

  it('should have feature scopes available with Loki', () => {
    const scopes = ScopeDefSample.filter(sc => isScopeAvailable(sc, allFeats, [], ColumnConfigSampleDefs, false));
    expect(scopes.map(sc => sc.id)).toEqual(['cluster', 'network', 'zone', 'host', 'namespace', 'owner', 'resource']);
  });

  it('should have some standard scopes available with Prometheus', () => {
    const scopes = ScopeDefSample.filter(sc =>
      isScopeAvailable(sc, [], promLabelsNoFeat, ColumnConfigSampleDefs, true)
    );
    expect(scopes.map(sc => sc.id)).toEqual(['host', 'namespace', 'owner']);
  });

  it('should have some feature scopes available with Prometheus', () => {
    const scopes = ScopeDefSample.filter(sc =>
      isScopeAvailable(sc, allFeats, promLabelsAllFeats, ColumnConfigSampleDefs, true)
    );
    expect(scopes.map(sc => sc.id)).toEqual(['cluster', 'network', 'zone', 'host', 'namespace', 'owner']);
  });
});

describe('Checking owner scope availability for new feature', () => {
  // Simulate a new feature-related label being added to owner scope
  const ownerScope = ScopeDefSample.find(sc => sc.id === 'owner')!;
  const modified = { ...ownerScope, labels: ownerScope.labels.concat('SomeNewLabel') };
  const modAllFeats = allFeats.concat('someNewFeatureWithoutPromLabels' as Feature);
  const columns = ColumnConfigSampleDefs.concat({
    id: 'SomeNewLabel',
    name: 'SomeNewLabel',
    field: 'SomeNewLabel',
    feature: 'someNewFeatureWithoutPromLabels' as Feature
  });

  it('should be available available with Loki / no feature', () => {
    const isAvailable = isScopeAvailable(modified, [], [], columns, false);
    expect(isAvailable).toBe(true);
  });

  it('should be available available with Loki / all features', () => {
    const isAvailable = isScopeAvailable(modified, modAllFeats, [], columns, false);
    expect(isAvailable).toBe(true);
  });

  it('should be available available with Prometheus / no feature', () => {
    // Owner scope is still available, because the added feature, which has labels not satisfied in Prometheus, is disabled
    const isAvailable = isScopeAvailable(modified, [], promLabelsNoFeat, columns, true);
    expect(isAvailable).toBe(true);
  });

  it('should not be available available with Prometheus / all feature', () => {
    // Owner scope is now unavailable, because the added feature, which has labels not satisfied in Prometheus, is enabled
    const isAvailable = isScopeAvailable(modified, modAllFeats, promLabelsAllFeats, columns, true);
    expect(isAvailable).toBe(false);
  });
});
