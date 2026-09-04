import { ChartDonut, ChartLabel, ChartLegend, ChartThemeColor } from '@patternfly/react-charts/victory';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { GenericMetric, MetricStats, NamedMetric } from '../../api/query-response';
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

  // Use adaptive padding based on panel width
  // Wide panels (full-width): use original asymmetric padding
  // Narrow panels (half-width): use more balanced padding to center donut+legend
  const isNarrowPanel = dimensions.width <= 800;

  // Truncate text with end ellipsis, preserving arrow structure
  const truncateEnd = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 1) + '…';
  };

  // Truncate both sides of arrow separately for better readability
  const truncateArrowFormat = (text: string, maxLength: number): string => {
    // Check if text contains arrow notation
    const arrowMatch = text.match(/^(.+?)\s*(->|→)\s*(.+)$/);
    if (arrowMatch) {
      const [, source, arrow, destination] = arrowMatch;
      // Split available length between source and destination (accounting for arrow)
      const arrowLength = arrow.length + 2; // " -> " or " → "
      const sideLength = Math.floor((maxLength - arrowLength) / 2);

      return `${truncateEnd(source, sideLength)} ${arrow} ${truncateEnd(destination, sideLength)}`;
    }
    // No arrow, just truncate normally
    return truncateEnd(text, maxLength);
  };

  // Create extra-short names for narrow panels to prevent cutoff
  const createDisplayName = (shortName: string, fullName: string): string => {
    if (!isNarrowPanel) {
      return fullName;
    }
    // For narrow panels, aggressively truncate to max 30 characters
    return truncateArrowFormat(shortName, 30);
  };

  const legendData = sliced.map((m, idx) => ({
    childName: `${'area-'}${idx}`,
    name: createDisplayName(m.shortName, m.fullName),
    fullName: m.fullName,
    formattedValue: getFormattedValue(m.value, metricType, metricFunction, t)
  }));

  // Custom label component with SVG title tooltip for truncated legend items
  interface LegendLabelData {
    name?: string;
    fullName?: string;
    formattedValue?: string;
  }

  interface LegendLabelProps {
    datum?: LegendLabelData;
    text?: string;
    [key: string]: unknown;
  }

  const TooltipLabel = (props: LegendLabelProps) => {
    const { datum, text, ...rest } = props;
    const displayName = text || datum?.name || '';
    const fullName = datum?.fullName || displayName;
    const formattedValue = datum?.formattedValue || '';
    const tooltipContent = `${fullName}: ${formattedValue}`;

    // Only show tooltip if the displayed name is truncated (different from full name)
    const isTruncated = displayName !== fullName;

    return (
      <g>
        <ChartLabel {...rest} text={text} className={smallerTexts ? 'small-chart-label' : ''} />
        {isTruncated && <title>{tooltipContent}</title>}
      </g>
    );
  };

  const legendComponent = <ChartLegend labelComponent={<TooltipLabel />} data={legendData} />;
  const legendPadding = showLegendResponsive
    ? isNarrowPanel
      ? {
          bottom: 20,
          left: 100,
          right: 250,
          top: 20
        }
      : {
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
      };

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
        padding={legendPadding}
        title={internalText || `${getFormattedValue(total, metricType, metricFunction, t)}`}
        subTitle={internalSubtitle || t('Total')}
      />
    </div>
  );
};
