import {
  Content,
  ContentVariants,
  DrawerActions,
  DrawerCloseButton,
  DrawerHead,
  DrawerPanelContent
} from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

export type HealthScoringContext = 'netobserv' | 'ovn' | 'bgp';

export interface HealthScoringDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  context: HealthScoringContext;
}

const NetobservScoringContent: React.FC = () => {
  const { t } = useTranslation('plugin__netobserv-plugin');

  return (
    <>
      <Content component={ContentVariants.h3}>{t('What is the Health Score?')}</Content>
      <Content component={ContentVariants.p}>
        {t(
          // eslint-disable-next-line max-len
          'The Network Health Score is a value between 0 and 10 that indicates the overall health of your network, where 10 represents perfect health and 0 represents critical issues.'
        )}
      </Content>

      <Content component={ContentVariants.h3}>{t('Severity Levels')}</Content>
      <Content component={ContentVariants.p}>{t('Issues are classified into three severity levels:')}</Content>

      <Content component={ContentVariants.h4}>
        <span
          style={{
            color: 'var(--pf-t--global--text--color--status--danger--default)'
          }}
        >
          {t('Critical')}
        </span>
      </Content>
      <Content component={ContentVariants.p}>
        {t('Severe problems requiring immediate attention. Critical issues can reduce the score down to 0.')}
      </Content>
      <Content component="p" className="health-scoring-list-item">{`• ${t('Score range: 0-6')}`}</Content>
      <Content component="p" className="health-scoring-list-item">{`• ${t('Weight: High (1.0)')}`}</Content>
      <Content component="p" className="health-scoring-list-item">{`• ${t(
        'Examples: connectivity loss, service failures'
      )}`}</Content>

      <Content component={ContentVariants.h4}>
        <span
          style={{
            color: 'var(--pf-t--global--text--color--status--warning--default)'
          }}
        >
          {t('Warning')}
        </span>
      </Content>
      <Content component={ContentVariants.p}>
        {t('Moderate problems that should be reviewed. Warnings can reduce the score down to 4.')}
      </Content>
      <Content component="p" className="health-scoring-list-item">{`• ${t('Score range: 4-8')}`}</Content>
      <Content component="p" className="health-scoring-list-item">{`• ${t('Weight: Medium (0.5)')}`}</Content>
      <Content component="p" className="health-scoring-list-item">{`• ${t(
        'Examples: elevated latency, increased errors'
      )}`}</Content>

      <Content component={ContentVariants.h4}>
        <span
          style={{
            color: 'var(--pf-t--global--text--color--status--info--default)'
          }}
        >
          {t('Info')}
        </span>
      </Content>
      <Content component={ContentVariants.p}>
        {t('Minor observations worth noting. Info issues can reduce the score down to 6.')}
      </Content>
      <Content component="p" className="health-scoring-list-item">{`• ${t('Score range: 6-10')}`}</Content>
      <Content component="p" className="health-scoring-list-item">{`• ${t('Weight: Low (0.25)')}`}</Content>
      <Content component="p" className="health-scoring-list-item">{`• ${t(
        'Examples: traffic increases, minor anomalies'
      )}`}</Content>

      <Content component={ContentVariants.h3}>{t('Alert States')}</Content>
      <Content component="p" className="health-scoring-list-item">
        <strong>{t('Inactive')}</strong>: {t('No problem detected - contributes best possible score for its severity')}
      </Content>
      <Content component="p" className="health-scoring-list-item">
        <strong>{t('Pending')}</strong>:{' '}
        {t('Problem detected, awaiting confirmation - reduced impact (30% of full impact)')}
      </Content>
      <Content component="p" className="health-scoring-list-item">
        <strong>{t('Firing')}</strong>: {t('Active problem - full impact on score')}
      </Content>
      <Content component="p" className="health-scoring-list-item">
        <strong>{t('Silenced')}</strong>: {t('Known issue, temporarily ignored - minimal impact (10% of full impact)')}
      </Content>

      <Content component={ContentVariants.h3}>{t('Alerts vs Recording Rules')}</Content>

      <Content component={ContentVariants.h4}>{t('Alerts (Alert Mode)')}</Content>
      <Content component={ContentVariants.p}>
        {t(
          'Traditional Prometheus alerts that fire when a condition is met. They transition through states (pending → firing) and can be silenced.'
        )}
      </Content>

      <Content component={ContentVariants.h4}>{t('Recording Rules (Recording Mode)')}</Content>
      <Content component={ContentVariants.p}>
        {t(
          // eslint-disable-next-line max-len
          'Pre-calculated metrics that are continuously evaluated. Unlike alerts, they always have a current value and are classified by severity based on threshold ranges:'
        )}
      </Content>
      <Content component="p" className="health-scoring-list-item">{`• ${t(
        'Value < info threshold: Not included in scoring'
      )}`}</Content>
      <Content component="p" className="health-scoring-list-item">{`• ${t(
        'Value ≥ info threshold: Classified as info'
      )}`}</Content>
      <Content component="p" className="health-scoring-list-item">{`• ${t(
        'Value ≥ warning threshold: Classified as warning'
      )}`}</Content>
      <Content component="p" className="health-scoring-list-item">{`• ${t(
        'Value ≥ critical threshold: Classified as critical'
      )}`}</Content>
      <Content component={ContentVariants.p}>
        {t('Recording rules provide real-time health insights even when no alerts have fired.')}
      </Content>

      <Content component={ContentVariants.h3}>{t('How Scores are Calculated')}</Content>
      <Content component={ContentVariants.p}>
        {t(
          'The final score is a weighted average of all issues (both alerts and recording rules). Each issue contributes based on:'
        )}
      </Content>
      <Content component="p" className="health-scoring-list-item">
        <strong>{t('How severe it is')}</strong>:{' '}
        {t('The distance between the current value and the threshold, mapped to the severity range')}
      </Content>
      <Content component="p" className="health-scoring-list-item">
        <strong>{t('Its severity level')}</strong>: {t('Critical issues have more weight than warnings or info')}
      </Content>
      <Content component="p" className="health-scoring-list-item">
        <strong>{t('Its state')}</strong>:{' '}
        {t('Firing issues have full impact, pending and silenced have reduced impact')}
      </Content>
    </>
  );
};

