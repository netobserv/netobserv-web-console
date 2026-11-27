export const K8sUISchema = {
  apiVersion: {
    'ui:widget': 'hidden',
    'ui:options': {
      label: false
    }
  },
  kind: {
    'ui:widget': 'hidden',
    'ui:options': {
      label: false
    }
  },
  spec: {
    'ui:options': {
      label: false
    }
  },
  status: {
    'ui:widget': 'hidden',
    'ui:options': {
      label: false
    }
  },
  'ui:order': ['metadata', 'spec', '*']
};

export const jsonSchemaGroupTypes: string[] = ['object', 'array'];
export const jsonSchemaNumberTypes: string[] = ['number', 'integer'];
