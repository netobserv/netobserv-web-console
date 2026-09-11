// Auto-generated on Tue, 04 Aug 2026 10:42:08 CEST by scripts/generate-health-rule-defaults.sh ; DO NOT EDIT.
// Source: network-observability-operator api/flowcollector/v1beta2.DefaultHealthRules
// Re-run: OPERATOR_PATH=../network-observability-operator ./scripts/generate-health-rule-defaults.sh

export type VariantFieldPlaceholders = {
  critical?: string;
  warning?: string;
  info?: string;
  lowVolumeThreshold?: string;
  trendOffset?: string;
  trendDuration?: string;
};

export type HealthRuleDefaultVariant = {
  thresholds: { info?: string; warning?: string; critical?: string };
  lowVolumeThreshold?: string;
  groupBy?: string;
  trendOffset?: string;
  trendDuration?: string;
  mode?: 'Alert' | 'Recording';
};

export type HealthRuleDefaultSummary = {
  template: string;
  /** Effective rule mode (Alert when unset in operator defaults). */
  mode: 'Alert' | 'Recording';
  /** All default variants for this template (used when customizing). */
  variants: HealthRuleDefaultVariant[];
};

/** Default health-rule templates from the operator (name, mode, variants). */
export const HEALTH_RULE_DEFAULTS: HealthRuleDefaultSummary[] = [
  {
    template: 'PacketDropsByKernel',
    mode: 'Recording',
    variants: [
      {
        thresholds: { info: '10', warning: '20' },
        lowVolumeThreshold: '5',
        groupBy: 'Namespace'
      },
      {
        thresholds: { info: '5', warning: '15' },
        groupBy: 'Node',
        mode: 'Recording'
      }
    ]
  },
  {
    template: 'PacketDropsByDevice',
    mode: 'Alert',
    variants: [
      {
        thresholds: { info: '5', warning: '10' },
        groupBy: 'Node'
      }
    ]
  },
  {
    template: 'IPsecErrors',
    mode: 'Alert',
    variants: [
      {
        thresholds: { warning: '2' }
      },
      {
        thresholds: { warning: '2' },
        groupBy: 'Node'
      }
    ]
  },
  {
    template: 'DNSErrors',
    mode: 'Alert',
    variants: [
      {
        thresholds: { warning: '5' }
      },
      {
        thresholds: { info: '5', warning: '10' },
        groupBy: 'Namespace'
      }
    ]
  },
  {
    template: 'DNSNxDomain',
    mode: 'Recording',
    variants: [
      {
        thresholds: { info: '10', warning: '80' },
        groupBy: 'Namespace'
      }
    ]
  },
  {
    template: 'NetpolDenied',
    mode: 'Recording',
    variants: [
      {
        thresholds: { info: '5', warning: '10' },
        groupBy: 'Namespace'
      }
    ]
  },
  {
    template: 'LatencyHighTrend',
    mode: 'Recording',
    variants: [
      {
        thresholds: { info: '100' },
        groupBy: 'Namespace',
        trendOffset: '24h',
        trendDuration: '1h'
      }
    ]
  },
  {
    template: 'ExternalEgressHighTrend',
    mode: 'Recording',
    variants: [
      {
        thresholds: { warning: '200' },
        groupBy: 'Node',
        trendOffset: '24h',
        trendDuration: '1h'
      },
      {
        thresholds: { info: '100', warning: '500' },
        groupBy: 'Namespace',
        trendOffset: '24h',
        trendDuration: '1h'
      }
    ]
  },
  {
    template: 'ExternalIngressHighTrend',
    mode: 'Recording',
    variants: [
      {
        thresholds: { warning: '200' },
        groupBy: 'Node',
        trendOffset: '24h',
        trendDuration: '1h'
      },
      {
        thresholds: { info: '100', warning: '500' },
        groupBy: 'Namespace',
        trendOffset: '24h',
        trendDuration: '1h'
      }
    ]
  },
  {
    template: 'Ingress5xxErrors',
    mode: 'Recording',
    variants: [
      {
        thresholds: { info: '5', warning: '10' },
        groupBy: 'Namespace'
      }
    ]
  },
  {
    template: 'IngressHTTPLatencyTrend',
    mode: 'Recording',
    variants: [
      {
        thresholds: { info: '100', warning: '200' },
        groupBy: 'Namespace',
        trendOffset: '24h',
        trendDuration: '1h'
      }
    ]
  },
  {
    template: 'TLSInsecureVersion',
    mode: 'Alert',
    variants: [
      {
        thresholds: { warning: '5' },
        groupBy: 'Namespace'
      }
    ]
  }
];

