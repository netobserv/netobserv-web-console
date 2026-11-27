import { buildSpreadsheetXml, collectFlowHeaders, flowToSheetRow } from '../flows-export-spreadsheet';

describe('flows-export-spreadsheet', () => {
  const sampleFlow = {
    labels: { SrcK8S_Namespace: 'default', app: 'netobserv' },
    fields: {
      TimeFlowStartMs: 1708011867121,
      TimeFlowEndMs: 1708011867121,
      TimeReceived: 1708011867,
      SrcAddr: '10.0.1.7',
      Bytes: 66
    }
  };

  it('orders headers like CSV export', () => {
    expect(collectFlowHeaders([sampleFlow])).toEqual([
      'TimeFlowStartMs',
      'TimeFlowEndMs',
      'TimeReceived',
      'SrcK8S_Namespace',
      'app',
      'SrcAddr',
      'Bytes'
    ]);
  });

  it('builds a flat row per flow', () => {
    const headers = collectFlowHeaders([sampleFlow]);
    expect(flowToSheetRow(sampleFlow, headers)).toEqual({
      TimeFlowStartMs: '1708011867121',
      TimeFlowEndMs: '1708011867121',
      TimeReceived: '1708011867',
      SrcK8S_Namespace: 'default',
      app: 'netobserv',
      SrcAddr: '10.0.1.7',
      Bytes: '66'
    });
  });

  it('builds spreadsheet XML workbook', () => {
    const xml = buildSpreadsheetXml({ exportedAt: '2026-01-01T00:00:00Z', flows: [sampleFlow] });
    expect(xml).toContain('<?mso-application progid="Excel.Sheet"?>');
    expect(xml).toContain('ss:Name="Flows"');
    expect(xml).toContain('SrcAddr');
    expect(xml).toContain('10.0.1.7');
  });
});
