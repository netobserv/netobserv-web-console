/* eslint-disable max-len */
import { UiSchema } from '@rjsf/utils';

// Keep the UISchema ordered for form display

export const flowMetricUISchema: UiSchema = {
  'ui:title': 'FlowMetric',
  'ui:flat': 'true',
  metadata: {
    'ui:title': 'Metadata',
    'ui:flat': 'true',
    name: {
      'ui:title': 'Name'
    },
    namespace: {
      'ui:title': 'Namespace',
      'ui:description': 'It must match the one configured in FlowCollector.'
    },
    labels: {
      'ui:widget': 'hidden'
    },
    'ui:order': ['name', 'namespace', 'labels', '*']
  },
  spec: {
    metricName: {
      'ui:title': 'Metric name'
    },
    type: {
      'ui:title': 'Type'
    },
    help: {
      'ui:title': 'Help'
    },
    buckets: {
      'ui:title': 'Buckets',
      'ui:dependency': {
        controlFieldPath: ['type'],
        controlFieldValue: 'Histogram',
        controlFieldName: 'type'
      }
    },
    valueField: {
      'ui:title': 'Value field'
    },
    divider: {
      'ui:title': 'Divider'
    },
    labels: {
      'ui:title': 'Labels'
    },
    flatten: {
      'ui:title': 'Flatten'
    },
    remap: {
      'ui:title': 'Remap',
      'ui:widget': 'map'
    },
    direction: {
      'ui:title': 'Direction'
    },
    filters: {
      'ui:title': 'Filters',
      items: {
        field: {
          'ui:title': 'Field'
        },
        matchType: {
          'ui:title': 'Match type'
        },
        value: {
          'ui:title': 'Value'
        },
        'ui:order': ['field', 'matchType', 'value', '*']
      }
    },
    charts: {
      'ui:title': 'Charts',
      items: {
        dashboardName: {
          'ui:title': 'Dashboard name'
        },
        sectionName: {
          'ui:title': 'Section name'
        },
        title: {
          'ui:title': 'Title'
        },
        unit: {
          'ui:title': 'Unit'
        },
        type: {
          'ui:title': 'Type'
        },
        queries: {
          'ui:title': 'Queries',
          items: {
            promQL: {
              'ui:title': 'Query'
            },
            legend: {
              'ui:title': 'Legend'
            },
            top: {
              'ui:title': 'Top'
            },
            'ui:order': ['promQL', 'legend', 'top', '*']
          }
        },
        'ui:order': ['dashboardName', 'sectionName', 'title', 'unit', 'type', 'queries', '*']
      }
    },
    'ui:order': [
      'metricName',
      'type',
      'help',
      'buckets',
      'valueField',
      'divider',
      'flatten',
      'remap',
      'direction',
      'labels',
      'filters',
      'charts',
      '*'
    ]
  },
  'ui:order': ['metadata', 'spec', '*']
};
