import {
  CustomRuleForm,
  HealthRuleGroupBy,
  HealthRuleTemplate,
  HealthRuleThresholds,
  HealthRuleVariantForm,
  NETOBSERV_NAMESPACE_CANDIDATES,
  TemplateRuleForm,
  TRENDING_TEMPLATES
} from './types';

export type ValidationResult = {
  errors: string[];
  warnings: string[];
};

const emptyResult = (): ValidationResult => ({ errors: [], warnings: [] });

export const parseThresholdFloat = (value: string | number | undefined | null): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
};

export const thresholdToCRDString = (value: string | number | undefined | null): string | undefined => {
  const n = parseThresholdFloat(value);
  return n === undefined ? undefined : String(n);
};

export const thresholdToFormNumber = (value: string | number | undefined | null): number | undefined => {
  return parseThresholdFloat(value);
};

export const isGroupBySupported = (template: HealthRuleTemplate, groupBy: HealthRuleGroupBy | undefined): boolean => {
  const g = groupBy || '';
  switch (template) {
    case 'PacketDropsByDevice':
      return g !== 'Workload';
    case 'IPsecErrors':
      return g !== 'Workload' && g !== 'Namespace';
    case 'Ingress5xxErrors':
    case 'IngressHTTPLatencyTrend':
      return g !== 'Node' && g !== 'Workload';
    default:
      return true;
  }
};

export const validateThresholds = (thresholds: HealthRuleThresholds, pathPrefix: string): string[] => {
  const errors: string[] = [];
  const critical = parseThresholdFloat(thresholds.critical);
  const warning = parseThresholdFloat(thresholds.warning);
  const info = parseThresholdFloat(thresholds.info);

  if (critical === undefined && warning === undefined && info === undefined) {
    errors.push(`${pathPrefix}: at least one threshold (critical, warning, or info) is required`);
  }

  let lastThreshold = -1;
  const ordered: Array<{ name: string; value: number | undefined }> = [
    { name: 'critical', value: critical },
    { name: 'warning', value: warning },
    { name: 'info', value: info }
  ];

  for (const { name, value } of ordered) {
    if (value === undefined) {
      continue;
    }
    if (value < 0) {
      errors.push(`${pathPrefix}: ${name} threshold must not be negative: "${value}"`);
    } else if (lastThreshold >= 0 && value > lastThreshold) {
      errors.push(`${pathPrefix}: ${name} threshold must be lower than or equal to ${lastThreshold} (higher severity)`);
    } else {
      lastThreshold = value;
    }
  }
  return errors;
};

export const validateVariant = (
  template: HealthRuleTemplate,
  variant: HealthRuleVariantForm,
  index: number
): ValidationResult => {
  const result = emptyResult();
  const prefix = `variant[${index}]`;
  const thresholds = variant?.thresholds || {};

  if (!isGroupBySupported(template, variant?.groupBy)) {
    result.errors.push(`${prefix}: template ${template} does not support grouping by ${variant.groupBy}`);
  }

  result.errors.push(...validateThresholds(thresholds, prefix));

  if (variant?.lowVolumeThreshold) {
    if (parseThresholdFloat(variant.lowVolumeThreshold) === undefined) {
      result.errors.push(`${prefix}: cannot parse lowVolumeThreshold as float: "${variant.lowVolumeThreshold}"`);
    }
  }

  if (TRENDING_TEMPLATES.includes(template)) {
    // trend fields optional; if provided they should be non-empty duration-like strings
    if (variant?.trendOffset !== undefined && variant.trendOffset.trim() === '') {
      result.errors.push(`${prefix}: trendOffset cannot be empty when set`);
    }
    if (variant?.trendDuration !== undefined && variant.trendDuration.trim() === '') {
      result.errors.push(`${prefix}: trendDuration cannot be empty when set`);
    }
  }

  return result;
};

export const validateTemplateForm = (form: TemplateRuleForm): ValidationResult => {
  const result = emptyResult();
  if (!form.template) {
    result.errors.push('Template is required');
  }

  // Variants are optional: omitting them keeps operator defaults (or expands defaults when only mode changes on save).
  (form.variants || []).forEach((v, i) => {
    const vr = validateVariant(form.template, v, i);
    result.errors.push(...vr.errors);
    result.warnings.push(...vr.warnings);
  });

  if ((form.variants || []).length > 0) {
    result.warnings.push(
      'Customizing a template replaces the default configuration for that template. Include default variants if you want to keep them.'
    );
  }

  return result;
};

export const validateCustomForm = (form: CustomRuleForm, netobservNamespace?: string): ValidationResult => {
  const result = emptyResult();

  if (!form.name?.trim()) {
    result.errors.push('Resource name is required');
  } else if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/.test(form.name)) {
    result.errors.push('Resource name must be a valid Kubernetes DNS subdomain name');
  }

  if (!form.namespace?.trim()) {
    result.errors.push('Namespace is required');
  }

  if (!form.expr?.trim()) {
    result.errors.push('PromQL expression is required');
  }

  if (form.mode === 'Alert') {
    if (!form.alertName?.trim()) {
      result.errors.push('Alert name is required');
    }
    if (!form.severity) {
      result.errors.push('Severity is required for alert rules');
    }
  } else {
    if (!form.recordName?.trim()) {
      result.errors.push('Record metric name is required');
    } else if (!/^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(form.recordName)) {
      result.errors.push('Record name must be a valid Prometheus metric name');
    }
    const rt = form.health.recordingThresholds;
    if (
      !rt ||
      (parseThresholdFloat(rt.info) === undefined &&
        parseThresholdFloat(rt.warning) === undefined &&
        parseThresholdFloat(rt.critical) === undefined)
    ) {
      result.errors.push('At least one recording threshold is required for recording rules');
    } else {
      result.errors.push(...validateThresholds(rt, 'recordingThresholds'));
    }
  }

  const nsLabels = form.health.namespaceLabels?.filter(Boolean) || [];
  const nodeLabels = form.health.nodeLabels?.filter(Boolean) || [];
  if (nsLabels.length && nodeLabels.length) {
    result.errors.push('namespaceLabels and nodeLabels are mutually exclusive');
  }

  const wl = form.health.workloadLabels?.filter(Boolean) || [];
  const kinds = form.health.kindLabels?.filter(Boolean) || [];
  if ((wl.length && !kinds.length) || (!wl.length && kinds.length)) {
    result.warnings.push('workloadLabels and kindLabels should both be set for the Workloads tab');
  }

  const ns = form.namespace?.trim() || '';
  const risky = (netobservNamespace && ns === netobservNamespace) || NETOBSERV_NAMESPACE_CANDIDATES.includes(ns);
  if (risky) {
    result.warnings.push(
      'Custom rules in the NetObserv namespace may be deleted if Network Observability is uninstalled. Prefer another namespace such as openshift-monitoring.'
    );
  }

  return result;
};

export const validatePromQLSoft = async (
  expr: string,
  queryFn: (q: string) => Promise<unknown>
): Promise<ValidationResult> => {
  const result = emptyResult();
  if (!expr?.trim()) {
    result.errors.push('PromQL expression is required');
    return result;
  }
  try {
    const data = (await queryFn(expr)) as { status?: string; error?: string; errorType?: string };
    if (data?.status === 'error' || data?.error) {
      result.errors.push(data.error || data.errorType || 'PromQL query failed');
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    result.errors.push(`PromQL validation failed: ${msg}`);
  }
  return result;
};
