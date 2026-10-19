import { ScopeConfigDef } from '../../model/scope';

export const ScopeDefSample: ScopeConfigDef[] = [
  {
    id: 'cluster',
    name: 'Cluster',
    description: 'Cluster name or identifier',
    labels: ['K8S_ClusterName'],
    feature: 'multiCluster',
    stepInto: 'zone'
  },
  {
    id: 'network',
    name: 'Network',
    description: 'Network name, such as User Defined Network',
    labels: ['SrcK8S_NetworkName', 'DstK8S_NetworkName'],
    feature: 'multiNetworks',
    groups: ['clusters'],
    stepInto: 'namespace'
  },
  {
    id: 'zone',
    name: 'Zone',
    description: 'Availability zone',
    labels: ['SrcK8S_Zone', 'DstK8S_Zone'],
    feature: 'zones',
    groups: ['clusters'],
    stepInto: 'host'
  },
  {
    id: 'host',
    name: 'Node',
    description: 'Node on which the resources are running',
    labels: ['SrcK8S_HostName', 'DstK8S_HostName'],
    groups: ['clusters', 'zones', 'clusters+zones'],
    stepInto: 'resource'
  },
  {
    id: 'namespace',
    name: 'Namespace',
    description: 'Resource namespace',
    labels: ['SrcK8S_Namespace', 'DstK8S_Namespace'],
    groups: ['clusters', 'clusters+zones', 'clusters+hosts', 'zones', 'zones+hosts', 'hosts'],
    stepInto: 'owner'
  },
  {
    id: 'owner',
    name: 'Owner',
    description: 'Controller owner, such as a Deployment',
    labels: [
      'SrcK8S_OwnerName',
      'SrcK8S_OwnerType',
      'DstK8S_OwnerName',
      'DstK8S_OwnerType',
      'SrcK8S_Namespace',
      'DstK8S_Namespace',
      'SrcSubnetLabel',
      'DstSubnetLabel'
    ],
    groups: [
      'clusters',
      'clusters+zones',
      'clusters+hosts',
      'clusters+namespaces',
      'zones',
      'zones+hosts',
      'zones+namespaces',
      'hosts',
      'hosts+namespaces',
      'namespaces'
    ],
    stepInto: 'resource'
  },
  {
    id: 'resource',
    name: 'Resource',
    description: 'Base resource, such as a Pod, a Service or a Node',
    labels: [
      'SrcK8S_Name',
      'SrcK8S_Type',
      'SrcK8S_OwnerName',
      'SrcK8S_OwnerType',
      'SrcK8S_Namespace',
      'SrcAddr',
      'SrcK8S_HostName',
      'SrcSubnetLabel',
      'DstK8S_Name',
      'DstK8S_Type',
      'DstK8S_OwnerName',
      'DstK8S_OwnerType',
      'DstK8S_Namespace',
      'DstAddr',
      'DstK8S_HostName',
      'DstSubnetLabel'
    ],
    groups: [
      'clusters',
      'clusters+zones',
      'clusters+hosts',
      'clusters+namespaces',
      'clusters+owners',
      'zones',
      'zones+hosts',
      'zones+namespaces',
      'zones+owners',
      'hosts',
      'hosts+namespaces',
      'hosts+owners',
      'namespaces',
      'namespaces+owners',
      'owners'
    ]
  }
];