const OvnPlatformInfoContent: React.FC = () => {
  const { t } = useTranslation('plugin__netobserv-plugin');

  return (
    <>
      <Content component={ContentVariants.h3}>{t('What are OVN platform alerts?')}</Content>
      <Content component={ContentVariants.p}>
        {t(
          // eslint-disable-next-line max-len
          'These are Prometheus alerts defined and managed by the OpenShift cluster network operator for OVN-Kubernetes. They monitor control plane health, node networking components, and OVN database state.'
        )}
      </Content>

      <Content component={ContentVariants.h3}>{t('Not included in the NetObserv health score')}</Content>
      <Content component={ContentVariants.p}>
        {t(
          'Platform alerts are shown for visibility only. They do not contribute to the 0–10 NetObserv health score calculated from NetObserv health rules.'
        )}
      </Content>

      <Content component={ContentVariants.h3}>{t('Severity Levels')}</Content>
      <Content component={ContentVariants.p}>
        {t(
          'Alerts are grouped by their Prometheus severity label. Counts in the summary reflect firing, pending, and silenced alerts at each level:'
        )}
      </Content>

      <Content component={ContentVariants.h4}>
        <span
          style={{
            color: 'var(--pf-t--global--text--color--status--danger--default)'
          }}
        >
          {t('Critical')}
        </span>
      </Content>
      <Content component={ContentVariants.p}>
        {t(
          'Severe platform problems requiring immediate attention, such as a missing OVN control plane or database connectivity loss.'
        )}
      </Content>

      <Content component={ContentVariants.h4}>
        <span
          style={{
            color: 'var(--pf-t--global--text--color--status--warning--default)'
          }}
        >
          {t('Warning')}
        </span>
      </Content>
      <Content component={ContentVariants.p}>
        {t('Moderate platform issues that should be reviewed, such as elevated database CPU or stale OVN state.')}
      </Content>

      <Content component={ContentVariants.h4}>
        <span
          style={{
            color: 'var(--pf-t--global--text--color--status--info--default)'
          }}
        >
          {t('Info')}
        </span>
      </Content>
      <Content component={ContentVariants.p}>
        {t('Minor platform observations worth noting, such as approaching subnet allocation thresholds.')}
      </Content>

      <Content component={ContentVariants.h3}>{t('Alert States')}</Content>
      <Content component="p" className="health-scoring-list-item">
        <strong>{t('Firing')}</strong>: {t('Active alert condition - counted in severity totals')}
      </Content>
      <Content component="p" className="health-scoring-list-item">
        <strong>{t('Pending')}</strong>: {t('Condition detected, awaiting confirmation - counted in severity totals')}
      </Content>
      <Content component="p" className="health-scoring-list-item">
        <strong>{t('Silenced')}</strong>:{' '}
        {t('Known issue, temporarily ignored in Alertmanager - still shown here for visibility')}
      </Content>

      <Content component={ContentVariants.h3}>{t('How the summary status is determined')}</Content>
      <Content component={ContentVariants.p}>
        {t(
          // eslint-disable-next-line max-len
          'The status message reflects the highest severity with active alerts: critical issues take precedence over warnings, then info. When no alerts are active, the summary reports a healthy platform state.'
        )}
      </Content>

      <Content component={ContentVariants.h3}>{t('Read-only platform view')}</Content>
      <Content component={ContentVariants.p}>
        {t(
          'These alerts cannot be managed from NetObserv. Use OpenShift monitoring tools or cluster network operator runbooks to investigate and resolve platform issues.'
        )}
      </Content>
    </>
  );
};

