import axios from 'axios';
import { ContextSingleton } from '../utils/context';
import { Record } from './ipfix';

export type ProxyRequest = {
  ProxyClientAddr: string;
  ProxyClientPort: number;
  ProxyStartMs: number;
  ProxyEndMs: number;
  ProxyInstance: string;
  ProxyRequestID: string;
};
export type ProxyResponse = {
  records: ProxyRequest[];
  limitReached: boolean;
  pending: boolean;
  searchStartMs: number;
  searchEndMs: number;
  lookaheadMs: number;
};

export const canFindProxyClients = (record: Record): boolean => {
  const flow = { ...record.labels, ...record.fields };
  return (
    flow.Proto === 6 &&
    !!flow.SrcAddr &&
    !!flow.DstAddr &&
    !!flow.SrcPort &&
    !!flow.DstPort &&
    !!flow.TimeFlowStartMs &&
    !!flow.TimeFlowEndMs &&
    !flow.UdnId &&
    !flow.Udns?.some(Boolean)
  );
};

export const getProxyRecords = (record: Record, signal?: AbortSignal): Promise<ProxyResponse> => {
  const flow = { ...record.labels, ...record.fields };
  return axios
    .get<ProxyResponse>(ContextSingleton.getHost() + '/api/loki/proxy/records', {
      signal,
      params: {
        srcAddr: flow.SrcAddr,
        srcPort: flow.SrcPort,
        dstAddr: flow.DstAddr,
        dstPort: flow.DstPort,
        startMs: flow.TimeFlowStartMs,
        endMs: flow.TimeFlowEndMs,
        cluster: flow.K8S_ClusterName,
        udn: flow.UdnId || flow.Udns?.filter(Boolean).join(',') || undefined
      }
    })
    .then(response => response.data);
};
