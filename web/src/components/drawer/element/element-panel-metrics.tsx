import { Flex, FlexItem, Radio, Text, TextVariants } from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { TopologyMetrics } from '../../../api/query-response';
import { isTimeMetric, MetricType } from '../../../model/flow-query';
import { getStat } from '../../../model/metrics';
import { decorated, NodeData } from '../../../model/topology';
import { matchPeer } from '../../../utils/metrics';
import { toNamedMetric } from '../../../utils/metrics-helper';
import { TruncateLength } from '../../dropdowns/truncate-dropdown';
import { MetricsGraph } from '../../metrics/metrics-graph';
import { ElementPanelStats } from './element-panel-stats';

type MetricsRadio = 'in' | 'out' | 'both';

export interface ElementPanelMetricsProps {
  aData: NodeData;
  bData?: NodeData;
  isGroup: boolean;
  metrics: TopologyMetrics[];
  metricType: MetricType;
  truncateLength: TruncateLength;
}

export const ElementPanelMetrics: React.FC<ElementPanelMetricsProps> = ({
  aData,
  bData,
  isGroup,
  metrics,
  metricType,
  truncateLength
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const [metricsRadio, setMetricsRadio] = React.useState<MetricsRadio>('both');

  const useArea = !isTimeMetric(metricType);
  const titleStats = t('Stats');

  let id = '';
  let metricsIn: TopologyMetrics[] = [];
  let metricsOut: TopologyMetrics[] = [];
  let metricsBoth: TopologyMetrics[] = [];

  if (bData) {
    // Edge selected
    id = `edge-${aData.peer.id}-${bData!.peer.id}`;
    metricsIn = metrics.filter(m => matchPeer(aData, m.source) && matchPeer(bData, m.destination));
    metricsOut = metrics.filter(m => matchPeer(bData, m.source) && matchPeer(aData, m.destination));
    metricsBoth = [...metricsIn, ...metricsOut];
  } else {
    // Node or group selected
    id = `node-${decorated(aData).id}`;
    metricsIn = metrics.filter(m => m.source.id !== m.destination.id && matchPeer(aData, m.destination));
    metricsOut = metrics.filter(m => m.source.id !== m.destination.id && matchPeer(aData, m.source));
    // Note that metricsBoth is not always the concat of in+out:
    //  when a group is selected, there might be an overlap of in and out, so we don't want to count them twice
    metricsBoth = metrics.filter(
      m => m.source.id !== m.destination.id && (matchPeer(aData, m.source) || matchPeer(aData, m.destination))
    );
  }
  const focusNode = bData ? undefined : aData;
  const top5 = (metricsRadio === 'in' ? metricsIn : metricsRadio === 'out' ? metricsOut : metricsBoth)
    .map(m => toNamedMetric(t, m, truncateLength, false, false, isGroup ? undefined : focusNode))
    .sort((a, b) => getStat(b.stats, 'sum') - getStat(a.stats, 'sum'));

  const getChartTitle = React.useCallback(() => {
    switch (metricType) {
      case 'DnsLatencyMs':
        return t('Top 5 DNS latency');
      case 'TimeFlowRttNs':
        return t('Top 5 flow RTT');
      default:
        return t('Top 5 rates');
    }
  }, [metricType, t]);

  return (
    <div className="element-metrics-container">
      <FlexItem>
        <Text id="metrics-stats-title" component={TextVariants.h4}>
          {titleStats}
        </Text>
        <ElementPanelStats
          metricType={metricType}
          metricsIn={metricsIn}
          metricsOut={metricsOut}
          metricsBoth={metricsBoth}
          isEdge={!!bData}
        />
      </FlexItem>
      <FlexItem>
        <Text id="metrics-chart-title" component={TextVariants.h4}>
          {getChartTitle()}
        </Text>
        <Flex className="metrics-justify-content">
          <FlexItem>
            <Radio
              isChecked={metricsRadio === 'in'}
              name="radio-in"
              onChange={() => setMetricsRadio('in')}
              label={bData ? t('A -> B') : t('In')}
              id="radio-in"
            />
          </FlexItem>
          <FlexItem>
            <Radio
              isChecked={metricsRadio === 'out'}
              name="radio-out"
              onChange={() => setMetricsRadio('out')}
              label={bData ? t('B -> A') : t('Out')}
              id="radio-out"
            />
          </FlexItem>
          <FlexItem>
            <Radio
              isChecked={metricsRadio === 'both'}
              name="radio-both"
              onChange={() => setMetricsRadio('both')}
              label={t('Both')}
              id="radio-both"
            />
          </FlexItem>
        </Flex>
      </FlexItem>
      <MetricsGraph
        id={id}
        metricType={metricType}
        metricFunction={isTimeMetric(metricType) ? 'sum' : 'avg'}
        metrics={top5}
        limit={5}
        showArea={useArea}
        showLine={!useArea}
        showScatter
        tooltipsTruncate={true}
        showLegend={true}
      />
    </div>
  );
};
