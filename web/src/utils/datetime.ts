import { TFunction } from 'i18next';
import { customTimeRangeKey } from '../components/dropdowns/time-range-dropdown';
import { getLanguage } from './language';

const zeroPad = (number: number) => (number < 10 ? `0${number}` : number);

// Get YYYY-MM-DD date string for a date object
export const toISODateString = (date: Date): string =>
  `${date.getFullYear()}-${zeroPad(date.getMonth() + 1)}-${zeroPad(date.getDate())}`;

export const twentyFourHourTime = (date: Date, showSeconds?: boolean): string => {
  const hours = zeroPad(date.getHours() ?? 0);
  const minutes = `:${zeroPad(date.getMinutes() ?? 0)}`;
  const seconds = showSeconds ? `:${zeroPad(date.getSeconds() ?? 0)}` : '';
  return `${hours}${minutes}${seconds}`;
};

export const getDateFromUnix = (v: number) => {
  return new Date(v * 1000);
};

export interface TimeRange {
  from: number;
  to: number;
}

export const getTimeRangeOptions = (t: TFunction, includeCustom = true) => {
  const timeOptions = {
    '5m': t('Last 5 minutes'),
    '15m': t('Last 15 minutes'),
    '30m': t('Last 30 minutes'),
    '1h': t('Last 1 hour'),
    '2h': t('Last 2 hours'),
    '6h': t('Last 6 hours'),
    '12h': t('Last 12 hours'),
    '1d': t('Last 1 day'),
    '2d': t('Last 2 days'),
    '1w': t('Last 1 week'),
    '2w': t('Last 2 weeks')
  };

  if (includeCustom) {
    return {
      [customTimeRangeKey]: t('Custom time range'),
      ...timeOptions
    };
  } else {
    return timeOptions;
  }
};

export const dateFormatter = new Intl.DateTimeFormat(getLanguage(), {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
});

export const timeFormatter = new Intl.DateTimeFormat(getLanguage(), {
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric'
});

export const timeMSFormatter = new Intl.DateTimeFormat(getLanguage(), {
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  fractionalSecondDigits: 3
});

export const dateTimeFormatter = new Intl.DateTimeFormat(getLanguage(), {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  year: 'numeric'
});

export const utcDateTimeFormatter = new Intl.DateTimeFormat(getLanguage(), {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  fractionalSecondDigits: 3,
  year: 'numeric',
  timeZone: 'UTC',
  timeZoneName: 'short'
});

export const getFormattedDate = (date: Date, format = dateTimeFormatter) => {
  return format.format(date);
};

export const rangeToSeconds = (range: TimeRange | number): number => {
  if (typeof range === 'number') {
    return range;
  }
  return range.to - range.from;
};

export const computeStepInterval = (range: TimeRange | number) => {
  const seconds = rangeToSeconds(range);
  let interval = Math.floor(seconds / 10);
  if (interval < 30) {
    interval = 30;
  }
  const step = Math.floor(interval / 2);
  return {
    rateIntervalSeconds: interval,
    stepSeconds: step
  };
};

/**
 * Formats a timestamp for "Active since" display with relative or absolute time.
 * - Today: Shows only time (14:23)
 * - Yesterday: Shows "Yesterday, HH:MM"
 * - Last 7 days: Shows day of week and time (Tue, 14:23)
 * - Older: Shows full date and time (2025-11-24 14:23)
 */
export const formatActiveSince = (t: TFunction, timestamp: string): string => {
  const activeDate = new Date(timestamp);
  const now = new Date();

  // Calculate time difference in milliseconds
  const diffMs = now.getTime() - activeDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Format time as HH:MM
  const timeStr = twentyFourHourTime(activeDate, false);

  // Today: show only time
  if (diffDays === 0 && now.getDate() === activeDate.getDate()) {
    return timeStr;
  }

  // Yesterday: show "Yesterday, HH:MM"
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    activeDate.getDate() === yesterday.getDate() &&
    activeDate.getMonth() === yesterday.getMonth() &&
    activeDate.getFullYear() === yesterday.getFullYear()
  ) {
    return `${t('Yesterday')}, ${timeStr}`;
  }

  // Last 7 days: show day of week and time
  if (diffDays < 7) {
    const weekdayFormatter = new Intl.DateTimeFormat(getLanguage(), { weekday: 'short' });
    const weekday = weekdayFormatter.format(activeDate);
    return `${weekday}, ${timeStr}`;
  }

  // Older: show full date and time (YYYY-MM-DD HH:MM)
  return `${toISODateString(activeDate)} ${timeStr}`;
};
