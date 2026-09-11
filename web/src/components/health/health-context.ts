import { PrometheusLabels, Rule } from '@openshift-console/dynamic-plugin-sdk';

/**
 * Routes alerts to Network Health context tabs.
 *
 * Contract (CNO / third-party PrometheusRules):
 * - netobserv="true" — label used only as a fast fetch filter (see health-fetcher.ts).
 * - netobserv_io_network_health JSON annotation — single source of routing/config:
 *     { "contextTab": "<tab>", "displayName": "<human title>" , ... }
 *   contextTab selects the target context tab (e.g. ovn, kiali); when absent the rule
 *   belongs to the scored NetObserv context.
 *
 * OVN platform alerts on current OpenShift clusters carry no such annotation; they are
 * discovered by a temporary hard-coded shim (see ovn-health-fetcher.ts) until CNO ships
 * the annotation on its alerts.
 */
export const NETOBSERV_CONTEXT_NETOBSERV = 'netobserv';
export const NETOBSERV_CONTEXT_OVN = 'ovn';

export type HealthContextKind = 'netobserv' | 'readonly-alerts';

export type HealthContextDefinition = {
  id: string;
  kind: HealthContextKind;
  scored: boolean;
  /** Built-in contexts use i18n keys; other contexts derive their title from a display name. */
  titleKey?: string;
};

const BUILTIN_CONTEXTS: Record<string, HealthContextDefinition> = {
  [NETOBSERV_CONTEXT_NETOBSERV]: {
    id: NETOBSERV_CONTEXT_NETOBSERV,
    kind: 'netobserv',
    scored: true,
    titleKey: 'NetObserv'
  }
};

export const formatContextTabTitle = (contextId: string): string => {
  if (contextId.length === 0) {
    return contextId;
  }
  return contextId.charAt(0).toUpperCase() + contextId.slice(1);
};

const UNSAFE_CONTEXT_IDS = new Set(['__proto__', 'constructor', 'prototype']);

/** Valid third-party / labeled context tab identifiers (alphanumeric, dash, underscore). */
export const isValidHealthContextId = (id: unknown): id is string =>
  typeof id === 'string' && id.length > 0 && /^[A-Za-z][A-Za-z0-9_-]*$/.test(id) && !UNSAFE_CONTEXT_IDS.has(id);

const sanitizeHealthContextId = (id: string | undefined): string | undefined =>
  id && isValidHealthContextId(id) ? id : undefined;

export type HealthContextAnnotationConfig = {
  contextTab?: string;
  displayName?: string;
};

/** Parse the netobserv_io_network_health annotation JSON into routing/config fields. */
export const parseHealthContextAnnotation = (annotations?: PrometheusLabels): HealthContextAnnotationConfig => {
  if (!annotations || !('netobserv_io_network_health' in annotations)) {
    return {};
  }
  try {
    const parsed = JSON.parse(annotations['netobserv_io_network_health'] as string) as {
      contextTab?: string;
      displayName?: string;
    };
    const displayName =
      typeof parsed?.displayName === 'string' && parsed.displayName.length > 0 ? parsed.displayName : undefined;
    return { contextTab: sanitizeHealthContextId(parsed?.contextTab), displayName };
  } catch {
    return {};
  }
};

/** @deprecated Prefer parseHealthContextAnnotation. Kept for existing callers/tests. */
export const getHealthContextTabFromAnnotations = (annotations?: PrometheusLabels): string | undefined =>
  parseHealthContextAnnotation(annotations).contextTab;

/** Resolve which context tab owns a Prometheus alert rule (annotation-driven, single source of truth). */
export const getRuleHealthContextId = (rule: Pick<Rule, 'annotations'>): string =>
  parseHealthContextAnnotation(rule.annotations).contextTab ?? NETOBSERV_CONTEXT_NETOBSERV;

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
export const isExcludedFromNetobservHealth = (rule: Pick<Rule, 'annotations'>): boolean =>
  getRuleHealthContextId(rule) !== NETOBSERV_CONTEXT_NETOBSERV;

export const sortContextTabIds = (contextIds: string[]): string[] => {
  const unique = [...new Set(contextIds)];
  const netobserv = unique.filter(id => id === NETOBSERV_CONTEXT_NETOBSERV);
  const others = unique.filter(id => id !== NETOBSERV_CONTEXT_NETOBSERV).sort();
  return [...netobserv, ...others];
};
