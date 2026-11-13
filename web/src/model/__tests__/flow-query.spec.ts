import {
  aggregateByWithTlsVersion,
  isTimeMetric,
  isVolumeMetric,
  showTLSHints,
  topologyTlsVersionAggregateSuffix
} from '../flow-query';

describe('isTimeMetric', () => {
  it('should be true for DNS latency and RTT', () => {
    expect(isTimeMetric('DnsLatencyMs')).toBe(true);
    expect(isTimeMetric('TimeFlowRttNs')).toBe(true);
  });

  it('should be false for volume metrics', () => {
    expect(isTimeMetric('Bytes')).toBe(false);
    expect(isTimeMetric('Packets')).toBe(false);
  });

  it('should be false when undefined', () => {
    expect(isTimeMetric(undefined)).toBe(false);
  });
});

describe('aggregateByWithTlsVersion', () => {
  it('should append the TLS version dimension suffix', () => {
    expect(topologyTlsVersionAggregateSuffix).toBe('__TLSVersion');
    expect(aggregateByWithTlsVersion('owner')).toBe('owner__TLSVersion');
  });
});

describe('isVolumeMetric', () => {
  it('should be true for volume metrics', () => {
    expect(isVolumeMetric('Bytes')).toBe(true);
    expect(isVolumeMetric('Packets')).toBe(true);
    expect(isVolumeMetric('PktDropBytes')).toBe(true);
    expect(isVolumeMetric('PktDropPackets')).toBe(true);
  });

  it('should be false for DNS, RTT, and undefined', () => {
    expect(isVolumeMetric('DnsLatencyMs')).toBe(false);
    expect(isVolumeMetric('TimeFlowRttNs')).toBe(false);
    expect(isVolumeMetric(undefined)).toBe(false);
  });
});

describe('showTLSHints', () => {
  it('should match volume metrics', () => {
    expect(showTLSHints('Bytes')).toBe(true);
    expect(showTLSHints('DnsLatencyMs')).toBe(false);
  });
});
