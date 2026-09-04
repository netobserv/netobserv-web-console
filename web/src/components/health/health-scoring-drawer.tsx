import {
  DrawerActions,
  DrawerCloseButton,
  DrawerHead,
  DrawerPanelContent,
  Text,
  TextContent,
  TextVariants
} from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

export interface HealthScoringDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HealthScoringDrawer: React.FC<HealthScoringDrawerProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const drawerRef = React.useRef<HTMLDivElement>(null);

  return (
    <DrawerPanelContent isResizable widths={{ default: 'width_50' }} minSize="400px">
      <DrawerHead>
        <span tabIndex={isOpen ? 0 : -1} ref={drawerRef}>
          <Text component={TextVariants.h2} style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>
            {t('Understanding Network Health Scores')}
          </Text>
        </span>
        <DrawerActions>
          <DrawerCloseButton onClick={onClose} />
        </DrawerActions>
      </DrawerHead>
      <div style={{ padding: '1.5rem', overflowY: 'auto', height: '100%' }}>
        <TextContent className="health-scoring-content">
          {/* What is the score */}
          <Text component={TextVariants.h3}>{t('What is the Health Score?')}</Text>
          <Text component={TextVariants.p}>
            {t(
              // eslint-disable-next-line max-len
              'The Network Health Score is a value between 0 and 10 that indicates the overall health of your network, where 10 represents perfect health and 0 represents critical issues.'
            )}
          </Text>

          <Text component={TextVariants.h3}>{t('Severity Levels')}</Text>
          <Text component={TextVariants.p}>{t('Issues are classified into three severity levels:')}</Text>

          <Text component={TextVariants.h4}>
            <span
              style={{
                color: 'var(--pf-t--global--text--color--status--danger--default)'
              }}
            >
              Critical
            </span>
          </Text>
          <Text component={TextVariants.p}>
            {t('Severe problems requiring immediate attention. Critical issues can reduce the score down to 0.')}
          </Text>
          <Text component="p" className="health-scoring-list-item">{`• ${t('Score range: 0-6')}`}</Text>
          <Text component="p" className="health-scoring-list-item">{`• ${t('Weight: High (1.0)')}`}</Text>
          <Text component="p" className="health-scoring-list-item">{`• ${t(
            'Examples: connectivity loss, service failures'
          )}`}</Text>

          <Text component={TextVariants.h4}>
            <span
              style={{
                color: 'var(--pf-t--global--text--color--status--warning--default)'
              }}
            >
              Warning
            </span>
          </Text>
          <Text component={TextVariants.p}>
            {t('Moderate problems that should be reviewed. Warnings can reduce the score down to 4.')}
          </Text>
          <Text component="p" className="health-scoring-list-item">{`• ${t('Score range: 4-8')}`}</Text>
          <Text component="p" className="health-scoring-list-item">{`• ${t('Weight: Medium (0.5)')}`}</Text>
          <Text component="p" className="health-scoring-list-item">{`• ${t(
            'Examples: elevated latency, increased errors'
          )}`}</Text>

          <Text component={TextVariants.h4}>
            <span
              style={{
                color: 'var(--pf-t--global--text--color--status--info--default)'
              }}
            >
              Info
            </span>
          </Text>
          <Text component={TextVariants.p}>
            {t('Minor observations worth noting. Info issues can reduce the score down to 6.')}
          </Text>
          <Text component="p" className="health-scoring-list-item">{`• ${t('Score range: 6-10')}`}</Text>
          <Text component="p" className="health-scoring-list-item">{`• ${t('Weight: Low (0.25)')}`}</Text>
          <Text component="p" className="health-scoring-list-item">{`• ${t(
            'Examples: traffic increases, minor anomalies'
          )}`}</Text>

          <Text component={TextVariants.h3}>{t('Alert States')}</Text>
          <Text component="p" className="health-scoring-list-item">
            <strong>{t('Inactive')}</strong>: {t('No problem detected - not counted in the score')}
          </Text>
          <Text component="p" className="health-scoring-list-item">
            <strong>{t('Pending')}</strong>:{' '}
            {t('Problem detected, awaiting confirmation - reduced impact (30% of full impact)')}
          </Text>
          <Text component="p" className="health-scoring-list-item">
            <strong>{t('Firing')}</strong>: {t('Active problem - full impact on score')}
          </Text>
          <Text component="p" className="health-scoring-list-item">
            <strong>{t('Silenced')}</strong>:{' '}
            {t('Known issue, temporarily ignored - minimal impact (10% of full impact)')}
          </Text>

          <Text component={TextVariants.h3}>{t('Alerts vs Recording Rules')}</Text>

          <Text component={TextVariants.h4}>{t('Alerts (Alert Mode)')}</Text>
          <Text component={TextVariants.p}>
            {t(
              'Traditional Prometheus alerts that fire when a condition is met. They transition through states (pending → firing) and can be silenced.'
            )}
          </Text>

          <Text component={TextVariants.h4}>{t('Recording Rules (Recording Mode)')}</Text>
          <Text component={TextVariants.p}>
            {t(
              // eslint-disable-next-line max-len
              'Pre-calculated metrics that are continuously evaluated. Unlike alerts, they always have a current value and are classified by severity based on threshold ranges:'
            )}
          </Text>
          <Text component="p" className="health-scoring-list-item">{`• ${t(
            'Value < info threshold: Not included in scoring'
          )}`}</Text>
          <Text component="p" className="health-scoring-list-item">{`• ${t(
            'Value ≥ info threshold: Classified as info'
          )}`}</Text>
          <Text component="p" className="health-scoring-list-item">{`• ${t(
            'Value ≥ warning threshold: Classified as warning'
          )}`}</Text>
          <Text component="p" className="health-scoring-list-item">{`• ${t(
            'Value ≥ critical threshold: Classified as critical'
          )}`}</Text>
          <Text component={TextVariants.p}>
            {t('Recording rules provide real-time health insights even when no alerts have fired.')}
          </Text>

          <Text component={TextVariants.h3}>{t('How Scores are Calculated')}</Text>
          <Text component={TextVariants.p}>
            {t(
              'The final score is a weighted average of all issues (both alerts and recording rules). Each issue contributes based on:'
            )}
          </Text>
          <Text component="p" className="health-scoring-list-item">
            <strong>{t('How severe it is')}</strong>:{' '}
            {t('The distance between the current value and the threshold, mapped to the severity range')}
          </Text>
          <Text component="p" className="health-scoring-list-item">
            <strong>{t('Its severity level')}</strong>: {t('Critical issues have more weight than warnings or info')}
          </Text>
          <Text component="p" className="health-scoring-list-item">
            <strong>{t('Its state')}</strong>:{' '}
            {t('Firing issues have full impact, pending and silenced have reduced impact')}
          </Text>
        </TextContent>
      </div>
    </DrawerPanelContent>
  );
};
