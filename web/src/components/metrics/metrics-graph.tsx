import {
  Chart,
  ChartArea,
  ChartAxis,
  ChartBar,
  ChartGroup,
  ChartLabel,
  ChartLegend,
  ChartLine,
  ChartScatter,
  ChartStack,
  ChartThemeColor
} from '@patternfly/react-charts';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { GenericMetric, NamedMetric } from '../../api/loki';
import { MetricFunction, MetricType } from '../../model/flow-query';
import { localStorageOverviewMetricsDimensionKey, useLocalStorage } from '../../utils/local-storage-hook';
import { getFormattedValue } from '../../utils/metrics';
import {
  ChartDataPoint,
  defaultDimensions,
  Dimensions,
  LegendDataItem,
  observeDimensions,
  toDatapoints
} from '../../utils/metrics-helper';
import { chartVoronoi } from './chart-voronoi';
import './metrics-content.css';

export interface MetricsGraphProps {
  id: string;
  metricType: MetricType;
  metricFunction: MetricFunction;
  metrics: GenericMetric[] | NamedMetric[];
  limit: number;
  showBar?: boolean;
  showArea?: boolean;
  showLine?: boolean;
  showScatter?: boolean;
  smallerTexts?: boolean;
  itemsPerRow?: number;
  tooltipsTruncate: boolean;
  showLegend?: boolean;
  animate?: boolean;
}

export const MetricsGraph: React.FC<MetricsGraphProps> = ({
  id,
  metricType,
  metricFunction,
  metrics,
  limit,
  showBar,
  showArea,
  showLine,
  showScatter,
  smallerTexts,
  itemsPerRow,
  tooltipsTruncate,
  showLegend,
  animate
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');

  const filteredMetrics = metrics.slice(0, limit);

  const legendData: LegendDataItem[] = filteredMetrics.map((m, idx) => ({
    childName: `${showBar ? 'bar-' : 'area-'}${idx}`,
    name: (m as NamedMetric).shortName || (m as GenericMetric).name,
    tooltipName:
      (tooltipsTruncate ? (m as NamedMetric).shortName || (m as GenericMetric).name : (m as NamedMetric).fullName) ||
      (m as GenericMetric).name
  }));

  const topKDatapoints: ChartDataPoint[][] = filteredMetrics.map(toDatapoints);

  const legentComponent = (
    <ChartLegend
      itemsPerRow={itemsPerRow ? itemsPerRow : 1}
      labelComponent={<ChartLabel className={smallerTexts ? 'small-chart-label' : ''} />}
      data={legendData}
    />
  );

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useLocalStorage<Dimensions>(
    `${localStorageOverviewMetricsDimensionKey}${showLegend ? '-legend' : ''}`,
    defaultDimensions
  );

  React.useEffect(() => {
    return observeDimensions(containerRef, dimensions, setDimensions);
  }, [containerRef, dimensions, setDimensions]);

  return (
    <div id={`chart-${id}`} className="metrics-content-div" ref={containerRef} data-test-metrics={metrics.length}>
      <Chart
        themeColor={ChartThemeColor.multiUnordered}
        containerComponent={
          showLegend
            ? chartVoronoi(legendData, (v: number) => getFormattedValue(v, metricType, metricFunction, t))
            : undefined
        }
        legendData={showLegend ? legendData : undefined}
        legendOrientation={'horizontal'}
        legendPosition="bottom-left"
        legendAllowWrap={true}
        legendComponent={showLegend ? legentComponent : undefined}
        scale={{ x: 'time', y: showBar ? 'linear' : 'sqrt' }}
        width={dimensions.width}
        height={dimensions.height}
        domainPadding={{ x: 0, y: 0 }}
        animate={animate}
        padding={
          showLegend
            ? {
                bottom: (itemsPerRow && itemsPerRow > 1 ? legendData.length / 2 + 1 : legendData.length) * 25 + 75,
                left: 90,
                right: 50,
                top: 50
              }
            : {
                bottom: 0,
                left: 0,
                right: 0,
                top: 0
              }
        }
      >
        <ChartAxis fixLabelOverlap />
        <ChartAxis
          dependentAxis
          showGrid
          fixLabelOverlap
          tickFormat={y => (showLegend ? getFormattedValue(y, metricType, metricFunction, t) : '')}
        />
        {showBar && (
          <ChartStack>
            {topKDatapoints.map((datapoints, idx) => (
              <ChartBar name={`bar-${idx}`} key={`bar-${idx}`} data={datapoints} />
            ))}
          </ChartStack>
        )}
        {showArea && (
          <ChartGroup>
            {topKDatapoints.map((datapoints, idx) => (
              <ChartArea name={`area-${idx}`} key={`area-${idx}`} data={datapoints} interpolation="monotoneX" />
            ))}
          </ChartGroup>
        )}
        {showLine && (
          <ChartGroup>
            {topKDatapoints.map((datapoints, idx) => (
              <ChartLine name={`line-${idx}`} key={`line-${idx}`} data={datapoints} interpolation="monotoneX" />
            ))}
          </ChartGroup>
        )}
        {showScatter && (
          <ChartGroup>
            {topKDatapoints.map((datapoints, idx) => (
              <ChartScatter name={`scatter-${idx}`} key={`scatter-${idx}`} data={datapoints} />
            ))}
          </ChartGroup>
        )}
      </Chart>
    </div>
  );
};

export default MetricsGraph;
