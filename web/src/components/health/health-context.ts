import { PrometheusLabels, Rule } from '@openshift-console/dynamic-plugin-sdk';
import { isOvnPlatformAlertName } from './ovn-platform-alerts';

/**
 * Routes alerts to Network Health context tabs.
 *
 * Contract (CNO / third-party PrometheusRules):
 * - netobserv="true" — alert is visible in Network Health
 * - netobserv_io_health_context="<tab>" — target context tab (e.g. ovn, kiali)
 * - netobserv_io_network_health JSON may also set "contextTab" for annotation-based routing
 */
export const NETOBSERV_HEALTH_CONTEXT_LABEL = 'netobserv_io_health_context';
export const NETOBSERV_CONTEXT_NETOBSERV = 'netobserv';
export const NETOBSERV_CONTEXT_OVN = 'ovn';

export type HealthContextKind = 'netobserv' | 'readonly-alerts';

export type HealthContextDefinition = {
  id: string;
  kind: HealthContextKind;
  scored: boolean;
  /** Built-in contexts use i18n keys; third-party contexts use a formatted id. */
  titleKey?: string;
};

const BUILTIN_CONTEXTS: Record<string, HealthContextDefinition> = {
  [NETOBSERV_CONTEXT_NETOBSERV]: {
    id: NETOBSERV_CONTEXT_NETOBSERV,
    kind: 'netobserv',
    scored: true,
    titleKey: 'NetObserv'
  },
  [NETOBSERV_CONTEXT_OVN]: {
    id: NETOBSERV_CONTEXT_OVN,
    kind: 'readonly-alerts',
    scored: false,
    titleKey: 'OVN'
  }
};

export const formatContextTabTitle = (contextId: string): string => {
  if (contextId.length === 0) {
    return contextId;
  }
  return contextId.charAt(0).toUpperCase() + contextId.slice(1);
};

export const getHealthContextTabFromAnnotations = (annotations?: PrometheusLabels): string | undefined => {
  if (!annotations || !('netobserv_io_network_health' in annotations)) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(annotations['netobserv_io_network_health'] as string) as { contextTab?: string };
    return sanitizeHealthContextId(parsed?.contextTab);
  } catch {
    return undefined;
  }
};

const UNSAFE_CONTEXT_IDS = new Set(['__proto__', 'constructor', 'prototype']);

/** Valid third-party / labeled context tab identifiers (alphanumeric, dash, underscore). */
export const isValidHealthContextId = (id: unknown): id is string =>
  typeof id === 'string' && id.length > 0 && /^[A-Za-z][A-Za-z0-9_-]*$/.test(id) && !UNSAFE_CONTEXT_IDS.has(id);

const sanitizeHealthContextId = (id: string | undefined): string | undefined =>
  id && isValidHealthContextId(id) ? id : undefined;

/** Resolve which context tab owns a Prometheus alert rule. */
export const getRuleHealthContextId = (rule: Pick<Rule, 'name' | 'labels' | 'annotations'>): string => {
  const fromLabel = sanitizeHealthContextId(rule.labels?.[NETOBSERV_HEALTH_CONTEXT_LABEL] as string | undefined);
  if (fromLabel) {
    return fromLabel;
  }
  const fromAnnotation = getHealthContextTabFromAnnotations(rule.annotations);
  if (fromAnnotation) {
    return fromAnnotation;
  }
  if (isOvnPlatformAlertName(rule.name)) {
    return NETOBSERV_CONTEXT_OVN;
  }
  return NETOBSERV_CONTEXT_NETOBSERV;
};

export const getHealthContextDefinition = (contextId: string): HealthContextDefinition => {
  const builtin = BUILTIN_CONTEXTS[contextId];
  if (builtin) {
    return builtin;
  }
  return {
    id: contextId,
    kind: 'readonly-alerts',
    scored: false
  };
};

export const isNetobservScoredContext = (contextId: string): boolean => getHealthContextDefinition(contextId).scored;

export const isReadonlyAlertsContext = (contextId: string): boolean =>
  getHealthContextDefinition(contextId).kind === 'readonly-alerts';

/** Rules that must not contribute to the NetObserv health score or NetObserv tab. */
export const isExcludedFromNetobservHealth = (rule: Pick<Rule, 'name' | 'labels' | 'annotations'>): boolean =>
  getRuleHealthContextId(rule) !== NETOBSERV_CONTEXT_NETOBSERV;

export const hasOvnHealthContextLabel = (rule: Pick<Rule, 'labels'>): boolean =>
  rule.labels?.[NETOBSERV_HEALTH_CONTEXT_LABEL] === NETOBSERV_CONTEXT_OVN;

export const sortContextTabIds = (contextIds: string[]): string[] => {
  const unique = [...new Set(contextIds)];
  const netobserv = unique.filter(id => id === NETOBSERV_CONTEXT_NETOBSERV);
  const ovn = unique.filter(id => id === NETOBSERV_CONTEXT_OVN);
  const others = unique.filter(id => id !== NETOBSERV_CONTEXT_NETOBSERV && id !== NETOBSERV_CONTEXT_OVN).sort();
  return [...netobserv, ...ovn, ...others];
};
