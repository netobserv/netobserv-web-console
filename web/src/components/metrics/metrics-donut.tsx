import { ChartDonut, ChartLabel, ChartLegend, ChartThemeColor } from '@patternfly/react-charts';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { GenericMetric, MetricStats, NamedMetric } from '../../api/loki';
import { MetricFunction, MetricType } from '../../model/flow-query';
import { getStat } from '../../model/metrics';
import { localStorageOverviewDonutDimensionKey, useLocalStorage } from '../../utils/local-storage-hook';
import { getFormattedValue, isUnknownPeer } from '../../utils/metrics';
import { defaultDimensions, Dimensions, observeDimensions } from '../../utils/metrics-helper';
import './metrics-content.css';

export interface MetricsDonutProps {
  id: string;
  internalText?: string;
  internalSubtitle?: string;
  limit: number;
  metricType: MetricType;
  metricFunction: MetricFunction;
  topKMetrics: (GenericMetric | NamedMetric)[];
  totalMetric?: GenericMetric | NamedMetric;
  showOthers: boolean;
  othersName?: string;
  showLast?: boolean;
  showInternal?: boolean;
  showOutOfScope?: boolean;
  smallerTexts?: boolean;
  showLegend?: boolean;
  animate?: boolean;
}

export const MetricsDonut: React.FC<MetricsDonutProps> = ({
  id,
  internalText,
  internalSubtitle,
  metricFunction,
  limit,
  metricType,
  topKMetrics,
  totalMetric,
  showOthers,
  othersName,
  showLast,
  showInternal,
  showOutOfScope,
  smallerTexts,
  showLegend,
  animate
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');

  const getStats = React.useCallback(
    (stats: MetricStats) => {
      return getStat(stats, showLast ? 'last' : metricFunction);
    },
    [metricFunction, showLast]
  );

  // If total metric isn't provided, use the sum of the provided metrics
  let total = totalMetric
    ? getStats(totalMetric.stats)
    : topKMetrics.map(m => getStats(m.stats)).reduce((prev, cur) => prev + cur);
  let filtered = topKMetrics;
  if (showOutOfScope === false) {
    filtered = (filtered as NamedMetric[]).filter(m => {
      if (isUnknownPeer(m.source) && isUnknownPeer(m.destination)) {
        // This is full out-of-scope traffic. If it's hidden, remove it also from total
        total -= getStats(m.stats);
        return false;
      }
      return true;
    });
  }
  if (showInternal === false) {
    filtered = (filtered as NamedMetric[]).filter(m => {
      if (m.isInternal) {
        // This is internal traffic. If it's hidden, remove it also from total
        total -= getStats(m.stats);
        return false;
      }
      return true;
    });
  }
  if (showOthers === false && othersName) {
    // remove others from generic metrics (DNS rcode NoError)
    filtered = (filtered as GenericMetric[]).filter(m => !othersName || m.name !== othersName);
  }

  let sliced = filtered
    .map(m => ({
      name: (m as NamedMetric).fullName || (m as GenericMetric).name,
      shortName: (m as NamedMetric).shortName || (m as GenericMetric).name,
      fullName: (m as NamedMetric).fullName || (m as GenericMetric).name,
      value: getStats(m.stats)
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);

  const others = Math.max(0, total - sliced.reduce((prev, cur) => prev + cur.value, 0));
  if (showOthers) {
    if (others > 0 && !othersName) {
      sliced = [
        ...sliced,
        {
          name: t('Others'),
          fullName: t('Others'),
          shortName: t('Others'),
          value: others
        }
      ];
    }
  } else {
    total -= others;
    sliced = sliced.filter(m => m.name !== (othersName || t('Others')));
  }

  const legendData = sliced.map((m, idx) => ({
    childName: `${'area-'}${idx}`,
    name: m.name
  }));

  const legendComponent = (
    <ChartLegend
      labelComponent={<ChartLabel className={smallerTexts ? 'small-chart-label' : ''} />}
      data={legendData}
    />
  );

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useLocalStorage<Dimensions>(
    `${localStorageOverviewDonutDimensionKey}${showLegend ? '-legend' : ''}`,
    defaultDimensions
  );
  React.useEffect(() => {
    return observeDimensions(containerRef, dimensions, setDimensions);
  }, [containerRef, dimensions, setDimensions]);

  // Hide legend on small screens to prevent overlap/cropping
  const showLegendResponsive = showLegend && dimensions.width >= 550;

  return (
    <div id={id} className="metrics-content-div" ref={containerRef} data-test-metrics={topKMetrics.length}>
      <ChartDonut
        themeColor={ChartThemeColor.multiUnordered}
        constrainToVisibleArea
        legendData={showLegendResponsive ? legendData : undefined}
        legendOrientation="vertical"
        legendPosition="right"
        legendAllowWrap={true}
        legendComponent={showLegendResponsive ? legendComponent : undefined}
        radius={showLegend ? dimensions.height / 3 : undefined}
        innerRadius={showLegend ? dimensions.height / 4 : undefined}
        width={dimensions.width}
        height={dimensions.height}
        data={sliced.map(m => ({
          x: showLegend ? `${m.name}: ${getFormattedValue(m.value, metricType, metricFunction, t)}` : ' ',
          y: m.value
        }))}
        allowTooltip={showLegend}
        animate={animate}
        padding={
          showLegendResponsive
            ? {
                bottom: 20,
                left: 20,
                right: 350,
                top: 20
              }
            : {
                bottom: 0,
                left: 0,
                right: 0,
                top: 0
              }
        }
        title={internalText || `${getFormattedValue(total, metricType, metricFunction, t)}`}
        subTitle={internalSubtitle || t('Total')}
      />
    </div>
  );
};
