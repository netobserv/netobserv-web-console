import { Chart, ChartAxis, ChartBar, ChartStack, ChartThemeColor, createContainer } from '@patternfly/react-charts';
import {
  Bullseye,
  Button,
  EmptyState,
  EmptyStateBody,
  EmptyStateHeader,
  EmptyStateVariant,
  Flex,
  FlexItem,
  PopoverPosition,
  Spinner,
  Text,
  TextVariants,
  Tooltip
} from '@patternfly/react-core';
import {
  AngleDoubleLeftIcon,
  AngleDoubleRightIcon,
  AngleLeftIcon,
  AngleRightIcon,
  QuestionCircleIcon,
  SearchMinusIcon,
  SearchPlusIcon
} from '@patternfly/react-icons';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { NamedMetric, TopologyMetrics } from '../../api/query-response';
import { TimeRange } from '../../utils/datetime';
import { getDateMsInSeconds } from '../../utils/duration';
import { localStorageHistogramGuidedTourDoneKey, useLocalStorage } from '../../utils/local-storage-hook';
import { getFormattedValue } from '../../utils/metrics';
import {
  ChartDataPoint,
  Dimensions,
  getDomainDisplayText,
  getDomainFromRange,
  getHistogramRangeFromLimit,
  observeDimensions,
  toHistogramDatapoints,
  toNamedMetric
} from '../../utils/metrics-helper';
import { TruncateLength } from '../dropdowns/truncate-dropdown';
import { GuidedTourHandle } from '../guided-tour/guided-tour';
import BrushHandleComponent from './brush-handle';
import './histogram.css';
import './metrics-content.css';

export const VoronoiContainer = createContainer('voronoi', 'brush');

export interface HistogramProps {
  id: string;
  loading: boolean;
  totalMetric: NamedMetric;
  limit: number;
  isDark: boolean;
  range?: TimeRange;
  guidedTourHandle: GuidedTourHandle | null;
  setRange: (tr: TimeRange) => void;
  moveRange: (next: boolean) => void;
  zoomRange: (zoom: boolean) => void;
}