const BgpInfoContent: React.FC = () => {
  const { t } = useTranslation('plugin__netobserv-plugin');

  return (
    <>
      <Content component={ContentVariants.h3}>{t('What are BGP/BFD alerts?')}</Content>
      <Content component={ContentVariants.p}>
        {t(
          // eslint-disable-next-line max-len
          'These are Prometheus alerts from bgp-cloud-connector based on frr-k8s metrics. They monitor BGP session state, BFD liveness, prefix advertisement, and peer stability.'
        )}
      </Content>

      <Content component={ContentVariants.h3}>{t('Not included in the NetObserv health score')}</Content>
      <Content component={ContentVariants.p}>
        {t(
          'BGP/BFD alerts are shown for visibility only. They do not contribute to the 0–10 NetObserv health score calculated from NetObserv health rules.'
        )}
      </Content>

      <Content component={ContentVariants.h3}>{t('Alert types')}</Content>

      <Content component="p" className="health-scoring-list-item">
        <strong>{t('BGPSessionDown')}</strong>: {t('A BGP session has been down for more than 1 minute.')}
      </Content>
      <Content component="p" className="health-scoring-list-item">
        <strong>{t('BGPPeerFlapping')}</strong>: {t('A BGP session is flapping (excessive opens in 10 minutes).')}
      </Content>
      <Content component="p" className="health-scoring-list-item">
        <strong>{t('BGPNoPrefixesReceived')}</strong>: {t('An established session has no received prefixes.')}
      </Content>
      <Content component="p" className="health-scoring-list-item">
        <strong>{t('BGPNoPrefixesAnnounced')}</strong>: {t('An established session has no announced prefixes.')}
      </Content>
      <Content component="p" className="health-scoring-list-item">
        <strong>{t('BFDSessionDown')}</strong>: {t('A BFD session has been down for more than 30 seconds.')}
      </Content>
      <Content component="p" className="health-scoring-list-item">
        <strong>{t('BFDPeerFlapping')}</strong>: {t('A BFD session is flapping (excessive down events in 10 minutes).')}
      </Content>

      <Content component={ContentVariants.h3}>{t('Grouping by peer')}</Content>
      <Content component={ContentVariants.p}>
        {t(
          'Alerts are grouped by the peer label from frr-k8s metrics, showing which BGP neighbor is affected. The Global view shows alerts without a specific peer label.'
        )}
      </Content>
    </>
  );
};

export const HealthScoringDrawer: React.FC<HealthScoringDrawerProps> = ({ isOpen, onClose, context }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const drawerRef = React.useRef<HTMLDivElement>(null);
  const isOvnContext = context === 'ovn';
  const isBgpContext = context === 'bgp';

  const title = isBgpContext
    ? t('Understanding BGP/BFD Alerts')
    : isOvnContext
    ? t('Understanding OVN Platform Alerts')
    : t('Understanding Network Health Scores');

  const dataTestClose = isBgpContext
    ? 'health-bgp-info-drawer-close'
    : isOvnContext
    ? 'health-ovn-info-drawer-close'
    : 'health-scoring-drawer-close';

  const dataTestContent = isBgpContext
    ? 'health-bgp-info-drawer'
    : isOvnContext
    ? 'health-ovn-info-drawer'
    : 'health-scoring-drawer';

  return (
    <DrawerPanelContent isResizable widths={{ default: 'width_50' }} minSize="400px">
      <DrawerHead>
        <span tabIndex={isOpen ? 0 : -1} ref={drawerRef}>
          <Content component={ContentVariants.h2} style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>
            {title}
          </Content>
        </span>
        <DrawerActions>
          <span data-test={dataTestClose}>
            <DrawerCloseButton onClick={onClose} />
          </span>
        </DrawerActions>
      </DrawerHead>
      <div style={{ padding: '1.5rem', overflowY: 'auto', height: '100%' }}>
        <Content className="health-scoring-content" data-test={dataTestContent}>
          {isBgpContext ? <BgpInfoContent /> : isOvnContext ? <OvnPlatformInfoContent /> : <NetobservScoringContent />}
        </Content>
      </div>
    </DrawerPanelContent>
  );
};
