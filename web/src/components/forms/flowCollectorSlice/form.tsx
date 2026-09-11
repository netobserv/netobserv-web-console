import React, { FC } from 'react';

import { useNavigate, useParams } from '../../../utils/url';
import { ResourceForm } from '../resource-form';
import { ResourceWatcher } from '../resource-watcher';
import { flowCollectorSliceUISchema } from './uiSchema';

export type FlowCollectorSliceFormProps = {
  name?: string;
};

export const FlowCollectorSliceForm: FC<FlowCollectorSliceFormProps> = props => {
  const params = useParams<{ name?: string; namespace?: string }>();
  const navigate = useNavigate();

  return (
    <ResourceWatcher
      group="flows.netobserv.io"
      version="v1alpha1"
      kind="FlowCollectorSlice"
      name={params.name || props.name}
      namespace={params.namespace || 'default'}
      onSuccess={() => navigate(-1)}
      defaultFrom="CSVExample"
    >
      <ResourceForm uiSchema={flowCollectorSliceUISchema} />
    </ResourceWatcher>
  );
};

export default FlowCollectorSliceForm;
