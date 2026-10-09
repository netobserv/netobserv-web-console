import { formatDuration, formatDurationAboveMillisecond, parseDuration } from '../duration';

describe('duration', () => {
  it('should format duration', () => {
    expect(formatDuration(1000)).toBe('1s');
    expect(formatDuration(1500)).toBe('1s');
    expect(formatDuration(1800)).toBe('1s');
    expect(formatDuration(180000)).toBe('3m');
    expect(formatDuration(200000)).toBe('3m 20s');
  });

  it('should not format too small duration', () => {
    expect(formatDuration(50)).toBe('');
    expect(formatDuration(500)).toBe('');
    expect(formatDuration(900)).toBe('');
  });

  it('should format duration above millisecond with precision', () => {
    expect(formatDurationAboveMillisecond(50)).toBe('50ms');
    expect(formatDurationAboveMillisecond(500)).toBe('500ms');
    expect(formatDurationAboveMillisecond(900)).toBe('900ms');
    expect(formatDurationAboveMillisecond(1000)).toBe('1s');
    expect(formatDurationAboveMillisecond(1500)).toBe('1.5s');
    expect(formatDurationAboveMillisecond(1800)).toBe('1.8s');
    expect(formatDurationAboveMillisecond(2345)).toBe('2.35s');
    expect(formatDurationAboveMillisecond(45230)).toBe('45.23s');
    expect(formatDurationAboveMillisecond(59999)).toBe('60s');
  });

  it('should format duration above 60s without decimal precision', () => {
    expect(formatDurationAboveMillisecond(60000)).toBe('1m');
    expect(formatDurationAboveMillisecond(180000)).toBe('3m');
    expect(formatDurationAboveMillisecond(200000)).toBe('3m 20s');
  });

  it('should parse durations', () => {
    expect(parseDuration('1s')).toBe(1000);
    expect(parseDuration('3d1s')).toBe(259201000);
    expect(parseDuration('1w 1d 1h 1m 1s')).toBe(694861000);
    expect(parseDuration('  15s ')).toBe(15000);
  });

  it('should fail to parse durations', () => {
    expect(() => parseDuration('oops')).toThrow('invalid duration: oops');
    expect(() => parseDuration('3.15s')).toThrow('invalid duration: 3.15s');
    expect(() => parseDuration('')).toThrow('invalid duration: ');
    expect(() => parseDuration('3d foo 1s')).toThrow('invalid duration: 3d foo 1s');
  });
});
