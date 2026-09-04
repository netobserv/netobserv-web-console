import { Bullseye, Content, ContentVariants, EmptyState, Spinner, Title } from '@patternfly/react-core';
import { CheckCircleIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { HealthDrawerContainer } from './health-drawer-container';
import { getAllHealthItems } from './health-helper';
import { OvnHealthStats } from './ovn-health-helper';
import { RuleDetails } from './rule-details';

export type HealthOvnView = 'global' | 'per-node';

export interface HealthOvnProps {
  stats: OvnHealthStats;
  view: HealthOvnView;
  isLoading?: boolean;
  isDark: boolean;
}

export const HealthOvn: React.FC<HealthOvnProps> = ({ stats, view, isLoading, isDark }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const globalItems = getAllHealthItems(stats.global);
  const hasNodeItems = stats.byNode.some(s => getAllHealthItems(s).length > 0);

  if (isLoading) {
    return (
      <Bullseye data-test="health-ovn-loading">
        <Spinner size="lg" aria-label={t('Loading OVN platform alerts')} />
      </Bullseye>
    );
  }

  if (!stats.available) {
    return (
      <EmptyState data-test="health-ovn-unavailable" titleText={t('OVN platform alerts unavailable')} headingLevel="h2">
        {t(
          'OpenShift OVN-Kubernetes platform alerts were not found. This tab is available on OpenShift clusters using the OVN-Kubernetes network plugin.'
        )}
      </EmptyState>
    );
  }

  if (view === 'global') {
    if (globalItems.length === 0) {
      return (
        <Bullseye>
          <EmptyState
            data-test="health-ovn-global-healthy"
            titleText={<Title headingLevel="h2">{t('No cluster-wide OVN platform alerts')}</Title>}
            icon={CheckCircleIcon}
          />
        </Bullseye>
      );
    }

    return (
      <div className="health-ovn-content" data-test="health-ovn-content">
        <Content component={ContentVariants.h3}>{t('Cluster-wide OVN alerts')}</Content>
        <RuleDetails kind={'Global'} resourceHealth={stats.global} />
      </div>
    );
  }

  if (!hasNodeItems) {
    return (
      <Bullseye>
        <EmptyState
          data-test="health-ovn-nodes-healthy"
          titleText={<Title headingLevel="h2">{t('No OVN platform alerts per node')}</Title>}
          icon={CheckCircleIcon}
        />
      </Bullseye>
    );
  }

  return (
    <div className="health-ovn-content" data-test="health-ovn-content">
      <HealthDrawerContainer title={t('OVN alerts per node')} stats={stats.byNode} kind={'Node'} isDark={isDark} />
    </div>
  );
};
