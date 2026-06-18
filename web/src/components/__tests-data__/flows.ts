import flowsJson from '../../../../mocks/loki/flow_records.json';
import { FlowDirection, Record } from '../../api/ipfix';
import { parseStream, RecordsResult, StreamResult } from '../../api/query-response';

export const FlowsMock: Record[] = flowsJson.data.result.flatMap(r => parseStream(r as unknown as StreamResult));

export const FlowsResultMock: RecordsResult = {
  records: FlowsMock,
  stats: {
    limitReached: FlowsMock.length >= 100,
    numQueries: 1,
    dataSources: ['loki']
  }
};

export const UnknownFlow: Record = {
  labels: {
    _RecordType: 'flowLog',
    FlowDirection: FlowDirection.Inner
  },
  key: 1,
  fields: {
    SrcAddr: '10.0.0.1',
    DstAddr: '10.0.0.2',
    Proto: NaN,
    SrcMac: '',
    DstMac: '',
    TimeFlowEndMs: NaN,
    TimeFlowStartMs: NaN,
    TimeReceived: NaN
  }
};

export const FlowsSample: Record[] = [
  {
    labels: {
      _RecordType: 'flowLog',
      FlowDirection: FlowDirection.Egress,
      SrcK8S_Namespace: 'default',
      DstK8S_Namespace: 'default',
      SrcK8S_Type: 'Pod',
      DstK8S_Type: 'Pod'
    },
    key: 1,
    fields: {
      SrcAddr: '10.244.0.6',
      DstAddr: '10.244.0.7',
      SrcK8S_Name: 'loki-promtail-7bpg8',
      DstK8S_Name: 'loki-0',
      SrcPort: 60354,
      DstPort: 3100,
      Packets: 400,
      Proto: 6,
      Bytes: 76800,
      SrcMac: '8a:f6:69:6b:1a:cc',
      DstMac: '0a:58:0a:80:00:17',
      TimeFlowEndMs: 1639058287000,
      TimeFlowStartMs: 1639058286000,
      TimeReceived: 1639058290
    }
  },
  {
    labels: {
      _RecordType: 'flowLog',
      FlowDirection: FlowDirection.Ingress,
      SrcK8S_Namespace: 'openshift-console',
      DstK8S_Namespace: 'netowrk-observability'
    },
    key: 2,
    fields: {
      SrcAddr: '10.244.0.2',
      DstAddr: '10.244.0.3',
      SrcK8S_Name: undefined,
      DstK8S_Name: undefined,
      SrcPort: 60350,
      DstPort: 3000,
      Packets: 300,
      Proto: 6,
      Bytes: 7800,
      SrcMac: '8a:f6:69:6b:1a:cc',
      DstMac: '0a:58:0a:80:00:17',
      TimeFlowEndMs: 1639058286000,
      TimeFlowStartMs: 1639058285000,
      TimeReceived: 1639058290
    }
  },
  {
    labels: {
      _RecordType: 'flowLog',
      FlowDirection: FlowDirection.Ingress,
      SrcK8S_Namespace: 'kube-system',
      DstK8S_Namespace: 'default'
    },
    key: 3,
    fields: {
      SrcAddr: '10.244.0.9',
      DstAddr: '10.244.0.2',
      SrcK8S_Name: 'coredns-74ff55c5b-dfbff',
      DstK8S_Name: 'loki-1',
      SrcPort: 60354,
      DstPort: 3100,
      Packets: 400,
      Proto: 6,
      Bytes: 76800,
      SrcMac: '8a:f6:69:6b:1a:cc',
      DstMac: '0a:58:0a:80:00:17',
      TimeFlowEndMs: 1639058288000,
      TimeFlowStartMs: 1639058286000,
      TimeReceived: 1639058291,
      DnsId: 123,
      DnsLatencyMs: 0.9
    }
  }
];

export const getTestFlows = (count: number) => {
  const flows: Record[] = [];
  for (let i = 0; i < count; i++) {
    flows.push({
      labels: {
        _RecordType: 'flowLog',
        FlowDirection: FlowDirection.Egress,
        SrcK8S_Namespace: 'default',
        DstK8S_Namespace: 'default'
      },
      key: 1,
      fields: {
        SrcAddr: '10.244.0.1',
        DstAddr: '10.244.0.2',
        SrcK8S_Name: 'random-0',
        DstK8S_Name: 'random-1',
        SrcPort: 1234,
        DstPort: 5678,
        Packets: 1,
        Proto: 6,
        Bytes: i * 1500,
        SrcMac: '00:00:00:00:00:00',
        DstMac: '00:00:00:00:00:00',
        TimeFlowEndMs: 1639058287000,
        TimeFlowStartMs: 1639058286000,
        TimeReceived: 1639058290
      }
    });
  }
  return flows;
};

export const FlowsResultSample: RecordsResult = {
  records: FlowsSample,
  stats: {
    limitReached: false,
    numQueries: 1,
    dataSources: ['loki']
  }
};
