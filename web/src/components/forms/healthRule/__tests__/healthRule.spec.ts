import { isK8sConflictError } from '../../utils';
import { resolveHealthRuleWizardArgs } from '../paths';
import {
  buildAlertHealthAnnotation,
  buildPrometheusRule,
  buildRecordingMetadataAnnotation,
  defaultPrometheusRuleFormData,
  ensureNetworkHealthLabels,
  NETWORK_HEALTH_ANNOTATION_KEY,
  parseHealthAnnotation,
  prometheusFormDataToCustomForm,
  prometheusRuleToFormData
} from '../prometheusForm';
import {
  flpHealthRuleToTemplateForm,
  mergeHealthRuleIntoFlowCollector,
  removeHealthRuleFromFlowCollector,
  resolveTemplateRuleForSave,
  syncFlowCollectorMeta,
  templateFormToFLPHealthRule
} from '../templateForm';
import { defaultCustomForm, defaultTemplateForm } from '../types';
import { isGroupBySupported, validateCustomForm, validateTemplateForm, validateThresholds } from '../validators';

describe('health-rule validators', () => {
  it('rejects empty thresholds', () => {
    const errors = validateThresholds({}, 't');
    expect(errors[0]).toContain('at least one threshold');
  });

  it('rejects inverted severity ordering', () => {
    const errors = validateThresholds({ critical: '5', warning: '20' }, 't');
    expect(errors.some(e => e.includes('lower than'))).toBe(true);
  });

  it('accepts ordered thresholds', () => {
    expect(validateThresholds({ critical: '30', warning: '20', info: '10' }, 't')).toEqual([]);
  });

  it('validates groupBy support for IPsecErrors', () => {
    expect(isGroupBySupported('IPsecErrors', 'Node')).toBe(true);
    expect(isGroupBySupported('IPsecErrors', 'Namespace')).toBe(false);
    expect(isGroupBySupported('IPsecErrors', 'Workload')).toBe(false);
  });

  it('accepts template form without variants', () => {
    const result = validateTemplateForm(defaultTemplateForm());
    expect(result.errors).toEqual([]);
  });

  it('validates variant thresholds when variants are provided', () => {
    const form = defaultTemplateForm();
    form.variants = [{ thresholds: {} }];
    const result = validateTemplateForm(form);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('validates custom alert form', () => {
    const form = defaultCustomForm();
    form.name = 'my-rule';
    form.alertName = 'MyAlert';
    form.expr = 'up == 0';
    const result = validateCustomForm(form);
    expect(result.errors).toEqual([]);
  });

  it('warns about netobserv namespace', () => {
    const form = defaultCustomForm();
    form.name = 'my-rule';
    form.alertName = 'MyAlert';
    form.expr = 'up == 0';
    form.namespace = 'netobserv';
    const result = validateCustomForm(form);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('health-rule builders', () => {
  it('merges health rule into FlowCollector by template', () => {
    const fc = {
      metadata: { name: 'cluster' },
      spec: {
        processor: {
          metrics: {
            healthRules: [{ template: 'DNSErrors', mode: 'Alert', variants: [{ thresholds: { warning: '1' } }] }]
          }
        }
      }
    };
    const rule = templateFormToFLPHealthRule({
      template: 'DNSErrors',
      mode: 'Recording',
      variants: [{ thresholds: { critical: '5' }, groupBy: 'Namespace' }]
    });
    const next = mergeHealthRuleIntoFlowCollector(fc, rule);
    expect(next.spec.processor.metrics.healthRules).toHaveLength(1);
    expect(next.spec.processor.metrics.healthRules[0].mode).toBe('Recording');
    expect(next.spec.processor.metrics.healthRules[0].variants[0].thresholds.critical).toBe('5');
  });

  it('appends a new template while leaving existing healthRules unchanged', () => {
    const fc = {
      metadata: { name: 'cluster' },
      spec: {
        processor: {
          metrics: {
            healthRules: [{ template: 'DNSErrors', mode: 'Alert', variants: [{ thresholds: { warning: '1' } }] }]
          }
        }
      }
    };
    const rule = templateFormToFLPHealthRule({
      template: 'IPsecErrors',
      mode: 'Alert',
      variants: [{ thresholds: { critical: '3' }, groupBy: 'Node' }]
    });
    const next = mergeHealthRuleIntoFlowCollector(fc, rule);
    expect(next.spec.processor.metrics.healthRules).toHaveLength(2);
    expect(next.spec.processor.metrics.healthRules[0].template).toBe('DNSErrors');
    expect(next.spec.processor.metrics.healthRules[0].variants[0].thresholds.warning).toBe('1');
    expect(next.spec.processor.metrics.healthRules[1].template).toBe('IPsecErrors');
    expect(next.spec.processor.metrics.healthRules[1].variants[0].thresholds.critical).toBe('3');
  });

  it('refuses to merge empty variants', () => {
    const fc = { metadata: { name: 'cluster' }, spec: { processor: { metrics: {} } } };
    expect(() => mergeHealthRuleIntoFlowCollector(fc, { template: 'DNSErrors', mode: 'Alert', variants: [] })).toThrow(
      /empty variants/
    );
  });

  it('empty-variants save resolves to null and leaves FlowCollector healthRules untouched', () => {
    const fc = {
      metadata: { name: 'cluster' },
      spec: {
        processor: {
          metrics: {
            healthRules: [{ template: 'DNSErrors', mode: 'Alert', variants: [{ thresholds: { warning: '1' } }] }]
          }
        }
      }
    };
    const form = defaultTemplateForm();
    form.template = 'DNSErrors';
    form.mode = 'Alert';
    form.variants = [];
    const toSave = resolveTemplateRuleForSave(form);
    expect(toSave).toBeNull();
    // Caller must skip merge when null — FC snapshot stays identical.
    expect(fc.spec.processor.metrics.healthRules).toHaveLength(1);
    expect(fc.spec.processor.metrics.healthRules[0].variants[0].thresholds.warning).toBe('1');
    expect(() => mergeHealthRuleIntoFlowCollector(fc, { template: 'DNSErrors', mode: 'Alert', variants: [] })).toThrow(
      /empty variants/
    );
  });

  it('resolveTemplateRuleForSave returns null when empty variants keep default mode', () => {
    const form = defaultTemplateForm();
    form.template = 'DNSErrors';
    form.mode = 'Alert';
    form.variants = [];
    expect(resolveTemplateRuleForSave(form)).toBeNull();
  });

  it('resolveTemplateRuleForSave expands defaults when only mode changes', () => {
    const form = defaultTemplateForm();
    form.template = 'DNSErrors';
    form.mode = 'Recording';
    form.variants = [];
    const rule = resolveTemplateRuleForSave(form);
    expect(rule?.mode).toBe('Recording');
    expect(rule?.variants?.length).toBeGreaterThan(0);
  });

  it('removes health rule override from FlowCollector', () => {
    const fc = {
      metadata: { name: 'cluster' },
      spec: {
        processor: {
          metrics: {
            healthRules: [
              { template: 'DNSErrors', mode: 'Alert', variants: [{ thresholds: { warning: '1' } }] },
              { template: 'IPsecErrors', mode: 'Alert', variants: [{ thresholds: { warning: '2' } }] }
            ]
          }
        }
      }
    };
    const next = removeHealthRuleFromFlowCollector(fc, 'DNSErrors');
    expect(next.spec.processor.metrics.healthRules).toHaveLength(1);
    expect(next.spec.processor.metrics.healthRules[0].template).toBe('IPsecErrors');
  });

  it('round-trips template form', () => {
    const form = defaultTemplateForm();
    form.variants = [{ groupBy: 'Node', thresholds: { warning: '10', critical: '20' } }];
    const rule = templateFormToFLPHealthRule(form);
    const back = flpHealthRuleToTemplateForm(rule);
    expect(back.template).toBe(form.template);
    expect(back.variants[0].groupBy).toBe('Node');
  });

  it('builds alert PrometheusRule with netobserv labels', () => {
    const form = defaultCustomForm();
    form.name = 'surge';
    form.alertName = 'IncomingTrafficSurge';
    form.expr = 'vector(1) > 0';
    form.health.namespaceLabels = ['DstK8S_Namespace'];
    form.health.threshold = '100';
    const pr = buildPrometheusRule(form);
    expect(pr.kind).toBe('PrometheusRule');
    expect(pr.metadata.labels?.netobserv).toBe('true');
    expect(pr.spec.groups[0].rules[0].alert).toBe('IncomingTrafficSurge');
    expect(pr.spec.groups[0].rules[0].labels?.netobserv).toBe('true');
    expect(pr.spec.groups[0].rules[0].annotations?.[NETWORK_HEALTH_ANNOTATION_KEY]).toContain('DstK8S_Namespace');
    expect(pr.spec.groups[0].rules[0].annotations?.[NETWORK_HEALTH_ANNOTATION_KEY]).toContain('"alertThreshold":"100"');
  });

  it('builds recording PrometheusRule with metadata annotation', () => {
    const form = defaultCustomForm();
    form.mode = 'Recording';
    form.name = 'rec-rule';
    form.recordName = 'my_metric_per_namespace';
    form.expr = 'vector(20)';
    form.health.recordingThresholds = { info: '10', warning: '25', critical: '50' };
    const pr = buildPrometheusRule(form);
    expect(pr.metadata.annotations?.['netobserv.io/network-health']).toContain('my_metric_per_namespace');
    expect(pr.spec.groups[0].rules[0].record).toBe('my_metric_per_namespace');
  });

  it('maps DynamicForm data into CustomRuleForm for validators', () => {
    const data = {
      metadata: { name: 'r1', namespace: 'openshift-monitoring' },
      spec: {
        groups: [
          {
            name: 'g1',
            rules: [{ alert: 'A1', expr: 'up == 0', labels: { severity: 'warning' }, healthDisplay: { unit: '%' } }]
          }
        ]
      }
    };
    const form = prometheusFormDataToCustomForm(data, 'Alert');
    expect(form.name).toBe('r1');
    expect(form.alertName).toBe('A1');
    expect(validateCustomForm(form).errors).toEqual([]);
  });
});

describe('health-rule annotations', () => {
  it('builds and parses alert annotation with alertThreshold', () => {
    const raw = buildAlertHealthAnnotation({
      namespaceLabels: ['ns'],
      threshold: '10',
      unit: '%'
    });
    expect(raw).toContain('"alertThreshold":"10"');
    expect(raw).not.toContain('"threshold":');
    const parsed = parseHealthAnnotation(raw);
    expect(parsed.namespaceLabels).toEqual(['ns']);
    expect(parsed.threshold).toBe('10');
  });

  it('retains threshold zero in alert annotation', () => {
    const raw = buildAlertHealthAnnotation({
      threshold: '0',
      unit: '%'
    });
    expect(raw).toContain('"alertThreshold":"0"');
    expect(parseHealthAnnotation(raw).threshold).toBe('0');
  });

  it('parses legacy threshold key for compatibility', () => {
    const parsed = parseHealthAnnotation(JSON.stringify({ threshold: '7', unit: '%' }));
    expect(parsed.threshold).toBe('7');
  });

  it('builds recording metadata annotation', () => {
    const raw = buildRecordingMetadataAnnotation('m', 'sum', 'desc', {
      recordingThresholds: { warning: '5' },
      unit: '%'
    });
    expect(raw).toContain('m');
    expect(raw).toContain('recordingThresholds');
  });

  it('alertThreshold round-trips through ensureNetworkHealthLabels and prometheusRuleToFormData', () => {
    const formData = defaultPrometheusRuleFormData('Alert');
    formData.metadata.name = 'surge-rule';
    formData.metadata.namespace = 'openshift-monitoring';
    formData.spec.groups[0].name = 'netobserv-custom';
    formData.spec.groups[0].rules[0].alert = 'Surge';
    formData.spec.groups[0].rules[0].expr = 'vector(1)';
    formData.spec.groups[0].rules[0].annotations = {
      summary: 'Surge',
      message: 'Elevated traffic'
    };
    formData.spec.groups[0].rules[0].healthDisplay = {
      unit: '%',
      threshold: '42',
      namespaceLabels: 'DstK8S_Namespace'
    };

    const saved = ensureNetworkHealthLabels(formData, 'Alert');
    const ann = saved.spec.groups[0].rules[0].annotations[NETWORK_HEALTH_ANNOTATION_KEY];
    expect(ann).toContain('"alertThreshold":"42"');
    expect(ann).not.toContain('"threshold":');
    expect(saved.spec.groups[0].rules[0].healthDisplay).toBeUndefined();
    expect(saved.metadata.labels.netobserv).toBe('true');

    const reloaded = prometheusRuleToFormData(saved);
    expect(reloaded.spec.groups[0].rules[0].healthDisplay.threshold).toBe('42');
    expect(reloaded.spec.groups[0].rules[0].healthDisplay.unit).toBe('%');
    expect(reloaded.spec.groups[0].rules[0].healthDisplay.namespaceLabels).toBe('DstK8S_Namespace');
    expect(reloaded.spec.groups[0].rules[0].annotations.summary).toBe('Surge');
  });

  it('ensureNetworkHealthLabels / prometheusRuleToFormData round-trip for recording rules', () => {
    const formData = defaultPrometheusRuleFormData('Recording');
    formData.metadata.name = 'rec-rule';
    formData.metadata.namespace = 'default';
    formData.spec.groups[0].name = 'rec-group';
    formData.spec.groups[0].rules[0].record = 'my_metric_per_ns';
    formData.spec.groups[0].rules[0].expr = 'vector(20)';
    formData.spec.groups[0].rules[0].annotations = {
      summary: 'Recording summary',
      message: 'Recording description'
    };
    formData.spec.groups[0].rules[0].healthDisplay = {
      unit: '%',
      warningThreshold: '25',
      criticalThreshold: '50'
    };

    const saved = ensureNetworkHealthLabels(formData, 'Recording');
    expect(saved.metadata.labels.netobserv).toBe('true');
    expect(saved.metadata.annotations['netobserv.io/network-health']).toContain('my_metric_per_ns');
    expect(saved.spec.groups[0].rules[0].healthDisplay).toBeUndefined();
    expect(saved.spec.groups[0].rules[0].annotations).toBeUndefined();

    const reloaded = prometheusRuleToFormData(saved);
    expect(reloaded.spec.groups[0].rules[0].record).toBe('my_metric_per_ns');
    expect(reloaded.spec.groups[0].rules[0].annotations.summary).toBe('Recording summary');
    expect(reloaded.spec.groups[0].rules[0].healthDisplay.warningThreshold).toBe('25');
    expect(reloaded.spec.groups[0].rules[0].healthDisplay.criticalThreshold).toBe('50');
  });
});

describe('resolveHealthRuleWizardArgs', () => {
  afterEach(() => {
    history.replaceState({}, '', '/');
  });

  it('resolves template from query string', () => {
    history.replaceState({}, '', '/console-health-rule-wizard?template=DNSErrors');
    expect(resolveHealthRuleWizardArgs({})).toEqual({
      template: 'DNSErrors',
      namespace: undefined,
      name: undefined
    });
  });

  it('resolves template from path segment', () => {
    history.replaceState({}, '', '/network-health/rules/template/PacketDropsByKernel');
    expect(resolveHealthRuleWizardArgs({})).toEqual({
      template: 'PacketDropsByKernel',
      namespace: undefined,
      name: undefined
    });
  });

  it('prefers route params over query and path', () => {
    history.replaceState({}, '', '/network-health/rules/template/DNSErrors?template=NetpolDenied');
    expect(resolveHealthRuleWizardArgs({ template: 'IPsecErrors' }).template).toBe('IPsecErrors');
  });

  it('resolves custom rule from query string', () => {
    history.replaceState({}, '', '/console-health-rule-wizard?namespace=openshift-monitoring&name=surge');
    expect(resolveHealthRuleWizardArgs({})).toEqual({
      template: undefined,
      namespace: 'openshift-monitoring',
      name: 'surge'
    });
  });

  it('resolves custom rule from path segments', () => {
    history.replaceState({}, '', '/network-health/rules/ns/my-ns/name/my-rule');
    expect(resolveHealthRuleWizardArgs({})).toEqual({
      template: undefined,
      namespace: 'my-ns',
      name: 'my-rule'
    });
  });

  it('decodes URL-encoded path segments', () => {
    history.replaceState({}, '', '/network-health/rules/template/Packet%20Drops');
    expect(resolveHealthRuleWizardArgs({}).template).toBe('Packet Drops');
  });

  it('keeps malformed percent-encoding instead of throwing', () => {
    history.replaceState({}, '', '/network-health/rules/template/bad%2');
    expect(resolveHealthRuleWizardArgs({}).template).toBe('bad%2');
  });
});

describe('syncFlowCollectorMeta', () => {
  const live = {
    apiVersion: 'flows.netobserv.io/v1beta2',
    kind: 'FlowCollector',
    metadata: { name: 'cluster', resourceVersion: '12345', uid: 'abc-123' },
    spec: { processor: {} }
  };

  it('returns the live resource when there is no seed yet', () => {
    expect(syncFlowCollectorMeta(null, live)).toBe(live);
  });

  it('adopts the live resourceVersion/uid onto a stale CSVExample seed', () => {
    // CSVExample fallback: seeded before the watch resolved, so no resourceVersion.
    const seed = { metadata: { name: 'cluster' }, spec: { processor: { metrics: { healthRules: [] } } } };
    const result = syncFlowCollectorMeta(seed, live);
    expect(result.metadata?.resourceVersion).toBe('12345');
    expect(result.metadata?.uid).toBe('abc-123');
    // In-progress spec edits must survive the refresh.
    expect(result.spec).toBe(seed.spec);
  });

  it('preserves the user spec while refreshing metadata', () => {
    const edited = {
      metadata: { name: 'cluster' },
      spec: { processor: { metrics: { healthRules: [{ template: 'DNSErrors', mode: 'Recording', variants: [] }] } } }
    };
    const result = syncFlowCollectorMeta(edited, live);
    expect(result.spec?.processor.metrics.healthRules[0]).toEqual({
      template: 'DNSErrors',
      mode: 'Recording',
      variants: []
    });
    expect(result.metadata?.resourceVersion).toBe('12345');
  });

  it('is a no-op when the resourceVersion already matches', () => {
    const seed = { metadata: { name: 'cluster', resourceVersion: '12345', uid: 'abc-123' }, spec: {} };
    // Same reference back so React bails out of a redundant re-render.
    expect(syncFlowCollectorMeta(seed, live)).toBe(seed);
  });

  it('leaves the seed untouched while the watch is still on the fallback', () => {
    const seed = { metadata: { name: 'cluster' }, spec: {} };
    const fallback = { metadata: { name: 'cluster' } }; // no resourceVersion yet
    expect(syncFlowCollectorMeta(seed, fallback)).toBe(seed);
  });
});

describe('isK8sConflictError', () => {
  it('detects HTTP 409 across the code/status/response/json shapes', () => {
    expect(isK8sConflictError({ code: 409 })).toBe(true);
    expect(isK8sConflictError({ status: 409 })).toBe(true);
    expect(isK8sConflictError({ response: { status: 409 } })).toBe(true);
    expect(isK8sConflictError({ json: { code: 409 } })).toBe(true);
  });

  it('detects the Conflict reason and the server conflict message', () => {
    expect(isK8sConflictError({ json: { reason: 'Conflict' } })).toBe(true);
    expect(
      isK8sConflictError(
        new Error('Operation cannot be fulfilled on flowcollectors "cluster": the object has been modified')
      )
    ).toBe(true);
  });

  it('is false for non-conflict errors and empty input', () => {
    expect(isK8sConflictError(null)).toBe(false);
    expect(isK8sConflictError(undefined)).toBe(false);
    expect(isK8sConflictError({ code: 404 })).toBe(false);
    expect(isK8sConflictError(new Error('boom'))).toBe(false);
  });
});