/** Primary (first) variant defaults per health-rule template (form placeholders). */
export const VARIANT_DEFAULT_PLACEHOLDERS: Record<string, VariantFieldPlaceholders> = {
  PacketDropsByKernel: {
    info: '10',
    warning: '20',
    lowVolumeThreshold: '5'
  },
  PacketDropsByDevice: {
    info: '5',
    warning: '10'
  },
  IPsecErrors: {
    warning: '2'
  },
  DNSErrors: {
    warning: '5'
  },
  DNSNxDomain: {
    info: '10',
    warning: '80'
  },
  NetpolDenied: {
    info: '5',
    warning: '10'
  },
  LatencyHighTrend: {
    info: '100',
    trendOffset: '24h',
    trendDuration: '1h'
  },
  ExternalEgressHighTrend: {
    warning: '200',
    trendOffset: '24h',
    trendDuration: '1h'
  },
  ExternalIngressHighTrend: {
    warning: '200',
    trendOffset: '24h',
    trendDuration: '1h'
  },
  Ingress5xxErrors: {
    info: '5',
    warning: '10'
  },
  IngressHTTPLatencyTrend: {
    info: '100',
    warning: '200',
    trendOffset: '24h',
    trendDuration: '1h'
  },
  TLSInsecureVersion: {
    warning: '5'
  }
};

export const getVariantPlaceholders = (template?: string): VariantFieldPlaceholders => {
  if (!template) {
    return {};
  }
  return VARIANT_DEFAULT_PLACEHOLDERS[template] ?? {};
};

export const getHealthRuleDefault = (template?: string): HealthRuleDefaultSummary | undefined =>
  template ? HEALTH_RULE_DEFAULTS.find(d => d.template === template) : undefined;

/** Convert an operator default into a FlowCollector healthRules entry. */
export const healthRuleDefaultToFLP = (
  def: HealthRuleDefaultSummary
): {
  template: string;
  mode: 'Alert' | 'Recording';
  variants: HealthRuleDefaultVariant[];
} => ({
  template: def.template,
  mode: def.mode,
  variants: def.variants.map(v => ({
    thresholds: { ...v.thresholds },
    ...(v.lowVolumeThreshold ? { lowVolumeThreshold: v.lowVolumeThreshold } : {}),
    ...(v.groupBy ? { groupBy: v.groupBy } : {}),
    ...(v.trendOffset ? { trendOffset: v.trendOffset } : {}),
    ...(v.trendDuration ? { trendDuration: v.trendDuration } : {}),
    ...(v.mode ? { mode: v.mode } : {})
  }))
});

/** Format threshold map for compact UI display (e.g. Manage rules drawer). */
export const formatThresholdsSummary = (thresholds?: {
  info?: string | number;
  warning?: string | number;
  critical?: string | number;
}): string => {
  if (!thresholds) {
    return '';
  }
  const parts: string[] = [];
  if (thresholds.info != null && thresholds.info !== '') {
    parts.push(`info: ${thresholds.info}`);
  }
  if (thresholds.warning != null && thresholds.warning !== '') {
    parts.push(`warning: ${thresholds.warning}`);
  }
  if (thresholds.critical != null && thresholds.critical !== '') {
    parts.push(`critical: ${thresholds.critical}`);
  }
  return parts.join(', ');
};
