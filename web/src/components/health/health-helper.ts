import { PrometheusAlert, PrometheusLabels, Rule } from '@openshift-console/dynamic-plugin-sdk';
import { TFunction } from 'i18next';
import * as _ from 'lodash';
import { SilenceMatcher } from '../../api/alert';
import { RecordingAnnotations } from '../../model/config';
import { ContextSingleton } from '../../utils/context';

export type Severity = 'critical' | 'warning' | 'info';
export type AlertState = 'firing' | 'pending' | 'silenced' | 'recording' | 'inactive';
export type HealthSuperKind = 'Global' | 'Node' | 'Namespace' | 'Owner';
export type HealthMode = 'alert' | 'recording';

export const getItemMode = (item: HealthItem): HealthMode => (item.state === 'recording' ? 'recording' : 'alert');

// HealthItem can be either based on an Alert or based on a RecordingRule metric
export type HealthItem = {
  ruleName: string;
  ruleID?: string;
  metadata: HealthMetadata;
  value: number;
  severity: Severity;
  state: AlertState;
  threshold: string;
  thresholdF: number;
  upperBound: string;
  labels: PrometheusLabels;
  summary: string;
  description: string;
  activeAt?: string;
  runbookUrl?: string;
};

export type RecordingRuleMetric = {
  name: string;
  values: { labels: PrometheusLabels; value: number }[];
};

export type HealthStats = {
  global: HealthStat;
  byNamespace: HealthStat[];
  byNode: HealthStat[];
  byOwner: HealthStat[];
};

export type HealthStat = {
  name: string;
  k8sKind?: string;
  namespace?: string;
  critical: PerState;
  warning: PerState;
  other: PerState;
  score: number;
};

type PerState = {
  firing: HealthItem[];
  pending: HealthItem[];
  silenced: HealthItem[];
  recording: HealthItem[];
  inactive: string[];
};

type HealthMetadata = {
  alertThreshold?: string;
  alertThresholdF: number;
  recordingThresholds?: RecordingThresholds;
  upperBound: string;
  upperBoundF: number;
  unit: string;
  nodeLabels?: string[];
  namespaceLabels?: string[];
  workloadLabels?: string[];
  kindLabels?: string[];
  links: { name: string; url: string }[];
  trafficLink?: TrafficLink;
};

type RecordingThresholds = {
  info?: string;
  warning?: string;
  critical?: string;
  infoF: number;
  warningF: number;
  criticalF: number;
};

type TrafficLink = {
  extraFilter: string;
  backAndForth: boolean;
  filterDestination: boolean;
};

export type ScoreDetail = {
  name: string;
  severity: Severity;
  state: AlertState | 'inactive';
  rawScore: number;
  weight: number;
  resource?: string; // The affected resource (namespace, node, or workload)
};

export type ScoreBreakdown = {
  score: number;
  details: ScoreDetail[];
};

/* Replaces {{ $value }} and {{ $labels.<key> }} in recording rule templates.
 * Recording rules don't have native annotations in Prometheus - these come from operator metadata
 * (netobserv.io/network-health) and need manual template substitution.
 * Note: Alert annotations are evaluated by Prometheus, so we don't substitute them here.
 */
const substituteTemplate = (template: string, labels: PrometheusLabels, value: number | string): string => {
  let out = template.replace(/\{\{\s*\$value\s*\}\}/g, String(value));
  for (const [k, v] of Object.entries(labels)) {
    out = out.replaceAll(`{{ $labels.${k} }}`, v);
  }
  return out;
};

const alertToHealth = (a: PrometheusAlert, r: Rule, md: HealthMetadata): HealthItem => {
  // Prometheus evaluates alert annotations automatically, so we use them directly
  return {
    ruleID: r.id,
    ruleName: r.name,
    metadata: md,
    threshold: md.alertThreshold || '',
    thresholdF: md.alertThresholdF,
    upperBound: md.upperBound,
    labels: a.labels,
    severity: (a.labels.severity as Severity) || 'info',
    state: (a.state as AlertState) || 'inactive',
    summary: a.annotations.summary || a.labels.template || '',
    description: a.annotations.description || a.annotations.message || '',
    runbookUrl: a.annotations.runbook_url,
    value: (a.value as number) || 0,
    activeAt: a.activeAt
  };
};

