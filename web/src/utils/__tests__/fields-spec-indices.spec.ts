import { Record } from '../../api/ipfix';
import {
  cloneFieldsSpecMock,
  FIELDS_SPEC_ROW_INDICES,
  getFieldsSpecRowsDesc,
  patchFieldsSpecMock
} from '../../components/__tests-data__/fields-spec';

describe('fields.spec row indices', () => {
  it('documents expected row indices for Cypress (End Time desc)', () => {
    const flowRecords = cloneFieldsSpecMock();
    patchFieldsSpecMock(flowRecords);
    const sortedDesc = getFieldsSpecRowsDesc(flowRecords);
    const find = (pred: (f: Record, i: number) => boolean) => sortedDesc.findIndex(pred);

    expect(sortedDesc.length).toBeGreaterThanOrEqual(42);

    expect(find((_, i) => i === FIELDS_SPEC_ROW_INDICES.standard)).toBe(FIELDS_SPEC_ROW_INDICES.standard);
    expect(sortedDesc[FIELDS_SPEC_ROW_INDICES.standard].fields.Proto).toBe(6);
    expect(sortedDesc[FIELDS_SPEC_ROW_INDICES.standard].fields.SrcK8S_Name).toBe('service-ca-operator-6d4bb6c9-crvqx');

    expect(find((f, i) => i === FIELDS_SPEC_ROW_INDICES.pktDrop && f.fields.PktDropBytes === 32)).toBe(
      FIELDS_SPEC_ROW_INDICES.pktDrop
    );
    expect(find((f, i) => i === FIELDS_SPEC_ROW_INDICES.dns && f.fields.DnsId === 49856)).toBe(
      FIELDS_SPEC_ROW_INDICES.dns
    );
    expect(find((f, i) => i === FIELDS_SPEC_ROW_INDICES.flowRTT && f.fields.TimeFlowRttNs === 5_531_000)).toBe(
      FIELDS_SPEC_ROW_INDICES.flowRTT
    );
    expect(
      find((f, i) => i === FIELDS_SPEC_ROW_INDICES.multiCluster && f.labels.K8S_ClusterName === 'test-cluster')
    ).toBe(FIELDS_SPEC_ROW_INDICES.multiCluster);
    expect(find((f, i) => i === FIELDS_SPEC_ROW_INDICES.zonesSrc && f.labels.SrcK8S_Zone === 'us-east-1d')).toBe(
      FIELDS_SPEC_ROW_INDICES.zonesSrc
    );
    expect(find((f, i) => i === FIELDS_SPEC_ROW_INDICES.zonesDst && f.labels.DstK8S_Zone === 'us-east-1d')).toBe(
      FIELDS_SPEC_ROW_INDICES.zonesDst
    );
    expect(find((f, i) => i === FIELDS_SPEC_ROW_INDICES.networkEvents && !!f.fields.NetworkEvents)).toBe(
      FIELDS_SPEC_ROW_INDICES.networkEvents
    );
  });
});
