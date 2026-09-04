import { Bullseye, Content, ContentVariants, EmptyState, Spinner, Title } from '@patternfly/react-core';
import { CheckCircleIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { HealthDrawerContainer } from './health-drawer-container';
import { getAllHealthItems } from './health-helper';
import { BgpHealthStats } from './bgp-health-helper';
import { RuleDetails } from './rule-details';

export type HealthBgpView = 'global' | 'per-peer';

export interface HealthBgpProps {
  stats: BgpHealthStats;
  view: HealthBgpView;
  isLoading?: boolean;
  isDark: boolean;
}

export const HealthBgp: React.FC<HealthBgpProps> = ({ stats, view, isLoading, isDark }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const globalItems = getAllHealthItems(stats.global);
  const hasPeerItems = stats.byPeer.some(s => getAllHealthItems(s).length > 0);

  if (isLoading) {
    return (
      <Bullseye data-test="health-bgp-loading">
        <Spinner size="lg" aria-label={t('Loading BGP health alerts')} />
      </Bullseye>
    );
  }

  if (!stats.available) {
    return (
      <EmptyState data-test="health-bgp-unavailable" titleText={t('BGP health alerts unavailable')} headingLevel="h2">
        {t(
          'BGP/BFD platform alerts were not found. This tab is available on clusters with bgp-cloud-connector and frr-k8s deployed.'
        )}
      </EmptyState>
    );
  }

  if (view === 'global') {
    if (globalItems.length === 0) {
      return (
        <Bullseye>
          <EmptyState
            data-test="health-bgp-global-healthy"
            titleText={<Title headingLevel="h2">{t('No cluster-wide BGP alerts')}</Title>}
            icon={CheckCircleIcon}
          />
        </Bullseye>
      );
    }

    return (
      <div className="health-bgp-content" data-test="health-bgp-content">
        <Content component={ContentVariants.h3}>{t('Cluster-wide BGP/BFD alerts')}</Content>
        <RuleDetails kind={'Global'} resourceHealth={stats.global} />
      </div>
    );
  }

  if (!hasPeerItems) {
    return (
      <Bullseye>
        <EmptyState
          data-test="health-bgp-peers-healthy"
          titleText={<Title headingLevel="h2">{t('No BGP alerts per peer')}</Title>}
          icon={CheckCircleIcon}
        />
      </Bullseye>
    );
  }

  return (
    <div className="health-bgp-content" data-test="health-bgp-content">
      <HealthDrawerContainer title={t('BGP/BFD alerts per peer')} stats={stats.byPeer} kind={'Peer'} isDark={isDark} />
    </div>
  );
};
