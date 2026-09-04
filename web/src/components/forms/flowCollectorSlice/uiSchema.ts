/* eslint-disable max-len */
import { UiSchema } from '@rjsf/utils';

// Keep the UISchema ordered for form display

export const flowCollectorSliceUISchema: UiSchema = {
  'ui:title': 'FlowCollectorSlice',
  'ui:flat': 'true',
  metadata: {
    'ui:title': 'Metadata',
    'ui:flat': 'true',
    name: {
      'ui:title': 'Name'
    },
    namespace: {
      'ui:title': 'Namespace'
    },
    labels: {
      'ui:widget': 'hidden'
    },
    'ui:order': ['name', 'namespace', 'labels', '*']
  },
  spec: {
    subnetLabels: {
      'ui:title': 'Subnet labels',
      items: {
        'ui:order': ['cidrs', 'name', '*']
      }
    },
    sampling: {
      'ui:title': 'Sampling'
    },
    'ui:order': ['subnetLabels', 'sampling', '*']
  },
  'ui:order': ['metadata', 'spec', '*']
};
