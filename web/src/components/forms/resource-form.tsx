/* eslint-disable @typescript-eslint/no-explicit-any */
import { ResourceYAMLEditor } from '@openshift-console/dynamic-plugin-sdk';
import { FormHelperText, PageSection, Title } from '@patternfly/react-core';
import { CustomValidator, UiSchema } from '@rjsf/utils';
import _ from 'lodash';
import React, { FC, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useDiscardGuard } from '../../utils/discard-guard-hook';
import { safeYAMLToJS } from '../../utils/yaml';
import { DynamicForm } from './dynamic-form/dynamic-form';
import { ErrorTemplate } from './dynamic-form/templates';
import { SchemaValidator } from './dynamic-form/validator';
import { EditorToggle, EditorType } from './editor-toggle';
import './forms.css';
import { ResourceDeleteModal } from './resource-delete-modal';
import { Consumer } from './resource-watcher';

export type ResourceFormProps = {
  uiSchema: UiSchema;
  initialViewType?: EditorType;
  createTitle?: string;
  formContext?: Record<string, unknown>;
  customValidate?: CustomValidator;
  transformData?: (data: any) => any;
};

export const ResourceForm: FC<ResourceFormProps> = ({
  uiSchema,
  initialViewType = EditorType.CUSTOM,
  createTitle,
  formContext,
  customValidate,
  transformData
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const [viewType, setViewType] = React.useState(initialViewType);
  const [data, setData] = React.useState<any>(null);
  const [isDeleteModalOpen, setDeleteModalOpen] = React.useState(false);
  const [discard, discardModal] = useDiscardGuard();

  const hasChanged = React.useCallback(
    (existing: any) => {
      return data?.metadata?.resourceVersion !== existing?.metadata?.resourceVersion;
    },
    [data?.metadata?.resourceVersion]
  );

  return (
    <Consumer>
      {ctx => {
        // first init data when watch resource query got results
        if (data == null) {
          setData(ctx.data);
        }
        return (
          <PageSection hasBodyWrapper={false} id="pageSection">
            <div id="pageHeader">
              <Title headingLevel="h1" size="2xl">
                {ctx.isUpdate
                  ? t('Update {{kind}}', { kind: ctx.kind })
                  : createTitle || t('Create {{kind}}', { kind: ctx.kind })}
              </Title>
              <FormHelperText style={{ marginTop: 'var(--pf-t--global--spacer--xs)' }}>
                {ctx.isUpdate
                  ? t('Update by completing the form. Current values are from the existing resource.')
                  : t('Create by completing the form. Default values are provided as example.')}
              </FormHelperText>
            </div>
            <Suspense fallback={<></>}>
              <EditorToggle
                type={viewType}
                updated={hasChanged(ctx.data)}
                isUpdate={ctx.isUpdate}
                onReload={() => setData(ctx.data)}
                onChange={setViewType}
                onSubmit={() => {
                  discard.clearDirty();
                  ctx.onSubmit(transformData ? transformData(data) : data);
                }}
                onCancel={() => discard.requestClose(() => window.history.back())}
                onDelete={() => setDeleteModalOpen(true)}
                customChild={
                  ctx.schema ? (
                    <DynamicForm
                      showAlert
                      formData={data}
                      formContext={formContext}
                      schema={ctx.schema}
                      uiSchema={uiSchema}
                      validator={SchemaValidator}
                      customValidate={customValidate}
                      errors={ctx.errors}
                      onError={errs => ctx.setErrors(_.map(errs, error => error.stack))}
                      onChange={event => {
                        setData(transformData ? transformData(event.formData) : event.formData);
                        discard.markDirty();
                      }}
                      skipDefaults={ctx.skipDefaults}
                    />
                  ) : (
                    <></>
                  )
                }
                yamlChild={
                  <>
                    <ResourceYAMLEditor
                      initialResource={data}
                      onSave={content => {
                        const updatedData = safeYAMLToJS(content);
                        const transformedData = transformData ? transformData(updatedData) : updatedData;
                        setData(transformedData);
                        discard.clearDirty();
                        ctx.onSubmit(transformedData);
                      }}
                    />
                    <>{ctx.errors.length > 0 && <ErrorTemplate errors={ctx.errors} />}</>
                  </>
                }
              />
            </Suspense>
            {isDeleteModalOpen && (
              <ResourceDeleteModal
                data={ctx.data}
                kind={ctx.kind}
                onDelete={() => ctx.onSubmit(data, true)}
                onCancel={() => setDeleteModalOpen(false)}
              />
            )}
            {discardModal}
          </PageSection>
        );
      }}
    </Consumer>
  );
};

export default ResourceForm;
