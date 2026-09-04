import { ResourceLink } from '@openshift-console/dynamic-plugin-sdk';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Content,
  ContentVariants,
  Flex,
  FlexItem
} from '@patternfly/react-core';
import { BellIcon, ExclamationCircleIcon, ExclamationTriangleIcon, InfoAltIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { valueFormat } from '../../utils/format';
import { computeResourceScore, HealthStat } from './health-helper';

import './health-card.css';

export interface HealthCardProps {
  name?: string;
  k8sKind?: string;
  resourceHealth: HealthStat;
  isDark: boolean;
  isSelected: boolean;
  onClick?: () => void;
  hideTitle?: boolean;
}

export const HealthCard: React.FC<HealthCardProps> = ({
  name,
  k8sKind,
  resourceHealth,
  isDark,
  isSelected,
  onClick,
  hideTitle
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');

  const score = React.useMemo(() => computeResourceScore(resourceHealth), [resourceHealth]);

  // Combine counts from both alerts and recording rules
  const criticalCount = React.useMemo(
    () =>
      (resourceHealth.critical.firing.length || 0) +
      (resourceHealth.critical.pending.length || 0) +
      (resourceHealth.critical.recording.length || 0),
    [resourceHealth]
  );

  const warningCount = React.useMemo(
    () =>
      (resourceHealth.warning.firing.length || 0) +
      (resourceHealth.warning.pending.length || 0) +
      (resourceHealth.warning.recording.length || 0),
    [resourceHealth]
  );

  const infoCount = React.useMemo(
    () =>
      (resourceHealth.other.firing.length || 0) +
      (resourceHealth.other.pending.length || 0) +
      (resourceHealth.other.recording.length || 0),
    [resourceHealth]
  );

  const silencedCount = React.useMemo(
    () =>
      (resourceHealth.critical.silenced.length || 0) +
      (resourceHealth.warning.silenced.length || 0) +
      (resourceHealth.other.silenced.length || 0),
    [resourceHealth]
  );

  // Build CSS classes like other health cards
  const classes = ['health-card'];
  let icon = <InfoAltIcon className="icon" />;
  if (criticalCount > 0) {
    classes.push('critical');
    icon = <ExclamationCircleIcon className="icon critical" />;
  } else if (warningCount > 0) {
    classes.push('warning');
    icon = <ExclamationTriangleIcon className="icon warning" />;
  } else if (infoCount > 0) {
    classes.push('minor');
    icon = <BellIcon className="icon minor" />;
  }
  if (isDark) {
    classes.push('dark');
  }

  return (
    <Card
      className={classes.join(' ')}
      data-test={`health-card-${name || 'global'}`}
      isClickable={onClick !== undefined}
      isClicked={isSelected}
    >
      <CardHeader
        className={hideTitle ? 'card-header-hidden' : 'card-header'}
        selectableActions={{
          selectableActionAriaLabelledby: `selectable-card-${name || 'global'}`,
          variant: 'single',
          onClickAction: onClick
        }}
      >
        {!hideTitle ? (
          <Flex
            gap={{ default: 'gapSm' }}
            alignItems={{ default: 'alignItemsCenter' }}
            flexWrap={{ default: 'nowrap' }}
          >
            <FlexItem>{icon}</FlexItem>
            <FlexItem>
              <CardTitle id={`selectable-card-${name || 'global'}`}>
                {k8sKind && name ? <ResourceLink inline={true} kind={k8sKind} name={name} /> : t('Global')}
              </CardTitle>
            </FlexItem>
          </Flex>
        ) : (
          <span id={`selectable-card-${name || 'global'}`} className="pf-v6-screen-reader">
            {name || t('Global')}
          </span>
        )}
      </CardHeader>
      <CardBody>
        <Flex gap={{ default: 'gapSm' }} alignItems={{ default: 'alignItemsCenter' }} flexWrap={{ default: 'nowrap' }}>
          {hideTitle && <FlexItem className="card-body-icon">{icon}</FlexItem>}
          <FlexItem grow={{ default: 'grow' }}>
            <ul style={{ listStyleType: 'none' }}>
              {criticalCount > 0 && (
                <li>
                  {criticalCount} {t('critical issues')}
                </li>
              )}
              {warningCount > 0 && (
                <li>
                  {warningCount} {t('warnings')}
                </li>
              )}
              {infoCount > 0 && (
                <li>
                  {infoCount} {t('info metrics')}
                </li>
              )}
              {silencedCount > 0 && (
                <li>
                  {silencedCount} {t('silenced issues')}
                </li>
              )}
            </ul>
          </FlexItem>
          <FlexItem>
            <Flex
              direction={{ default: 'column' }}
              alignItems={{ default: 'alignItemsCenter' }}
              gap={{ default: 'gapNone' }}
            >
              <FlexItem>
                <Content
                  component={ContentVariants.small}
                  style={{
                    color: 'var(--pf-t--global--text--color--subtle)'
                  }}
                >
                  {t('Score')}
                </Content>
              </FlexItem>
              <FlexItem>
                <Content component={ContentVariants.p} className="health-card-score">
                  {isNaN(score) || !isFinite(score) ? '-' : valueFormat(score, 1)}
                </Content>
              </FlexItem>
            </Flex>
          </FlexItem>
        </Flex>
      </CardBody>
    </Card>
  );
};
