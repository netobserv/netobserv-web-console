/* eslint-disable @typescript-eslint/no-explicit-any */
import { ResourceYAMLEditor } from '@openshift-console/dynamic-plugin-sdk';
import { FormHelperText, PageSection, Title } from '@patternfly/react-core';
import { UiSchema } from '@rjsf/utils';
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
  wizardChild?: JSX.Element;
};

export type ResourceEditorContextValue = {
  data: any;
  setData: React.Dispatch<React.SetStateAction<any>>;
  setView: (view: EditorType) => void;
};

export const ResourceEditorContext = React.createContext<ResourceEditorContextValue | null>(null);

export const useResourceEditor = () => React.useContext(ResourceEditorContext);

export const ResourceForm: FC<ResourceFormProps> = ({ uiSchema, wizardChild }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const [viewType, setViewType] = React.useState(() => {
    const requestedView = new URLSearchParams(window.location.search).get('view');
    if (requestedView === EditorType.WIZARD && wizardChild) {
      return EditorType.WIZARD;
    }
    if (requestedView === EditorType.YAML) {
      return EditorType.YAML;
    }
    return EditorType.FORM;
  });
  const [data, setData] = React.useState<any>(null);
  const [isDeleteModalOpen, setDeleteModalOpen] = React.useState(false);
  const [discard, discardModal] = useDiscardGuard();

  const changeView = React.useCallback((next: EditorType) => {
    setViewType(next);
    const url = new URL(window.location.href);
    if (next === EditorType.FORM) {
      url.searchParams.delete('view');
    } else {
      url.searchParams.set('view', next);
    }
    window.history.replaceState(window.history.state, '', url.toString());
  }, []);

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
                {ctx.isUpdate ? t('Update {{kind}}', { kind: ctx.kind }) : t('Create {{kind}}', { kind: ctx.kind })}
              </Title>
              <FormHelperText style={{ marginTop: 'var(--pf-t--global--spacer--xs)' }}>
                {ctx.isUpdate
                  ? t('Update by completing the form. Current values are from the existing resource.')
                  : t('Create by completing the form. Default values are provided as example.')}
              </FormHelperText>
            </div>
            <Suspense fallback={<></>}>
              <ResourceEditorContext.Provider value={{ data, setData, setView: changeView }}>
                <EditorToggle
                  type={viewType}
                  updated={hasChanged(ctx.data)}
                  isUpdate={ctx.isUpdate}
                  onReload={() => setData(ctx.data)}
                  onChange={changeView}
                  onSubmit={() => {
                    discard.clearDirty();
                    ctx.onSubmit(data);
                  }}
                  onCancel={() => discard.requestClose(() => window.history.back())}
                  onDelete={() => setDeleteModalOpen(true)}
                  formChild={
                    ctx.schema ? (
                      <DynamicForm
                        showAlert
                        formData={data}
                        schema={ctx.schema}
                        uiSchema={uiSchema}
                        validator={SchemaValidator}
                        errors={ctx.errors}
                        onError={errs => ctx.setErrors(_.map(errs, error => error.stack))}
                        onChange={event => {
                          setData(event.formData);
                          discard.markDirty();
                        }}
                        skipDefaults={ctx.skipDefaults}
                      />
                    ) : (
                      <></>
                    )
                  }
                  wizardChild={wizardChild}
                  yamlChild={
                    <>
                      <ResourceYAMLEditor
                        initialResource={data}
                        onSave={content => {
                          const updatedData = safeYAMLToJS(content);
                          setData(updatedData);
                          discard.clearDirty();
                          ctx.onSubmit(updatedData);
                        }}
                      />
                      <>{ctx.errors.length > 0 && <ErrorTemplate errors={ctx.errors} />}</>
                    </>
                  }
                />
              </ResourceEditorContext.Provider>
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
