import { LockIconConfig, LockOpenIconConfig } from '@patternfly/react-icons';
import { css } from '@patternfly/react-styles';
import type { Point } from '@patternfly/react-topology';
import { NodeStatus, StatusModifier } from '@patternfly/react-topology';
import { useSize } from '@patternfly/react-topology/dist/esm/utils/useSize';
import styles from '@patternfly/react-topology/src/css/topology-components';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { TlsLockSeverity } from '../../../../../utils/tls-lock-severity';

const LOCK_PATH = LockIconConfig.svgPath;
const LOCK_ICON_W = LockIconConfig.width;
const LOCK_ICON_H = LockIconConfig.height;
const LOCK_SCALE = 0.022;
/** Match open-lock width to closed lock (PatternFly `LockOpenIcon` viewBox). */
const OPEN_LOCK_SCALE = (LOCK_ICON_W * LOCK_SCALE) / LockOpenIconConfig.width;
const LOCK_GAP = 5;

export type TopologyConnectorTagProps = {
  className?: string;
  startPoint: Point;
  endPoint: Point;
  tag: string;
  status?: NodeStatus;
  paddingX?: number;
  paddingY?: number;
  /** Closed lock: TLS observed on aggregated flows. */
  showLeadingLock?: boolean;
  /** Open lock: cleartext hint (opt-in topology option). */
  showCleartextLock?: boolean;
  /** TLS protocol class for closed-lock color (deprecated / legacy / modern / unknown). */
  lockSeverity?: TlsLockSeverity;
};

const TopologyConnectorTag: React.FunctionComponent<TopologyConnectorTagProps> = ({
  className,
  startPoint,
  endPoint,
  tag,
  status,
  paddingX = 4,
  paddingY = 2,
  showLeadingLock,
  showCleartextLock,
  lockSeverity
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');

  const [textSize, textRef] = useSize([tag, className]);

  const showClosedLock = Boolean(showLeadingLock);
  const showOpenLock = Boolean(showCleartextLock) && !showClosedLock;
  const showAnyLock = showClosedLock || showOpenLock;

  const lockTitle = React.useMemo(() => {
    if (showOpenLock) {
      return t('No TLS signals in aggregated flow logs for this link (cleartext or not classified as TLS).');
    }
    switch (lockSeverity) {
      case 'deprecated':
        return t('Observed TLS uses deprecated protocol versions (e.g. TLS 1.0 / 1.1 or SSL).');
      case 'legacy':
        return t('Observed TLS includes TLS 1.2 (older but still common). Prefer TLS 1.3 where possible.');
      case 'modern':
        return t('Observed TLS includes TLS 1.3 (current recommended).');
      case 'pqc':
        return t('Observed TLS 1.3 with a post-quantum key exchange group (PQC).');
      case 'unknown':
        return t('Observed TLS on this link; protocol version could not be classified from labels.');
      default:
        return t('Observed TLS on this link.');
    }
  }, [lockSeverity, showOpenLock, t]);

  const scaledLockW = LOCK_ICON_W * LOCK_SCALE;
  const scaledLockH = LOCK_ICON_H * LOCK_SCALE;
  const scaledOpenW = LockOpenIconConfig.width * OPEN_LOCK_SCALE;
  const scaledOpenH = LockOpenIconConfig.height * OPEN_LOCK_SCALE;
  const lockSlotW = showClosedLock ? scaledLockW : showOpenLock ? scaledOpenW : 0;
  const lockSlotH = showClosedLock ? scaledLockH : showOpenLock ? scaledOpenH : 0;
  const lockSlot = showAnyLock ? lockSlotW + LOCK_GAP : 0;

  const layout = React.useMemo(() => {
    if (!tag && showAnyLock) {
      const width = lockSlotW + paddingX * 2;
      const height = lockSlotH + paddingY * 2;
      return {
        width,
        height,
        startX: -width / 2,
        startY: -height / 2,
        textOffsetX: 0,
        lockTranslateX: -width / 2 + paddingX,
        lockTranslateY: -lockSlotH / 2,
        lockScale: showClosedLock ? LOCK_SCALE : OPEN_LOCK_SCALE,
        lockPath: showClosedLock ? LOCK_PATH : LockOpenIconConfig.svgPath
      };
    }
    if (!textSize) {
      return null;
    }
    const textH = textSize.height;
    const innerH = Math.max(textH, showAnyLock ? lockSlotH : 0);
    const width = textSize.width + paddingX * 2 + lockSlot;
    const height = innerH + paddingY * 2;
    const startX = -width / 2;
    const startY = -height / 2;
    return {
      width,
      height,
      startX,
      startY,
      textOffsetX: startX + paddingX + lockSlot,
      lockTranslateX: startX + paddingX,
      lockTranslateY: -lockSlotH / 2,
      lockScale: showClosedLock ? LOCK_SCALE : OPEN_LOCK_SCALE,
      lockPath: showClosedLock ? LOCK_PATH : LockOpenIconConfig.svgPath
    };
  }, [tag, showAnyLock, showClosedLock, textSize, paddingX, paddingY, lockSlot, lockSlotH, lockSlotW]);

  if (!tag && !showAnyLock) {
    return null;
  }

  const midX = startPoint.x + (endPoint.x - startPoint.x) * 0.5;
  const midY = startPoint.y + (endPoint.y - startPoint.y) * 0.5;

  const tagClassName = css(
    styles.topologyEdgeTag,
    className,
    status !== undefined ? StatusModifier[status] : undefined
  );

  const lockModifierClass = showOpenLock
    ? 'netobserv-topology-edge-lock--cleartext'
    : `netobserv-topology-edge-lock--${lockSeverity ?? 'unknown'}`;

  if (!layout) {
    return (
      <g className={tagClassName} transform={`translate(${midX}, ${midY})`} opacity={0} pointerEvents="none">
        {tag ? (
          <text ref={textRef as React.LegacyRef<SVGTextElement>} dy="0.35em" x={0} y={0}>
            {tag}
          </text>
        ) : null}
      </g>
    );
  }

  return (
    <g className={tagClassName} transform={`translate(${midX}, ${midY})`}>
      <rect
        className={css(styles.topologyEdgeTagBackground)}
        x={layout.startX}
        y={layout.startY}
        width={layout.width}
        height={layout.height}
        rx={3}
        ry={3}
      />
      {showAnyLock ? (
        <g
          className={`netobserv-topology-edge-lock ${lockModifierClass}`}
          transform={`translate(${layout.lockTranslateX}, ${layout.lockTranslateY}) scale(${layout.lockScale})`}
        >
          <title>{lockTitle}</title>
          <path d={layout.lockPath} />
        </g>
      ) : null}
      {tag ? (
        <text ref={textRef as React.LegacyRef<SVGTextElement>} dy="0.35em" x={layout.textOffsetX} y={0}>
          {tag}
        </text>
      ) : null}
    </g>
  );
};

export default TopologyConnectorTag;