const recordingToHealth = (metric: RecordingRuleMetric, annotations: { [key: string]: string }): HealthItem[] => {
  // Parse metadata
  const md = getHealthMetadata(annotations);
  return metric.values.flatMap(valueData => {
    // Process each value (each value represents a different resource/label combination)
    const value = !isNaN(valueData.value) && isFinite(valueData.value) ? valueData.value : 0;

    // Determine severity based on thresholds
    let severity: Severity = 'info';
    let state: AlertState = 'inactive';
    let threshold: string | undefined = undefined;
    let thresholdF = 0;
    if (md.recordingThresholds) {
      if (md.recordingThresholds.criticalF && value >= md.recordingThresholds.criticalF) {
        severity = 'critical';
        state = 'recording';
        threshold = md.recordingThresholds.critical!;
        thresholdF = md.recordingThresholds.criticalF;
      } else if (md.recordingThresholds.warning && value >= md.recordingThresholds.warningF) {
        severity = 'warning';
        state = 'recording';
        threshold = md.recordingThresholds.warning!;
        thresholdF = md.recordingThresholds.warningF;
      } else if (md.recordingThresholds.info && value >= md.recordingThresholds.infoF) {
        severity = 'info';
        state = 'recording';
        threshold = md.recordingThresholds.info;
        thresholdF = md.recordingThresholds.infoF;
      }
      if (!threshold) {
        // Fallback: use the lowest threshold available (info -> warning -> critical)
        threshold = md.recordingThresholds.info || md.recordingThresholds.warning || md.recordingThresholds.critical;
        thresholdF =
          md.recordingThresholds.infoF || md.recordingThresholds.warningF || md.recordingThresholds.criticalF;
      }
    }

    // Inject $value and $labels.* in description and summary
    const rawSummary = annotations.summary || valueData.labels.template || '';
    // Use 'message' as fallback if 'description' is not present (common in some Prometheus rule conventions)
    const rawDescription = annotations.description || annotations.message || '';
    const summary = substituteTemplate(rawSummary, valueData.labels, value);
    const description = substituteTemplate(rawDescription, valueData.labels, value);

    return {
      ruleName: metric.name,
      metadata: md,
      threshold: threshold || '',
      thresholdF: thresholdF,
      upperBound: md.upperBound,
      labels: valueData.labels,
      severity: severity,
      state: state,
      summary,
      description,
      runbookUrl: annotations.runbook_url,
      value: value
    };
  });
};

const getHealthMetadata = (annotations: PrometheusLabels): HealthMetadata => {
  const defaultMetadata: HealthMetadata = {
    alertThresholdF: 0,
    upperBound: '100',
    upperBoundF: 100,
    unit: '%',
    trafficLink: {
      extraFilter: '',
      backAndForth: true,
      filterDestination: false
    },
    links: []
  };
  const parseFloat0 = (s?: string) => (s ? parseFloat(s) || 0 : 0);
  if (annotations && 'netobserv_io_network_health' in annotations) {
    const md = (JSON.parse(annotations['netobserv_io_network_health']) as HealthMetadata) || undefined;
    if (md) {
      // Setup defaults and derived
      md.unit = md.unit || defaultMetadata.unit;
      md.upperBound = md.upperBound || defaultMetadata.upperBound;
      md.trafficLink = md.trafficLink || defaultMetadata.trafficLink;
      md.links = md.links || defaultMetadata.links;
      md.alertThresholdF = parseFloat0(md.alertThreshold);
      md.upperBoundF = parseFloat(md.upperBound) || defaultMetadata.upperBoundF;
      if (md.recordingThresholds) {
        md.recordingThresholds.criticalF = parseFloat0(md.recordingThresholds.critical);
        md.recordingThresholds.warningF = parseFloat0(md.recordingThresholds.warning);
        md.recordingThresholds.infoF = parseFloat0(md.recordingThresholds.info);
      }
      return md;
    }
  }
  return defaultMetadata;
};

