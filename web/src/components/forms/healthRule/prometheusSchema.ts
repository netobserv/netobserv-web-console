/**
 * Minimal JSON Schema for custom Network Health PrometheusRules.
 * Labels/annotations are structured fields (not free-form maps) for clearer UX.
 * Form-only `healthDisplay` is composed into NetObserv annotations on save.
 */
import * as _ from 'lodash';
import { HealthRuleMode } from './types';

export const prometheusRuleSchema = {
  type: 'object',
  required: ['apiVersion', 'kind', 'metadata', 'spec'],
  properties: {
    apiVersion: {
      type: 'string',
      default: 'monitoring.coreos.com/v1'
    },
    kind: {
      type: 'string',
      default: 'PrometheusRule',
      enum: ['PrometheusRule']
    },
    metadata: {
      type: 'object',
      required: ['name', 'namespace'],
      properties: {
        name: {
          type: 'string',
          title: 'Name',
          minLength: 1,
          maxLength: 253,
          pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$'
        },
        namespace: {
          type: 'string',
          title: 'Namespace',
          minLength: 1
        },
        labels: {
          type: 'object',
          additionalProperties: { type: 'string' }
        },
        annotations: {
          type: 'object',
          additionalProperties: { type: 'string' }
        }
      }
    },
    spec: {
      type: 'object',
      required: ['groups'],
      properties: {
        groups: {
          type: 'array',
          title: 'Rule group',
          minItems: 1,
          items: {
            type: 'object',
            title: 'Rule group',
            required: ['name', 'rules'],
            properties: {
              name: {
                type: 'string',
                title: 'Group name',
                minLength: 1
              },
              rules: {
                type: 'array',
                title: 'Rule',
                minItems: 1,
                items: {
                  type: 'object',
                  title: 'Rule',
                  required: ['expr'],
                  properties: {
                    alert: {
                      type: 'string',
                      title: 'Alert name',
                      minLength: 1
                    },
                    record: {
                      type: 'string',
                      title: 'Recording metric name',
                      minLength: 1
                    },
                    expr: {
                      type: 'string',
                      title: 'PromQL expression',
                      minLength: 1
                    },
                    for: {
                      type: 'string',
                      title: 'Pending duration (for)'
                    },
                    labels: {
                      type: 'object',
                      title: 'Labels',
                      required: ['severity'],
                      properties: {
                        severity: {
                          type: 'string',
                          title: 'Severity',
                          enum: ['critical', 'warning', 'info'],
                          default: 'warning'
                        },
                        netobserv: {
                          type: 'string',
                          default: 'true'
                        }
                      }
                    },
                    annotations: {
                      type: 'object',
                      title: 'Annotations',
                      properties: {
                        summary: {
                          type: 'string',
                          title: 'Summary'
                        },
                        message: {
                          type: 'string',
                          title: 'Description'
                        }
                      }
                    },
                    healthDisplay: {
                      type: 'object',
                      title: 'Network Health display',
                      properties: {
                        unit: {
                          type: 'string',
                          title: 'Unit',
                          default: '%'
                        },
                        upperBound: {
                          type: 'string',
                          title: 'Upper bound'
                        },
                        threshold: {
                          type: 'string',
                          title: 'Threshold'
                        },
                        namespaceLabels: {
                          type: 'string',
                          title: 'Namespace labels'
                        },
                        nodeLabels: {
                          type: 'string',
                          title: 'Node labels'
                        },
                        workloadLabels: {
                          type: 'string',
                          title: 'Workload labels'
                        },
                        kindLabels: {
                          type: 'string',
                          title: 'Kind labels'
                        },
                        infoThreshold: {
                          type: 'string',
                          title: 'Info threshold'
                        },
                        warningThreshold: {
                          type: 'string',
                          title: 'Warning threshold'
                        },
                        criticalThreshold: {
                          type: 'string',
                          title: 'Critical threshold'
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

/** Mark Alert-only or Recording-only fields as required so the form shows a red asterisk. */
export const prometheusRuleSchemaForMode = (mode: HealthRuleMode) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schema: any = _.cloneDeep(prometheusRuleSchema);
  const ruleItems = schema?.properties?.spec?.properties?.groups?.items?.properties?.rules?.items;
  if (!ruleItems) {
    return schema;
  }
  if (mode === 'Alert') {
    ruleItems.required = ['alert', 'expr'];
  } else {
    ruleItems.required = ['record', 'expr'];
    // Severity only applies to alerts
    if (ruleItems.properties?.labels) {
      delete ruleItems.properties.labels.required;
    }
  }
  return schema;
};
