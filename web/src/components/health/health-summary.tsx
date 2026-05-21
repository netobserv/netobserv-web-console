import { Rule } from '@openshift-console/dynamic-plugin-sdk';
import { Alert, Card, CardBody, Flex, FlexItem, Grid, GridItem, Text, TextVariants } from '@patternfly/react-core';
import { AngleDownIcon, AngleRightIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { localStorageHealthSummaryExpandedKey, useLocalStorage } from '../../utils/local-storage-hook';
import { HealthStats } from './health-helper';
import { HealthMetricCard } from './health-metric-card';

type StatusClass = 'success' | 'critical' | 'warning' | 'info';

export interface HealthSummaryProps {
  rules: Rule[];
  stats: HealthStats;
  forceCollapsed?: boolean;
}

export const HealthSummary: React.FC<HealthSummaryProps> = ({ rules, stats, forceCollapsed }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const [isExpanded, setIsExpanded] = useLocalStorage<boolean>(localStorageHealthSummaryExpandedKey, false);

  // Determine the actual display state: forced collapsed or user's preference
  const displayExpanded = forceCollapsed ? false : isExpanded;

  // Helper function to format metric details
  const formatMetricDetail = (firingAlerts: number, pendingAlerts: number, recordingRules: number): string => {
    const parts = [];
    if (firingAlerts > 0) {
      parts.push(t('{{count}} firing', { count: firingAlerts }));
    }
    if (pendingAlerts > 0) {
      parts.push(t('{{count}} pending', { count: pendingAlerts }));
    }
    if (recordingRules > 0) {
      parts.push(t('{{count}} recording', { count: recordingRules }));
    }
    return parts.join(', ');
  };

  // Count recording rules by severity
  let recordingRulesCritical = 0;
  let recordingRulesWarning = 0;
  let recordingRulesInfo = 0;

  // Count from global
  recordingRulesCritical += stats.global.critical.recording.length;
  recordingRulesWarning += stats.global.warning.recording.length;
  recordingRulesInfo += stats.global.other.recording.length;

  // Count from all namespaces
  stats.byNamespace.forEach(ns => {
    recordingRulesCritical += ns.critical.recording.length;
    recordingRulesWarning += ns.warning.recording.length;
    recordingRulesInfo += ns.other.recording.length;
  });

  // Count from all nodes
  stats.byNode.forEach(node => {
    recordingRulesCritical += node.critical.recording.length;
    recordingRulesWarning += node.warning.recording.length;
    recordingRulesInfo += node.other.recording.length;
  });

  // Count from all owners (workloads)
  stats.byOwner.forEach(owner => {
    recordingRulesCritical += owner.critical.recording.length;
    recordingRulesWarning += owner.warning.recording.length;
    recordingRulesInfo += owner.other.recording.length;
  });

  // Check if there are no rules at all (neither alerts nor recording rules)
  const totalRecordingRules = recordingRulesCritical + recordingRulesWarning + recordingRulesInfo;
  if (rules.length === 0 && totalRecordingRules === 0) {
    return (
      <div className="health-summary-dashboard">
        <Alert title={t('No rules found, health cannot be determined')} variant="info">
          <>
            {t(
              'Check alert definitions in FlowCollector "spec.processor.metrics.alertGroups" and "spec.processor.metrics.disableAlerts".'
            )}
            <br />
            {t('Make sure that Prometheus and AlertManager are running.')}
          </>
        </Alert>
      </div>
    );
  }

  const summaryStats = {
    critical: {
      firingAlerts: rules.flatMap(r => r.alerts).filter(a => a.state === 'firing' && a.labels.severity === 'critical')
        .length,
      firingRules: rules.filter(a => a.state === 'firing' && a.labels.severity === 'critical').length,
      pendingAlerts: rules.flatMap(r => r.alerts).filter(a => a.state === 'pending' && a.labels.severity === 'critical')
        .length,
      pendingRules: rules.filter(a => a.state === 'pending' && a.labels.severity === 'critical').length,
      recordingRules: recordingRulesCritical,
      total: rules.filter(a => a.labels.severity === 'critical').length
    },
    warning: {
      firingAlerts: rules.flatMap(r => r.alerts).filter(a => a.state === 'firing' && a.labels.severity === 'warning')
        .length,
      firingRules: rules.filter(a => a.state === 'firing' && a.labels.severity === 'warning').length,
      pendingAlerts: rules.flatMap(r => r.alerts).filter(a => a.state === 'pending' && a.labels.severity === 'warning')
        .length,
      pendingRules: rules.filter(a => a.state === 'pending' && a.labels.severity === 'warning').length,
      recordingRules: recordingRulesWarning,
      total: rules.filter(a => a.labels.severity === 'warning').length
    },
    info: {
      firingAlerts: rules.flatMap(r => r.alerts).filter(a => a.state === 'firing' && a.labels.severity === 'info')
        .length,
      firingRules: rules.filter(a => a.state === 'firing' && a.labels.severity === 'info').length,
      pendingAlerts: rules.flatMap(r => r.alerts).filter(a => a.state === 'pending' && a.labels.severity === 'info')
        .length,
      pendingRules: rules.filter(a => a.state === 'pending' && a.labels.severity === 'info').length,
      recordingRules: recordingRulesInfo,
      total: rules.filter(a => a.labels.severity === 'info').length
    }
  };

  let title = t('The network looks healthy');
  let statusClass: StatusClass = 'success';
  if (
    summaryStats.critical.firingAlerts > 0 ||
    summaryStats.critical.pendingAlerts > 0 ||
    summaryStats.critical.recordingRules > 0
  ) {
    statusClass = 'critical';
    title = t('There are critical network issues');
  } else if (
    summaryStats.warning.firingAlerts > 0 ||
    summaryStats.warning.pendingAlerts > 0 ||
    summaryStats.warning.recordingRules > 0
  ) {
    statusClass = 'warning';
    title = t('There are network warnings');
  } else if (
    summaryStats.info.firingAlerts > 0 ||
    summaryStats.info.pendingAlerts > 0 ||
    summaryStats.info.recordingRules > 0
  ) {
    statusClass = 'info';
    title = t('The network looks relatively healthy, with minor issues');
  }

  const criticalTotal =
    summaryStats.critical.firingAlerts + summaryStats.critical.pendingAlerts + summaryStats.critical.recordingRules;
  const warningTotal =
    summaryStats.warning.firingAlerts + summaryStats.warning.pendingAlerts + summaryStats.warning.recordingRules;
  const infoTotal = summaryStats.info.firingAlerts + summaryStats.info.pendingAlerts + summaryStats.info.recordingRules;

  // Build details like the old Alert summary
  const hasViolations = criticalTotal > 0 || warningTotal > 0 || infoTotal > 0;
  const details: string[] = [];

  // Critical
  if (
    summaryStats.critical.firingAlerts > 0 ||
    summaryStats.critical.pendingAlerts > 0 ||
    summaryStats.critical.recordingRules > 0
  ) {
    const total =
      summaryStats.critical.firingAlerts + summaryStats.critical.pendingAlerts + summaryStats.critical.recordingRules;
    const parts = [];
    if (summaryStats.critical.firingAlerts > 0) {
      parts.push(t('{{count}} firing alerts', { count: summaryStats.critical.firingAlerts }));
    }
    if (summaryStats.critical.pendingAlerts > 0) {
      parts.push(t('{{count}} pending alerts', { count: summaryStats.critical.pendingAlerts }));
    }
    if (summaryStats.critical.recordingRules > 0) {
      parts.push(t('{{count}} from recording rules', { count: summaryStats.critical.recordingRules }));
    }
    details.push(t('{{total}} critical issues ({{breakdown}})', { total, breakdown: parts.join(', ') }));
  } else if (!hasViolations) {
    details.push(t('No critical issues out of {{total}} rules', summaryStats.critical));
  }

  // Warning
  if (
    summaryStats.warning.firingAlerts > 0 ||
    summaryStats.warning.pendingAlerts > 0 ||
    summaryStats.warning.recordingRules > 0
  ) {
    const total =
      summaryStats.warning.firingAlerts + summaryStats.warning.pendingAlerts + summaryStats.warning.recordingRules;
    const parts = [];
    if (summaryStats.warning.firingAlerts > 0) {
      parts.push(t('{{count}} firing alerts', { count: summaryStats.warning.firingAlerts }));
    }
    if (summaryStats.warning.pendingAlerts > 0) {
      parts.push(t('{{count}} pending alerts', { count: summaryStats.warning.pendingAlerts }));
    }
    if (summaryStats.warning.recordingRules > 0) {
      parts.push(t('{{count}} from recording rules', { count: summaryStats.warning.recordingRules }));
    }
    details.push(t('{{total}} warnings ({{breakdown}})', { total, breakdown: parts.join(', ') }));
  } else if (!hasViolations) {
    details.push(t('No warnings out of {{total}} rules', summaryStats.warning));
  }

  // Info
  if (
    summaryStats.info.firingAlerts > 0 ||
    summaryStats.info.pendingAlerts > 0 ||
    summaryStats.info.recordingRules > 0
  ) {
    const total = summaryStats.info.firingAlerts + summaryStats.info.pendingAlerts + summaryStats.info.recordingRules;
    const parts = [];
    if (summaryStats.info.firingAlerts > 0) {
      parts.push(t('{{count}} firing alerts', { count: summaryStats.info.firingAlerts }));
    }
    if (summaryStats.info.pendingAlerts > 0) {
      parts.push(t('{{count}} pending alerts', { count: summaryStats.info.pendingAlerts }));
    }
    if (summaryStats.info.recordingRules > 0) {
      parts.push(t('{{count}} from recording rules', { count: summaryStats.info.recordingRules }));
    }
    details.push(t('{{total}} minor issues ({{breakdown}})', { total, breakdown: parts.join(', ') }));
  } else if (!hasViolations) {
    details.push(t('No minor issues out of {{total}} rules', summaryStats.info));
  }

  const handleToggle = () => {
    // Skip toggle when forced collapsed
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
      gap={{ default: 'gapMd' }}
      alignItems={{ default: 'alignItemsCenter' }}
      className={`health-summary-dashboard ${forceCollapsed ? 'force-collapsed' : ''}`}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      tabIndex={forceCollapsed ? -1 : 0}
      role="button"
      aria-label={displayExpanded ? t('Collapse health summary') : t('Expand health summary')}
      aria-expanded={displayExpanded}
      aria-disabled={forceCollapsed}
      style={{ cursor: forceCollapsed ? 'default' : 'pointer' }}
    >
      {!forceCollapsed && (
        <FlexItem className="health-summary-toggle-icon">
          {displayExpanded ? <AngleDownIcon /> : <AngleRightIcon />}
        </FlexItem>
      )}
      <FlexItem flex={{ default: 'flex_1' }}>
        {displayExpanded ? (
          <Grid hasGutter>
            {/* Status card */}
            <GridItem lg={6} md={6} sm={12}>
              <Card className={`health-metric-card status ${statusClass}`}>
                <CardBody>
                  <Flex direction={{ default: 'column' }} spaceItems={{ default: 'spaceItemsNone' }}>
                    <FlexItem>
                      <Text component={TextVariants.small} className="metric-label">
                        {t('Status')}
                      </Text>
                    </FlexItem>
                    <FlexItem>
                      <Text component={TextVariants.p} className="metric-status">
                        {title}
                      </Text>
                    </FlexItem>
                    {details.length > 0 && (
                      <FlexItem className="status-details">
                        <ul>
                          {details.map((text, i) => (
                            <li key={'li_' + i}>{text}</li>
                          ))}
                        </ul>
                      </FlexItem>
                    )}
                  </Flex>
                </CardBody>
              </Card>
            </GridItem>

            {/* Critical card */}
            <GridItem lg={2} md={6} sm={12}>
              <HealthMetricCard
                severity="critical"
                label={t('Critical')}
                total={criticalTotal}
                detail={
                  criticalTotal > 0
                    ? formatMetricDetail(
                        summaryStats.critical.firingAlerts,
                        summaryStats.critical.pendingAlerts,
                        summaryStats.critical.recordingRules
                      )
                    : undefined
                }
              />
            </GridItem>

            {/* Warning card */}
            <GridItem lg={2} md={6} sm={12}>
              <HealthMetricCard
                severity="warning"
                label={t('Warning')}
                total={warningTotal}
                detail={
                  warningTotal > 0
                    ? formatMetricDetail(
                        summaryStats.warning.firingAlerts,
                        summaryStats.warning.pendingAlerts,
                        summaryStats.warning.recordingRules
                      )
                    : undefined
                }
              />
            </GridItem>

            {/* Info card */}
            <GridItem lg={2} md={6} sm={12}>
              <HealthMetricCard
                severity="info"
                label={t('Info')}
                total={infoTotal}
                detail={
                  infoTotal > 0
                    ? formatMetricDetail(
                        summaryStats.info.firingAlerts,
                        summaryStats.info.pendingAlerts,
                        summaryStats.info.recordingRules
                      )
                    : undefined
                }
              />
            </GridItem>
          </Grid>
        ) : (
          <Flex gap={{ default: 'gapSm' }} alignItems={{ default: 'alignItemsCenter' }}>
            {/* Collapsed view - just counters with icons */}
            <FlexItem className={`health-summary-compact-item ${statusClass}`}>
              <Flex gap={{ default: 'gapXs' }} alignItems={{ default: 'alignItemsCenter' }}>
                <FlexItem className="health-summary-compact-icon status" />
                <FlexItem>
                  <Text component={TextVariants.p} className="health-summary-compact-text">
                    {title}
                  </Text>
                </FlexItem>
              </Flex>
            </FlexItem>
            <FlexItem className="health-summary-compact-item critical">
              <Flex gap={{ default: 'gapXs' }} alignItems={{ default: 'alignItemsCenter' }}>
                <FlexItem className="health-summary-compact-icon critical" />
                <FlexItem>
                  <Text component={TextVariants.p} className="health-summary-compact-text">
                    {criticalTotal}
                  </Text>
                </FlexItem>
              </Flex>
            </FlexItem>
            <FlexItem className="health-summary-compact-item warning">
              <Flex gap={{ default: 'gapXs' }} alignItems={{ default: 'alignItemsCenter' }}>
                <FlexItem className="health-summary-compact-icon warning" />
                <FlexItem>
                  <Text component={TextVariants.p} className="health-summary-compact-text">
                    {warningTotal}
                  </Text>
                </FlexItem>
              </Flex>
            </FlexItem>
            <FlexItem className="health-summary-compact-item info">
              <Flex gap={{ default: 'gapXs' }} alignItems={{ default: 'alignItemsCenter' }}>
                <FlexItem className="health-summary-compact-icon info" />
                <FlexItem>
                  <Text component={TextVariants.p} className="health-summary-compact-text">
                    {infoTotal}
                  </Text>
                </FlexItem>
              </Flex>
            </FlexItem>
          </Flex>
        )}
      </FlexItem>
    </Flex>
  );
};
