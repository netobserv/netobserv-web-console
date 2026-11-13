import flowRecordsJson from '../../../../mocks/loki/flow_records.json';
import { Flow, Record } from '../../api/ipfix';
import { parseStream } from '../../api/query-response';
import { mergeFlowReporters } from '../../utils/flows';

export type FieldsSpecMock = typeof flowRecordsJson;

/** Row indices used by cypress/e2e/table/fields.spec.ts (End Time descending). */
export const FIELDS_SPEC_ROW_INDICES = {
  standard: 0,
  pktDrop: 41,
  dns: 21,
  flowRTT: 13,
  multiCluster: 8,
  zonesSrc: 0,
  zonesDst: 2,
  networkEvents: 3
} as const;

const NETWORK_EVENTS_MESSAGE = 'Allowed by default allow from local node policy, direction Ingress';

export const cloneFieldsSpecMock = (): FieldsSpecMock => JSON.parse(JSON.stringify(flowRecordsJson));

export const patchFieldsSpecMock = (flowRecords: FieldsSpecMock): void => {
  flowRecords.data.result.forEach(stream => {
    stream.values.forEach(v => {
      const parsed = JSON.parse(v[1]);
      if (
        parsed.SrcK8S_Name === 'kubernetes' &&
        parsed.DstK8S_Name === 'service-ca-operator-6d4bb6c9-crvqx' &&
        parsed.SrcPort === 443
      ) {
        v[1] = JSON.stringify({ ...parsed, NetworkEvents: [NETWORK_EVENTS_MESSAGE] });
      }
    });

    const hasClusterFlow = stream.values.some(v => {
      const parsed = JSON.parse(v[1]);
      return parsed.SrcK8S_Name === 'ip-10-0-1-92.ec2.internal' && parsed.DstAddr === '10.0.1.56';
    });
    if (hasClusterFlow) {
      (stream.stream as Flow).K8S_ClusterName = 'test-cluster';
    }
  });
};

export const getFieldsSpecRowsDesc = (flowRecords: FieldsSpecMock): Record[] => {
  const records = (flowRecords.data.result as Parameters<typeof parseStream>[0][]).flatMap(r => parseStream(r));
  const flows = mergeFlowReporters(records);
  return [...flows].sort((a, b) => (b.fields.TimeFlowEndMs || 0) - (a.fields.TimeFlowEndMs || 0));
};
