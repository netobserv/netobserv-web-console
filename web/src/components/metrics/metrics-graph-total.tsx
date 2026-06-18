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
import { GenericMetric, NamedMetric } from '../../api/query-response';
import { MetricFunction, MetricType } from '../../model/flow-query';
import { localStorageOverviewMetricsTotalDimensionKey, useLocalStorage } from '../../utils/local-storage-hook';
import { getFormattedValue, isUnknownPeer } from '../../utils/metrics';
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

export interface MetricsGraphWithTotalProps {
  id: string;
  metricType: MetricType;
  metricFunction: MetricFunction;
  topKMetrics: (GenericMetric | NamedMetric)[];
  totalMetric?: GenericMetric | NamedMetric;
  totalDropMetric?: NamedMetric;
  limit: number;
  showTop: boolean;
  showTotal: boolean;
  showTotalDrop: boolean;
  showOthers: boolean;
  othersName?: string;
  showInternal?: boolean;
  showOutOfScope?: boolean;
  smallerTexts?: boolean;
  topAsBars?: boolean;
  showLegend?: boolean;
  animate?: boolean;
}

export const MetricsGraphWithTotal: React.FC<MetricsGraphWithTotalProps> = ({
  id,
  metricType,
  metricFunction,
  topKMetrics,
  totalMetric,
  totalDropMetric,
  limit,
  showTop,
  showTotal,
  showTotalDrop,
  showOthers,
  othersName,
  showInternal,
  showOutOfScope,
  smallerTexts,
  topAsBars,
  showLegend,
  animate
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');

  let filtered = topKMetrics;
  if (showInternal === false) {
    filtered = (filtered as NamedMetric[]).filter(m => !m.isInternal);
  }
  if (!showOutOfScope === false) {
    filtered = (filtered as NamedMetric[]).filter(m => !isUnknownPeer(m.source) || !isUnknownPeer(m.destination));
  }
  if (showOthers === false && othersName) {
    // remove others from generic metrics (DNS rcode NoError)
    filtered = (filtered as GenericMetric[]).filter(m => showOthers || (othersName && m.name !== othersName));
  }
  filtered = filtered.slice(0, limit);

  const legendData: LegendDataItem[] = showTop
    ? filtered.map((m, idx) => ({
        childName: `top-${idx}`,
        name: (m as NamedMetric).shortName || (m as GenericMetric).name,
        tooltipName: (m as NamedMetric).fullName || (m as GenericMetric).name
      }))
    : [];

  if (showTotal && totalMetric) {
    legendData.push({
      childName: 'area-total',
      name: t('Total'),
      symbol: { fill: '#8B8D8F' }
    });
  }

  if (showTotalDrop && totalDropMetric) {
    legendData.push({
      childName: 'area-totaldrop',
      name: t('Total dropped'),
      symbol: { fill: '#C9190B' }
    });
  }

  const topKDatapoints: ChartDataPoint[][] = filtered.map(toDatapoints);
  const totalDatapoints: ChartDataPoint[] = totalMetric ? toDatapoints(totalMetric) : [];
  const totalDropDatapoints: ChartDataPoint[] = totalDropMetric ? toDatapoints(totalDropMetric) : [];

  const legentComponent = (
    <ChartLegend
      itemsPerRow={2}
      labelComponent={<ChartLabel className={smallerTexts ? 'small-chart-label' : ''} />}
      data={legendData}
    />
  );

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useLocalStorage<Dimensions>(
    `${localStorageOverviewMetricsTotalDimensionKey}${showLegend ? '-legend' : ''}`,
    defaultDimensions
  );

  React.useEffect(() => {
    return observeDimensions(containerRef, dimensions, setDimensions);
  }, [containerRef, dimensions, setDimensions]);

  return (
    <div id={`chart-${id}`} className="metrics-content-div" ref={containerRef} data-test-metrics={topKMetrics.length}>
      <Chart
        themeColor={ChartThemeColor.multiUnordered}
        containerComponent={
          showLegend
            ? chartVoronoi(legendData, (v: number) => getFormattedValue(v, metricType, metricFunction, t))
            : undefined
        }
        legendData={legendData}
        legendOrientation="horizontal"
        legendPosition="bottom-left"
        legendAllowWrap={true}
        legendComponent={legentComponent}
        scale={{ x: 'time', y: 'linear' }}
        width={dimensions.width}
        height={dimensions.height}
        domainPadding={{ x: 0, y: 0 }}
        animate={animate}
        padding={
          showLegend
            ? {
                bottom: (legendData.length / 2) * 25 + 100,
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
        {showTop &&
          (topAsBars ? (
            <ChartStack>
              {topKDatapoints.map((datapoints, idx) => (
                <ChartBar name={`top-${idx}`} key={`top-${idx}`} data={datapoints} />
              ))}
            </ChartStack>
          ) : (
            <ChartGroup>
              {topKDatapoints.map((datapoints, idx) => (
                <ChartLine name={`top-${idx}`} key={`top-${idx}`} data={datapoints} interpolation="monotoneX" />
              ))}
            </ChartGroup>
          ))}
        {showTotal && (
          <ChartGroup>
            <ChartArea
              name={'area-total'}
              style={{ data: { fill: '#8B8D8F' } }}
              data={totalDatapoints}
              interpolation="monotoneX"
            />
          </ChartGroup>
        )}
        {showTotal && (
          <ChartGroup>
            <ChartScatter name={'scatter-total'} style={{ data: { fill: '#8B8D8F' } }} data={totalDatapoints} />
          </ChartGroup>
        )}
        {showTotalDrop && (
          <ChartGroup>
            <ChartArea
              name={'area-totaldrop'}
              style={{ data: { fill: '#C9190B' } }}
              data={totalDropDatapoints}
              interpolation="monotoneX"
            />
          </ChartGroup>
        )}
        {showTotalDrop && (
          <ChartGroup>
            <ChartScatter name={'scatter-totaldrop'} style={{ data: { fill: '#C9190B' } }} data={totalDropDatapoints} />
          </ChartGroup>
        )}
      </Chart>
    </div>
  );
};
