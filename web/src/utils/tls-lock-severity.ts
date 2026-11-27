/**
 * Worst TLS protocol class wins when multiple versions appear on one edge.
 * Used for topology edge lock coloring.
 */
export type TlsLockSeverity = 'deprecated' | 'legacy' | 'modern' | 'pqc' | 'unknown';

/** Post-quantum TLS groups (PQC compliance is based on TLSGroup + TLS 1.3). */
const pqcTlsGroups = new Set(['X25519MLKEM768', 'Secp256r1MLKEM768', 'Secp384r1MLKEM1024']);

/** Higher rank = worse / more alarming for edge lock coloring (deprecated wins over pqc). */
const SEVERITY_RANK: Record<TlsLockSeverity, number> = {
  deprecated: 5,
  legacy: 4,
  pqc: 3,
  modern: 2,
  unknown: 1
};

/** Known TLSVersion strings from flowlogs-pipeline (optionally prefixed with "~ "). */
const stripApproxPrefix = (raw: string): string => raw.replace(/^~\s*/, '').trim();

/** Classify a single TLSVersion label from Loki / flow JSON. */
export const classifyTlsVersionString = (raw: string): TlsLockSeverity | null => {
  const s = stripApproxPrefix(raw);
  if (!s) {
    return null;
  }
  switch (s) {
    case 'SSLv3':
    case 'TLS 1.0':
    case 'TLS 1.1':
      return 'deprecated';
    case 'TLS 1.2':
      return 'legacy';
    case 'TLS 1.3':
      return 'modern';
    default:
      return null;
  }
};

/** Lock color for a TLSGroup row in the drawer (PQC when TLS 1.3 is also observed on the link). */
export const tlsLockSeverityForGroupLabel = (group: string, versionLabels: string[]): TlsLockSeverity => {
  const hasModern = versionLabels.map(stripApproxPrefix).some(v => classifyTlsVersionString(v) === 'modern');
  if (hasModern && pqcTlsGroups.has(group)) {
    return 'pqc';
  }
  return 'unknown';
};

/** TLS 1.3 with a PQC TLSGroup → pqc; otherwise derive from version alone. */
export const classifyTlsLockSeverity = (versionLabel: string, tlsGroup?: string): TlsLockSeverity => {
  const versionClass = classifyTlsVersionString(versionLabel);
  if (versionClass === 'modern' && tlsGroup && pqcTlsGroups.has(tlsGroup)) {
    return 'pqc';
  }
  return versionClass ?? 'unknown';
};

/** Aggregate several version / group labels to a single severity (worst wins). */
export const aggregateTlsLockSeverity = (
  versionLabels: string[],
  groupLabels: string[] = []
): TlsLockSeverity | undefined => {
  const versions = versionLabels.map(stripApproxPrefix).filter(Boolean);
  const groups = groupLabels.filter(Boolean);
  let best: TlsLockSeverity | undefined;

  const hasModern = versions.some(v => classifyTlsVersionString(v) === 'modern');
  const hasPqcGroup = groups.some(g => pqcTlsGroups.has(g));
  if (hasModern && hasPqcGroup) {
    best = 'pqc';
  }

  for (const v of versions) {
    const c = classifyTlsVersionString(v) ?? 'unknown';
    if (!best || SEVERITY_RANK[c] > SEVERITY_RANK[best]) {
      best = c;
    }
  }
  return best;
};

export const mergeTlsLockSeverities = (
  a: TlsLockSeverity | undefined,
  b: TlsLockSeverity | undefined
): TlsLockSeverity | undefined => {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
};