export const Histogram: React.FC<HistogramProps> = ({
  id,
  loading,
  totalMetric,
  limit,
  isDark,
  range,
  guidedTourHandle,
  setRange,
  moveRange,
  zoomRange
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');

  const datapoints: ChartDataPoint[] = toHistogramDatapoints(totalMetric);
  const defaultRange = getHistogramRangeFromLimit(totalMetric, limit);
  const [displayedRange, setDisplayedRange] = React.useState<TimeRange>();

  React.useEffect(() => {
    if (range) {
      setDisplayedRange(range);
    }
  }, [range]);

  const [tooltipsTrigger, setTooltipsTrigger] = React.useState<'manual' | 'mouseenter'>('mouseenter');
  const containerRef = React.useRef<HTMLDivElement>(null);
  const zoomRef = React.createRef<HTMLInputElement>();
  const pageRef = React.createRef<HTMLInputElement>();
  const arrowRef = React.createRef<HTMLInputElement>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const animate: any = {
    duration: 1500,
    animationWhitelist: ['data', 'domain']
  };

  const [dimensions, setDimensions] = React.useState<Dimensions>({ width: 3000, height: 250 });
  React.useEffect(() => {
    return observeDimensions(containerRef, dimensions, setDimensions);
  }, [containerRef, dimensions, setDimensions]);

  const moveHistogramRange = React.useCallback(
    (next: boolean) => {
      containerRef.current?.focus();

      const r = range ? range : defaultRange;
      const rSize = r.to - r.from;

      let start = r.from - rSize;
      if (next) {
        start = r.to;
      }
      const end = start + rSize;

      //try to get new range using limit
      let updatedRange = getHistogramRangeFromLimit(totalMetric, limit, start);

      //else fallback on previous / next range keeping actual width
      if (!updatedRange.from || !updatedRange.to) {
        const minTime = getDateMsInSeconds(Math.min(...datapoints.map(dp => dp.x.getTime())));
        const maxTime = getDateMsInSeconds(Math.max(...datapoints.map(dp => dp.x.getTime())));

        updatedRange = {
          from: start > minTime ? start : minTime,
          to: end < maxTime ? end : maxTime
        };
      }

      if (updatedRange.from && updatedRange.to && updatedRange.from < updatedRange.to) {
        setRange(updatedRange);
      } else {
        setRange(defaultRange);
      }
    },
    [containerRef, datapoints, defaultRange, limit, range, setRange, totalMetric]
  );

  const onKeyDown = React.useCallback(
    (key: string) => {
      switch (key) {
        case 'ArrowRight':
          moveRange(true);
          break;
        case 'ArrowLeft':
          moveRange(false);
          break;
        case '+':
          zoomRange(true);
          break;
        case '-':
          zoomRange(false);
          break;
        case 'PageUp':
          moveHistogramRange(true);
          break;
        case 'PageDown':
          moveHistogramRange(false);
          break;
      }
    },
    [moveHistogramRange, moveRange, zoomRange]
  );

  const zoomButtonTips = React.useCallback(() => {
    return t(
      // eslint-disable-next-line max-len
      'Zoom in / zoom out the histogram displayed time range. The selected time range in the top right corner will adapt accordingly. You can also use the plus or minus buttons while the histogram is focused.'
    );
  }, [t]);

  const pageButtonTips = React.useCallback(() => {
    return t(
      // eslint-disable-next-line max-len
      'Move the selected range to filter the table below as time based pagination. You can also use the page up or down buttons while the histogram is focused.'
    );
  }, [t]);

  const arrowButtonTips = React.useCallback(() => {
    return t(
      // eslint-disable-next-line max-len
      'Shift the histogram displayed time range. The selected time range in the top right corner will adapt accordingly. You can also use the arrow left or right buttons while the histogram is focused.'
    );
  }, [t]);

  const [guidedTourDone, setGuidedTourDone] = useLocalStorage<boolean>(localStorageHistogramGuidedTourDoneKey);
  React.useEffect(() => {
    if (!guidedTourHandle) {
      return;
    }

    guidedTourHandle.clearOnIndexChangeListener();
    guidedTourHandle.updateTourItems([
      {
        title: t('Histogram'),
        description: t(
          // eslint-disable-next-line max-len
          'The following bar chart represents the number of logs over time. You can select a portion of it to drill down into the selected time range, accordingly/consequently filtering the following flows information.'
        ),
        assetName: 'histogram.gif',
        minWidth: '600px',
        ref: containerRef
      },
      {
        title: t('Zoom buttons'),
        description: zoomButtonTips(),
        assetName: 'histogram-zoom.gif',
        position: PopoverPosition.bottom,
        ref: zoomRef
      },
      {
        title: t('Arrow buttons'),
        description: arrowButtonTips(),
        ref: arrowRef
      },
      {
        title: t('Page buttons'),
        description: pageButtonTips(),
        assetName: 'histogram-pages.gif',
        minWidth: '600px',
        position: PopoverPosition.bottom,
        ref: pageRef
      }
    ]);

    if (!guidedTourDone) {
      setGuidedTourDone(true);
      guidedTourHandle.startTour();
    }

    guidedTourHandle.addOnIndexChangeListener(index =>
      setTooltipsTrigger(index !== undefined ? 'manual' : 'mouseenter')
    );
  }, [
    arrowButtonTips,
    arrowRef,
    containerRef,
    guidedTourDone,
    guidedTourHandle,
    pageButtonTips,
    pageRef,
    setGuidedTourDone,
    t,
    zoomButtonTips,
    zoomRef
  ]);

  return (
    <div
      id={`chart-${id}`}
      className={`metrics-content-div ${loading ? 'loading' : ''}`}
      ref={containerRef}
      tabIndex={0}
      onKeyDown={e => onKeyDown(e.key)}
    >
      <Flex className="histogram-range-container" direction={{ default: 'row' }}>
        <FlexItem flex={{ default: 'flex_1' }}>
          <Text component={TextVariants.p}>{t('Number of logs over time')}</Text>
        </FlexItem>
        <FlexItem>
          <Tooltip
            content={arrowButtonTips()}
            trigger={tooltipsTrigger}
            isVisible={tooltipsTrigger === 'manual' ? false : undefined}
          >
            <Button
              data-test="histogram-double-left"
              icon={<AngleDoubleLeftIcon />}
              variant="plain"
              className={`metrics-content-button ${loading ? 'loading' : ''}`}
              onClick={() => moveRange(false)}
              ref={arrowRef}
            />
          </Tooltip>
          <Tooltip
            content={pageButtonTips()}
            trigger={tooltipsTrigger}
            isVisible={tooltipsTrigger === 'manual' ? false : undefined}
          >
            <Button
              data-test="histogram-single-left"
              icon={<AngleLeftIcon />}
              variant="plain"
              className={`metrics-content-button ${loading ? 'loading' : ''}`}
              onClick={() => moveHistogramRange(false)}
              ref={pageRef}
            />
          </Tooltip>
        </FlexItem>
        <FlexItem>
          <Text component={TextVariants.p}>{getDomainDisplayText(displayedRange || range || defaultRange)}</Text>
        </FlexItem>
        <FlexItem>
          <Tooltip
            content={pageButtonTips()}
            trigger={tooltipsTrigger}
            isVisible={tooltipsTrigger === 'manual' ? false : undefined}
          >
            <Button
              data-test="histogram-single-right"
              icon={<AngleRightIcon />}
              variant="plain"
              className={`metrics-content-button ${loading ? 'loading' : ''}`}
              onClick={() => moveHistogramRange(true)}
            />
          </Tooltip>
          <Tooltip
            content={arrowButtonTips()}
            trigger={tooltipsTrigger}
            isVisible={tooltipsTrigger === 'manual' ? false : undefined}
          >
            <Button
              data-test="histogram-double-right"
              icon={<AngleDoubleRightIcon />}
              variant="plain"
              className={`metrics-content-button ${loading ? 'loading' : ''}`}
              onClick={() => moveRange(true)}
            />
          </Tooltip>
        </FlexItem>
        <FlexItem flex={{ default: 'flex_1' }}>
          <Flex className="histogram-zoom-container" direction={{ default: 'row' }}>
            <FlexItem>
              <Tooltip
                content={zoomButtonTips()}
                trigger={tooltipsTrigger}
                isVisible={tooltipsTrigger === 'manual' ? false : undefined}
              >
                <Button
                  data-test="histogram-zoom-out"
                  icon={<SearchMinusIcon />}
                  variant="plain"
                  className={`metrics-content-button ${loading ? 'loading' : ''}`}
                  onClick={() => zoomRange(false)}
                  ref={zoomRef}
                />
              </Tooltip>
            </FlexItem>
            <FlexItem>
              <Tooltip
                content={zoomButtonTips()}
                trigger={tooltipsTrigger}
                isVisible={tooltipsTrigger === 'manual' ? false : undefined}
              >
                <Button
                  data-test="histogram-zoom-in"
                  icon={<SearchPlusIcon />}
                  variant="plain"
                  className={`metrics-content-button ${loading ? 'loading' : ''}`}
                  onClick={() => zoomRange(true)}
                />
              </Tooltip>
            </FlexItem>
          </Flex>
        </FlexItem>
        <FlexItem>
          <Button
            icon={<QuestionCircleIcon />}
            variant="plain"
            className={`metrics-content-button ${loading ? 'loading' : ''}`}
            onClick={() => guidedTourHandle?.startTour()}
          />
        </FlexItem>
      </Flex>
      <Chart
        themeColor={ChartThemeColor.multiUnordered}
        containerComponent={
          <VoronoiContainer
            brushDimension="x"
            onBrushDomainChange={(updated?: { x?: Array<Date | number> }) => {
              if (limit && updated?.x && updated.x.length && typeof updated.x[0] === 'object') {
                const start = getDateMsInSeconds(updated.x[0].getTime());
                const range = getHistogramRangeFromLimit(totalMetric, limit, start);

                if (range.from < range.to) {
                  updated.x = getDomainFromRange(range);
                  setDisplayedRange(range);
                }
              }
            }}
            onBrushDomainChangeEnd={(domain?: { x?: Array<Date | number> }) => {
              containerRef.current?.focus();
              if (
                domain?.x &&
                domain.x.length > 1 &&
                typeof domain.x[0] === 'object' &&
                typeof domain.x[1] === 'object'
              ) {
                const start = domain.x[0];
                const end = domain.x[1];

                if (start.getTime() < end.getTime()) {
                  setRange({ from: getDateMsInSeconds(start.getTime()), to: getDateMsInSeconds(end.getTime()) });
                }
              }
            }}
            handleComponent={<BrushHandleComponent isDark={isDark} />}
            defaultBrushArea="none"
            handleWidth={1}
            brushStyle={{ stroke: 'transparent', fill: 'black', fillOpacity: 0.1 }}
            brushDomain={{
              x: getDomainFromRange(range ? range : defaultRange)
            }}
          />
        }
        //TODO: fix refresh on selection change to enable animation
        //animate={true}
        scale={{ x: 'time', y: 'linear' }}
        width={dimensions.width}
        height={dimensions.height}
        padding={{
          top: 45,
          right: 25,
          bottom: 40,
          left: 60
        }}
      >
        <ChartAxis animate={animate} fixLabelOverlap />
        <ChartAxis
          animate={animate}
          dependentAxis
          showGrid
          fixLabelOverlap
          tickFormat={y => getFormattedValue(y, 'Flows', 'sum', t)}
        />
        <ChartStack>
          <ChartBar
            animate={animate}
            name={`bar-${id}`}
            key={`bar-${id}`}
            data={datapoints}
            barWidth={(dimensions.width / datapoints.length) * 0.8}
            alignment={'start'}
          />
        </ChartStack>
      </Chart>
    </div>
  );
};

export const HistogramContainer: React.FC<{
  id: string;
  loading: boolean;
  totalMetric: TopologyMetrics | undefined;
  limit: number;
  isDark: boolean;
  range?: TimeRange;
  guidedTourHandle: GuidedTourHandle | null;
  setRange: (tr: TimeRange) => void;
  moveRange: (next: boolean) => void;
  zoomRange: (zoom: boolean) => void;
  resetRange: () => void;
}> = ({
  id,
  loading,
  totalMetric,
  limit,
  isDark,
  range,
  guidedTourHandle,
  setRange,
  moveRange,
  zoomRange,
  resetRange
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');

  return totalMetric ? (
    <Histogram
      id={id}
      loading={loading}
      totalMetric={toNamedMetric(t, totalMetric, TruncateLength.OFF, false, false)}
      limit={limit}
      isDark={isDark}
      range={range}
      guidedTourHandle={guidedTourHandle}
      setRange={setRange}
      moveRange={moveRange}
      zoomRange={zoomRange}
    />
  ) : loading ? (
    <Bullseye data-test="loading-histogram">
      <Spinner size="xl" />
    </Bullseye>
  ) : (
    <Bullseye data-test="no-datapoints-found">
      <EmptyState variant={EmptyStateVariant.full} isFullHeight>
        <EmptyStateHeader titleText={t('No datapoints found in the selected time range')} headingLevel="h6" />
        <EmptyStateBody>{t('Reset time range and try again.')}</EmptyStateBody>
        <Button id="reset-timerange-button" data-test="reset-timerange-button" variant="link" onClick={resetRange}>
          {t('Reset time range')}
        </Button>
      </EmptyState>
    </Bullseye>
  );
};

export default HistogramContainer;
