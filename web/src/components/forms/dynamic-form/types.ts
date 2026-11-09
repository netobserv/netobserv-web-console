export type DynamicFormFieldDependency = {
  controlFieldPath: string[];
  controlFieldValue: string | string[];
  controlFieldName: string;
  /**
   * `equals` (default): show when the value at `controlFieldPath` (under spec) equals `controlFieldValue`.
   * `controlUnset`: show when the control path is effectively unset (missing key, null, or empty array).
   */
  matchMode?: 'equals' | 'controlUnset';
};

export type UiSchemaOptionsWithDependency = {
  flat?: string;
  dependency?: DynamicFormFieldDependency;
  /** When `matchMode: 'controlUnset'` pauses the array, tooltip for the disabled Add action. */
  addDisabledTooltip?: string;
  /** When true, FieldSet accordion starts expanded (root always does). */
  defaultExpanded?: boolean;
  /** When true, populated array fields start expanded. */
  expandWhenPopulated?: boolean;
  /** Groups FlowCapture filtering-related fields into one parent section. */
  flowCaptureFiltersGroup?: boolean;
};

export type DynamicFormSchemaError = {
  title: string;
  message: string;
};
