import React, { FC } from 'react';

import {
  flowCollectorPath,
  getFlowCollectorResourceName,
  isFlowCollectorCreatePath,
  isFlowCollectorWizardPath,
  useNavigate,
  useParams
} from '../../../utils/url';
import { EditorType } from '../editor-toggle';
import { ResourceForm } from '../resource-form';
import { ResourceWatcher } from '../resource-watcher';
import { flowCollectorUISchema } from './uiSchema';
import { FlowCollectorWizard } from './wizard';

export type FlowCollectorFormProps = {
  name?: string;
};

export const FlowCollectorForm: FC<FlowCollectorFormProps> = props => {
  const params = useParams<{ name?: string }>();
  const navigate = useNavigate();
  const isSetupRoute = window.location.pathname.startsWith(flowCollectorPath('setup')!);

  let name: string | undefined;
  if (isSetupRoute) {
    name = 'cluster';
  } else if (isFlowCollectorCreatePath()) {
    // Create route: do not watch an existing resource (wizard bypass lands here).
    name = undefined;
  } else {
    name = params.name || props.name;
    if (name === 'edit') {
      name = 'cluster';
    }
    name = name || getFlowCollectorResourceName();
  }

  return (
    <ResourceWatcher
      group="flows.netobserv.io"
      version="v1beta2"
      kind="FlowCollector"
      name={name}
      skipCRError={isSetupRoute}
      onSuccess={() => navigate(flowCollectorPath('status')!)}
      defaultFrom="CSVExample"
    >
      <ResourceForm
        uiSchema={flowCollectorUISchema}
        initialViewType={isFlowCollectorWizardPath() ? EditorType.WIZARD : EditorType.FORM}
        wizardChild={<FlowCollectorWizard name={name} />}
      />
    </ResourceWatcher>
  );
};

export default FlowCollectorForm;