export const rulesToHealthItems = (
  alertRules: Rule[],
  recordingAnnotations: RecordingAnnotations,
  recordingRulesMetrics: RecordingRuleMetric[] = []
): HealthItem[] => {
  const alertItems = alertRules.flatMap(ar => {
    const md = getHealthMetadata(ar.annotations);
    if (ar.alerts.length === 0) {
      // set as inactive
      return [
        alertToHealth(
          {
            annotations: ar.annotations,
            labels: { severity: 'inactive' }
          } as PrometheusAlert,
          ar,
          md
        )
      ];
    }
    return ar.alerts.map(a => {
      if (typeof a.value === 'string') {
        a.value = parseFloat(a.value);
      }
      return alertToHealth(a, ar, md);
    });
  });
  const recordingItems = recordingRulesMetrics.flatMap(rm => {
    const annotations = recordingAnnotations[rm.name];
    if (annotations) {
      return recordingToHealth(rm, annotations);
    }
    return [];
  });
  return [...alertItems, ...recordingItems];
};

export const buildStats = (items: HealthItem[], predicate?: (item: NamedItem) => boolean): HealthStats => {
  // Filter-out undefined
  const namedItems = items
    .map(toNamedItem)
    .filter((i?: NamedItem): i is NamedItem => !!i)
    .filter(i => !predicate || predicate(i));
  // First group by superKind
  const bySuperKind = _.groupBy(namedItems, i => i.superKind);
  // For each superKind except Global, group by name
  const stats: HealthStats = {
    global: statsFromGrouped(bySuperKind['Global'] || []) || emptyStat(''),
    byNode: groupAndSortByResource(bySuperKind['Node']),
    byNamespace: groupAndSortByResource(bySuperKind['Namespace']),
    byOwner: groupAndSortByResource(bySuperKind['Owner'])
  };
  stats.global.score = computeResourceScore(stats.global).score;
  return stats;
};

const groupAndSortByResource = (items: NamedItem[]): HealthStat[] => {
  const byResource = _.groupBy(items, i => `${i.name}/${i.namespace}/${i.k8sKind}`);
  const stats: HealthStat[] = [];
  Object.values(byResource).forEach(items => {
    const stat = statsFromGrouped(items);
    if (stat) {
      // Ignore if all are inactive
      const countInactive = stat.critical.inactive.length + stat.warning.inactive.length + stat.other.inactive.length;
      if (countInactive !== items.length) {
        stat.score = computeResourceScore(stat).score;
        stats.push(stat);
      }
    }
  });
  return _.sortBy(stats, s => s.score, 'asc');
};

export const emptyStat = (name: string, namespace?: string, k8sKind?: string): HealthStat => {
  return {
    name,
    namespace,
    k8sKind,
    critical: { firing: [], pending: [], silenced: [], inactive: [], recording: [] },
    warning: { firing: [], pending: [], silenced: [], inactive: [], recording: [] },
    other: { firing: [], pending: [], silenced: [], inactive: [], recording: [] },
    score: 0
  };
};

export type NamedItem = HealthItem & { name: string; superKind: HealthSuperKind; k8sKind: string; namespace?: string };
export const toNamedItem = (item: HealthItem): NamedItem | undefined => {
  if (item.metadata.workloadLabels && item.metadata.namespaceLabels && item.metadata.kindLabels) {
    const name = getLabelValue(item, item.metadata.workloadLabels);
    const namespace = getLabelValue(item, item.metadata.namespaceLabels);
    const k8sKind = getLabelValue(item, item.metadata.kindLabels);
    if (name && k8sKind && namespace) {
      return { superKind: 'Owner', name, namespace, k8sKind, ...item };
    }
    return undefined;
  }
  if (item.metadata.namespaceLabels) {
    const name = getLabelValue(item, item.metadata.namespaceLabels);
    if (name) {
      return { superKind: 'Namespace', k8sKind: 'Namespace', name, ...item };
    }
    return undefined;
  }
  if (item.metadata.nodeLabels) {
    const name = getLabelValue(item, item.metadata.nodeLabels);
    if (name) {
      return { superKind: 'Node', k8sKind: 'Node', name, ...item };
    }
    return undefined;
  }
  return { superKind: 'Global', k8sKind: '', name: '', ...item };
};

const getLabelValue = (item: HealthItem, keys: string[]): string | undefined => {
  const kv = Object.entries(item.labels).find(l => keys.includes(l[0]));
  return kv ? kv[1] : undefined;
};

