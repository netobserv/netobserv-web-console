/**
 * Default PrometheusRule form data and helpers for the Health Rule wizard.
 * Composes NetObserv labels/annotations on save; form uses structured fields instead of raw maps.
 */
import * as _ from 'lodash';
import { prometheusRuleUISchema } from './prometheusUISchema';
import {
  CustomRuleForm,
  DEFAULT_NAMESPACE_SUGGESTION,
  defaultCustomForm,
  HealthAnnotationFields,
  HealthRuleMode,
  HealthRuleThresholds,
  PrometheusRuleResource
} from './types';

export const NETWORK_HEALTH_ANNOTATION_KEY = 'netobserv_io_network_health';
export const RECORDING_METADATA_ANNOTATION = 'netobserv.io/network-health';

const isPresentScalar = (value: string | number | undefined | null): boolean =>
  value !== undefined && value !== null && value !== '';

export const buildAlertHealthAnnotation = (fields: HealthAnnotationFields): string => {
  const payload: Record<string, unknown> = {};
  if (fields.namespaceLabels?.length) {
    payload.namespaceLabels = fields.namespaceLabels;
  }
  if (fields.nodeLabels?.length) {
    payload.nodeLabels = fields.nodeLabels;
  }
  if (fields.workloadLabels?.length) {
    payload.workloadLabels = fields.workloadLabels;
  }
  if (fields.kindLabels?.length) {
    payload.kindLabels = fields.kindLabels;
  }
  if (fields.unit) {
    payload.unit = fields.unit;
  }
  if (isPresentScalar(fields.upperBound)) {
    payload.upperBound = fields.upperBound;
  }
  // Network Health / operator expect alertThreshold (not threshold).
  if (isPresentScalar(fields.threshold)) {
    payload.alertThreshold = fields.threshold;
  }
  return JSON.stringify(payload);
};
export const buildRecordingHealthInner = (fields: HealthAnnotationFields): string => {
  const payload: Record<string, unknown> = {};
  if (fields.namespaceLabels?.length) {
    payload.namespaceLabels = fields.namespaceLabels;
  }
  if (fields.nodeLabels?.length) {
    payload.nodeLabels = fields.nodeLabels;
  }
  if (fields.workloadLabels?.length) {
    payload.workloadLabels = fields.workloadLabels;
  }
  if (fields.kindLabels?.length) {
    payload.kindLabels = fields.kindLabels;
  }
  if (fields.unit) {
    payload.unit = fields.unit;
  }
  if (isPresentScalar(fields.upperBound)) {
    payload.upperBound = fields.upperBound;
  }
  if (fields.recordingThresholds) {
    const rt: HealthRuleThresholds = {};
    if (isPresentScalar(fields.recordingThresholds.info)) {
      rt.info = fields.recordingThresholds.info;
    }
    if (isPresentScalar(fields.recordingThresholds.warning)) {
      rt.warning = fields.recordingThresholds.warning;
    }
    if (isPresentScalar(fields.recordingThresholds.critical)) {
      rt.critical = fields.recordingThresholds.critical;
    }
    payload.recordingThresholds = rt;
  }
  return JSON.stringify(payload);
};

export const buildRecordingMetadataAnnotation = (
  recordName: string,
  summary: string | undefined,
  description: string | undefined,
  fields: HealthAnnotationFields
): string => {
  return JSON.stringify(
    {
      [recordName]: {
        ...(summary ? { summary } : {}),
        ...(description ? { description } : {}),
        [NETWORK_HEALTH_ANNOTATION_KEY]: buildRecordingHealthInner(fields)
      }
    },
    null,
    2
  );
};

export const parseRecordingMetadata = (
  annotation: string | undefined
): Record<string, { summary?: string; description?: string; netobserv_io_network_health?: string }> => {
  if (!annotation) {
    return {};
  }
  try {
    return JSON.parse(annotation);
  } catch {
    return {};
  }
};

export const parseHealthAnnotation = (raw: string | undefined): HealthAnnotationFields => {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as HealthAnnotationFields & { alertThreshold?: string };
    // Accept both operator key (alertThreshold) and legacy form key (threshold).
    if (parsed.alertThreshold && !parsed.threshold) {
      parsed.threshold = parsed.alertThreshold;
    }
    return parsed;
  } catch {
    return {};
  }
};

export const commaSeparatedToList = (value: string): string[] =>
  value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

export const listToCommaSeparated = (list?: string[]): string => (list || []).join(', ');

export type RuleHealthDisplay = {
  unit?: string;
  upperBound?: string;
  threshold?: string;
  namespaceLabels?: string;
  nodeLabels?: string;
  workloadLabels?: string;
  kindLabels?: string;
  infoThreshold?: string;
  warningThreshold?: string;
  criticalThreshold?: string;
};

