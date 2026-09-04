import { TFunction } from 'i18next';
import { HEALTH_RULE_TEMPLATES } from './types';

/**
 * Wizard-oriented JSON Schema for a single FlowCollector healthRules entry.
 * Kept under apiVersion/kind/metadata/spec so DynamicForm's getUpdatedCR works.
 * Shape is flattened for UX — not the nested CRD path.
 */
export const getHealthRuleTemplateSchema = (t: TFunction) => ({
  type: 'object',
  required: ['apiVersion', 'kind', 'spec'],
  properties: {
    apiVersion: {
      type: 'string',
      default: 'netobserv.io/v1'
    },
    kind: {
      type: 'string',
      default: 'HealthRuleForm',
      enum: ['HealthRuleForm']
    },
    metadata: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          default: 'health-rule'
        }
      }
    },
    spec: {
      type: 'object',
      required: ['template', 'mode'],
      properties: {
        template: {
          type: 'string',
          title: t('Template'),
          enum: [...HEALTH_RULE_TEMPLATES]
        },
        mode: {
          type: 'string',
          title: t('Mode'),
          enum: ['Alert', 'Recording'],
          default: 'Alert'
        },
        variants: {
          type: 'array',
          title: t('Variants'),
          items: {
            type: 'object',
            title: t('Variant'),
            properties: {
              groupBy: {
                type: 'string',
                title: t('Group by'),
                enum: ['Cluster', 'Node', 'Namespace', 'Workload'],
                default: 'Cluster'
              },
              thresholds: {
                type: 'object',
                title: t('Thresholds'),
                default: {},
                properties: {
                  critical: {
                    type: 'number',
                    title: t('Critical threshold')
                  },
                  warning: {
                    type: 'number',
                    title: t('Warning threshold')
                  },
                  info: {
                    type: 'number',
                    title: t('Info threshold')
                  }
                }
              },
              lowVolumeThreshold: {
                type: 'number',
                title: t('Low volume threshold')
              },
              trendOffset: {
                type: 'string',
                title: t('Trend offset')
              },
              trendDuration: {
                type: 'string',
                title: t('Trend duration')
              },
              mode: {
                type: 'string',
                title: t('Variant mode override'),
                enum: ['Alert', 'Recording']
              }
            }
          }
        }
      }
    }
  }
});