// Distinct namespace values present in the (unfiltered) dataset, used to populate the namespace filter options.
export const collectAvailableNamespaces = (items: HealthItem[]): string[] => {
  const named = items
    .map(toNamedItem)
    .filter((i): i is NamedItem => !!i)
    .filter(i => i.state !== 'inactive');
  const namespaces = named
    .map(i => (i.superKind === 'Namespace' ? i.name : i.superKind === 'Owner' ? i.namespace : undefined))
    .filter((n): n is string => !!n);
  return _.uniq(namespaces).sort();
};

const statsFromGrouped = (grouped: NamedItem[]): HealthStat | undefined => {
  if (grouped.length === 0) {
    return undefined;
  }
  // All provided items are expected to have same name/kind/namespace, so pick [0]
  const br = emptyStat(grouped[0].name, grouped[0].namespace, grouped[0].k8sKind);
  _.uniqWith(grouped, (a, b) => {
    return a.ruleName === b.ruleName && _.isEqual(a.labels, b.labels);
  }).forEach(item => {
    let stats: PerState;
    switch (item.severity) {
      case 'critical':
        stats = br.critical;
        break;
      case 'warning':
        stats = br.warning;
        break;
      default:
        stats = br.other;
        break;
    }
    switch (item.state) {
      case 'firing':
        stats.firing.push(item);
        break;
      case 'pending':
        stats.pending.push(item);
        break;
      case 'silenced':
        stats.silenced.push(item);
        break;
      case 'recording':
        stats.recording.push(item);
        break;
      case 'inactive':
        stats.inactive.push(item.ruleName);
        break;
    }
  });
  return br;
};

export const getAllHealthItems = (g: HealthStat): HealthItem[] => {
  return [
    ...g.critical.firing,
    ...g.warning.firing,
    ...g.other.firing,
    ...g.critical.pending,
    ...g.warning.pending,
    ...g.other.pending,
    ...g.critical.silenced,
    ...g.warning.silenced,
    ...g.other.silenced,
    ...g.critical.recording,
    ...g.warning.recording,
    ...g.other.recording
  ];
};

export const getItemFilteredLabels = (item: HealthItem, target: string): [string, string][] => {
  return Object.entries(item.labels).filter(
    e =>
      e[0] !== 'app' &&
      e[0] !== 'netobserv' &&
      e[0] !== 'severity' &&
      e[0] !== '__name__' &&
      e[0] !== 'prometheus' &&
      e[0] !== 'template' &&
      e[0] !== 'alertname' &&
      e[1] !== target
  );
};

export const getLinks = (
  t: TFunction,
  kind: HealthSuperKind,
  item: HealthItem,
  name: string,
  namespace?: string,
  k8sKind?: string
) => {
  const customLinks = item.metadata.links.map(l => ({
    name: l.name,
    url: substituteLabelsInUrl(l.url, item.labels)
  }));
  return [
    ...(item.runbookUrl ? [{ name: t('View runbook'), url: item.runbookUrl }] : []),
    ...(ContextSingleton.isStandalone()
      ? []
      : [
          item.state === 'recording'
            ? { name: t('Inspect metric'), url: getRecordingRuleMetricLink(item, name) }
            : { name: t('Inspect alert'), url: getAlertLink(item) }
        ]),
    { name: t('Inspect network traffic'), url: getTrafficLink(kind, item, name, namespace, k8sKind) },
    ...customLinks
  ];
};

/* Replaces {{ $labels.<key> }} in a string with values from labels (used for alert/recording rule link URLs). */
const substituteLabelsInUrl = (url: string, labels: PrometheusLabels): string => {
  let out = url;
  for (const [k, v] of Object.entries(labels)) {
    out = out.replaceAll(`{{ $labels.${k} }}`, v);
  }
  return out;
};

const getAlertLink = (item: HealthItem): string | undefined => {
  if (item.ruleID) {
    const labels: string[] = [];
    Object.keys(item.labels).forEach(k => {
      labels.push(k + '=' + item.labels[k]);
    });
    return `/monitoring/alerts/${item.ruleID}?${labels.join('&')}`;
  }
  return undefined;
};

