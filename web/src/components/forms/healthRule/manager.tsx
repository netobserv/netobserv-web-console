import {
  k8sDelete,
  k8sGet,
  K8sModel,
  K8sResourceKind,
  k8sUpdate,
  useK8sWatchResource
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Button,
  DrawerActions,
  DrawerCloseButton,
  DrawerContentBody,
  DrawerHead,
  DrawerPanelContent,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Label,
  Spinner,
  Title
} from '@patternfly/react-core';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useK8sModel } from '../../../utils/k8s-models-hook';
import { navigateTo } from '../../../utils/url';
import Modal from '../../modals/modal';
import { isK8sConflictError, k8sErrorMessage } from '../utils';
import { healthRuleEditCustomPath, healthRuleEditTemplatePath, healthRuleSetupPath } from './paths';
import { removeHealthRuleFromFlowCollector } from './templateForm';
import { FLOW_COLLECTOR_GVK, FLPHealthRule, PROMETHEUS_RULE_GVK, PrometheusRuleResource } from './types';
import { HEALTH_RULE_DEFAULTS } from './variantDefaults';

export type HealthRulesManagerProps = {
  isOpen: boolean;
  onClose: () => void;
};

type PendingAction = { type: 'reset'; template: string } | { type: 'delete'; namespace: string; name: string } | null;

/**
 * The manager's `fc` comes from a watch that can lag a write made elsewhere (e.g. the
 * wizard just saved an override), so a naive update would 409 on a stale resourceVersion
 * and silently drop the user's reset. Re-fetch on conflict instead of failing the action.
 */
const updateFlowCollectorWithRetry = async (
  model: K8sModel,
  seed: K8sResourceKind,
  transform: (fc: K8sResourceKind) => K8sResourceKind,
  attempts = 3
): Promise<void> => {
  let current = seed;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await k8sUpdate({ model, data: transform(current) });
      return;
    } catch (e) {
      if (attempt === attempts - 1 || !isK8sConflictError(e)) {
        throw e;
      }
      current = await k8sGet({ model, name: 'cluster' });
    }
  }
};

/**
 * Drawer panel for listing/editing health rules.
 * Must be rendered as `panelContent` of Network Health's page Drawer
 * (same pattern as HealthScoringDrawer) so the page stays behind the panel.
 */