/** Form-time rule shape: Prometheus rule + optional healthDisplay before annotation compose. */
export type PrometheusRuleFormRule = {
  alert?: string;
  record?: string;
  expr?: string;
  for?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  healthDisplay?: RuleHealthDisplay;
};

type PrometheusRuleFormGroup = {
  name?: string;
  interval?: string;
  rules?: PrometheusRuleFormRule[];
};

const healthDisplayToFields = (hd?: RuleHealthDisplay): HealthAnnotationFields => {
  if (!hd) {
    return {};
  }
  const recordingThresholds = {
    ...(hd.infoThreshold ? { info: hd.infoThreshold } : {}),
    ...(hd.warningThreshold ? { warning: hd.warningThreshold } : {}),
    ...(hd.criticalThreshold ? { critical: hd.criticalThreshold } : {})
  };
  return {
    unit: hd.unit,
    upperBound: hd.upperBound,
    threshold: hd.threshold,
    namespaceLabels: commaSeparatedToList(hd.namespaceLabels || ''),
    nodeLabels: commaSeparatedToList(hd.nodeLabels || ''),
    workloadLabels: commaSeparatedToList(hd.workloadLabels || ''),
    kindLabels: commaSeparatedToList(hd.kindLabels || ''),
    ...(Object.keys(recordingThresholds).length ? { recordingThresholds } : {})
  };
};

const fieldsToHealthDisplay = (fields: HealthAnnotationFields): RuleHealthDisplay => ({
  unit: fields.unit,
  upperBound: fields.upperBound,
  threshold: fields.threshold,
  namespaceLabels: (fields.namespaceLabels || []).join(', '),
  nodeLabels: (fields.nodeLabels || []).join(', '),
  workloadLabels: (fields.workloadLabels || []).join(', '),
  kindLabels: (fields.kindLabels || []).join(', '),
  infoThreshold: fields.recordingThresholds?.info !== undefined ? String(fields.recordingThresholds.info) : undefined,
  warningThreshold:
    fields.recordingThresholds?.warning !== undefined ? String(fields.recordingThresholds.warning) : undefined,
  criticalThreshold:
    fields.recordingThresholds?.critical !== undefined ? String(fields.recordingThresholds.critical) : undefined
});

const hasHealthDisplayContent = (hd?: RuleHealthDisplay): boolean => {
  if (!hd) {
    return false;
  }
  return Boolean(
    hd.unit ||
      hd.upperBound ||
      hd.threshold ||
      hd.namespaceLabels ||
      hd.nodeLabels ||
      hd.workloadLabels ||
      hd.kindLabels ||
      hd.infoThreshold ||
      hd.warningThreshold ||
      hd.criticalThreshold
  );
};

export const defaultPrometheusRuleFormData = (mode: HealthRuleMode = 'Alert') => {
  const isAlert = mode === 'Alert';
  const healthDisplay: RuleHealthDisplay = { unit: '%' };
  return {
    apiVersion: 'monitoring.coreos.com/v1',
    kind: 'PrometheusRule',
    metadata: {
      name: '',
      namespace: DEFAULT_NAMESPACE_SUGGESTION,
      labels: {
        netobserv: 'true'
      }
    },
    spec: {
      groups: [
        {
          name: '',
          rules: [
            isAlert
              ? {
                  alert: '',
                  expr: '',
                  for: '5m',
                  labels: {
                    severity: 'warning',
                    netobserv: 'true'
                  },
                  annotations: {
                    summary: '',
                    message: ''
                  },
                  healthDisplay
                }
              : {
                  record: '',
                  expr: '',
                  labels: {
                    netobserv: 'true'
                  },
                  annotations: {
                    summary: '',
                    message: ''
                  },
                  healthDisplay
                }
          ]
        }
      ]
    }
  };
};

