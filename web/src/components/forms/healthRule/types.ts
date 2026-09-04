export type HealthRuleSource = 'template' | 'custom';
export type HealthRuleMode = 'Alert' | 'Recording';
export type HealthRuleGroupBy = '' | 'Node' | 'Namespace' | 'Workload';
export type HealthRuleSeverity = 'critical' | 'warning' | 'info';

export const FLOW_COLLECTOR_GVK = {
  group: 'flows.netobserv.io',
  version: 'v1beta2',
  kind: 'FlowCollector'
} as const;

export const PROMETHEUS_RULE_GVK = {
  group: 'monitoring.coreos.com',
  version: 'v1',
  kind: 'PrometheusRule'
} as const;

export const HEALTH_RULE_TEMPLATES = [
  'PacketDropsByKernel',
  'PacketDropsByDevice',
  'IPsecErrors',
  'NetpolDenied',
  'LatencyHighTrend',
  'DNSErrors',
  'DNSNxDomain',
  'ExternalEgressHighTrend',
  'ExternalIngressHighTrend',
  'Ingress5xxErrors',
  'IngressHTTPLatencyTrend',
  'TLSInsecureVersion'
] as const;

export type HealthRuleTemplate = (typeof HEALTH_RULE_TEMPLATES)[number];

export const TRENDING_TEMPLATES: HealthRuleTemplate[] = [
  'LatencyHighTrend',
  'ExternalEgressHighTrend',
  'ExternalIngressHighTrend',
  'IngressHTTPLatencyTrend'
];

export type HealthRuleThresholds = {
  /** Stored as strings in the CRD; the form may use numbers for number inputs. */
  info?: string | number;
  warning?: string | number;
  critical?: string | number;
};

export type HealthRuleVariantForm = {
  thresholds: HealthRuleThresholds;
  groupBy?: HealthRuleGroupBy;
  lowVolumeThreshold?: string | number;
  trendOffset?: string;
  trendDuration?: string;
  mode?: HealthRuleMode;
};

export type TemplateRuleForm = {
  template: HealthRuleTemplate;
  mode: HealthRuleMode;
  variants: HealthRuleVariantForm[];
};

export type HealthDashboardScope = 'global' | 'node' | 'namespace' | 'workload';

export type HealthAnnotationFields = {
  namespaceLabels?: string[];
  nodeLabels?: string[];
  workloadLabels?: string[];
  kindLabels?: string[];
  unit?: string;
  upperBound?: string;
  threshold?: string;
  recordingThresholds?: HealthRuleThresholds;
};

export type CustomRuleForm = {
  name: string;
  namespace: string;
  mode: HealthRuleMode;
  expr: string;
  alertName?: string;
  recordName?: string;
  severity?: HealthRuleSeverity;
  for?: string;
  summary?: string;
  description?: string;
  health: HealthAnnotationFields;
  groupInterval?: string;
};

export type WizardState = {
  source: HealthRuleSource;
  mode: HealthRuleMode;
  template: TemplateRuleForm;
  custom: CustomRuleForm;
  /** When editing, lock source and identify the resource */
  isEdit?: boolean;
  editTemplate?: HealthRuleTemplate;
  editPrometheusRuleName?: string;
  editPrometheusRuleNamespace?: string;
};

export const DEFAULT_NAMESPACE_SUGGESTION = 'openshift-monitoring';
export const NETOBSERV_NAMESPACE_CANDIDATES = ['netobserv', 'openshift-netobserv', 'openshift-netobserv-operator'];

export const defaultTemplateForm = (): TemplateRuleForm => ({
  template: 'PacketDropsByKernel',
  mode: 'Alert',
  variants: []
});

export const defaultCustomForm = (): CustomRuleForm => ({
  name: '',
  namespace: DEFAULT_NAMESPACE_SUGGESTION,
  mode: 'Alert',
  expr: '',
  alertName: '',
  recordName: '',
  severity: 'warning',
  for: '5m',
  summary: '',
  description: '',
  health: {
    unit: '%',
    upperBound: '100',
    threshold: '10',
    recordingThresholds: { info: '10', warning: '25', critical: '50' }
  },
  groupInterval: '30s'
});

export const defaultWizardState = (): WizardState => ({
  source: 'template',
  mode: 'Alert',
  template: defaultTemplateForm(),
  custom: defaultCustomForm()
});

/** FlowCollector healthRules entry shape (subset of CRD) */
export type FLPHealthRule = {
  template: string;
  mode?: HealthRuleMode;
  variants: Array<{
    thresholds: HealthRuleThresholds;
    groupBy?: string;
    lowVolumeThreshold?: string;
    trendOffset?: string;
    trendDuration?: string;
    mode?: HealthRuleMode;
  }>;
};

export type PrometheusRuleResource = {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    resourceVersion?: string;
    uid?: string;
  };
  spec: {
    groups: Array<{
      name: string;
      interval?: string;
      rules: Array<{
        alert?: string;
        record?: string;
        expr: string;
        for?: string;
        labels?: Record<string, string>;
        annotations?: Record<string, string>;
      }>;
    }>;
  };
};
