import { buildSpreadsheetXml, MetricsExportReport } from '../metrics-export-spreadsheet';

describe('metrics-export-spreadsheet', () => {
  it('builds spreadsheet xml with metrics and topology worksheets', () => {
    const report: MetricsExportReport = {
      exportedAt: '2026-07-13T09:00:00.000Z',
      timeRange: 300,
      metrics: [
        {
          metricGroup: 'rate.bytes',
          series: 'a -> b',
          timestamp: 1,
          timestampIso: '1970-01-01T00:00:01.000Z',
          value: 42
        }
      ],
      topologyEdges: [
        {
          metricGroup: 'rate.bytes',
          sourceKind: 'Pod',
          sourceName: 'a',
          destinationKind: 'Pod',
          destinationName: 'b',
          sum: 42,
          avg: 42,
          min: 42,
          max: 42,
          latest: 42
        }
      ]
    };

    const xml = buildSpreadsheetXml(report);
    expect(xml).toContain('ss:Name="Metrics"');
    expect(xml).toContain('ss:Name="Topology edges"');
  });
});
