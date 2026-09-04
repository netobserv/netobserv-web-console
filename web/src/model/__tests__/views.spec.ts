import { getPanelFeature } from '../../utils/overview-panels';
import { Feature } from '../config';
import { getAvailableViews, getViewPreset, ViewPresetId, viewPresets } from '../views';

describe('viewPresets', () => {
  it('always includes "all" as first preset', () => {
    expect(viewPresets[0].id).toBe('all');
  });

  it('"all" preset has no requiredFeature', () => {
    const allPreset = viewPresets.find(v => v.id === 'all');
    expect(allPreset?.requiredFeature).toBeUndefined();
  });

  it('feature presets have requiredFeature set', () => {
    const featurePresets = viewPresets.filter(v => v.id !== 'all');
    featurePresets.forEach(p => {
      expect(p.requiredFeature).toBeDefined();
    });
  });
});

describe('getAvailableViews', () => {
  it('returns only "all" when no features enabled', () => {
    const views = getAvailableViews([]);
    expect(views).toHaveLength(1);
    expect(views[0].id).toBe('all');
  });

  it('includes pktdrop view when pktDrop feature enabled', () => {
    const views = getAvailableViews(['pktDrop'] as Feature[]);
    const ids = views.map(v => v.id);
    expect(ids).toContain('all');
    expect(ids).toContain('pktdrop');
  });

  it('includes dns view when dnsTracking feature enabled', () => {
    const views = getAvailableViews(['dnsTracking'] as Feature[]);
    const ids = views.map(v => v.id);
    expect(ids).toContain('dns');
  });

  it('includes rtt view when flowRTT feature enabled', () => {
    const views = getAvailableViews(['flowRTT'] as Feature[]);
    const ids = views.map(v => v.id);
    expect(ids).toContain('rtt');
  });

  it('includes tls view when tlsTracking feature enabled', () => {
    const views = getAvailableViews(['tlsTracking'] as Feature[]);
    const ids = views.map(v => v.id);
    expect(ids).toContain('tls');
  });

  it('includes udn view when udnMapping feature enabled', () => {
    const views = getAvailableViews(['udnMapping'] as Feature[]);
    const ids = views.map(v => v.id);
    expect(ids).toContain('udn');
  });

  it('includes networkEvents view when networkEvents feature enabled', () => {
    const views = getAvailableViews(['networkEvents'] as Feature[]);
    const ids = views.map(v => v.id);
    expect(ids).toContain('networkEvents');
  });

  it('includes packetTranslation view when packetTranslation feature enabled', () => {
    const views = getAvailableViews(['packetTranslation'] as Feature[]);
    const ids = views.map(v => v.id);
    expect(ids).toContain('packetTranslation');
  });

  it('includes multiple views when multiple features enabled', () => {
    const views = getAvailableViews(['pktDrop', 'dnsTracking', 'flowRTT'] as Feature[]);
    const ids = views.map(v => v.id);
    expect(ids).toContain('all');
    expect(ids).toContain('pktdrop');
    expect(ids).toContain('dns');
    expect(ids).toContain('rtt');
    expect(ids).not.toContain('tls');
  });
});

describe('getViewPreset', () => {
  it('returns preset for known id', () => {
    const preset = getViewPreset('dns');
    expect(preset).toBeDefined();
    expect(preset?.id).toBe('dns');
    expect(preset?.topologyMetricType).toBe('DnsLatencyMs');
  });

  it('returns undefined for unknown id', () => {
    const preset = getViewPreset('unknown' as ViewPresetId);
    expect(preset).toBeUndefined();
  });

  it('"all" preset has no panels or columns (uses localStorage defaults)', () => {
    const preset = getViewPreset('all');
    expect(preset?.panels).toBeUndefined();
    expect(preset?.columns).toBeUndefined();
  });

  it('pktdrop preset has topologyMetricType set', () => {
    const preset = getViewPreset('pktdrop');
    expect(preset?.topologyMetricType).toBe('PktDropPackets');
  });
});

describe('getPanelFeature', () => {
  it('returns pktDrop for dropped panels', () => {
    expect(getPanelFeature('top_avg_dropped_byte_rates')).toBe('pktDrop');
    expect(getPanelFeature('state_dropped_packet_rates')).toBe('pktDrop');
  });

  it('returns dnsTracking for DNS panels', () => {
    expect(getPanelFeature('top_avg_dns_latency')).toBe('dnsTracking');
    expect(getPanelFeature('name_dns_latency_flows')).toBe('dnsTracking');
  });

  it('returns flowRTT for RTT panels', () => {
    expect(getPanelFeature('top_avg_rtt')).toBe('flowRTT');
    expect(getPanelFeature('bottom_min_rtt')).toBe('flowRTT');
  });

  it('returns tlsTracking for TLS panels', () => {
    expect(getPanelFeature('tls_usage_global')).toBe('tlsTracking');
    expect(getPanelFeature('tls_per_version')).toBe('tlsTracking');
  });

  it('returns undefined for generic panels', () => {
    expect(getPanelFeature('overview')).toBeUndefined();
    expect(getPanelFeature('top_sankey')).toBeUndefined();
    expect(getPanelFeature('byte_rates')).toBeUndefined();
  });
});
