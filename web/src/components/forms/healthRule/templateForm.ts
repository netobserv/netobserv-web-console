/**
 * Helpers to wrap TemplateRuleForm for DynamicForm and unwrap for submit/preview.
 * Group-by uses "Cluster" in the form UI (SelectWidget cannot display empty string well).
 */
import { K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk';
import { defaultTemplateForm, FLPHealthRule, HealthRuleGroupBy, TemplateRuleForm } from './types';
import { thresholdToCRDString, thresholdToFormNumber } from './validators';
import { getHealthRuleDefault, healthRuleDefaultToFLP } from './variantDefaults';

export type HealthRuleFormData = {
  apiVersion: string;
  kind: string;
  metadata: { name: string };
  spec: TemplateRuleForm;
};

const toFormGroupBy = (groupBy?: HealthRuleGroupBy | string): string => (!groupBy ? 'Cluster' : String(groupBy));

const fromFormGroupBy = (groupBy?: string): HealthRuleGroupBy =>
  !groupBy || groupBy === 'Cluster' ? '' : (groupBy as HealthRuleGroupBy);

const toFormSpec = (form: TemplateRuleForm): TemplateRuleForm => ({
  ...form,
  variants: (form.variants || []).map(v => ({
    thresholds: { ...(v?.thresholds || {}) },
    groupBy: toFormGroupBy(v?.groupBy) as HealthRuleGroupBy,
    lowVolumeThreshold: v?.lowVolumeThreshold,
    trendOffset: v?.trendOffset,
    trendDuration: v?.trendDuration,
    mode: v?.mode
  }))
});

const fromFormSpec = (spec: TemplateRuleForm): TemplateRuleForm => ({
  template: spec.template,
  mode: spec.mode || 'Alert',
  variants: (spec.variants || []).map(v => ({
    thresholds: { ...(v?.thresholds || {}) },
    groupBy: fromFormGroupBy(v?.groupBy as string),
    lowVolumeThreshold: v?.lowVolumeThreshold,
    trendOffset: v?.trendOffset,
    trendDuration: v?.trendDuration,
    mode: v?.mode
  }))
});

export const templateFormToFLPHealthRule = (form: TemplateRuleForm): FLPHealthRule => ({
  template: form.template,
  mode: form.mode,
  variants: (form.variants || []).map(v => {
    const thresholds = v?.thresholds || {};
    const info = thresholdToCRDString(thresholds.info);
    const warning = thresholdToCRDString(thresholds.warning);
    const critical = thresholdToCRDString(thresholds.critical);
    const lowVolume = thresholdToCRDString(v?.lowVolumeThreshold);
    return {
      thresholds: {
        ...(info !== undefined ? { info } : {}),
        ...(warning !== undefined ? { warning } : {}),
        ...(critical !== undefined ? { critical } : {})
      },
      ...(v?.groupBy ? { groupBy: v.groupBy } : {}),
      ...(lowVolume !== undefined ? { lowVolumeThreshold: lowVolume } : {}),
      ...(v?.trendOffset ? { trendOffset: v.trendOffset } : {}),
      ...(v?.trendDuration ? { trendDuration: v.trendDuration } : {}),
      ...(v?.mode ? { mode: v.mode } : {})
    };
  })
});

/**
 * Resolve what to write into FlowCollector.healthRules.
 * - Empty variants + same mode as operator default → null (no override; keeps defaults).
 * - Empty variants + different mode → full defaults with the chosen mode (never write variants: []).
 * - Non-empty variants → explicit override.
 */
export const resolveTemplateRuleForSave = (form: TemplateRuleForm): FLPHealthRule | null => {
  const variants = form.variants || [];
  if (variants.length > 0) {
    return templateFormToFLPHealthRule(form);
  }
  const def = getHealthRuleDefault(form.template);
  if (!def) {
    return null;
  }
  if (form.mode && form.mode !== def.mode) {
    return {
      ...(healthRuleDefaultToFLP(def) as FLPHealthRule),
      mode: form.mode
    };
  }
  return null;
};

export const flpHealthRuleToTemplateForm = (rule: FLPHealthRule): TemplateRuleForm => ({
  template: rule.template as TemplateRuleForm['template'],
  mode: rule.mode || 'Alert',
  variants: (rule.variants || []).map(v => ({
    thresholds: {
      ...(thresholdToFormNumber(v?.thresholds?.info) !== undefined
        ? { info: thresholdToFormNumber(v?.thresholds?.info) }
        : {}),
      ...(thresholdToFormNumber(v?.thresholds?.warning) !== undefined
        ? { warning: thresholdToFormNumber(v?.thresholds?.warning) }
        : {}),
      ...(thresholdToFormNumber(v?.thresholds?.critical) !== undefined
        ? { critical: thresholdToFormNumber(v?.thresholds?.critical) }
        : {})
    },
    groupBy: (v.groupBy || '') as TemplateRuleForm['variants'][0]['groupBy'],
    lowVolumeThreshold: thresholdToFormNumber(v.lowVolumeThreshold),
    trendOffset: typeof v.trendOffset === 'string' ? v.trendOffset : undefined,
    trendDuration: typeof v.trendDuration === 'string' ? v.trendDuration : undefined,
    mode: v.mode
  }))
});

/**
 * Merge a health rule into FlowCollector.spec.processor.metrics.healthRules,
 * replacing any existing entry with the same template name.
 * Refuses empty variants (would wipe operator defaults).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mergeHealthRuleIntoFlowCollector = (flowCollector: any, rule: FLPHealthRule): any => {
  if (!rule?.template) {
    return flowCollector;
  }
  if (!rule.variants?.length) {
    throw new Error(
      `Cannot save health rule "${rule.template}" with empty variants; that would remove operator defaults`
    );
  }
  const next = JSON.parse(JSON.stringify(flowCollector || {}));
  if (!next.metadata) {
    next.metadata = { name: 'cluster' };
  }
  if (!next.spec) {
    next.spec = {};
  }
  if (!next.spec.processor) {
    next.spec.processor = {};
  }
  if (!next.spec.processor.metrics) {
    next.spec.processor.metrics = {};
  }
  const existing: FLPHealthRule[] = Array.isArray(next.spec.processor.metrics.healthRules)
    ? [...next.spec.processor.metrics.healthRules]
    : [];
  const idx = existing.findIndex(r => r.template === rule.template);
  if (idx >= 0) {
    existing[idx] = rule;
  } else {
    existing.push(rule);
  }
  next.spec.processor.metrics.healthRules = existing;
  return next;
};

/**
 * The wizard's one-shot seed can capture the CSVExample fallback (no resourceVersion)
 * before the FlowCollector watch resolves; without this the later save fails with
 * `resourceVersion: Invalid value: 0: must be specified for an update`. Spec edits made
 * before the watch resolves must survive, so only metadata is refreshed.
 */
export const syncFlowCollectorMeta = (prev: K8sResourceKind | null, live: K8sResourceKind): K8sResourceKind => {
  if (prev == null) {
    return live;
  }
  const liveMeta = live?.metadata || {};
  if (
    liveMeta.resourceVersion &&
    (prev.metadata?.resourceVersion !== liveMeta.resourceVersion || prev.metadata?.uid !== liveMeta.uid)
  ) {
    return {
      ...prev,
      metadata: {
        ...prev.metadata,
        resourceVersion: liveMeta.resourceVersion,
        uid: liveMeta.uid
      }
    };
  }
  return prev;
};

/** Remove a template override so the operator DefaultHealthRules apply again. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const removeHealthRuleFromFlowCollector = (flowCollector: any, template: string): any => {
  const next = JSON.parse(JSON.stringify(flowCollector || {}));
  const rules: FLPHealthRule[] = next?.spec?.processor?.metrics?.healthRules;
  if (!Array.isArray(rules)) {
    return next;
  }
  next.spec.processor.metrics.healthRules = rules.filter(r => r?.template !== template);
  if (next.spec.processor.metrics.healthRules.length === 0) {
    delete next.spec.processor.metrics.healthRules;
  }
  return next;
};
export const wrapTemplateForm = (form: TemplateRuleForm): HealthRuleFormData => ({
  apiVersion: 'netobserv.io/v1',
  kind: 'HealthRuleForm',
  metadata: { name: 'health-rule' },
  spec: toFormSpec(form)
});

export const unwrapTemplateForm = (data: HealthRuleFormData | null | undefined): TemplateRuleForm => {
  if (data?.spec?.template) {
    return fromFormSpec({
      template: data.spec.template,
      mode: data.spec.mode || 'Alert',
      variants: data.spec.variants || []
    });
  }
  return defaultTemplateForm();
};

export const templateFormDataToRule = (data: HealthRuleFormData | null | undefined): FLPHealthRule =>
  templateFormToFLPHealthRule(unwrapTemplateForm(data));

export const ruleToTemplateFormData = (rule: FLPHealthRule): HealthRuleFormData =>
  wrapTemplateForm(flpHealthRuleToTemplateForm(rule));

export const defaultTemplateFormData = (): HealthRuleFormData => wrapTemplateForm(defaultTemplateForm());

/** Seed form from a FlowCollector override, or operator DefaultHealthRules when absent. */
export const seedTemplateRule = (template: string, override?: FLPHealthRule): FLPHealthRule => {
  if (override) {
    return override;
  }
  const def = getHealthRuleDefault(template);
  if (def) {
    return healthRuleDefaultToFLP(def) as FLPHealthRule;
  }
  return {
    template,
    mode: 'Alert',
    variants: [{ thresholds: {} }]
  };
};
