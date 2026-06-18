import { Flex, FlexItem, Text, TextVariants, Tooltip } from '@patternfly/react-core';
import { DomainIcon, OutlinedClockIcon, TachometerAltIcon } from '@patternfly/react-icons';
import _ from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { getRateMetricKey, NetflowMetrics } from '../../api/query-response';
import { MetricType } from '../../model/flow-query';
import { Warning } from '../../model/warnings';
import { valueFormat } from '../../utils/format';
import { BytesIcon, PacketsIcon } from '../icons';
import StatsQuerySummary from './stats-query-summary';

const exposedMetrics: MetricType[] = [
  'Bytes',
  'Packets',
  'PktDropBytes',
  'PktDropPackets',
  'DnsLatencyMs',
  'TimeFlowRttNs'
];

export interface MetricsQuerySummaryContentProps {
  metrics: NetflowMetrics;
  numQueries?: number;
  dataSources?: string[];
  loading?: boolean;
  lastRefresh?: Date;
  lastDuration?: number;
  warning?: Warning;
  direction: 'row' | 'column';
  className?: string;
  isShowQuerySummary?: boolean;
  toggleQuerySummary?: () => void;
  isDark?: boolean;
}

export const MetricsQuerySummaryContent: React.FC<MetricsQuerySummaryContentProps> = ({
  metrics,
  numQueries,
  dataSources,
  loading,
  lastRefresh,
  lastDuration,
  warning,
  direction,
  className,
  isShowQuerySummary,
  toggleQuerySummary,
  isDark
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');

  const getMetrics = React.useCallback(
    (metricType: MetricType) => {
      switch (metricType) {
        case 'Bytes':
        case 'Packets':
          return metrics.rate?.result?.[getRateMetricKey(metricType)];
        case 'PktDropBytes':
        case 'PktDropPackets':
          return metrics.droppedRate?.result?.[getRateMetricKey(metricType)];
        case 'DnsLatencyMs':
          return metrics.dnsLatency?.result?.avg;
        case 'TimeFlowRttNs':
          return metrics.rtt?.result?.avg;
        default:
          return undefined;
      }
    },
    [metrics]
  );

  const getAppMetrics = React.useCallback(
    (metricType: MetricType) => {
      switch (metricType) {
        case 'Bytes':
        case 'Packets':
          return metrics.totalRate?.result?.[getRateMetricKey(metricType)];
        case 'PktDropBytes':
        case 'PktDropPackets':
          return metrics.totalDroppedRate?.result?.[getRateMetricKey(metricType)];
        case 'DnsLatencyMs':
          return metrics.totalDnsLatency?.result?.avg;
        case 'TimeFlowRttNs':
          return metrics.totalRtt?.result?.avg;
        default:
          return undefined;
      }
    },
    [metrics]
  );

  const counters = React.useCallback(
    (metricType: MetricType) => {
      const metrics = getMetrics(metricType);
      const appMetrics = getAppMetrics(metricType);
      if (!metrics || _.isEmpty(metrics)) {
        return undefined;
      }
      const avgSum = metrics.map(m => m.stats.avg).reduce((prev, cur) => prev + cur, 0);
      const absTotal = metrics.map(m => m.stats.total).reduce((prev, cur) => prev + cur, 0);

      switch (metricType) {
        case 'Bytes':
        case 'PktDropBytes': {
          const textColor = metricType === 'PktDropBytes' ? (isDark ? '#C9190B' : '#A30000') : undefined;
          const droppedText = metricType === 'PktDropBytes' ? ' ' + t('dropped') : '';
          const textAbs = appMetrics
            ? `${t('Filtered sum of top-k bytes')}${droppedText} / ${t('Filtered total bytes')}${droppedText}`
            : `${t('Filtered sum of top-k bytes')}${droppedText}`;
          const textRate = appMetrics
            ? `${t('Filtered top-k byte rate')}${droppedText} / ${t('Filtered total byte rate')}${droppedText}`
            : `${t('Filtered top-k byte rate')}${droppedText}`;
          const valAbs = appMetrics
            ? valueFormat(absTotal, 1, t('B')) + ' / ' + valueFormat(appMetrics.stats.total, 1, t('B'))
            : valueFormat(absTotal, 1, t('B'));
          const valRate = appMetrics
            ? valueFormat(avgSum, 2, t('Bps')) + ' / ' + valueFormat(appMetrics.stats.avg, 2, t('Bps'))
            : valueFormat(avgSum, 2, t('Bps'));
          return [
            <FlexItem key={`${metricType}Count`}>
              <Tooltip content={<Text component={TextVariants.p}>{textAbs}</Text>}>
                <div className="stats-query-summary-container-with-icon">
                  <BytesIcon />
                  <Text id={`${_.lowerFirst(metricType)}Count`} component={TextVariants.p} style={{ color: textColor }}>
                    {valAbs}
                  </Text>
                </div>
              </Tooltip>
            </FlexItem>,
            <FlexItem key={`${metricType}PerSecondsCount`}>
              <Tooltip content={<Text component={TextVariants.p}>{textRate}</Text>}>
                <div className="stats-query-summary-container-with-icon">
                  <TachometerAltIcon />
                  <Text
                    id={`${_.lowerFirst(metricType)}PerSecondsCount`}
                    component={TextVariants.p}
                    style={{ color: textColor }}
                  >
                    {valRate}
                  </Text>
                </div>
              </Tooltip>
            </FlexItem>
          ];
        }
        case 'Packets':
        case 'PktDropPackets': {
          const textColor = metricType === 'PktDropPackets' ? (isDark ? '#C9190B' : '#A30000') : undefined;
          const droppedText = metricType === 'PktDropPackets' ? ' ' + t('dropped') : '';
          const textAbs = appMetrics
            ? `${t('Filtered sum of top-k packets')}${droppedText} / ${t('Filtered total packets')}${droppedText}`
            : `${t('Filtered sum of top-k packets')}${droppedText}`;
          const valAbs =
            (appMetrics ? `${absTotal} / ${appMetrics.stats.total}` : String(absTotal)) + ' ' + t('Packets');
          return [
            <FlexItem key={`${metricType}Count`}>
              <Tooltip content={<Text component={TextVariants.p}>{textAbs}</Text>}>
                <div className="stats-query-summary-container-with-icon">
                  <PacketsIcon />
                  <Text id={`${_.lowerFirst(metricType)}Count`} component={TextVariants.p} style={{ color: textColor }}>
                    {valAbs}
                  </Text>
                </div>
              </Tooltip>
            </FlexItem>
          ];
        }
        case 'DnsLatencyMs': {
          const textAvg = appMetrics
            ? `${t('Filtered avg DNS Latency')} | ${t('Filtered overall avg DNS Latency')}`
            : t('Filtered avg DNS Latency');
          const valAvg = appMetrics
            ? `${valueFormat(avgSum / metrics.length, 2, t('ms'))} | ${valueFormat(appMetrics.stats.avg, 2, t('ms'))}`
            : String(valueFormat(avgSum / metrics.length, 2, t('ms')));
          return [
            <FlexItem key="dnsAvg">
              <Tooltip content={<Text component={TextVariants.p}>{textAvg}</Text>}>
                <div className="stats-query-summary-container-with-icon">
                  <DomainIcon />
                  <Text id="dnsAvg" component={TextVariants.p}>
                    {valAvg}
                  </Text>
                </div>
              </Tooltip>
            </FlexItem>
          ];
        }
        case 'TimeFlowRttNs': {
          const textAvg = appMetrics ? `${t('Filtered avg RTT')} | ${t('Overall avg RTT')}` : t('Filtered avg RTT');
          const valAvg = appMetrics
            ? `${valueFormat(avgSum / metrics.length, 2, t('ms'))} | ${valueFormat(appMetrics.stats.avg, 2, t('ms'))}`
            : String(valueFormat(avgSum / metrics.length, 2, t('ms')));
          return [
            <FlexItem key="rttAvg">
              <Tooltip content={<Text component={TextVariants.p}>{textAvg}</Text>}>
                <div className="stats-query-summary-container-with-icon">
                  <OutlinedClockIcon />
                  <Text id="rttAvg" component={TextVariants.p}>
                    {valAvg}
                  </Text>
                </div>
              </Tooltip>
            </FlexItem>
          ];
        }
        default: {
          return undefined;
        }
      }
    },
    [getAppMetrics, getMetrics, isDark, t]
  );

  const metricsToShow = React.useCallback(() => {
    const filtered = exposedMetrics
      .filter(mt => getMetrics(mt) !== undefined)
      .flatMap((mt: MetricType) => counters(mt));
    // limit the number of metrics to show horizontally since we don't have enough room
    if (direction === 'row') {
      return filtered.slice(0, 5);
    }
    return filtered;
  }, [counters, direction, getMetrics]);

  return (
    <Flex
      id="query-summary-content"
      className={`${className} ${direction === 'row' ? 'center' : ''}`}
      direction={{ default: direction }}
    >
      {direction === 'row' && (
        <FlexItem key="title">
          <Text id="query-summary-title" component={TextVariants.h4}>
            {t('Summary')}
          </Text>
        </FlexItem>
      )}
      <FlexItem key="stats">
        <StatsQuerySummary
          detailed={direction === 'column'}
          loading={loading}
          lastRefresh={lastRefresh}
          lastDuration={lastDuration}
          numQueries={numQueries}
          dataSources={dataSources}
          warning={warning}
        />
      </FlexItem>
      {metricsToShow()}
      {direction === 'row' && toggleQuerySummary && (
        <FlexItem key="toggle">
          <Text id="query-summary-toggle" component={TextVariants.a} onClick={toggleQuerySummary}>
            {isShowQuerySummary ? t('See less') : t('See more')}
          </Text>
        </FlexItem>
      )}
    </Flex>
  );
};

export default MetricsQuerySummaryContent;
