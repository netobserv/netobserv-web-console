/**
 * TLS lock icons for DOM (drawer, etc.): PatternFly `LockIcon` / `LockOpenIcon` with severity-based color.
 * Topology edge tags import `LockIconConfig` / `LockOpenIconConfig` directly for embedded SVG `<path>` data.
 */
import { LockIcon, LockOpenIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { classifyTlsVersionString, type TlsLockSeverity } from '../../utils/tls-lock-severity';

/** Fill colors aligned with `topology-content.css` lock modifiers. */
const tlsLockFillForSeverity = (severity: TlsLockSeverity): string => {
  switch (severity) {
    case 'deprecated':
      return 'var(--pf-t--global--danger-color--100, #c9190b)';
    case 'legacy':
      return 'var(--pf-t--global--warning-color--100, #f0ab00)';
    case 'modern':
      return 'var(--pf-t--global--success-color--100, #3e8635)';
    case 'pqc':
      return 'var(--pf-t--global--color--blue-50, #2b9af3)';
    default:
      return 'var(--pf-t--global--icon--color--subtle, #6a6e73)';
  }
};

const tlsLockFillForVersionLabel = (label: string): string => {
  const c = classifyTlsVersionString(label);
  return tlsLockFillForSeverity(c ?? 'unknown');
};

export type TlsSeverityLockIconProps = {
  severity: TlsLockSeverity;
  size?: number;
  className?: string;
};

/** PatternFly `LockIcon` tinted by a TLS severity tier. */
export const TlsSeverityLockIcon: React.FC<TlsSeverityLockIconProps> = ({ severity, size = 14, className }) => {
  const color = tlsLockFillForSeverity(severity);
  return (
    <span className={className} style={{ color, display: 'inline-flex', lineHeight: 1, flexShrink: 0 }} aria-hidden>
      <LockIcon size={size} />
    </span>
  );
};

export type TlsVersionLockIconProps = {
  versionLabel: string;
  /** Pixel size passed to PatternFly SVG icons (`size` prop). */
  size?: number;
  className?: string;
};

/** PatternFly `LockIcon` tinted by TLS version severity (side panel, toolbars, etc.). */
export const TlsVersionLockIcon: React.FC<TlsVersionLockIconProps> = ({ versionLabel, size = 14, className }) => {
  const color = tlsLockFillForVersionLabel(versionLabel);
  return (
    <span className={className} style={{ color, display: 'inline-flex', lineHeight: 1, flexShrink: 0 }} aria-hidden>
      <LockIcon size={size} />
    </span>
  );
};

export type TlsCleartextLockIconProps = {
  size?: number;
  className?: string;
};

/** PatternFly `LockOpenIcon` for cleartext / no-TLS hints (same semantics as topology open lock). */
export const TlsCleartextLockIcon: React.FC<TlsCleartextLockIconProps> = ({ size = 14, className }) => (
  <span
    className={className}
    style={{
      color: 'var(--pf-t--global--icon--color--subtle, #6a6e73)',
      display: 'inline-flex',
      lineHeight: 1,
      flexShrink: 0
    }}
    aria-hidden
  >
    <LockOpenIcon size={size} />
  </span>
);
