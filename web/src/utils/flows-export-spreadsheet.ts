import { TimeRange } from './datetime';
import { buildWorkbookXml, downloadSpreadsheetXml, rowsToWorksheetXml } from './spreadsheet-export';

export type FlowsExportRecord = {
  labels: Record<string, string>;
  fields: Record<string, unknown>;
};

/** JSON report returned by GET /api/loki/export?format=json. */
export type FlowsExportReport = {
  exportedAt: string;
  timeRange?: number | TimeRange | { from: string; to: string };
  flows: FlowsExportRecord[];
};

const TIME_COLUMNS = ['TimeFlowStartMs', 'TimeFlowEndMs', 'TimeReceived'];

export const collectFlowHeaders = (flows: FlowsExportRecord[]): string[] => {
  const labels: string[] = [];
  const fields: string[] = [];
  const labelSeen = new Set<string>();
  const fieldSeen = new Set<string>();

  for (const flow of flows) {
    for (const key of Object.keys(flow.labels)) {
      if (!labelSeen.has(key)) {
        labelSeen.add(key);
        labels.push(key);
      }
    }
    for (const key of Object.keys(flow.fields)) {
      if (TIME_COLUMNS.includes(key) || fieldSeen.has(key)) {
        continue;
      }
      fieldSeen.add(key);
      fields.push(key);
    }
  }

  return [...TIME_COLUMNS, ...labels, ...fields];
};

export const flowToSheetRow = (flow: FlowsExportRecord, headers: string[]): Record<string, string | number> => {
  const row: Record<string, string | number> = {};
  for (const header of headers) {
    if (TIME_COLUMNS.includes(header)) {
      const value = flow.fields[header];
      row[header] = value === undefined || value === null ? '' : String(value);
    } else if (Object.prototype.hasOwnProperty.call(flow.labels, header)) {
      row[header] = flow.labels[header];
    } else {
      const value = flow.fields[header];
      row[header] = value === undefined || value === null ? '' : String(value);
    }
  }
  return row;
};

export const buildSpreadsheetXml = (report: FlowsExportReport): string => {
  const headers = collectFlowHeaders(report.flows);
  const rows = report.flows.map(flow => flowToSheetRow(flow, headers));
  return buildWorkbookXml([rowsToWorksheetXml('Flows', headers, rows)]);
};

export const downloadSpreadsheetReport = (report: FlowsExportReport, filenamePrefix = 'netobserv_flows'): void => {
  downloadSpreadsheetXml(buildSpreadsheetXml(report), filenamePrefix);
};
