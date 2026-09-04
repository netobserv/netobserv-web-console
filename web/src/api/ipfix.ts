/* eslint-disable max-len */
import { TFunction } from 'i18next';
import { RecordType } from '../model/flow-query';

export interface Record {
  labels: Flow;
  key: number;
  fields: Flow;
}

export const getRecordValue = (record: Record, field: Field, defaultValue?: string | number) => {
  /* TODO: fix following behavior:
   * Check if field exists first since /flow endpoint return fields as labels when using filters
   * This is mandatory to ensure fields types
   */
  if (record.fields[field] !== undefined) {
    return record.fields[field];
  }
  // check if label exists
  if (record.labels[field] !== undefined) {
    return record.labels[field];
  }
  // fallback on default
  return defaultValue;
};

export type Field = keyof Flow;

export interface Flow {
  SrcK8S_Namespace?: string;
  DstK8S_Namespace?: string;
  SrcK8S_Type?: string;
  DstK8S_Type?: string;
  FlowDirection?: FlowDirection;
  _RecordType?: RecordType;
  SrcAddr?: string;
  DstAddr?: string;
  SrcMac?: string;
  DstMac?: string;
  SrcK8S_Name?: string;
  DstK8S_Name?: string;
  SrcPort?: number;
  DstPort?: number;
  SrcK8S_OwnerName?: string;
  DstK8S_OwnerName?: string;
  SrcK8S_OwnerType?: string;
  DstK8S_OwnerType?: string;
  SrcK8S_HostIP?: string;
  DstK8S_HostIP?: string;
  SrcK8S_HostName?: string;
  DstK8S_HostName?: string;
  SrcK8S_Zone?: string;
  DstK8S_Zone?: string;
  SrcK8S_NetworkName?: string;
  DstK8S_NetworkName?: string;
  SrcSubnetLabel?: string;
  DstSubnetLabel?: string;
  SrcASN?: string;
  DstASN?: string;
  K8S_ClusterName?: string;
  Proto?: number;
  Interfaces?: string[];
  IfDirections?: IfDirection[];
  Udns?: string[];
  NetworkEvents?: string[];
  Flags?: string[];
  Packets?: number;
  Packets_AB?: number;
  Packets_BA?: number;
  Bytes?: number;
  Bytes_AB?: number;
  Bytes_BA?: number;
  Dscp?: number;
  IcmpType?: number;
  IcmpCode?: number;
  PktDropLatestState?: string;
  PktDropLatestDropCause?: string;
  PktDropLatestFlags?: number;
  PktDropPackets?: number;
  PktDropPackets_AB?: number;
  PktDropPackets_BA?: number;
  PktDropBytes?: number;
  PktDropBytes_AB?: number;
  PktDropBytes_BA?: number;
  DnsId?: number;
  DnsName?: string;
  DnsFlags?: number;
  DnsFlagsResponseCode?: string;
  DnsLatencyMs?: number;
  DnsErrno?: number;
  TimeFlowStartMs?: number;
  TimeFlowEndMs?: number;
  TimeReceived?: number;
  TimeFlowRttNs?: number;
  _HashId?: string;
  _IsFirst?: string;
  numFlowLogs?: number;
  UdnId?: string;
  TLSTypes?: string[];
  TLSVersion?: string;
  TLSGroup?: string;
}

export enum FlowDirection {
  Ingress = '0',
  Egress = '1',
  Inner = '2',
  Both = '3'
}

export const getDirectionDisplayString = (value: FlowDirection, t: TFunction) => {
  return value === FlowDirection.Ingress
    ? t('Ingress')
    : value === FlowDirection.Egress
    ? t('Egress')
    : value === FlowDirection.Inner
    ? t('Inner')
    : value === FlowDirection.Both
    ? t('Both')
    : t('n/a');
};

export enum IfDirection {
  Ingress = '0',
  Egress = '1'
}