/** Preserve shared form fields while switching Alert ↔ Recording mode. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const applyPrometheusRuleMode = (pr: any, mode: HealthRuleMode): any => {
  const next = _.cloneDeep(pr || defaultPrometheusRuleFormData(mode));
  const rule = next.spec?.groups?.[0]?.rules?.[0] as PrometheusRuleFormRule | undefined;
  if (!rule) {
    return defaultPrometheusRuleFormData(mode);
  }
  if (mode === 'Alert') {
    const previousRecord = rule.record;
    delete rule.record;
    rule.alert = rule.alert || previousRecord || '';
    rule.for = rule.for || '5m';
    rule.labels = {
      ...(rule.labels || {}),
      severity: rule.labels?.severity || 'warning',
      netobserv: 'true'
    };
    rule.annotations = {
      ...(rule.annotations || {}),
      summary: rule.annotations?.summary || '',
      message: rule.annotations?.message || rule.annotations?.description || ''
    };
  } else {
    const previousAlert = rule.alert;
    delete rule.alert;
    delete rule.for;
    rule.record = rule.record || previousAlert || '';
    rule.labels = {
      ...(rule.labels || {}),
      netobserv: 'true'
    };
    delete rule.labels.severity;
    rule.annotations = {
      ...(rule.annotations || {}),
      summary: rule.annotations?.summary || '',
      message: rule.annotations?.message || rule.annotations?.description || ''
    };
  }
  return next;
};

/** Hide Alert-only or Recording-only fields based on wizard mode. */
export const prometheusRuleUISchemaForMode = (mode: HealthRuleMode) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schema: any = _.cloneDeep(prometheusRuleUISchema);
  const ruleItems = schema.spec?.groups?.items?.rules?.items;
  if (!ruleItems) {
    return schema;
  }
  const hidden = {
    'ui:widget': 'hidden',
    'ui:options': { label: false }
  };
  if (mode === 'Alert') {
    ruleItems.record = hidden;
    if (ruleItems.healthDisplay) {
      ruleItems.healthDisplay['ui:description'] =
        'Optional. Controls how the alert appears on Network Health (unit, labels, and score threshold).';
      ruleItems.healthDisplay.infoThreshold = hidden;
      ruleItems.healthDisplay.warningThreshold = hidden;
      ruleItems.healthDisplay.criticalThreshold = hidden;
    }
  } else {
    ruleItems.alert = hidden;
    ruleItems.for = hidden;
    ruleItems.labels = hidden;
    if (ruleItems.healthDisplay) {
      ruleItems.healthDisplay['ui:description'] =
        'At least one severity threshold is required so Network Health can score the metric. Other fields are optional.';
      ruleItems.healthDisplay.threshold = hidden;
    }
  }
  return schema;
};

