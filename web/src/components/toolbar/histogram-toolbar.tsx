import { Toolbar, ToolbarItem } from '@patternfly/react-core';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TopologyMetrics } from '../../api/query-response';
import { getTimeRangeOptions, TimeRange } from '../../utils/datetime';
import { formatDuration, getDateMsInSeconds, getDateSInMiliseconds, parseDuration } from '../../utils/duration';
import { defaultTimeRange } from '../../utils/router';
import { useTheme } from '../../utils/theme-hook';
import { GuidedTourHandle } from '../guided-tour/guided-tour';
import HistogramContainer from '../metrics/histogram';

export interface HistogramToolbarProps {
  loading: boolean;
  lastRefresh: Date | undefined;
  totalMetric: TopologyMetrics | undefined;
  limit: number;
  range: TimeRange | number;
  guidedTourHandle: GuidedTourHandle | null;
  setRange: (tr: TimeRange | number) => void;
  histogramRange?: TimeRange;
  loadedRange?: TimeRange;
  setHistogramRange: (tr: TimeRange) => void;
  resetRange: () => void;
  tick: () => void;
}

export const getZoomedTimeRange = (range: TimeRange, zoomIn: boolean, now: number): TimeRange | undefined => {
  const duration = range.to - range.from;
  if (zoomIn) {
    const step = Math.floor(duration / 4);
    if (step <= 0) {
      return undefined;
    }
    const updatedRange = { from: range.from + step, to: range.to - step };
    return updatedRange.to - updatedRange.from >= defaultTimeRange ? updatedRange : undefined;
  }

  const step = Math.floor(duration / 2);
  if (duration >= defaultTimeRange) {
    return {
      from: range.from - step,
      // Zooming out keeps the complete displayed interval, even if its end
      // is later than the most recent refresh time.
      to: Math.min(range.to + step, Math.max(getDateMsInSeconds(now), range.to))
    };
  }

  const targetDuration = defaultTimeRange;
  // Keep the displayed interval intact, even when its end is later than the
  // most recent refresh time. Clamp short intervals to the default duration.
  const to = Math.min(
    range.to + Math.ceil((targetDuration - duration) / 2),
    Math.max(getDateMsInSeconds(now), range.to)
  );
  return { from: to - targetDuration, to };
};

export const HistogramToolbar: React.FC<HistogramToolbarProps> = props => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const isDarkTheme = useTheme();

  const moveRange = React.useCallback(
    (next: boolean) => {
      const now = props.lastRefresh ? props.lastRefresh.getTime() : new Date().getTime();

      if (typeof props.range === 'number') {
        if (next) {
          //call refresh as we can't move in the future
          props.tick();
        } else {
          props.setRange({
            from: getDateMsInSeconds(now) - 2 * props.range,
            to: getDateMsInSeconds(now) - props.range
          });
        }
      } else {
        const updatedRange = { ...props.range };
        const factor = (next ? 1 : -1) * (props.range.to - props.range.from);

        updatedRange.from += factor;
        updatedRange.to += factor;

        if (getDateSInMiliseconds(updatedRange.to) > now) {
          updatedRange.to = getDateMsInSeconds(now);
        }

        if (updatedRange.to - updatedRange.from < defaultTimeRange) {
          props.setRange(defaultTimeRange);
        } else {
          props.setRange(updatedRange);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.lastRefresh, props.range, props.tick]
  );

  const zoomRange = React.useCallback(
    (zoomIn: boolean) => {
      const timeRangeOptions = getTimeRangeOptions(t, false);
      const keys = Object.keys(timeRangeOptions);
      const displayedRange = props.loadedRange ?? props.range;

      if (typeof displayedRange === 'number') {
        const selectedKey = formatDuration(getDateSInMiliseconds(displayedRange));
        let index = keys.indexOf(selectedKey);
        if (zoomIn && index > 0) {
          index--;
        } else if (!zoomIn && index < keys.length) {
          index++;
        }

        props.setRange(getDateMsInSeconds(parseDuration(keys[index])));
      } else {
        const now = props.lastRefresh ? props.lastRefresh.getTime() : new Date().getTime();
        const updatedRange = getZoomedTimeRange(displayedRange, zoomIn, now);
        if (updatedRange) {
          props.setRange(updatedRange);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.lastRefresh, props.loadedRange, props.range]
  );

  return (
    <Toolbar data-test-id="histogram-toolbar" id="histogram-toolbar" isFullHeight className={isDarkTheme ? 'dark' : ''}>
      <ToolbarItem className="histogram">
        <HistogramContainer
          id={'histogram'}
          loading={props.loading}
          totalMetric={props.totalMetric}
          limit={props.limit}
          isDark={isDarkTheme}
          range={props.histogramRange}
          loadedRange={props.loadedRange}
          guidedTourHandle={props.guidedTourHandle}
          setRange={props.setHistogramRange}
          moveRange={moveRange}
          zoomRange={zoomRange}
          resetRange={props.resetRange}
        />
      </ToolbarItem>
    </Toolbar>
  );
};

export default HistogramToolbar;
