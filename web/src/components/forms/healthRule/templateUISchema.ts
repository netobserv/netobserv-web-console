import { UiSchema } from '@rjsf/utils';
import * as _ from 'lodash';
import { getVariantPlaceholders, VariantFieldPlaceholders } from './variantDefaults';

const applyVariantPlaceholders = (items: UiSchema | undefined, placeholders: VariantFieldPlaceholders) => {
  if (!items) {
    return;
  }
  const thresholds = items.thresholds as UiSchema | undefined;
  if (thresholds) {
    if (placeholders.critical) {
      thresholds.critical = { ...(thresholds.critical as object), 'ui:placeholder': placeholders.critical };
    }
    if (placeholders.warning) {
      thresholds.warning = { ...(thresholds.warning as object), 'ui:placeholder': placeholders.warning };
    }
    if (placeholders.info) {
      thresholds.info = { ...(thresholds.info as object), 'ui:placeholder': placeholders.info };
    }
  }
  if (placeholders.lowVolumeThreshold) {
    items.lowVolumeThreshold = {
      ...(items.lowVolumeThreshold as object),
      'ui:placeholder': placeholders.lowVolumeThreshold
    };
  }
  if (placeholders.trendOffset) {
    items.trendOffset = { ...(items.trendOffset as object), 'ui:placeholder': placeholders.trendOffset };
  }
  if (placeholders.trendDuration) {
    items.trendDuration = { ...(items.trendDuration as object), 'ui:placeholder': placeholders.trendDuration };
  }
};

/**
 * Flattened UI schema for a single health rule — inspired by FlowCollector wizard:
 * flat layout, reordered fields, advanced/rarely used fields hidden.
 */
export const healthRuleTemplateUISchema: UiSchema = {
  'ui:title': 'Health rule',
  'ui:flat': 'true',
  apiVersion: {
    'ui:widget': 'hidden',
    'ui:options': { label: false }
  },
  kind: {
    'ui:widget': 'hidden',
    'ui:options': { label: false }
  },
  metadata: {
    'ui:widget': 'hidden',
    'ui:options': { label: false }
  },
  spec: {
    'ui:flat': 'true',
    'ui:options': { label: false },
    template: {
      'ui:title': 'Template',
      'ui:description': 'NetObserv built-in health rule template. Saving replaces defaults for this template.'
    },
    mode: {
      'ui:title': 'Mode',
      'ui:description': 'Alert notifies via Alertmanager; Recording is Network Health only.'
    },
    variants: {
      'ui:title': 'Variants',
      'ui:description':
        'Optional. Leave empty to keep operator defaults (or change mode only). Adding variants replaces the full ' +
        'default configuration for this template — include every variant you want to keep. Placeholders show defaults.',
      items: {
        'ui:title': 'Variant',
        'ui:flat': 'true',
        'ui:options': { defaultExpanded: true },
        groupBy: {
          'ui:title': 'Group by',
          'ui:description': 'Cluster is cluster-wide. Some templates limit supported scopes.'
        },
        thresholds: {
          'ui:title': 'Severity thresholds',
          'ui:flat': 'true',
          'ui:description':
            'Numeric thresholds as a percentage of errors. Provide at least one. Critical must be highest, ' +
            'then warning, then info. Placeholders show template defaults.',
          critical: {
            'ui:title': 'Critical threshold'
          },
          warning: {
            'ui:title': 'Warning threshold'
          },
          info: {
            'ui:title': 'Info threshold'
          },
          'ui:order': ['critical', 'warning', 'info', '*']
        },
        lowVolumeThreshold: {
          'ui:title': 'Low volume threshold',
          'ui:description': 'Optional. Absolute rate below which metrics are ignored (noise reduction).'
        },
        trendOffset: {
          'ui:title': 'Trend offset',
          'ui:description': 'Optional. Used by trending templates (e.g. 24h).'
        },
        trendDuration: {
          'ui:title': 'Trend duration',
          'ui:description': 'Optional. Used by trending templates (e.g. 1h).'
        },
        mode: {
          'ui:title': 'Variant mode override',
          'ui:description':
            'Optional. Overrides the template mode for this variant only (e.g. Recording while the template is Alert).'
        },
        'ui:order': ['groupBy', 'thresholds', 'lowVolumeThreshold', 'mode', 'trendOffset', 'trendDuration', '*']
      }
    },
    'ui:order': ['template', 'mode', 'variants', '*']
  },
  'ui:order': ['spec', '*']
};

/** Lock template when editing; inject per-template default placeholders on variants. */
export const healthRuleTemplateUISchemaForEdit = (lockTemplate: boolean, template?: string): UiSchema => {
  const schema = _.cloneDeep(healthRuleTemplateUISchema);
  const variants = schema.spec?.variants as UiSchema | undefined;
  applyVariantPlaceholders(variants?.items as UiSchema | undefined, getVariantPlaceholders(template));
  if (lockTemplate && schema.spec) {
    const spec = schema.spec as UiSchema;
    spec.template = {
      ...(spec.template as object),
      'ui:readonly': true,
      'ui:disabled': true
    };
  }
  return schema;
};
