import { Bullseye, Content, ContentVariants, EmptyState, Flex, FlexItem, Spinner, Title } from '@patternfly/react-core';
import { CheckCircleIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { valueFormat } from '../../utils/format';
import { computeResourceScore, getAllHealthItems, HealthStat, Severity } from './health-helper';
import { RuleDetails } from './rule-details';

export interface HealthGlobalProps {
  info: HealthStat;
  isLoading?: boolean;
}

const SeverityFilterChip: React.FC<{
  severity: Severity;
  count: number;
  label: string;
  selected: boolean;
  onToggle: (severity: Severity) => void;
  filterLabel: string;
}> = ({ severity, count, label, selected, onToggle, filterLabel }) => (
  <FlexItem>
    <button
      type="button"
      className={`health-summary-compact-item health-global-filter-chip ${severity}${selected ? ' is-selected' : ''}`}
      onClick={() => onToggle(severity)}
      aria-pressed={selected}
      aria-label={filterLabel}
      data-test={`health-global-filter-${severity}`}
    >
      <Flex gap={{ default: 'gapXs' }} alignItems={{ default: 'alignItemsCenter' }}>
        <FlexItem className={`health-summary-compact-icon ${severity}`} />
        <FlexItem>
          <Content component={ContentVariants.p} className="health-summary-compact-text">
            {count} {label}
          </Content>
        </FlexItem>
      </Flex>
    </button>
  </FlexItem>
);

export const HealthGlobal: React.FC<HealthGlobalProps> = ({ info, isLoading }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const all = getAllHealthItems(info);
  const [severityFilter, setSeverityFilter] = React.useState<Severity | undefined>(undefined);

  const score = React.useMemo(() => computeResourceScore(info), [info]);
  const criticalCount = React.useMemo(
    () =>
      (info.critical.firing.length || 0) +
      (info.critical.pending.length || 0) +
      (info.critical.silenced.length || 0) +
      (info.critical.recording.length || 0),
    [info]
  );
  const warningCount = React.useMemo(
    () =>
      (info.warning.firing.length || 0) +
      (info.warning.pending.length || 0) +
      (info.warning.silenced.length || 0) +
      (info.warning.recording.length || 0),
    [info]
  );
  const infoCount = React.useMemo(
    () =>
      (info.other.firing.length || 0) +
      (info.other.pending.length || 0) +
      (info.other.silenced.length || 0) +
      (info.other.recording.length || 0),
    [info]
  );
  const silencedCount = React.useMemo(
    () =>
      (info.critical.silenced.length || 0) + (info.warning.silenced.length || 0) + (info.other.silenced.length || 0),
    [info]
  );

  const toggleSeverityFilter = React.useCallback((severity: Severity) => {
    setSeverityFilter(current => (current === severity ? undefined : severity));
  }, []);

  return (
    <div className="health-global-content">
      {isLoading ? (
        <Bullseye data-test="health-global-loading">
          <Spinner size="lg" aria-label={t('Loading network health')} />
        </Bullseye>
      ) : all.length === 0 ? (
        <>
          <Content>
            <Content component={ContentVariants.h3}>{t('Global rule violations')}</Content>
          </Content>
          <Bullseye>
            <EmptyState
              titleText={<Title headingLevel="h2">{t('No violations found')}</Title>}
              icon={CheckCircleIcon}
            ></EmptyState>
          </Bullseye>
        </>
      ) : (
        <>
          <Flex
            className="health-global-header"
            alignItems={{ default: 'alignItemsCenter' }}
            justifyContent={{ default: 'justifyContentSpaceBetween' }}
            flexWrap={{ default: 'wrap' }}
            gap={{ default: 'gapMd' }}
          >
            <FlexItem>
              <Content>
                <Content component={ContentVariants.h3}>{t('Global rule violations')}</Content>
              </Content>
            </FlexItem>
            <FlexItem>
              <Flex
                className="health-global-strip"
                data-test="health-global-strip"
                gap={{ default: 'gapSm' }}
                alignItems={{ default: 'alignItemsCenter' }}
                flexWrap={{ default: 'wrap' }}
              >
                <FlexItem className="health-summary-compact-item health-global-strip-score">
                  <Flex gap={{ default: 'gapXs' }} alignItems={{ default: 'alignItemsCenter' }}>
                    <FlexItem>
                      <Content component={ContentVariants.small} className="health-global-strip-label">
                        {t('Score')}
                      </Content>
                    </FlexItem>
                    <FlexItem>
                      <Content component={ContentVariants.p} className="health-summary-compact-text">
                        {isNaN(score) || !isFinite(score) ? '-' : valueFormat(score, 1)}
                      </Content>
                    </FlexItem>
                  </Flex>
                </FlexItem>
                {criticalCount > 0 && (
                  <SeverityFilterChip
                    severity="critical"
                    count={criticalCount}
                    label={t('critical issues')}
                    selected={severityFilter === 'critical'}
                    onToggle={toggleSeverityFilter}
                    filterLabel={severityFilter === 'critical' ? t('Clear critical filter') : t('Filter by critical')}
                  />
                )}
                {warningCount > 0 && (
                  <SeverityFilterChip
                    severity="warning"
                    count={warningCount}
                    label={t('warnings')}
                    selected={severityFilter === 'warning'}
                    onToggle={toggleSeverityFilter}
                    filterLabel={severityFilter === 'warning' ? t('Clear warning filter') : t('Filter by warning')}
                  />
                )}
                {infoCount > 0 && (
                  <SeverityFilterChip
                    severity="info"
                    count={infoCount}
                    label={t('info metrics')}
                    selected={severityFilter === 'info'}
                    onToggle={toggleSeverityFilter}
                    filterLabel={severityFilter === 'info' ? t('Clear info filter') : t('Filter by info')}
                  />
                )}
                {silencedCount > 0 && (
                  <FlexItem className="health-summary-compact-item">
                    <Content component={ContentVariants.p} className="health-summary-compact-text">
                      {silencedCount} {t('silenced issues')}
                    </Content>
                  </FlexItem>
                )}
              </Flex>
            </FlexItem>
          </Flex>
          <RuleDetails kind={'Global'} resourceHealth={info} severityFilter={severityFilter} />
        </>
      )}
    </div>
  );
};
