import { buildMonitoringQueryBrowserPath, inferMonitoringQueryUnits } from '../promql-query-browser';

describe('inferMonitoringQueryUnits', () => {
  it('uses bps for byte rates', () => {
    expect(inferMonitoringQueryUnits('rate(netobserv_workload_egress_bytes_total[5m])')).toBe('bps');
  });

  it('uses bytes for absolute byte metrics', () => {
    expect(inferMonitoringQueryUnits('netobserv_workload_egress_bytes_total')).toBe('bytes');
  });

  it('uses pps for packet rates', () => {
    expect(inferMonitoringQueryUnits('sum(rate(netobserv_namespace_drop_packets_total[5m]))')).toBe('pps');
  });

  it('uses percentunit for scaled ratios even when metrics are bytes', () => {
    const expr = `(100 *
  (sum(rate(netobserv_namespace_egress_bytes_total[30m])) by (SrcK8S_Namespace) > 1000)
  - sum(rate(netobserv_namespace_egress_bytes_total[30m] offset 1d)) by (SrcK8S_Namespace)
) / sum(rate(netobserv_namespace_egress_bytes_total[30m] offset 1d)) by (SrcK8S_Namespace)`;
    expect(inferMonitoringQueryUnits(expr)).toBe('percentunit');
  });

  it('does not treat bare 100 * byte rates as percentunit', () => {
    expect(inferMonitoringQueryUnits('100 * rate(metric_bytes_total[5m])')).toBe('bps');
  });

  it('returns undefined when unit cannot be inferred', () => {
    expect(inferMonitoringQueryUnits('up == 0')).toBeUndefined();
  });
});

describe('buildMonitoringQueryBrowserPath', () => {
  it('encodes PromQL into OpenShift query-browser URL with bps', () => {
    const expr = `sum by (SrcK8S_Namespace, DstK8S_Namespace) (
  rate(netobserv_workload_egress_bytes_total{SrcK8S_Namespace!="", DstK8S_Namespace!=""}[5m])
)`;
    const path = buildMonitoringQueryBrowserPath(expr);
    expect(path.startsWith('/monitoring/query-browser?')).toBe(true);
    expect(path).toContain('units=bps');
    const params = new URLSearchParams(path.slice(path.indexOf('?')));
    expect(params.get('query0')).toBe(expr.trim());
  });

  it('omits units when not inferred', () => {
    const path = buildMonitoringQueryBrowserPath('up == 0');
    expect(path).not.toContain('units=');
    expect(new URLSearchParams(path.slice(path.indexOf('?'))).get('query0')).toBe('up == 0');
  });
});
