import { TopologyMetrics } from '../../api/query-response';
import { topologyFromLabels } from './topology-from-labels';

/** Matches the former client-side parse window used by these fixtures. */
const fixtureRange = { from: 1653989800, to: 1653990100 };

export const metrics: TopologyMetrics[] = [
  topologyFromLabels(
    {
      DstAddr: '172.30.139.153',
      DstK8S_Name: 'loki',
      DstK8S_Namespace: 'network-observability',
      DstK8S_OwnerName: 'loki',
      DstK8S_OwnerType: 'Service',
      DstK8S_Type: 'Service',
      DstK8S_HostName: 'ip-10-0-142-22.ec2.internal',
      SrcAddr: '10.131.0.14',
      SrcK8S_HostName: 'ip-10-0-142-24.ec2.internal',
      SrcK8S_Name: 'flowlogs-pipeline-tskw2',
      SrcK8S_Namespace: 'network-observability',
      SrcK8S_OwnerName: 'flowlogs-pipeline',
      SrcK8S_OwnerType: 'DaemonSet',
      SrcK8S_Type: 'Pod'
    },
    [
      [1653989806.227, '31825.78'],
      [1653989866.227, '25000.00'],
      [1653989926.227, '12340.00'],
      [1653989986.227, '56780.00'],
      [1653990046.227, '99999.99']
    ],
    'resource',
    fixtureRange
  ),
  topologyFromLabels(
    {
      DstAddr: '172.30.139.153',
      DstK8S_Name: 'loki',
      DstK8S_Namespace: 'network-observability',
      DstK8S_OwnerName: 'loki',
      DstK8S_OwnerType: 'Service',
      DstK8S_Type: 'Service',
      DstK8S_HostName: 'ip-10-0-142-22.ec2.internal',
      SrcAddr: '10.131.0.13',
      SrcK8S_HostName: 'ip-10-0-142-24.ec2.internal',
      SrcK8S_Name: 'flowlogs-pipeline-ahkq',
      SrcK8S_Namespace: 'network-observability',
      SrcK8S_OwnerName: 'flowlogs-pipeline',
      SrcK8S_OwnerType: 'DaemonSet',
      SrcK8S_Type: 'Pod'
    },
    [
      [1653989806.227, '12340.00'],
      [1653989866.227, '56780.00'],
      [1653989926.227, '0'],
      [1653989986.227, '0'],
      [1653990046.227, '0']
    ],
    'resource',
    fixtureRange
  ),
  topologyFromLabels(
    {
      DstAddr: '172.30.139.100',
      DstK8S_Name: 'pod 2',
      DstK8S_Namespace: 'network-observability',
      DstK8S_OwnerName: 'deployment',
      DstK8S_OwnerType: 'Deployment',
      DstK8S_Type: 'Pod',
      DstK8S_HostName: 'ip-10-0-142-22.ec2.internal',
      SrcAddr: '172.30.139.101',
      SrcK8S_HostName: 'ip-10-0-142-24.ec2.internal',
      SrcK8S_Name: 'pod 1',
      SrcK8S_Namespace: 'network-observability',
      SrcK8S_OwnerName: 'deployment',
      SrcK8S_OwnerType: 'Deployment',
      SrcK8S_Type: 'Pod'
    },
    [
      [1653989806.227, '12459.23'],
      [1653989866.227, '56821.44'],
      [1653989926.227, '98133.21'],
      [1653989986.227, '12345.67'],
      [1653990046.227, '12345.67']
    ],
    'resource',
    fixtureRange
  )
];

export const droppedMetrics: TopologyMetrics[] = [
  topologyFromLabels(
    {
      DstAddr: '172.30.139.153',
      DstK8S_Name: 'loki',
      DstK8S_Namespace: 'network-observability',
      DstK8S_OwnerName: 'loki',
      DstK8S_OwnerType: 'Service',
      DstK8S_Type: 'Service',
      DstK8S_HostName: 'ip-10-0-142-22.ec2.internal',
      SrcAddr: '10.131.0.14',
      SrcK8S_HostName: 'ip-10-0-142-24.ec2.internal',
      SrcK8S_Name: 'flowlogs-pipeline-tskw2',
      SrcK8S_Namespace: 'network-observability',
      SrcK8S_OwnerName: 'flowlogs-pipeline',
      SrcK8S_OwnerType: 'DaemonSet',
      SrcK8S_Type: 'Pod'
    },
    [
      [1653989806.227, '25.78'],
      [1653989866.227, '00.00'],
      [1653989926.227, '40.00'],
      [1653989986.227, '80.00'],
      [1653990046.227, '99.99']
    ],
    'resource',
    fixtureRange
  )
];
