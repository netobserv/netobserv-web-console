import { Card, CardBody, Content, ContentVariants, Flex, FlexItem, Spinner } from '@patternfly/react-core';
import { AngleDownIcon, AngleRightIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { localStorageHealthOvnSummaryExpandedKey, useLocalStorage } from '../../utils/local-storage-hook';
import { formatContextTabTitle, NETOBSERV_CONTEXT_OVN } from './health-context';
import { HealthMetricCard } from './health-metric-card';
import { getOvnSummaryCounts, OvnHealthStats } from './ovn-health-helper';
import { getReadonlyContextCopy } from './readonly-context-copy';

type StatusClass = 'success' | 'critical' | 'warning' | 'info';

export interface HealthOvnSummaryProps {
  contextId?: string;
  stats: OvnHealthStats;
  forceCollapsed?: boolean;
  isLoading?: boolean;
  activeViewLabel?: string;
}

const sectionSummaryLayout = {
  direction: { default: 'row' as const },
  alignItems: { default: 'alignItemsCenter' as const },
  justifyContent: { default: 'justifyContentSpaceBetween' as const },
  gap: { default: 'gapMd' as const }
};

export const HealthOvnSummary: React.FC<HealthOvnSummaryProps> = ({
  contextId = NETOBSERV_CONTEXT_OVN,
  stats,
  forceCollapsed,
  isLoading,
  activeViewLabel
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const copy = getReadonlyContextCopy(contextId, t);
  const titleName = contextId === NETOBSERV_CONTEXT_OVN ? t('OVN') : formatContextTabTitle(contextId);
  const testPrefix = `health-${contextId}`;
  const [isExpanded, setIsExpanded] = useLocalStorage<boolean>(localStorageHealthOvnSummaryExpandedKey, false);
  const displayExpanded = forceCollapsed ? false : isExpanded;
  const sectionDetails = copy.sectionDetails;
  const sectionDescription = activeViewLabel
    ? t('{{view}} · {{details}}', { view: activeViewLabel, details: sectionDetails })
    : sectionDetails;

  if (isLoading) {
    return (
      <Flex className="health-section-summary health-ovn-summary" {...sectionSummaryLayout}>
        <FlexItem className="health-section-summary-heading">
          <Content
            component={ContentVariants.h3}
            className="health-summary-section-title"
            data-test={`${testPrefix}-summary-label`}
          >
            {copy.summaryLabel}
          </Content>
          <Content component={ContentVariants.p} className="health-summary-section-description">
            {sectionDescription}
          </Content>
        </FlexItem>
        <FlexItem className="health-section-summary-body">
          <Flex
            className="health-summary-dashboard"
            alignItems={{ default: 'alignItemsCenter' }}
            data-test={`${testPrefix}-summary-loading`}
          >
            <FlexItem>
              <Spinner size="lg" aria-label={copy.loadingLabel} />
            </FlexItem>
          </Flex>
        </FlexItem>
      </Flex>
    );
  }

  const counts = getOvnSummaryCounts(stats);
  const criticalTotal = counts.critical.firing + counts.critical.pending + counts.critical.silenced;
  const warningTotal = counts.warning.firing + counts.warning.pending + counts.warning.silenced;
  const infoTotal = counts.info.firing + counts.info.pending + counts.info.silenced;

  let title = t('No active {{title}} alerts', { title: titleName });
  let statusClass: StatusClass = 'success';
  if (criticalTotal > 0) {
    statusClass = 'critical';
    title = t('Critical {{title}} issues', { title: titleName });
  } else if (warningTotal > 0) {
    statusClass = 'warning';
    title = t('{{title}} warnings', { title: titleName });
  } else if (infoTotal > 0) {
    statusClass = 'info';
    title = t('Minor {{title}} observations', { title: titleName });
  }

  const formatDetail = (firing: number, pending: number, silenced: number): string | undefined => {
    const parts: string[] = [];
    if (firing > 0) {
      parts.push(t('{{count}} firing', { count: firing }));
    }
    if (pending > 0) {
      parts.push(t('{{count}} pending', { count: pending }));
    }
    if (silenced > 0) {
      parts.push(t('{{count}} silenced', { count: silenced }));
    }
    return parts.length > 0 ? parts.join(', ') : undefined;
  };

  const handleToggle = () => {
    if (forceCollapsed) {
      return;
    }
    setIsExpanded(!isExpanded);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <Flex
      className="health-section-summary health-ovn-summary"
      {...sectionSummaryLayout}
      data-test={`${testPrefix}-summary`}
    >
      <FlexItem className="health-section-summary-heading">
        <Content
          component={ContentVariants.h3}
          className="health-summary-section-title"
          data-test={`${testPrefix}-summary-label`}
        >
          {copy.summaryLabel}
        </Content>
        <Content component={ContentVariants.p} className="health-summary-section-description">
          {sectionDescription}
        </Content>
      </FlexItem>
      <FlexItem className="health-section-summary-body">
        <Flex
          data-test={`${testPrefix}-summary-dashboard`}
          gap={{ default: 'gapMd' }}
          alignItems={{ default: 'alignItemsCenter' }}
          className={`health-summary-dashboard ${forceCollapsed ? 'force-collapsed' : ''}`}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          tabIndex={forceCollapsed ? -1 : 0}
          role="button"
          aria-label={
            displayExpanded
              ? t('Collapse {{title}} summary', { title: titleName })
              : t('Expand {{title}} summary', { title: titleName })
          }
          aria-expanded={displayExpanded}
          aria-disabled={forceCollapsed}
          style={{ cursor: forceCollapsed ? 'default' : 'pointer' }}
        >
          {!forceCollapsed && (
            <FlexItem className="health-summary-toggle-icon">
              {displayExpanded ? <AngleDownIcon /> : <AngleRightIcon />}
            </FlexItem>
          )}
          <FlexItem className="health-section-summary-cards-container health-ovn-summary-cards-container">
            {displayExpanded ? (
              <Flex
                className="health-summary-cards health-ovn-summary-cards"
                gap={{ default: 'gapMd' }}
                alignItems={{ default: 'alignItemsStretch' }}
                flexWrap={{ default: 'nowrap' }}
              >
                <FlexItem className="health-summary-status-card">
                  <Card className={`health-metric-card status ${statusClass}`}>
                    <CardBody>
                      <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsNone' }}>
                        <FlexItem>
                          <Content component={ContentVariants.small} className="metric-label">
                            {t('Status')}
                          </Content>
                        </FlexItem>
                        <FlexItem>
                          <Content component={ContentVariants.p} className="metric-status">
                            {title}
                          </Content>
                        </FlexItem>
                      </Flex>
                    </CardBody>
                  </Card>
                </FlexItem>
                <FlexItem className="health-summary-metric-card">
                  <HealthMetricCard
                    severity="critical"
                    label={t('Critical')}
                    total={criticalTotal}
                    detail={formatDetail(counts.critical.firing, counts.critical.pending, counts.critical.silenced)}
                  />
                </FlexItem>
                <FlexItem className="health-summary-metric-card">
                  <HealthMetricCard
                    severity="warning"
                    label={t('Warning')}
                    total={warningTotal}
                    detail={formatDetail(counts.warning.firing, counts.warning.pending, counts.warning.silenced)}
                  />
                </FlexItem>
                <FlexItem className="health-summary-metric-card">
                  <HealthMetricCard
                    severity="info"
                    label={t('Info')}
                    total={infoTotal}
                    detail={formatDetail(counts.info.firing, counts.info.pending, counts.info.silenced)}
                  />
                </FlexItem>
              </Flex>
            ) : (
              <Flex
                className="health-summary-compact-row health-section-summary-compact-row health-ovn-summary-compact-row"
                gap={{ default: 'gapSm' }}
                alignItems={{ default: 'alignItemsCenter' }}
                flexWrap={{ default: 'nowrap' }}
              >
                <FlexItem className={`health-summary-compact-item ${statusClass}`}>
                  <Flex gap={{ default: 'gapXs' }} alignItems={{ default: 'alignItemsCenter' }}>
                    <FlexItem className="health-summary-compact-icon status" />
                    <FlexItem>
                      <Content component={ContentVariants.p} className="health-summary-compact-text">
                        {title}
                      </Content>
                    </FlexItem>
                  </Flex>
                </FlexItem>
                <FlexItem className="health-summary-compact-item critical">
                  <Flex gap={{ default: 'gapXs' }} alignItems={{ default: 'alignItemsCenter' }}>
                    <FlexItem className="health-summary-compact-icon critical" />
                    <FlexItem>
                      <Content component={ContentVariants.p} className="health-summary-compact-text">
                        {criticalTotal}
                      </Content>
                    </FlexItem>
                  </Flex>
                </FlexItem>
                <FlexItem className="health-summary-compact-item warning">
                  <Flex gap={{ default: 'gapXs' }} alignItems={{ default: 'alignItemsCenter' }}>
                    <FlexItem className="health-summary-compact-icon warning" />
                    <FlexItem>
                      <Content component={ContentVariants.p} className="health-summary-compact-text">
                        {warningTotal}
                      </Content>
                    </FlexItem>
                  </Flex>
                </FlexItem>
                <FlexItem className="health-summary-compact-item info">
                  <Flex gap={{ default: 'gapXs' }} alignItems={{ default: 'alignItemsCenter' }}>
                    <FlexItem className="health-summary-compact-icon info" />
                    <FlexItem>
                      <Content component={ContentVariants.p} className="health-summary-compact-text">
                        {infoTotal}
                      </Content>
                    </FlexItem>
                  </Flex>
                </FlexItem>
              </Flex>
            )}
          </FlexItem>
        </Flex>
      </FlexItem>
    </Flex>
  );
};
