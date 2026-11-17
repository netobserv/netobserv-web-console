import { FlowScope } from '../model/flow-query';
import { TimeRange } from './datetime';
import { buildWorkbookXml, downloadSpreadsheetXml, rowsToWorksheetXml } from './spreadsheet-export';

export type MetricSeriesRow = {
  metricGroup: string;
  series: string;
  timestamp: number;
  timestampIso: string;
  value: number | null;
  sourceKind?: string;
  sourceName?: string;
  destinationKind?: string;
  destinationName?: string;
};

export type TopologyEdgeRow = {
  metricGroup: string;
  sourceKind: string;
  sourceName: string;
  destinationKind: string;
  destinationName: string;
  sum: number | null;
  avg: number | null;
  min: number | null;
  max: number | null;
  latest: number | null;
};

/** JSON report returned by GET/POST /api/flow/metrics/export. */
export type MetricsExportReport = {
  exportedAt: string;
  timeRange: number | TimeRange | { from: string; to: string };
  metricScope?: FlowScope;
  metrics: MetricSeriesRow[];
  topologyEdges?: TopologyEdgeRow[];
};

const sheetNumber = (v: number | null | undefined): string | number => (v === null || v === undefined ? '' : v);

const metricSeriesToSheetRows = (rows: MetricSeriesRow[]): Record<string, string | number>[] =>
  rows.map(row => ({
    metricGroup: row.metricGroup,
    series: row.series,
    timestamp: row.timestamp,
    timestampIso: row.timestampIso,
    value: sheetNumber(row.value),
    sourceKind: row.sourceKind ?? '',
    sourceName: row.sourceName ?? '',
    destinationKind: row.destinationKind ?? '',
    destinationName: row.destinationName ?? ''
  }));

const topologyEdgesToSheetRows = (rows: TopologyEdgeRow[]): Record<string, string | number>[] =>
  rows.map(row => ({
    metricGroup: row.metricGroup,
    sourceKind: row.sourceKind,
    sourceName: row.sourceName,
    destinationKind: row.destinationKind,
    destinationName: row.destinationName,
    sum: sheetNumber(row.sum),
    avg: sheetNumber(row.avg),
    min: sheetNumber(row.min),
    max: sheetNumber(row.max),
    latest: sheetNumber(row.latest)
  }));

const METRIC_HEADERS = [
  'metricGroup',
  'series',
  'timestamp',
  'timestampIso',
  'value',
  'sourceKind',
  'sourceName',
  'destinationKind',
  'destinationName'
];

const EDGE_HEADERS = [
  'metricGroup',
  'sourceKind',
  'sourceName',
  'destinationKind',
  'destinationName',
  'sum',
  'avg',
  'min',
  'max',
  'latest'
];

export const buildSpreadsheetXml = (report: MetricsExportReport): string => {
  const worksheets = [rowsToWorksheetXml('Metrics', METRIC_HEADERS, metricSeriesToSheetRows(report.metrics))];

  if (report.topologyEdges?.length) {
    worksheets.push(rowsToWorksheetXml('Topology edges', EDGE_HEADERS, topologyEdgesToSheetRows(report.topologyEdges)));
  }

  return buildWorkbookXml(worksheets);
};

export const downloadSpreadsheetReport = (report: MetricsExportReport, filenamePrefix = 'netobserv_metrics'): void => {
  downloadSpreadsheetXml(buildSpreadsheetXml(report), filenamePrefix);
};
