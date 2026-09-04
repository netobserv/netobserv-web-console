/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  k8sCreate,
  k8sDelete,
  k8sGet,
  K8sResourceKind,
  k8sUpdate,
  ResourceYAMLEditor
} from '@openshift-console/dynamic-plugin-sdk';
import {
  ActionList,
  ActionListGroup,
  ActionListItem,
  Alert,
  AlertVariant,
  Button,
  PageSection,
  Title,
  useWizardContext,
  Wizard,
  WizardFooterWrapper,
  WizardStep,
  WizardStepType
} from '@patternfly/react-core';
import { RJSFSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { queryPrometheusMetric } from '../../../api/routes';
import { ContextSingleton } from '../../../utils/context';
import { useDiscardGuard } from '../../../utils/discard-guard-hook';
import { useK8sModel } from '../../../utils/k8s-models-hook';
import { navigateTo, useNavigate, useParams } from '../../../utils/url';
import { safeJSToYAML, safeYAMLToJS } from '../../../utils/yaml';
import Modal from '../../modals/modal';
import { DynamicForm } from '../dynamic-form/dynamic-form';
import { ErrorTemplate } from '../dynamic-form/templates';
import '../forms.css';
import ResourceWatcher, { Consumer, ResourceWatcherContext } from '../resource-watcher';
import { k8sErrorMessage } from '../utils';
import { networkHealthCreatedPath, networkHealthPath, resolveHealthRuleWizardArgs } from './paths';
import {
  applyPrometheusRuleMode,
  defaultPrometheusRuleFormData,
  ensureNetworkHealthLabels,
  prometheusFormDataToCustomForm,
  prometheusRuleToFormData,
  prometheusRuleUISchemaForMode
} from './prometheusForm';
import { prometheusRuleSchemaForMode } from './prometheusSchema';
import {
  defaultTemplateFormData,
  HealthRuleFormData,
  mergeHealthRuleIntoFlowCollector,
  removeHealthRuleFromFlowCollector,
  resolveTemplateRuleForSave,
  ruleToTemplateFormData,
  seedTemplateRule,
  syncFlowCollectorMeta,
  unwrapTemplateForm
} from './templateForm';
import { getHealthRuleTemplateSchema } from './templateSchema';
import { healthRuleTemplateUISchemaForEdit } from './templateUISchema';
import {
  defaultWizardState,
  FLPHealthRule,
  HealthRuleTemplate,
  PROMETHEUS_RULE_GVK,
  PrometheusRuleResource,
  WizardState
} from './types';
import { validateCustomForm, validatePromQLSoft, validateTemplateForm } from './validators';
import { ConfigStepIntro, SourceModeStep } from './wizardSteps';

export {
  healthRuleEditCustomPath,
  healthRuleEditTemplatePath,
  healthRuleSetupPath,
  networkHealthCreatedPath,
  networkHealthPath,
  resolveHealthRuleWizardArgs
} from './paths';

export type HealthRuleWizardProps = {
  initialState?: WizardState;
};

const isEmpty = (arr?: string[]) => !arr || arr.length === 0;

type WizardInnerProps = {
  ctx: ResourceWatcherContext;
  initialState?: WizardState;
};

/**
 * Bottom footer matching FlowCollector form / EditorToggle ActionGroup:
 * primary (Next/Save), optional danger (Delete/Reset), Cancel.
 */
type HealthRuleWizardFooterProps = {
  isLastStep: boolean;
  primaryLabel: string;
  onPrimary: () => void;
  showDanger: boolean;
  dangerLabel: string;
  onDanger: () => void;
  onCancel: () => void;
  submitting: boolean;
  deleting: boolean;
};

const HealthRuleWizardFooter: React.FC<HealthRuleWizardFooterProps> = ({
  isLastStep,
  primaryLabel,
  onPrimary,
  showDanger,
  dangerLabel,
  onDanger,
  onCancel,
  submitting,
  deleting
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const { goToPrevStep, goToNextStep, activeStep } = useWizardContext();
  const isFirst = (activeStep?.index ?? 1) === 1;

  return (
    <WizardFooterWrapper>
      <ActionList>
        <ActionListGroup>
          {!isFirst && (
            <ActionListItem>
              <Button
                variant="secondary"
                data-test="health-rule-wizard-back"
                onClick={goToPrevStep}
                isDisabled={submitting || deleting}
              >
                {t('Back')}
              </Button>
            </ActionListItem>
          )}
          <ActionListItem>
            <Button
              variant="primary"
              data-test="health-rule-wizard-primary"
              onClick={isLastStep ? onPrimary : goToNextStep}
              isDisabled={submitting || deleting}
              isLoading={isLastStep && submitting}
            >
              {isLastStep ? primaryLabel : t('Next')}
            </Button>
          </ActionListItem>
          <ActionListItem>
            <Button
              variant="link"
              data-test="health-rule-wizard-cancel"
              onClick={onCancel}
              isDisabled={submitting || deleting}
            >
              {t('Cancel')}
            </Button>
          </ActionListItem>
          {showDanger && (
            <ActionListItem>
              <Button
                variant="danger"
                data-test="health-rule-wizard-delete"
                onClick={onDanger}
                isDisabled={submitting || deleting}
              >
                {dangerLabel}
              </Button>
            </ActionListItem>
          )}
        </ActionListGroup>
      </ActionList>
    </WizardFooterWrapper>
  );
};

/**
 * Wizard body under ResourceWatcher. Syncs FlowCollector from context via effect
 * (never setState during Consumer render).
 */
const HealthRuleWizardInner: React.FC<WizardInnerProps> = ({ ctx, initialState }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const navigate = useNavigate();
  const routeParams = useParams<{ template?: string; namespace?: string; name?: string }>();
  // Resolve on every render so query/path from navigateTo(pushState) is picked up.
  const {
    template: editTemplateParam,
    namespace: editNamespace,
    name: editName
  } = resolveHealthRuleWizardArgs(routeParams);
  const prometheusRuleModel = useK8sModel(
    PROMETHEUS_RULE_GVK.group,
    PROMETHEUS_RULE_GVK.version,
    PROMETHEUS_RULE_GVK.kind
  );

  const [sourceState, setSourceState] = React.useState<WizardState>(initialState || defaultWizardState());
  const [flowCollectorData, setFlowCollectorData] = React.useState<any>(null);
  const [templateData, setTemplateData] = React.useState<HealthRuleFormData>(defaultTemplateFormData());
  const [prometheusData, setPrometheusData] = React.useState<any>(null);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [loadedEdit, setLoadedEdit] = React.useState(false);
  const [existingPR, setExistingPR] = React.useState<PrometheusRuleResource | undefined>();
  const [previewYAML, setPreviewYAML] = React.useState('');
  const [confirmDanger, setConfirmDanger] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [discard, discardModal] = useDiscardGuard();
  const seededTemplateFromFc = React.useRef(false);
  const seededCustomCreate = React.useRef(false);

  const isTemplate = sourceState.source === 'template';
  const isEdit = Boolean(sourceState.isEdit || editTemplateParam || (editNamespace && editName));
  const editTemplateName = (sourceState.editTemplate || editTemplateParam) as string | undefined;

  const hasTemplateOverride = React.useMemo(() => {
    if (!isTemplate || !editTemplateName || !flowCollectorData) {
      return false;
    }
    const rules: FLPHealthRule[] = flowCollectorData?.spec?.processor?.metrics?.healthRules || [];
    return rules.some(r => r.template === editTemplateName);
  }, [isTemplate, editTemplateName, flowCollectorData]);

  /** Delete custom PR, or reset template override — create flow has no danger action. */
  const showDangerAction =
    isEdit && (isTemplate ? hasTemplateOverride : Boolean(existingPR || (editNamespace && editName)));
  const dangerLabel = isTemplate ? t('Reset to defaults') : t('Delete');

  // Keep metadata tracking the watch; see syncFlowCollectorMeta for why.
  React.useEffect(() => {
    if (!ctx.data) {
      return;
    }
    setFlowCollectorData((prev: K8sResourceKind | null) => syncFlowCollectorMeta(prev, ctx.data));
  }, [ctx.data]);

  React.useEffect(() => {
    if (loadedEdit || initialState) {
      return;
    }
    const template = editTemplateParam;
    const ns = editNamespace;
    const name = editName;

    if (template) {
      const seeded = seedTemplateRule(template);
      setSourceState({
        ...defaultWizardState(),
        source: 'template',
        mode: seeded.mode || 'Alert',
        isEdit: true,
        editTemplate: template as HealthRuleTemplate,
        template: {
          template: template as HealthRuleTemplate,
          mode: seeded.mode || 'Alert',
          variants: []
        }
      });
      setTemplateData(ruleToTemplateFormData(seeded));
      setLoadedEdit(true);
      return;
    }

    if (ns && name && prometheusRuleModel) {
      k8sGet({ model: prometheusRuleModel, name, ns: ns })
        .then(pr => {
          const rule = pr as PrometheusRuleResource;
          setExistingPR(rule);
          setPrometheusData(prometheusRuleToFormData(rule));
          setSourceState({
            ...defaultWizardState(),
            source: 'custom',
            mode: rule.spec?.groups?.[0]?.rules?.[0]?.record ? 'Recording' : 'Alert',
            isEdit: true,
            editPrometheusRuleName: name,
            editPrometheusRuleNamespace: ns
          });
        })
        .catch(err => {
          setErrors([err instanceof Error ? err.message : String(err)]);
        })
        .finally(() => setLoadedEdit(true));
      return;
    }

    if (!template && !ns) {
      setLoadedEdit(true);
    }
  }, [editTemplateParam, editNamespace, editName, prometheusRuleModel, loadedEdit, initialState]);

  // When FlowCollector loads, prefer an existing healthRules override; otherwise keep operator defaults
  React.useEffect(() => {
    if (!flowCollectorData || seededTemplateFromFc.current) {
      return;
    }
    const editTemplate = sourceState.editTemplate || editTemplateParam;
    if (editTemplate) {
      const rules: FLPHealthRule[] = flowCollectorData?.spec?.processor?.metrics?.healthRules || [];
      const found = rules.find(r => r.template === editTemplate);
      const seeded = seedTemplateRule(editTemplate, found);
      setSourceState(prev => ({
        ...prev,
        mode: seeded.mode || prev.mode,
        template: {
          template: editTemplate as HealthRuleTemplate,
          mode: seeded.mode || 'Alert',
          variants: []
        }
      }));
      setTemplateData(ruleToTemplateFormData(seeded));
      seededTemplateFromFc.current = true;
    }
  }, [flowCollectorData, sourceState.editTemplate, editTemplateParam]);

  // Seed custom form when switching to custom (create only); mode changes preserve shared fields
  React.useEffect(() => {
    if (sourceState.source !== 'custom' || sourceState.isEdit || existingPR) {
      if (sourceState.source !== 'custom') {
        seededCustomCreate.current = false;
      }
      return;
    }
    if (!seededCustomCreate.current) {
      setPrometheusData(defaultPrometheusRuleFormData(sourceState.mode));
      seededCustomCreate.current = true;
      return;
    }
    setPrometheusData((prev: any) => applyPrometheusRuleMode(prev, sourceState.mode));
  }, [sourceState.source, sourceState.mode, sourceState.isEdit, existingPR]);

  /** Template review shows the single rule being created/edited. */
  const previewResource = React.useMemo(() => {
    if (isTemplate) {
      const rule = resolveTemplateRuleForSave(unwrapTemplateForm(templateData));
      return { healthRules: rule ? [rule] : [] };
    }
    return ensureNetworkHealthLabels(prometheusData, sourceState.mode);
  }, [isTemplate, templateData, prometheusData, sourceState.mode]);

  const mergeTemplatePreviewIntoFlowCollector = React.useCallback(
    (parsed: any) => {
      if (!flowCollectorData) {
        return parsed;
      }
      const rules = Array.isArray(parsed?.healthRules)
        ? parsed.healthRules
        : parsed?.spec?.processor?.metrics?.healthRules;
      if (Array.isArray(rules) && rules.length > 0) {
        let next = flowCollectorData;
        rules.forEach((rule: FLPHealthRule) => {
          if (rule?.variants?.length) {
            next = mergeHealthRuleIntoFlowCollector(next, rule);
          }
        });
        return next;
      }
      return parsed?.kind === 'FlowCollector' ? parsed : flowCollectorData;
    },
    [flowCollectorData]
  );

  const refreshPreview = React.useCallback(() => {
    setPreviewYAML(safeJSToYAML(previewResource, '', { noRefs: true, lineWidth: -1 }));
  }, [previewResource]);

  const onStepChange = React.useCallback(
    (_event: React.MouseEvent<HTMLButtonElement>, step: WizardStepType) => {
      if (step.id === 'review') {
        refreshPreview();
      }
    },
    [refreshPreview]
  );

  const validateTemplate = (): boolean => {
    const result = validateTemplateForm(unwrapTemplateForm(templateData));
    setErrors(result.errors);
    setWarnings(result.warnings);
    return result.errors.length === 0;
  };

  const validateCustom = async (): Promise<boolean> => {
    const form = prometheusFormDataToCustomForm(prometheusData, sourceState.mode);
    const installNs = flowCollectorData?.spec?.namespace as string | undefined;
    const result = validateCustomForm(form, installNs);
    const nextErrors = [...result.errors];
    const nextWarnings = [...result.warnings];
    const groupName = prometheusData?.spec?.groups?.[0]?.name;
    if (!groupName?.trim()) {
      nextErrors.push(t('Group name is required'));
    }
    if (nextErrors.length === 0 && form.expr?.trim()) {
      const soft = await validatePromQLSoft(form.expr, queryPrometheusMetric);
      nextErrors.push(...soft.errors);
      nextWarnings.push(...soft.warnings);
    }
    setErrors(nextErrors);
    setWarnings(nextWarnings);
    return nextErrors.length === 0;
  };

  const doNavigateTo = React.useCallback(
    (path: string) => {
      discard.clearDirty();
      if (ContextSingleton.isStandalone()) {
        navigateTo(path);
      } else {
        navigate(path);
      }
    },
    [navigate, discard]
  );

  const navigateAway = React.useCallback(() => {
    doNavigateTo(networkHealthPath());
  }, [doNavigateTo]);

  const navigateAfterSave = React.useCallback(() => {
    doNavigateTo(networkHealthCreatedPath());
  }, [doNavigateTo]);

  const navigateAfterDelete = React.useCallback(() => {
    doNavigateTo(networkHealthPath());
  }, [doNavigateTo]);

  const handleClose = React.useCallback(() => {
    discard.requestClose(navigateAway);
  }, [discard, navigateAway]);

  const onConfirmDanger = async () => {
    setDeleting(true);
    setErrors([]);
    try {
      if (isTemplate) {
        if (!flowCollectorData || !editTemplateName) {
          throw new Error(t('FlowCollector is not available yet'));
        }
        const next = removeHealthRuleFromFlowCollector(flowCollectorData, editTemplateName);
        setFlowCollectorData(next);
        await Promise.resolve(ctx.onSubmit(next));
        setConfirmDanger(false);
        return;
      }
      if (!prometheusRuleModel) {
        throw new Error(t('PrometheusRule API model is not available'));
      }
      const name = existingPR?.metadata?.name || editName;
      const ns = existingPR?.metadata?.namespace || editNamespace;
      if (!name || !ns) {
        throw new Error(t('PrometheusRule API model is not available'));
      }
      await k8sDelete({
        model: prometheusRuleModel,
        resource: { metadata: { name, namespace: ns } }
      });
      setConfirmDanger(false);
      navigateAfterDelete();
    } catch (e) {
      setErrors([k8sErrorMessage(e) || String(e)]);
      setConfirmDanger(false);
    } finally {
      setDeleting(false);
    }
  };

  const onSaveTemplate = async (yamlOverride?: string) => {
    setSubmitting(true);
    setErrors([]);
    discard.clearDirty();
    try {
      if (yamlOverride) {
        const merged = mergeTemplatePreviewIntoFlowCollector(safeYAMLToJS(yamlOverride));
        setFlowCollectorData(merged);
        await Promise.resolve(ctx.onSubmit(merged));
        return;
      }
      if (!validateTemplate()) {
        return;
      }
      if (!flowCollectorData) {
        setErrors([t('FlowCollector is not available yet')]);
        return;
      }
      const rule = resolveTemplateRuleForSave(unwrapTemplateForm(templateData));
      if (!rule) {
        // Empty variants with default mode: nothing to write (operator defaults already apply).
        navigateAfterSave();
        return;
      }
      const merged = mergeHealthRuleIntoFlowCollector(flowCollectorData, rule);
      setFlowCollectorData(merged);
      await Promise.resolve(ctx.onSubmit(merged));
    } catch (e) {
      setErrors([k8sErrorMessage(e) || String(e)]);
    } finally {
      setSubmitting(false);
    }
  };

  const onSaveCustom = async (yamlOverride?: string) => {
    if (!prometheusRuleModel) {
      setErrors([t('PrometheusRule API model is not available')]);
      return;
    }
    setSubmitting(true);
    setErrors([]);
    discard.clearDirty();
    try {
      let data: any;
      if (yamlOverride) {
        data = ensureNetworkHealthLabels(safeYAMLToJS(yamlOverride), sourceState.mode);
        if (existingPR?.metadata) {
          data.metadata = {
            ...data.metadata,
            ...(!data.metadata?.resourceVersion && existingPR.metadata.resourceVersion
              ? { resourceVersion: existingPR.metadata.resourceVersion }
              : {}),
            ...(!data.metadata?.uid && existingPR.metadata.uid ? { uid: existingPR.metadata.uid } : {})
          };
        }
      } else {
        const ok = await validateCustom();
        if (!ok) {
          return;
        }
        data = ensureNetworkHealthLabels(prometheusData, sourceState.mode);
        if (existingPR?.metadata?.resourceVersion) {
          data.metadata = {
            ...data.metadata,
            resourceVersion: existingPR.metadata.resourceVersion,
            uid: existingPR.metadata.uid
          };
        }
      }
      if (sourceState.isEdit || existingPR) {
        await k8sUpdate({ model: prometheusRuleModel, data });
      } else {
        await k8sCreate({ model: prometheusRuleModel, data });
      }
      navigateAfterSave();
    } catch (e) {
      setErrors([k8sErrorMessage(e) || String(e)]);
    } finally {
      setSubmitting(false);
    }
  };

  const templateForm = () => (
    <DynamicForm
      formData={templateData}
      schema={getHealthRuleTemplateSchema(t) as RJSFSchema}
      uiSchema={healthRuleTemplateUISchemaForEdit(
        Boolean(sourceState.isEdit || editTemplateParam),
        templateData?.spec?.template
      )}
      customUISchema
      validator={validator}
      onChange={event => {
        const next = event.formData as HealthRuleFormData;
        if (next?.spec?.variants) {
          next.spec.variants = next.spec.variants.map(v => ({
            groupBy: (v?.groupBy as string) || 'Cluster',
            thresholds: { ...(v?.thresholds || {}) },
            lowVolumeThreshold: v?.lowVolumeThreshold,
            trendOffset: v?.trendOffset,
            trendDuration: v?.trendDuration,
            mode: v?.mode
          })) as HealthRuleFormData['spec']['variants'];
        }
        setTemplateData(next);
        discard.markDirty();
      }}
      errors={errors}
      skipDefaults
    />
  );

  const customForm = () => {
    if (!prometheusData) {
      return <></>;
    }
    return (
      <DynamicForm
        formData={prometheusData}
        schema={prometheusRuleSchemaForMode(sourceState.mode) as RJSFSchema}
        uiSchema={prometheusRuleUISchemaForMode(sourceState.mode)}
        customUISchema
        validator={validator}
        onChange={event => {
          setPrometheusData(event.formData);
          discard.markDirty();
        }}
        errors={errors}
        skipDefaults
      />
    );
  };

  return (
    <PageSection hasBodyWrapper={false} id="pageSection">
      <div id="pageHeader">
        <Title headingLevel="h1" size="2xl">
          {isEdit ? t('Edit Network Health rule') : t('Create Network Health rule')}
        </Title>
      </div>
      <div id="wizard-container">
        <Wizard
          id="healthRuleWizard"
          key={isEdit ? `edit-${editTemplateParam || `${editNamespace}/${editName}`}` : 'create'}
          onStepChange={onStepChange}
          onSave={() => {
            if (isTemplate) {
              void onSaveTemplate();
            } else {
              void onSaveCustom();
            }
          }}
          onClose={handleClose}
          isVisitRequired={false}
        >
          {!isEdit && (
            <WizardStep name={t('Rule type')} id="source">
              <SourceModeStep
                state={sourceState}
                lockSource={false}
                onChange={next => {
                  setSourceState(next);
                  setErrors([]);
                  setWarnings([]);
                  discard.markDirty();
                }}
              />
            </WizardStep>
          )}
          <WizardStep
            name={t('Configuration')}
            id="config"
            footer={
              showDangerAction ? (
                <HealthRuleWizardFooter
                  isLastStep={false}
                  primaryLabel={t('Next')}
                  onPrimary={() => undefined}
                  showDanger={showDangerAction}
                  dangerLabel={dangerLabel}
                  onDanger={() => setConfirmDanger(true)}
                  onCancel={handleClose}
                  submitting={submitting}
                  deleting={deleting}
                />
              ) : undefined
            }
          >
            <ConfigStepIntro source={sourceState.source} mode={sourceState.mode} />
            {isTemplate ? templateForm() : customForm()}
            {!isEmpty(errors) && <ErrorTemplate errors={errors} />}
            {warnings.map(w => (
              <Alert key={w} variant={AlertVariant.warning} isInline title={w} style={{ marginTop: '0.5rem' }} />
            ))}
          </WizardStep>
          <WizardStep
            name={t('Review')}
            id="review"
            body={{ className: 'wizard-editor-container' }}
            footer={
              <HealthRuleWizardFooter
                isLastStep
                primaryLabel={submitting ? t('Saving...') : isEdit ? t('Save') : t('Create')}
                onPrimary={() => {
                  if (isTemplate) {
                    void onSaveTemplate(previewYAML);
                  } else {
                    void onSaveCustom(previewYAML);
                  }
                }}
                showDanger={showDangerAction}
                dangerLabel={dangerLabel}
                onDanger={() => setConfirmDanger(true)}
                onCancel={handleClose}
                submitting={submitting}
                deleting={deleting}
              />
            }
          >
            {!isEmpty(errors) && (
              <div style={{ marginBottom: '1rem' }} data-test="health-rule-save-error">
                <ErrorTemplate errors={errors} />
              </div>
            )}
            <Alert variant="info" isInline title={t('Preview')} style={{ marginBottom: '1rem' }}>
              {t(
                'Review the generated health rule before saving. Rules may take a short time to appear on Network Health after Prometheus reconciles.'
              )}
            </Alert>
            {ContextSingleton.isStandalone() ? (
              <pre data-test="health-rule-yaml-preview" className="wizard-yaml-preview">
                {previewYAML || safeJSToYAML(previewResource)}
              </pre>
            ) : (
              <ResourceYAMLEditor
                initialResource={previewResource as object}
                onChange={content => setPreviewYAML(content)}
              />
            )}
            {warnings.map(w => (
              <Alert key={w} variant={AlertVariant.warning} isInline title={w} style={{ marginTop: '0.5rem' }} />
            ))}
          </WizardStep>
        </Wizard>
      </div>
      {discardModal}
      <Modal
        id="health-rule-wizard-delete-modal"
        title={isTemplate ? t('Reset template to defaults?') : t('Delete custom rule?')}
        isOpen={confirmDanger}
        scrollable={false}
        onClose={
          deleting
            ? undefined
            : () => {
                setConfirmDanger(false);
              }
        }
        footer={
          <div className="footer">
            <Button key="cancel" variant="link" isDisabled={deleting} onClick={() => setConfirmDanger(false)}>
              {t('Cancel')}
            </Button>
            <Button
              key="confirm"
              variant="danger"
              data-test="health-rule-wizard-delete-confirm"
              isLoading={deleting}
              onClick={() => void onConfirmDanger()}
            >
              {dangerLabel}
            </Button>
          </div>
        }
      >
        {isTemplate && editTemplateName ? (
          <p>
            {t(
              'This removes the FlowCollector healthRules override for {{template}}. Operator defaults will apply again.',
              { template: editTemplateName }
            )}
          </p>
        ) : (
          <p>
            {t('This permanently deletes PrometheusRule {{name}} in namespace {{namespace}}.', {
              name: existingPR?.metadata?.name || editName || '',
              namespace: existingPR?.metadata?.namespace || editNamespace || ''
            })}
          </p>
        )}
      </Modal>
    </PageSection>
  );
};

export const HealthRuleWizard: React.FC<HealthRuleWizardProps> = ({ initialState }) => {
  const navigate = useNavigate();
  const onSuccess = React.useCallback(() => {
    const path = networkHealthCreatedPath();
    if (ContextSingleton.isStandalone()) {
      navigateTo(path);
    } else {
      navigate(path);
    }
  }, [navigate]);

  return (
    <ResourceWatcher
      group="flows.netobserv.io"
      version="v1beta2"
      kind="FlowCollector"
      name="cluster"
      skipCRError
      onSuccess={onSuccess}
      defaultFrom="CSVExample"
    >
      <Consumer>{ctx => <HealthRuleWizardInner ctx={ctx} initialState={initialState} />}</Consumer>
    </ResourceWatcher>
  );
};

export { ConfigStepIntro, SourceModeStep } from './wizardSteps';
export type { ConfigStepIntroProps, SourceModeStepProps } from './wizardSteps';

export default HealthRuleWizard;
