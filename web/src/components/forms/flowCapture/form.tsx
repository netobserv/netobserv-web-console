import { CustomValidator } from '@rjsf/utils';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { flowCapturePath, useNavigate, useParams } from '../../../utils/url';
import { EditorType } from '../editor-toggle';
import { ResourceForm } from '../resource-form';
import { ResourceWatcher } from '../resource-watcher';
import { FlowCaptureResource } from './types';
import { flowCaptureUISchema } from './uiSchema';

export type FlowCaptureSource = 'filters' | 'flow' | 'topology' | 'health';
export type FlowCaptureFormProps = { name?: string; initialData?: FlowCaptureResource; source?: FlowCaptureSource };

const normalizeFlowCaptureData = (data: FlowCaptureResource): FlowCaptureResource => {
  if (data.spec?.outputType === 'packets' || data.spec?.tlsPlaintext === undefined) {
    return data;
  }
  const spec = { ...data.spec };
  delete spec.tlsPlaintext;
  return { ...data, spec };
};

const flowCaptureDefaultSpec = {
  maxTime: '1h',
  maxBytes: 0,
  sampling: 1
};

export const FlowCaptureForm: FC<FlowCaptureFormProps> = ({ name, initialData, source }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const params = useParams<{ name?: string; namespace?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const stateData = (location.state as { capture?: FlowCaptureResource } | null)?.capture;
  const stateSource = (location.state as { flowCaptureSource?: FlowCaptureSource } | null)?.flowCaptureSource;
  const initial = initialData || stateData;
  const flowCaptureSource = source || stateSource;
  const flowCaptureCustomValidate: CustomValidator<FlowCaptureResource> = (formData, errors) => {
    if (formData?.spec?.outputType === 'packets' && !formData.spec.filters?.length) {
      errors.spec?.filters?.addError(t('Packet captures require at least one eBPF filter.'));
    }
    return errors;
  };
  const initialWithDefaults: FlowCaptureResource = {
    ...(initial || {}),
    spec: {
      ...flowCaptureDefaultSpec,
      ...(initial?.spec || {})
    }
  };
  return (
    <ResourceWatcher
      group="flows.netobserv.io"
      version="v1alpha1"
      kind="FlowCapture"
      name={params.name || name}
      namespace={params.namespace || 'default'}
      initialData={initialWithDefaults}
      onSuccess={created =>
        navigate(flowCapturePath(created?.metadata?.name || params.name || name || '', params.namespace))
      }
      defaultFrom="CRD"
    >
      <ResourceForm
        uiSchema={flowCaptureUISchema}
        createTitle={
          flowCaptureSource === 'filters'
            ? t('Create FlowCapture from filters')
            : flowCaptureSource === 'flow'
              ? t('Create FlowCapture from selected flow')
              : flowCaptureSource === 'topology'
                ? t('Create FlowCapture from topology')
              : flowCaptureSource === 'health'
                ? t('Create FlowCapture from Network Health')
                : undefined
        }
        formContext={{ flowCaptureAutofilled: Boolean(flowCaptureSource) }}
        customValidate={flowCaptureCustomValidate}
        transformData={normalizeFlowCaptureData}
        initialViewType={window.location.pathname.endsWith('/yaml') ? EditorType.YAML : EditorType.CUSTOM}
      />
    </ResourceWatcher>
  );
};

export default FlowCaptureForm;
