import { Feature } from '../model/config';
import { ScopeConfigDef } from '../model/scope';
import { ColumnConfigDef } from './columns';

export const isScopeAvailable = (
  scope: ScopeConfigDef,
  features: Feature[],
  promLabels: string[],
  columns: ColumnConfigDef[],
  isPromOnly: boolean
): boolean => {
  // If the scope relate to a feature, that feature must be enabled
  if (scope.feature && !features.includes(scope.feature)) {
    return false;
  }
  if (isPromOnly) {
    // Prometheus must handle all scope labels (unless label is for a disabled feature)
    return scope.labels.every(label => {
      // Ignore absent labels for disabled features
      const col = columns.find(c => c.field === label);
      if (col && col.feature && !features.includes(col.feature)) {
        return true;
      }
      return promLabels.includes(label);
    });
  }
  return true;
};
