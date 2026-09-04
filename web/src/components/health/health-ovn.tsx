import { Bullseye, Content, ContentVariants, EmptyState, Spinner, Title } from '@patternfly/react-core';
import { CheckCircleIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { NETOBSERV_CONTEXT_OVN } from './health-context';
import { HealthDrawerContainer } from './health-drawer-container';
import { getAllHealthItems } from './health-helper';
import { OvnHealthStats } from './ovn-health-helper';
import { getReadonlyContextCopy } from './readonly-context-copy';
import { RuleDetails } from './rule-details';

export type HealthReadonlyView = 'global' | 'per-node';

export interface HealthReadonlyContextProps {
  contextId: string;
  stats: OvnHealthStats;
  view: HealthReadonlyView;
  isLoading?: boolean;
  isDark: boolean;
}

export const HealthReadonlyContext: React.FC<HealthReadonlyContextProps> = ({
  contextId,
  stats,
  view,
  isLoading,
  isDark
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const copy = getReadonlyContextCopy(contextId, t);
  const testPrefix = `health-${contextId}`;
  const globalItems = getAllHealthItems(stats.global);
  const hasNodeItems = stats.byNode.some(s => getAllHealthItems(s).length > 0);

  if (isLoading) {
    return (
      <Bullseye data-test={`${testPrefix}-loading`}>
        <Spinner size="lg" aria-label={copy.loadingLabel} />
      </Bullseye>
    );
  }

  if (!stats.available) {
    return (
      <EmptyState data-test={`${testPrefix}-unavailable`} titleText={copy.unavailableTitle} headingLevel="h2">
        {copy.unavailableBody}
      </EmptyState>
    );
  }

  if (view === 'global') {
    if (globalItems.length === 0) {
      return (
        <Bullseye>
          <EmptyState
            data-test={`${testPrefix}-global-healthy`}
            titleText={<Title headingLevel="h2">{copy.globalHealthyTitle}</Title>}
            icon={CheckCircleIcon}
          />
        </Bullseye>
      );
    }

    return (
      <div className="health-readonly-content" data-test={`${testPrefix}-content`}>
        <Content component={ContentVariants.h3}>{copy.globalSectionTitle}</Content>
        <RuleDetails kind={'Global'} resourceHealth={stats.global} />
      </div>
    );
  }

  if (!hasNodeItems) {
    return (
      <Bullseye>
        <EmptyState
          data-test={`${testPrefix}-nodes-healthy`}
          titleText={<Title headingLevel="h2">{copy.nodesHealthyTitle}</Title>}
          icon={CheckCircleIcon}
        />
      </Bullseye>
    );
  }

  return (
    <div className="health-readonly-content" data-test={`health-${contextId}-content`}>
      <HealthDrawerContainer title={copy.nodesSectionTitle} stats={stats.byNode} kind={'Node'} isDark={isDark} />
    </div>
  );
};

/** @deprecated Use HealthReadonlyContext with contextId="ovn" */
export type HealthOvnView = HealthReadonlyView;

/** @deprecated Use HealthReadonlyContext */
export const HealthOvn: React.FC<Omit<HealthReadonlyContextProps, 'contextId'> & { contextId?: string }> = props => (
  <HealthReadonlyContext {...props} contextId={props.contextId ?? NETOBSERV_CONTEXT_OVN} />
);
