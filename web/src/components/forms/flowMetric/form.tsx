import React, { FC } from 'react';

import { useNavigate, useParams } from '../../../utils/url';
import { ResourceForm } from '../resource-form';
import { ResourceWatcher } from '../resource-watcher';
import { flowMetricUISchema } from './uiSchema';

export type FlowMetricFormProps = {
  name?: string;
};

export const FlowMetricForm: FC<FlowMetricFormProps> = props => {
  const params = useParams<{ name?: string; namespace?: string }>();
  const navigate = useNavigate();

  return (
    <ResourceWatcher
      group="flows.netobserv.io"
      version="v1alpha1"
      kind="FlowMetric"
      name={params.name || props.name}
      namespace={params.namespace || 'default'}
      onSuccess={() => navigate(-1)}
      defaultFrom="CRD"
    >
      <ResourceForm uiSchema={flowMetricUISchema} />
    </ResourceWatcher>
  );
};

export default FlowMetricForm;
