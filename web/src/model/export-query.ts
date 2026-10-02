import * as _ from 'lodash';
import { ExportApiFormat } from './export-format';
import { FlowQuery } from './flow-query';

export type BuildExportQueryOptions = {
  format?: ExportApiFormat;
  columns?: string[];
};

export const buildExportQuery = (flowQuery: FlowQuery, options?: BuildExportQueryOptions | string[]) => {
  const resolvedOptions: BuildExportQueryOptions = Array.isArray(options) ? { columns: options } : options ?? {};

  const query = {
    ...flowQuery,
    format: resolvedOptions.format ?? 'csv'
    // no-explicit-any disabled: URLSearchParams actually accepts any object
    // even though its typescript def doesn't say so
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  if (resolvedOptions.columns) {
    query.columns = String(resolvedOptions.columns);
  }
  const omitEmpty = _.omitBy(query, a => a === undefined);
  return new URLSearchParams(omitEmpty).toString();
};