/**
 * Inject NetObserv discovery labels and compose health annotations from form fields.
 * Strips form-only `healthDisplay` so the result is a valid PrometheusRule.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ensureNetworkHealthLabels = (pr: any, mode: HealthRuleMode = 'Alert'): any => {
  const next = _.cloneDeep(pr || {});
  if (!next.metadata) {
    next.metadata = {};
  }
  next.metadata.labels = {
    ...(next.metadata.labels || {}),
    netobserv: 'true'
  };

  type RecordingMeta = {
    summary?: string;
    description?: string;
    fields: HealthAnnotationFields;
  };
  const recordingMeta: Record<string, RecordingMeta> = {};

  (next.spec?.groups || []).forEach((g: PrometheusRuleFormGroup) => {
    (g.rules || []).forEach((rule: PrometheusRuleFormRule) => {
      const healthDisplay = rule.healthDisplay;
      const fields = healthDisplayToFields(healthDisplay);
      delete rule.healthDisplay;

      rule.labels = {
        ...(rule.labels || {}),
        netobserv: 'true',
        ...(mode === 'Alert' ? { severity: rule.labels?.severity || 'warning' } : {})
      };

      const summary = rule.annotations?.summary || '';
      const message = rule.annotations?.message || rule.annotations?.description || '';

      if (mode === 'Alert') {
        rule.annotations = {
          ...(rule.annotations || {}),
          ...(summary ? { summary } : {}),
          ...(message ? { message } : {})
        };
        if (hasHealthDisplayContent(healthDisplay)) {
          rule.annotations[NETWORK_HEALTH_ANNOTATION_KEY] = buildAlertHealthAnnotation(fields);
        }
      } else {
        const preserved = { ...(rule.annotations || {}) };
        delete preserved.summary;
        delete preserved.message;
        delete preserved.description;
        delete preserved[NETWORK_HEALTH_ANNOTATION_KEY];
        if (Object.keys(preserved).length) {
          rule.annotations = preserved;
        } else {
          delete rule.annotations;
        }
        const recordName = rule.record as string | undefined;
        if (recordName) {
          recordingMeta[recordName] = {
            summary,
            description: message,
            fields: hasHealthDisplayContent(healthDisplay)
              ? fields
              : {
                  unit: '%',
                  recordingThresholds: { info: '10', warning: '25', critical: '50' }
                }
          };
        }
      }
    });
  });

  if (mode === 'Recording' && Object.keys(recordingMeta).length > 0) {
    const built: Record<string, unknown> = {};
    Object.entries(recordingMeta).forEach(([recordName, meta]) => {
      Object.assign(
        built,
        JSON.parse(buildRecordingMetadataAnnotation(recordName, meta.summary, meta.description, meta.fields))
      );
    });
    next.metadata.annotations = {
      ...(next.metadata.annotations || {}),
      [RECORDING_METADATA_ANNOTATION]: JSON.stringify(built, null, 2)
    };
  }

  return next;
};

/**
 * When loading an existing PrometheusRule for edit, expand NetObserv annotations
 * into form-friendly `healthDisplay` + summary/message fields.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prometheusRuleToFormData = (pr: any): any => {
  const next = _.cloneDeep(pr || {});
  const firstRule = next.spec?.groups?.[0]?.rules?.[0];
  const mode: HealthRuleMode = firstRule?.record ? 'Recording' : 'Alert';
  const recordingMeta = parseRecordingMetadata(next.metadata?.annotations?.[RECORDING_METADATA_ANNOTATION]);

  (next.spec?.groups || []).forEach((g: PrometheusRuleFormGroup) => {
    (g.rules || []).forEach((rule: PrometheusRuleFormRule) => {
      if (mode === 'Alert') {
        const healthRaw = rule.annotations?.[NETWORK_HEALTH_ANNOTATION_KEY];
        rule.labels = {
          severity: rule.labels?.severity || 'warning',
          netobserv: 'true'
        };
        rule.annotations = {
          summary: rule.annotations?.summary || '',
          message: rule.annotations?.message || rule.annotations?.description || ''
        };
        rule.healthDisplay = fieldsToHealthDisplay(parseHealthAnnotation(healthRaw));
      } else {
        const entry = (rule.record && recordingMeta[rule.record]) || Object.values(recordingMeta)[0] || {};
        rule.labels = { netobserv: 'true' };
        rule.annotations = {
          summary: entry.summary || '',
          message: entry.description || ''
        };
        rule.healthDisplay = fieldsToHealthDisplay(parseHealthAnnotation(entry.netobserv_io_network_health));
      }
    });
  });

  return next;
};

export const buildPrometheusRule = (
  form: CustomRuleForm,
  existing?: PrometheusRuleResource
): PrometheusRuleResource => {
  const mode = form.mode;
  const labels = { netobserv: 'true' as const };
  const ruleLabels = mode === 'Alert' ? { ...labels, severity: form.severity || 'warning' } : { ...labels };

  const ruleAnnotations =
    mode === 'Alert'
      ? {
          summary: form.summary || form.alertName || '',
          message: form.description || form.summary || '',
          [NETWORK_HEALTH_ANNOTATION_KEY]: buildAlertHealthAnnotation(form.health)
        }
      : undefined;

  const rule =
    mode === 'Alert'
      ? {
          alert: form.alertName || form.name,
          expr: form.expr,
          for: form.for || '5m',
          labels: ruleLabels,
          annotations: ruleAnnotations
        }
      : {
          record: form.recordName || form.name,
          expr: form.expr,
          labels: ruleLabels
        };

  const metadataAnnotations =
    mode === 'Recording'
      ? {
          [RECORDING_METADATA_ANNOTATION]: buildRecordingMetadataAnnotation(
            form.recordName || form.name,
            form.summary,
            form.description,
            form.health
          )
        }
      : existing?.metadata?.annotations;

  return {
    apiVersion: 'monitoring.coreos.com/v1',
    kind: 'PrometheusRule',
    metadata: {
      name: form.name,
      namespace: form.namespace,
      labels: {
        ...(existing?.metadata?.labels || {}),
        netobserv: 'true'
      },
      ...(metadataAnnotations ? { annotations: metadataAnnotations } : {}),
      ...(existing?.metadata?.resourceVersion ? { resourceVersion: existing.metadata.resourceVersion } : {}),
      ...(existing?.metadata?.uid ? { uid: existing.metadata.uid } : {})
    },
    spec: {
      groups: [
        {
          name: existing?.spec?.groups?.[0]?.name || form.name || '',
          ...(form.groupInterval ? { interval: form.groupInterval } : {}),
          rules: [rule]
        }
      ]
    }
  };
};

/**
 * Map DynamicForm PrometheusRule form data into CustomRuleForm for shared validators.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prometheusFormDataToCustomForm = (data: any, mode: HealthRuleMode): CustomRuleForm => {
  const base = defaultCustomForm();
  const group = data?.spec?.groups?.[0];
  const rule = group?.rules?.[0] as PrometheusRuleFormRule | undefined;
  const hd = healthDisplayToFields(rule?.healthDisplay);
  return {
    ...base,
    name: data?.metadata?.name || '',
    namespace: data?.metadata?.namespace || '',
    mode,
    expr: rule?.expr || '',
    alertName: rule?.alert || '',
    recordName: rule?.record || '',
    severity: (rule?.labels?.severity as CustomRuleForm['severity']) || 'warning',
    for: rule?.for || '5m',
    summary: rule?.annotations?.summary || '',
    description: rule?.annotations?.message || rule?.annotations?.description || '',
    health: {
      ...base.health,
      ...hd,
      recordingThresholds: hd.recordingThresholds || base.health.recordingThresholds
    },
    groupInterval: group?.interval
  };
};
