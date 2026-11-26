import { ErrorBoundaryFallbackProps } from '@openshift-console/dynamic-plugin-sdk';
import { Accordion, Alert } from '@patternfly/react-core';
import Form, { FormProps } from '@rjsf/core';
import * as _ from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { FlowCaptureFiltersField } from '../flowCapture/filters-widget';
import { NodeSelectorField } from '../flowCapture/node-selector-widget';
import { TLSPlaintextField } from '../flowCapture/tls-plaintext-field';
import { getUpdatedCR } from '../utils';
import { K8sUISchema } from './const';
import './dynamic-form.css';
import { ErrorBoundary } from './error-boundary';
import defaultFields from './fields';
import defaultTemplates, { ErrorTemplate } from './templates';
import defaultWidgets from './widgets';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DynamicFormProps = FormProps<any> & {
  errors?: string[];
  ErrorTemplate?: React.FC<{ errors: string[] }>;
  customUISchema?: boolean;
  showAlert?: boolean;
  skipDefaults: boolean;
};

export const DynamicFormFormErrorFallback: React.FC<ErrorBoundaryFallbackProps> = () => {
  const { t } = useTranslation('plugin__netobserv-plugin');

  return (
    <Alert
      isInline
      className="co-alert co-break-word"
      variant="danger"
      data-test-id="dynamic-form-error-boundary-fallback"
      title={t('There is some issue in this form view. Please select "YAML view" for full control.')}
    />
  );
};

export const DynamicForm: React.FC<DynamicFormProps> = ({
  errors = [],
  fields = {},
  templates = {},
  formContext,
  formData = {},
  noValidate = false,
  onFocus = _.noop,
  onBlur = _.noop,
  onChange = _.noop,
  onError = _.noop,
  schema,
  uiSchema = {},
  widgets = {},
  customUISchema,
  showAlert = false,
  skipDefaults,
  ...restProps
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const [mustSync, setMustSync] = React.useState(false);
  return (
    <div className="dynamic-form" data-test-id="dynamic-form">
      {showAlert && (
        <Alert
          isInline
          className="co-alert co-break-word"
          variant="info"
          data-test-id="dynamic-form-partial-fields-notice"
          title={t(
            'Note: Some fields may not be represented in this form view. Please select "YAML view" for full control.'
          )}
        />
      )}
      <Accordion asDefinitionList={false} className="co-dynamic-form__accordion">
        <ErrorBoundary fallbackComponent={DynamicFormFormErrorFallback}>
          <Form
            {...restProps}
            className="co-dynamic-form"
            noValidate={noValidate}
            fields={{
              ...defaultFields,
              flowCaptureFilters: FlowCaptureFiltersField,
              nodeSelector: NodeSelectorField,
              flowCaptureTLSPlaintext: TLSPlaintextField,
              ...fields
            }}
            formContext={{ ...formContext, formData }}
            formData={formData}
            experimental_defaultFormStateBehavior={
              skipDefaults
                ? {
                    // We assume the input data already has the desired defaults
                    emptyObjectFields: 'skipDefaults'
                  }
                : undefined
            }
            noHtml5Validate
            liveValidate
            onChange={(event, id) => {
              // skip the onChange event if formData is not ready
              if (!event.formData || !event.formData.apiVersion || !event.formData.kind) {
                return;
              }
              if (!mustSync) {
                // keep original formData reference and update only specific fields
                event.formData = getUpdatedCR(formData, event.formData);
              }
              setMustSync(false);
              onChange(event, id);
            }}
            onFocus={(id, data) => {
              setMustSync(true);
              onFocus(id, data);
            }}
            onBlur={onBlur}
            onError={onError}
            schema={schema}
            // Don't show the react-jsonschema-form error list at top
            showErrorList={false}
            uiSchema={customUISchema ? uiSchema : _.defaultsDeep({}, K8sUISchema, uiSchema)}
            widgets={{ ...defaultWidgets, ...widgets }}
            templates={{ ...defaultTemplates, ...templates }}
          >
            <>{errors.length > 0 && <ErrorTemplate errors={errors} />}</>
          </Form>
        </ErrorBoundary>
      </Accordion>
    </div>
  );
};

export default DynamicForm;
