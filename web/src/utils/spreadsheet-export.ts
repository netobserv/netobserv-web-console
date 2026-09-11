import { buildExportFilename, downloadBlob } from './export-download';

export const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const cellXml = (value: string | number | boolean | undefined | null): string => {
  if (value === undefined || value === null) {
    return '<Cell><Data ss:Type="String"></Data></Cell>';
  }
  if (typeof value === 'number') {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return `<Cell><Data ss:Type="String">${escapeXml(text)}</Data></Cell>`;
};

export const rowsToWorksheetXml = (
  sheetName: string,
  headers: string[],
  rows: Record<string, string | number>[]
): string => {
  const headerRow = `<Row>${headers.map(header => cellXml(header)).join('')}</Row>`;
  const dataRows = rows.map(row => `<Row>${headers.map(header => cellXml(row[header])).join('')}</Row>`).join('');
  return `<Worksheet ss:Name="${escapeXml(sheetName)}"><Table>${headerRow}${dataRows}</Table></Worksheet>`;
};

export const buildWorkbookXml = (worksheets: string[]): string => `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${worksheets.join('\n')}
</Workbook>`;

export const downloadSpreadsheetXml = (xml: string, filenamePrefix: string): void => {
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  downloadBlob(blob, buildExportFilename(filenamePrefix, 'xls'));
};
