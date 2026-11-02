/// <reference types="cypress" />
import {
  cloneFieldsSpecMock,
  FIELDS_SPEC_ROW_INDICES,
  patchFieldsSpecMock
} from '../../../src/components/__tests-data__/fields-spec';

const flowRecords = cloneFieldsSpecMock();
patchFieldsSpecMock(flowRecords);

const flowRecordsResponse = {
  ...flowRecords.data,
  stats: { numQueries: 1, limitReached: false, dataSources: ['loki'] },
  unixTimestamp: Math.floor(Date.now() / 1000)
};

const selectRow = (rowIndex: number): void => {
  cy.get(`#netflow-table-row-${rowIndex}`)
    .scrollIntoView()
    .should('be.visible');
  // Rows outside the viewport are kept in the DOM without cells until the
  // table processes the scroll event. Wait for the row contents before
  // clicking so the selected record can open its drawer reliably in CI.
  cy.get(`#netflow-table-row-${rowIndex}`).find('td').should('have.length.greaterThan', 0);
  cy.get(`#netflow-table-row-${rowIndex}`).click();
};

describe('netflow-table', () => {
  beforeEach(() => {
    // this test bench only work with mocks
    cy.intercept('GET', '/api/loki/flow/records?*', {
      statusCode: 200,
      body: flowRecordsResponse
    });
    cy.intercept('/api/frontend-config', req => {
      req.continue(res => {
        switch (Cypress.currentTest.title) {
          case 'display pktDrop':
            res.body.features = ['pktDrop'];
            break;
          case 'display dnsTracking':
            res.body.features = ['dnsTracking'];
            break;
          case 'display flowRTT':
            res.body.features = ['flowRTT'];
            break;
          case 'display multiCluster':
            res.body.features = ['multiCluster'];
            break;
          case 'display zones':
            res.body.features = ['zones'];
            break;
          case 'display networkEvents':
            res.body.features = ['networkEvents'];
            break;
          default:
            // disable all features by default
            res.body.features = [];
            break;
        }
      });
    });
    cy.openNetflowTrafficPage(true);

    // move to table view
    cy.get('.tableTabButton').click();
    // clear default app filters
    cy.get('#clear-all-filters-button').click();
    // row indices below assume End Time descending (newest flows first)
    cy.get('#table-container').find('tr').its('length').should('be.gte', 10);
    // Default sort is End Time ascending; one click switches to descending.
    cy.get('thead').contains('End Time').click();
    cy.get('[aria-sort="descending"]').should('have.length', 1);
  });

  it('display standard content', () => {
    selectRow(FIELDS_SPEC_ROW_INDICES.standard);

    // source accordion
    cy.get('[data-test-id="group-2"]').contains('Source');
    cy.checkRecordField('SrcK8S_Name', 'Name', ['service-ca-operator-6d4bb6c9-crvqx']);
    cy.checkRecordField('SrcK8S_Type', 'Kind', ['Pod']);
    cy.checkRecordField('SrcAddr', 'IP', ['10.128.0.17']);
    cy.checkRecordField('SrcPort', 'Port', ['51628']);
    cy.checkRecordField('SrcMac', 'MAC', ['0a:58:0a:80:00:01']);

    // destination accordion
    cy.get('[data-test-id="group-3"]').contains('Destination');
    cy.checkRecordField('DstAddr', 'IP', ['172.20.0.1']);
    cy.checkRecordField('DstPort', 'Port', ['6443']);
    cy.checkRecordField('DstMac', 'MAC', ['0a:58:0a:80:00:02']);

    // others
    cy.checkRecordField('K8S_FlowLayer', 'Flow layer', ['infra']);

    cy.get('[data-test-id="group-5"]').contains('Protocol Info');
    cy.checkRecordField('Proto', 'Protocol', ['TCP']);
    cy.checkRecordField('Dscp', 'DSCP', ['Standard']);

    cy.checkRecordField('FlowDirection', 'Node Direction', ['Egress']);
    cy.checkRecordField('FlowDirInts', 'Interfaces and Directions', ['ovn-k8s-mp0', 'Ingress']);

    cy.checkRecordField('Bytes', 'Bytes', ['1109 bytes sent']);
    cy.checkRecordField('Packets', 'Packets', ['14 packets sent']);
  });

  it('display pktDrop', () => {
    selectRow(FIELDS_SPEC_ROW_INDICES.pktDrop);

    cy.checkRecordField('Bytes', 'Bytes', ['32 bytes dropped']);
    cy.checkRecordField('Packets', 'Packets', ['1 packets dropped', 'SKB_DROP_REASON_TCP_ACK_UNSENT_DATA']);
  });

  it('display dnsTracking', () => {
    selectRow(FIELDS_SPEC_ROW_INDICES.dns);

    cy.checkRecordField('DNSId', 'Id', ['49856']);
    cy.checkRecordField('DNSLatency', 'Latency', ['< 1ms']);
    cy.checkRecordField('DNSResponseCode', 'Response Code', ['No Error']);
    cy.checkRecordField('DNSErrNo', 'Error', ['2']);
  });

  it('display flowRTT', () => {
    selectRow(FIELDS_SPEC_ROW_INDICES.flowRTT);

    cy.checkRecordField('TimeFlowRttMs', 'Flow RTT', ['6ms']);
  });

  it('display multiCluster', () => {
    selectRow(FIELDS_SPEC_ROW_INDICES.multiCluster);

    cy.checkRecordField('ClusterName', 'Cluster', ['test-cluster']);
  });

  it('display zones', () => {
    selectRow(FIELDS_SPEC_ROW_INDICES.zonesSrc);
    cy.checkRecordField('SrcZone', 'Zone', ['us-east-1d']);

    selectRow(FIELDS_SPEC_ROW_INDICES.zonesDst);
    cy.checkRecordField('DstZone', 'Zone', ['us-east-1d']);
  });

  it('display networkEvents', () => {
    selectRow(FIELDS_SPEC_ROW_INDICES.networkEvents);

    cy.checkRecordField('NetworkEvents', 'Network Events', [
      'Allowed by default allow from local node policy, direction Ingress'
    ]);
  });
});
