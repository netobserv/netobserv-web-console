import { EXPORT_MAX_LIMIT, resolveExportLimit } from '../export-limit';

describe('export-limit', () => {
  it('raises limit to EXPORT_MAX_LIMIT when useMaxLimit is enabled', () => {
    expect(resolveExportLimit(10, true)).toBe(EXPORT_MAX_LIMIT);
    expect(resolveExportLimit(500, true)).toBe(EXPORT_MAX_LIMIT);
  });

  it('keeps current limit when useMaxLimit is disabled', () => {
    expect(resolveExportLimit(10, false)).toBe(10);
    expect(resolveExportLimit(500, false)).toBe(500);
  });

  it('keeps limit when already at or above EXPORT_MAX_LIMIT', () => {
    expect(resolveExportLimit(EXPORT_MAX_LIMIT, true)).toBe(EXPORT_MAX_LIMIT);
  });

  it('returns undefined when current limit is undefined', () => {
    expect(resolveExportLimit(undefined, true)).toBeUndefined();
  });
});
