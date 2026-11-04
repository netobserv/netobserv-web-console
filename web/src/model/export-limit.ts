import { limitValues } from '../components/dropdowns/query-options-panel';

/** Maximum rows/series allowed when "use maximum limit" is enabled for export. */
export const EXPORT_MAX_LIMIT = Math.max(...limitValues);

/**
 * Returns the limit to send on an export request.
 * When useMaxLimit is set and the current limit is below the export cap, raises it to EXPORT_MAX_LIMIT.
 */
export const resolveExportLimit = (currentLimit: number | undefined, useMaxLimit: boolean): number | undefined => {
  if (useMaxLimit && currentLimit !== undefined && currentLimit < EXPORT_MAX_LIMIT) {
    return EXPORT_MAX_LIMIT;
  }
  return currentLimit;
};