const getRecordingRuleMetricLink = (item: HealthItem, resourceName?: string): string => {
  let query = item.ruleName;

  // Filter by namespace or node if available
  if (resourceName) {
    if (item.metadata.namespaceLabels && item.metadata.namespaceLabels.length > 0) {
      query += `{${item.metadata.namespaceLabels[0]}="${resourceName}"}`;
    } else if (item.metadata.nodeLabels && item.metadata.nodeLabels.length > 0) {
      query += `{${item.metadata.nodeLabels[0]}="${resourceName}"}`;
    }
    // TODO: Health: workloads
  }

  return `/monitoring/query-browser?query0=${encodeURIComponent(query)}`;
};

const getTrafficLink = (
  kind: HealthSuperKind,
  item: HealthItem,
  name: string,
  namespace?: string,
  k8sKind?: string
): string => {
  const filters: string[] = [];
  let params = '';
  const side = item.metadata.trafficLink?.filterDestination ? 'dst' : 'src';
  const bnf = item.metadata.trafficLink?.backAndForth !== false;
  switch (kind) {
    case 'Namespace':
      filters.push(`${side}_namespace="${name}"`);
      params += `&bnf=${bnf}`;
      break;
    case 'Node':
      filters.push(`${side}_owner_name="${name}"`);
      filters.push(`${side}_kind="Node"`);
      params += `&bnf=${bnf}`;
      break;
    case 'Owner':
      // Filter by owner name
      filters.push(`${side}_owner_name="${name}"`);
      filters.push(`${side}_namespace="${namespace}"`);
      filters.push(`${side}_kind="${k8sKind}"`);
      params += `&bnf=${bnf}`;
      break;
  }
  if (item.metadata.trafficLink?.extraFilter) {
    filters.push(item.metadata.trafficLink.extraFilter);
  }
  const root = ContextSingleton.isStandalone() ? '/console-netflow-traffic' : '/netflow-traffic';
  return `${root}?filters=${encodeURIComponent(filters.join(';'))}${params}`;
};

const criticalWeight = 1;
const warningWeight = 0.5;
const minorWeight = 0.25;
const pendingWeight = 0.3;
const silencedWeight = 0.1;

const getSeverityScoreRange = (severity: string): { min: number; max: number } => {
  switch (severity) {
    case 'critical':
      return { min: 0, max: 6 };
    case 'warning':
      return { min: 4, max: 8 };
    default:
      // 'info'
      return { min: 6, max: 10 };
  }
};

const getSeverityWeight = (severity: Severity): number => {
  switch (severity) {
    case 'critical':
      return criticalWeight;
    case 'warning':
      return warningWeight;
    default:
      return minorWeight;
  }
};

const getStateWeight = (state: AlertState) => {
  switch (state) {
    case 'pending':
      return pendingWeight;
    case 'silenced':
      return silencedWeight;
    case 'inactive':
      return 0;
  }
  return 1;
};

// Generic weighted score calculator - eliminates code duplication
// Score [0,10]; higher is better
const computeWeightedScore = (scores: ScoreDetail[]): number => {
  if (scores.length === 0) {
    return 10; // Perfect score if no violations
  }

  // Filter out any scores with NaN rawScore to prevent contamination
  const validScores = scores.filter(s => !isNaN(s.rawScore) && isFinite(s.rawScore));

  if (validScores.length === 0) {
    return 10;
  }

  const sum = validScores.map(s => s.rawScore * s.weight).reduce((a, b) => a + b, 0);
  const sumWeights = validScores.map(s => s.weight).reduce((a, b) => a + b, 0);
  if (sumWeights === 0) {
    return 10;
  }
  return sum / sumWeights;
};

// Score [0,10]; higher is better
export const computeResourceScore = (r: HealthStat): ScoreBreakdown => {
  const allAlerts = getAllHealthItems(r);
  const details: ScoreDetail[] = allAlerts
    .map(computeHealthItemScore)
    .concat(
      r.critical.inactive.map(name => ({
        name,
        severity: 'critical' as Severity,
        state: 'inactive' as const,
        rawScore: 10,
        weight: criticalWeight
      }))
    )
    .concat(
      r.warning.inactive.map(name => ({
        name,
        severity: 'warning' as Severity,
        state: 'inactive' as const,
        rawScore: 10,
        weight: warningWeight
      }))
    )
    .concat(
      r.other.inactive.map(name => ({
        name,
        severity: 'info' as Severity,
        state: 'inactive' as const,
        rawScore: 10,
        weight: minorWeight
      }))
    );
  return { score: computeWeightedScore(details), details };
};

