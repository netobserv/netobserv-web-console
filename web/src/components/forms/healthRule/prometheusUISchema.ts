import { UiSchema } from '@rjsf/utils';
import { K8sUISchema } from '../dynamic-form/const';

/**
 * UI schema for custom Network Health PrometheusRules.
 * netobserv labels are hidden (always injected on save).
 * Severity is a dropdown; annotations are summary/description + optional Health display.
 */
export const prometheusRuleUISchema: UiSchema = {
  ...K8sUISchema,
  'ui:flat': 'true',
  metadata: {
    'ui:flat': 'true',
    'ui:options': { label: false },
    name: {
      'ui:title': 'Name'
    },
    namespace: {
      'ui:title': 'Namespace',
      'ui:description': 'Prefer a namespace other than the NetObserv install namespace.'
    },
    labels: {
      'ui:widget': 'hidden',
      'ui:options': { label: false }
    },
    annotations: {
      'ui:widget': 'hidden',
      'ui:options': { label: false }
    },
    'ui:order': ['name', 'namespace', '*']
  },
  spec: {
    'ui:flat': 'true',
    'ui:options': { label: false },
    groups: {
      'ui:title': 'Rule group',
      'ui:options': { label: false },
      items: {
        'ui:title': 'Rule group',
        'ui:description':
          'A Prometheus rule group holds related alert or recording rules. Most setups need a single group.',
        'ui:options': { defaultExpanded: true },
        name: {
          'ui:title': 'Group name',
          'ui:description': 'Identifier for this group in the PrometheusRule resource.',
          'ui:placeholder': 'my-network-health-rules'
        },
        rules: {
          'ui:title': 'Rule',
          'ui:description': 'One or more alert or recording rules in this group.',
          'ui:options': { defaultExpanded: true },
          items: {
            'ui:title': 'Rule',
            'ui:flat': 'true',
            'ui:options': { defaultExpanded: true },
            alert: {
              'ui:title': 'Alert name',
              'ui:placeholder': 'MyCustomAlert'
            },
            record: {
              'ui:title': 'Recording metric name',
              'ui:placeholder': 'my_metric_per_namespace'
            },
            expr: {
              'ui:title': 'PromQL expression',
              'ui:widget': 'promql'
            },
            for: {
              'ui:title': 'Pending duration (for)',
              'ui:description': 'Optional, e.g. 5m.',
              'ui:placeholder': '5m'
            },
            labels: {
              'ui:title': 'Labels',
              'ui:flat': 'true',
              severity: {
                'ui:title': 'Severity',
                'ui:description': 'Alert severity for Alertmanager and Network Health coloring.'
              },
              netobserv: {
                'ui:widget': 'hidden',
                'ui:options': { label: false }
              },
              'ui:order': ['severity', '*']
            },
            annotations: {
              'ui:title': 'Annotations',
              'ui:flat': 'true',
              summary: {
                'ui:title': 'Summary',
                'ui:description': 'Short title. May use Prometheus templates such as {{ $labels.namespace }}.',
                'ui:placeholder': 'High drop rate in {{ $labels.namespace }}'
              },
              message: {
                'ui:title': 'Description',
                'ui:description': 'Longer message shown in Alertmanager and Network Health.',
                'ui:placeholder': 'Drop rate is {{ $value }}% in namespace {{ $labels.namespace }}'
              },
              'ui:order': ['summary', 'message', '*']
            },
            healthDisplay: {
              'ui:title': 'Network Health display',
              'ui:description': 'Controls how the rule appears on Network Health.',
              unit: {
                'ui:title': 'Unit',
                'ui:description': 'Display unit for values on Network Health (for example %).',
                'ui:placeholder': '%'
              },
              upperBound: {
                'ui:title': 'Upper bound',
                'ui:description': 'Score scale ceiling. Values above this are clamped when computing health scores.',
                'ui:placeholder': '100'
              },
              threshold: {
                'ui:title': 'Threshold',
                'ui:description': 'Alert threshold as a string; should match the threshold used in PromQL.',
                'ui:placeholder': '10'
              },
              namespaceLabels: {
                'ui:title': 'Namespace labels',
                'ui:description':
                  'Comma-separated PromQL label names that hold namespaces. Shows the rule under the Namespaces tab.',
                'ui:placeholder': 'DstK8S_Namespace'
              },
              nodeLabels: {
                'ui:title': 'Node labels',
                'ui:description':
                  'Comma-separated PromQL label names that hold node names. Shows the rule under the Nodes tab. Mutually exclusive with namespace labels.',
                'ui:placeholder': 'instance'
              },
              workloadLabels: {
                'ui:title': 'Workload labels',
                'ui:description':
                  'Comma-separated PromQL label names for owner/workload names. Pair with kind labels for the Workloads tab.',
                'ui:placeholder': 'DstK8S_OwnerName'
              },
              kindLabels: {
                'ui:title': 'Kind labels',
                'ui:description':
                  'Comma-separated PromQL label names for owner kinds (for example Deployment, DaemonSet). Pair with workload labels for the Workloads tab.',
                'ui:placeholder': 'DstK8S_OwnerType'
              },
              infoThreshold: {
                'ui:title': 'Info threshold',
                'ui:description': 'Recording-rule score threshold for info severity coloring.',
                'ui:placeholder': '10'
              },
              warningThreshold: {
                'ui:title': 'Warning threshold',
                'ui:description': 'Recording-rule score threshold for warning severity coloring.',
                'ui:placeholder': '25'
              },
              criticalThreshold: {
                'ui:title': 'Critical threshold',
                'ui:description': 'Recording-rule score threshold for critical severity coloring.',
                'ui:placeholder': '50'
              },
              'ui:order': [
                'unit',
                'upperBound',
                'threshold',
                'namespaceLabels',
                'nodeLabels',
                'workloadLabels',
                'kindLabels',
                'infoThreshold',
                'warningThreshold',
                'criticalThreshold',
                '*'
              ]
            },
            'ui:order': ['alert', 'record', 'expr', 'for', 'labels', 'annotations', 'healthDisplay', '*']
          }
        },
        'ui:order': ['name', 'rules', '*']
      }
    },
    'ui:order': ['groups', '*']
  },
  'ui:order': ['metadata', 'spec', '*']
};
