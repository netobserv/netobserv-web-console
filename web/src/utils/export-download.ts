export const buildExportFilename = (prefix: string, extension: string): string => {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
  return `${prefix}_${stamp}.${extension}`;
};

export const metricsExportFilenamePrefix = (metricScope?: string): string => {
  const base = 'netobserv_metrics';
  if (!metricScope) {
    return base;
  }
  const sanitized = metricScope
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return sanitized ? `${base}_${sanitized}` : base;
};

export const downloadBlob = (blob: Blob, filename: string): void => {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const downloadExportBlob = (blob: Blob, prefix: string, format: string): void => {
  downloadBlob(blob, buildExportFilename(prefix, format));
};

export const parseExportError = async (data: Blob | unknown, status: number, statusText: string): Promise<string> => {
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed.message) {
        return `${parsed.message} [code=${status}]`;
      }
      if (text) {
        return `${text} [code=${status}]`;
      }
    } catch {
      // not JSON
    }
  }
  return `${statusText} [code=${status}]`;
};
