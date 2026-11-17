import React, { FC } from 'react';

import { isFlowMetricWizardPath, useNavigate, useParams } from '../../../utils/url';
import { EditorType } from '../editor-toggle';
import { ResourceForm } from '../resource-form';
import { ResourceWatcher } from '../resource-watcher';
import { flowMetricUISchema } from './uiSchema';
import { FlowMetricWizard } from './wizard';

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
      <ResourceForm
        uiSchema={flowMetricUISchema}
        initialViewType={isFlowMetricWizardPath() ? EditorType.WIZARD : EditorType.FORM}
        wizardChild={<FlowMetricWizard name={params.name || props.name} />}
      />
    </ResourceWatcher>
  );
};

export default FlowMetricForm;