export const HealthRulesManager: React.FC<HealthRulesManagerProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const drawerRef = React.useRef<HTMLDivElement>(null);
  const flowCollectorModel = useK8sModel(FLOW_COLLECTOR_GVK.group, FLOW_COLLECTOR_GVK.version, FLOW_COLLECTOR_GVK.kind);
  const prometheusRuleModel = useK8sModel(
    PROMETHEUS_RULE_GVK.group,
    PROMETHEUS_RULE_GVK.version,
    PROMETHEUS_RULE_GVK.kind
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [fc, fcLoaded, fcError] = useK8sWatchResource<any>({
    groupVersionKind: FLOW_COLLECTOR_GVK,
    kind: 'FlowCollector',
    name: 'cluster',
    isList: false
  });
  const isTemplatesLoading = !fcLoaded;

  // Wait for the model so the watch actually starts; otherwise Console can report loaded with no data.
  const prometheusRulesWatch = React.useMemo(
    () =>
      prometheusRuleModel
        ? {
            groupVersionKind: PROMETHEUS_RULE_GVK,
            kind: 'PrometheusRule' as const,
            isList: true as const,
            selector: { matchLabels: { netobserv: 'true' } }
          }
        : null,
    [prometheusRuleModel]
  );
  const [prometheusRules, prometheusRulesLoaded, prometheusRulesError] =
    useK8sWatchResource<PrometheusRuleResource[]>(prometheusRulesWatch);
  const isCustomRulesLoading = !prometheusRuleModel || !prometheusRulesLoaded;

  const [pending, setPending] = React.useState<PendingAction>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const templateOverrides = React.useMemo(() => {
    const rules: FLPHealthRule[] = fc?.spec?.processor?.metrics?.healthRules || [];
    return new Map(rules.filter(r => r?.template).map(r => [r.template, r]));
  }, [fc]);

  const customRules = React.useMemo(() => {
    const list = Array.isArray(prometheusRules) ? prometheusRules : [];
    return list.filter(pr => pr?.metadata?.name && pr?.metadata?.namespace);
  }, [prometheusRules]);

  const openTemplate = (template: string) => {
    onClose();
    navigateTo(healthRuleEditTemplatePath(template));
  };

  const confirmPending = async () => {
    if (!pending) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      if (pending.type === 'reset') {
        if (!flowCollectorModel || !fc) {
          throw new Error(t('FlowCollector is not available yet'));
        }
        await updateFlowCollectorWithRetry(flowCollectorModel, fc, current =>
          removeHealthRuleFromFlowCollector(current, pending.template)
        );
      } else if (pending.type === 'delete') {
        if (!prometheusRuleModel) {
          throw new Error(t('PrometheusRule API model is not available'));
        }
        await k8sDelete({
          model: prometheusRuleModel,
          resource: {
            metadata: { name: pending.name, namespace: pending.namespace }
          }
        });
      }
      setPending(null);
    } catch (e) {
      setActionError(k8sErrorMessage(e) || (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DrawerPanelContent isResizable widths={{ default: 'width_50' }} minSize="400px" data-test="health-rules-manager">
      <DrawerHead>
        <span tabIndex={isOpen ? 0 : -1} ref={drawerRef}>
          <Title headingLevel="h2" size="lg">
            {t('Manage health rules')}
          </Title>
        </span>
        <DrawerActions>
          <DrawerCloseButton onClick={onClose} />
        </DrawerActions>
      </DrawerHead>
      <DrawerContentBody>
        <Button
          variant="primary"
          data-test="create-health-rule"
          onClick={() => {
            onClose();
            navigateTo(healthRuleSetupPath());
          }}
          style={{ marginBottom: '1rem' }}
        >
          {t('Create health rule')}
        </Button>

        <Title headingLevel="h3" size="md" style={{ marginBottom: '0.5rem' }}>
          {t('FlowCollector templates')}
        </Title>
        <p style={{ marginBottom: '0.75rem' }}>
          {t(
            'Built-in templates from the operator. Customizing a template writes an override into FlowCollector healthRules.'
          )}
        </p>
        {isTemplatesLoading ? (
          <EmptyState
            variant={EmptyStateVariant.xs}
            icon={Spinner}
            titleText={t('Loading FlowCollector templates')}
            headingLevel="h4"
            data-test="flowcollector-templates-loading"
          />
        ) : fcError ? (
          <EmptyState titleText={t('Error')} headingLevel="h4" variant={EmptyStateVariant.xs}>
            <EmptyStateBody>{k8sErrorMessage(fcError) || t('Failed to load FlowCollector templates')}</EmptyStateBody>
          </EmptyState>
        ) : (
          <Table aria-label={t('FlowCollector templates')} variant="compact">
            <Thead>
              <Tr>
                <Th>{t('Template')}</Th>
                <Th>{t('Mode')}</Th>
                <Th>{t('Status')}</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {HEALTH_RULE_DEFAULTS.map(def => {
                const override = templateOverrides.get(def.template);
                const mode = override?.mode || def.mode;
                return (
                  <Tr key={def.template} data-test={`template-health-rule-row-${def.template}`}>
                    <Td dataLabel={t('Template')}>{def.template}</Td>
                    <Td dataLabel={t('Mode')}>{mode}</Td>
                    <Td dataLabel={t('Status')}>
                      {override ? (
                        <Label color="blue">{t('Customized')}</Label>
                      ) : (
                        <Label color="grey">{t('Default')}</Label>
                      )}
                    </Td>
                    <Td isActionCell>
                      <div data-test={`template-health-rule-actions-${def.template}`}>
                        <ActionsColumn
                          items={[
                            {
                              title: t('Edit'),
                              onClick: () => openTemplate(def.template)
                            },
                            ...(override
                              ? [
                                  {
                                    title: t('Reset to defaults'),
                                    onClick: () => {
                                      setActionError(null);
                                      setPending({ type: 'reset', template: def.template });
                                    }
                                  }
                                ]
                              : [])
                          ]}
                        />
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}

        <Title headingLevel="h3" size="md" style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>
          {t('Custom PrometheusRules')}
        </Title>
        {isCustomRulesLoading ? (
          <EmptyState
            variant={EmptyStateVariant.xs}
            icon={Spinner}
            titleText={t('Loading custom PrometheusRules')}
            headingLevel="h4"
            data-test="custom-prometheus-rules-loading"
          />
        ) : prometheusRulesError ? (
          <EmptyState titleText={t('Error')} headingLevel="h4" variant={EmptyStateVariant.xs}>
            <EmptyStateBody>
              {k8sErrorMessage(prometheusRulesError) || t('Failed to load custom PrometheusRules')}
            </EmptyStateBody>
          </EmptyState>
        ) : customRules.length === 0 ? (
          <EmptyState titleText={t('No custom rules')} headingLevel="h4" variant={EmptyStateVariant.xs}>
            <EmptyStateBody>{t('Custom PrometheusRules with label netobserv=true will appear here.')}</EmptyStateBody>
          </EmptyState>
        ) : (
          <Table aria-label={t('Custom PrometheusRules')} variant="compact">
            <Thead>
              <Tr>
                <Th>{t('Name')}</Th>
                <Th>{t('Namespace')}</Th>
                <Th>{t('Type')}</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {customRules.map(pr => {
                const rule = pr.spec?.groups?.[0]?.rules?.[0];
                const type = rule?.record ? t('Recording') : t('Alert');
                const name = pr.metadata.name;
                const namespace = pr.metadata.namespace;
                return (
                  <Tr key={`${namespace}/${name}`} data-test={`custom-health-rule-row-${namespace}/${name}`}>
                    <Td dataLabel={t('Name')}>{name}</Td>
                    <Td dataLabel={t('Namespace')}>{namespace}</Td>
                    <Td dataLabel={t('Type')}>{type}</Td>
                    <Td isActionCell>
                      <div data-test={`custom-health-rule-actions-${namespace}/${name}`}>
                        <ActionsColumn
                          items={[
                            {
                              title: t('Edit'),
                              onClick: () => {
                                onClose();
                                navigateTo(healthRuleEditCustomPath(namespace, name));
                              }
                            },
                            {
                              title: t('Delete'),
                              isDanger: true,
                              onClick: () => {
                                setActionError(null);
                                setPending({
                                  type: 'delete',
                                  namespace,
                                  name
                                });
                              }
                            }
                          ]}
                        />
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}

        <Modal
          id="health-rules-manager-confirm"
          title={
            pending?.type === 'reset'
              ? t('Reset template to defaults?')
              : pending?.type === 'delete'
              ? t('Delete custom rule?')
              : ''
          }
          isOpen={Boolean(pending)}
          scrollable={false}
          onClose={
            busy
              ? undefined
              : () => {
                  setPending(null);
                  setActionError(null);
                }
          }
          footer={
            <div className="footer">
              <Button
                key="cancel"
                variant="link"
                isDisabled={busy}
                onClick={() => {
                  setPending(null);
                  setActionError(null);
                }}
              >
                {t('Cancel')}
              </Button>
              <Button key="confirm" variant="danger" isLoading={busy} onClick={() => void confirmPending()}>
                {pending?.type === 'reset' ? t('Reset to defaults') : t('Delete')}
              </Button>
            </div>
          }
        >
          {pending?.type === 'reset' && (
            <p>
              {t(
                'This removes the FlowCollector healthRules override for {{template}}. Operator defaults will apply again.',
                { template: pending.template }
              )}
            </p>
          )}
          {pending?.type === 'delete' && (
            <p>
              {t('This permanently deletes PrometheusRule {{name}} in namespace {{namespace}}.', {
                name: pending.name,
                namespace: pending.namespace
              })}
            </p>
          )}
          {actionError && <p className="pf-v6-c-form__helper-text pf-m-error">{actionError}</p>}
        </Modal>
      </DrawerContentBody>
    </DrawerPanelContent>
  );
};

export default HealthRulesManager;
