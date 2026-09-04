import { ContextSingleton } from '../../../utils/context';

export const healthRuleSetupPath = () =>
  ContextSingleton.isStandalone() ? '/console-health-rule-wizard' : '/network-health/rules/setup';

/** Edit/customize a FlowCollector template — template is always in query (and path in plugin mode). */
export const healthRuleEditTemplatePath = (template: string) => {
  const q = `template=${encodeURIComponent(template)}`;
  return ContextSingleton.isStandalone()
    ? `/console-health-rule-wizard?${q}`
    : `/network-health/rules/template/${encodeURIComponent(template)}?${q}`;
};

/** Edit a custom PrometheusRule — ns/name in query (and path in plugin mode). */
export const healthRuleEditCustomPath = (namespace: string, name: string) => {
  const q = `namespace=${encodeURIComponent(namespace)}&name=${encodeURIComponent(name)}`;
  return ContextSingleton.isStandalone()
    ? `/console-health-rule-wizard?${q}`
    : `/network-health/rules/ns/${encodeURIComponent(namespace)}/name/${encodeURIComponent(name)}?${q}`;
};

export const networkHealthPath = () =>
  ContextSingleton.isStandalone() ? '/console-network-health' : '/network-health';

export const networkHealthCreatedPath = () =>
  ContextSingleton.isStandalone() ? '/console-network-health?ruleCreated=1' : '/network-health?ruleCreated=1';

const safeDecodeURIComponent = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/**
 * Resolve wizard route args from react-router params, query string, or path segments.
 * Query is required for standalone (flat /console-health-rule-wizard route) and is a
 * reliable fallback when Console does not expose path params to useParams.
 */
export const resolveHealthRuleWizardArgs = (routeParams: {
  template?: string;
  namespace?: string;
  name?: string;
}): { template?: string; namespace?: string; name?: string } => {
  const search = new URLSearchParams(window.location.search);
  const pathname = window.location.pathname;

  const templateFromPath = pathname.match(/\/rules\/template\/([^/?#]+)/)?.[1];
  const customFromPath = pathname.match(/\/rules\/ns\/([^/]+)\/name\/([^/?#]+)/);

  const template =
    routeParams.template ||
    search.get('template') ||
    (templateFromPath ? safeDecodeURIComponent(templateFromPath) : undefined) ||
    undefined;

  const namespace =
    routeParams.namespace ||
    search.get('namespace') ||
    (customFromPath?.[1] ? safeDecodeURIComponent(customFromPath[1]) : undefined) ||
    undefined;

  const name =
    routeParams.name ||
    search.get('name') ||
    (customFromPath?.[2] ? safeDecodeURIComponent(customFromPath[2]) : undefined) ||
    undefined;

  return { template, namespace, name };
};
