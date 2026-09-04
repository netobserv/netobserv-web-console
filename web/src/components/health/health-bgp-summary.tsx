import { Card, CardBody, Content, ContentVariants, Flex, FlexItem, Spinner } from '@patternfly/react-core';
import { AngleDownIcon, AngleRightIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { localStorageHealthBgpSummaryExpandedKey, useLocalStorage } from '../../utils/local-storage-hook';
import { HealthMetricCard } from './health-metric-card';
import { getBgpSummaryCounts, BgpHealthStats } from './bgp-health-helper';

type StatusClass = 'success' | 'critical' | 'warning' | 'info';

export interface HealthBgpSummaryProps {
  stats: BgpHealthStats;
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

export const HealthBgpSummary: React.FC<HealthBgpSummaryProps> = ({
  stats,
  forceCollapsed,
  isLoading,
  activeViewLabel
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const [isExpanded, setIsExpanded] = useLocalStorage<boolean>(localStorageHealthBgpSummaryExpandedKey, false);
  const displayExpanded = forceCollapsed ? false : isExpanded;
  const sectionDetails = t(
    'BGP/BFD session alerts from frr-k8s. Not included in the NetObserv health score.'
  );
  const sectionDescription = activeViewLabel
    ? t('{{view}} · {{details}}', { view: activeViewLabel, details: sectionDetails })
    : sectionDetails;

  if (isLoading) {
    return (
      <Flex className="health-section-summary health-bgp-summary" {...sectionSummaryLayout}>
        <FlexItem className="health-section-summary-heading">
          <Content
            component={ContentVariants.h3}
            className="health-summary-section-title"
            data-test="health-bgp-summary-label"
          >
            {t('BGP/BFD session health')}
          </Content>
          <Content component={ContentVariants.p} className="health-summary-section-description">
            {sectionDescription}
          </Content>
        </FlexItem>
        <FlexItem className="health-section-summary-body">
          <Flex
            className="health-summary-dashboard"
            alignItems={{ default: 'alignItemsCenter' }}
            data-test="health-bgp-summary-loading"
          >
            <FlexItem>
              <Spinner size="lg" aria-label={t('Loading BGP health alerts')} />
            </FlexItem>
          </Flex>
        </FlexItem>
      </Flex>
    );
  }

  const counts = getBgpSummaryCounts(stats);
  const criticalTotal = counts.critical.firing + counts.critical.pending + counts.critical.silenced;
  const warningTotal = counts.warning.firing + counts.warning.pending + counts.warning.silenced;
  const infoTotal = counts.info.firing + counts.info.pending + counts.info.silenced;

  let title = t('All BGP/BFD sessions healthy');
  let statusClass: StatusClass = 'success';
  if (criticalTotal > 0) {
    statusClass = 'critical';
    title = t('Critical BGP/BFD issues');
  } else if (warningTotal > 0) {
    statusClass = 'warning';
    title = t('BGP/BFD warnings');
  } else if (infoTotal > 0) {
    statusClass = 'info';
    title = t('Minor BGP/BFD observations');
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
      className="health-section-summary health-bgp-summary"
      {...sectionSummaryLayout}
      data-test="health-bgp-summary"
    >
      <FlexItem className="health-section-summary-heading">
        <Content
          component={ContentVariants.h3}
          className="health-summary-section-title"
          data-test="health-bgp-summary-label"
        >
          {t('BGP/BFD session health')}
        </Content>
        <Content component={ContentVariants.p} className="health-summary-section-description">
          {sectionDescription}
        </Content>
      </FlexItem>
      <FlexItem className="health-section-summary-body">
        <Flex
          data-test="health-bgp-summary-dashboard"
          gap={{ default: 'gapMd' }}
          alignItems={{ default: 'alignItemsCenter' }}
          className={`health-summary-dashboard ${forceCollapsed ? 'force-collapsed' : ''}`}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          tabIndex={forceCollapsed ? -1 : 0}
          role="button"
          aria-label={displayExpanded ? t('Collapse BGP summary') : t('Expand BGP summary')}
          aria-expanded={displayExpanded}
          aria-disabled={forceCollapsed}
          style={{ cursor: forceCollapsed ? 'default' : 'pointer' }}
        >
          {!forceCollapsed && (
            <FlexItem className="health-summary-toggle-icon">
              {displayExpanded ? <AngleDownIcon /> : <AngleRightIcon />}
            </FlexItem>
          )}
          <FlexItem className="health-section-summary-cards-container health-bgp-summary-cards-container">
            {displayExpanded ? (
              <Flex
                className="health-summary-cards health-bgp-summary-cards"
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
                className="health-summary-compact-row health-section-summary-compact-row health-bgp-summary-compact-row"
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
