import React, { FC } from 'react';

import {
  flowCollectorStatusPath,
  getFlowCollectorResourceName,
  isFlowCollectorCreatePath,
  useNavigate,
  useParams
} from '../../../utils/url';
import { ResourceForm } from '../resource-form';
import { ResourceWatcher } from '../resource-watcher';
import { flowCollectorUISchema } from './uiSchema';

export type FlowCollectorFormProps = {
  name?: string;
};

export const FlowCollectorForm: FC<FlowCollectorFormProps> = props => {
  const params = useParams<{ name?: string }>();
  const navigate = useNavigate();

  let name: string | undefined;
  if (isFlowCollectorCreatePath()) {
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
      onSuccess={() => navigate(flowCollectorStatusPath)}
      defaultFrom="CSVExample"
    >
      <ResourceForm uiSchema={flowCollectorUISchema} />
    </ResourceWatcher>
  );
};

export default FlowCollectorForm;