// Round a list of values to 1 decimal so that the rounded values still add up EXACTLY to the rounded
// total (largest-remainder / Hamilton apportionment). Naive per-value rounding can drift, so a manual
// sum of the displayed per-rule impacts would not reconcile with the displayed total. Working in tenths
// (integers) keeps the arithmetic exact.
export const apportionToOneDecimal = (values: number[]): number[] => {
  const tenths = values.map(v => v * 10);
  const target = Math.round(tenths.reduce((sum, v) => sum + v, 0));
  const floored = tenths.map(v => Math.floor(v));
  let remainder = target - floored.reduce((sum, v) => sum + v, 0);
  // Hand out the leftover tenths to the values with the largest fractional parts first.
  const order = tenths.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac);
  const result = floored.slice();
  for (let k = 0; k < order.length && remainder > 0; k++) {
    result[order[k].i] += 1;
    remainder--;
  }
  return result.map(v => v / 10);
};

// Score [0,1]; lower is better
export const computeExcessRatio = (item: HealthItem): number => {
  // Assuming the alert value is a [0-n] percentage. Needs update if more use cases come up.
  const threshold = item.thresholdF;
  const upper = item.metadata.upperBoundF;
  const vclamped = Math.min(Math.max(item.value, threshold), upper);
  const range = upper - threshold;
  return (vclamped - threshold) / range;
};

export const computeExcessRatioStatusWeighted = (item: HealthItem): number => {
  return computeExcessRatio(item) * getStateWeight(item.state);
};

// Score [0,10]; higher is better
export const computeHealthItemScore = (item: HealthItem): ScoreDetail => {
  const excessRatio = computeExcessRatio(item);
  const range = getSeverityScoreRange(item.severity);

  const scoreRange = range.max - range.min;
  const rawScore = range.min + scoreRange * (1 - excessRatio);

  // Extract resource name from labels (namespace, node, or workload)
  let resource: string | undefined;
  if (item.metadata.workloadLabels && item.metadata.namespaceLabels && item.metadata.kindLabels) {
    const workloadName = getLabelValue(item, item.metadata.workloadLabels);
    const namespace = getLabelValue(item, item.metadata.namespaceLabels);
    const kind = getLabelValue(item, item.metadata.kindLabels);
    if (workloadName && namespace && kind) {
      resource = `${kind}/${namespace}/${workloadName}`;
    }
  } else if (item.metadata.namespaceLabels) {
    resource = getLabelValue(item, item.metadata.namespaceLabels);
  } else if (item.metadata.nodeLabels) {
    resource = getLabelValue(item, item.metadata.nodeLabels);
  }

  return {
    name: item.ruleName,
    severity: item.severity,
    state: item.state,
    rawScore: rawScore,
    weight: getSeverityWeight(item.severity) * getStateWeight(item.state),
    resource
  };
};

// Mapping of severity levels to PatternFly Label colors
// critical -> red (danger)
// warning -> orange (warning)
// info -> blue (info)
const severityLabelsColors = {
  critical: 'red',
  warning: 'orange',
  info: 'blue'
} as const;

export const getSeverityColor = (severity: string | undefined): 'red' | 'orange' | 'blue' => {
  if (severity && severity in severityLabelsColors) {
    return severityLabelsColors[severity as keyof typeof severityLabelsColors];
  }
  return 'blue'; // default for info/undefined
};

export const isSilenced = (silence: SilenceMatcher[], labels: PrometheusLabels): boolean => {
  for (const matcher of silence) {
    if (!(matcher.name in labels)) {
      return false;
    }
    if (matcher.value !== labels[matcher.name]) {
      return false;
    }
  }
  return true;
};

export const getResourceSeverity = (s: HealthStat): Severity | undefined => {
  if (s.critical.firing.length > 0 || s.critical.pending.length > 0 || s.critical.recording.length > 0) {
    return 'critical';
  }
  if (s.warning.firing.length > 0 || s.warning.pending.length > 0 || s.warning.recording.length > 0) {
    return 'warning';
  }
  if (s.other.firing.length > 0 || s.other.pending.length > 0 || s.other.recording.length > 0) {
    return 'info';
  }
  return undefined;
};
