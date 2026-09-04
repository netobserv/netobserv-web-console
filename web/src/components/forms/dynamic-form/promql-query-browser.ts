/**
 * Infer OpenShift Metrics query-browser `units` from PromQL shape.
 * Order matters: percentage ratios can mention byte/packet metrics and must win.
 */
export const inferMonitoringQueryUnits = (query: string): string | undefined => {
  const q = query.trim();

  // 0–1 or 0–100 style ratios (health checks often use `100 * a / b`)
  if ((/\b100\s*\*|\*\s*100\b/i.test(q) && /\//.test(q)) || /percent/i.test(q)) {
    return 'percentunit';
  }

  const hasRate = /\b(i?rate)\s*\(/i.test(q);
  const hasBytes = /bytes(_total)?|_bytes\b/i.test(q);
  const hasPackets = /packets(_total)?|_packets\b/i.test(q);

  if (hasPackets && hasRate) {
    return 'pps';
  }
  if (hasBytes && hasRate) {
    return 'bps';
  }
  if (hasBytes) {
    return 'bytes';
  }
  return undefined;
};

/**
 * OpenShift Console Metrics → Observe → Metrics (query browser) deep link.
 */
export const buildMonitoringQueryBrowserPath = (query: string): string => {
  const trimmed = query.trim();
  const params = new URLSearchParams();
  const units = inferMonitoringQueryUnits(trimmed);
  if (units) {
    params.set('units', units);
  }
  params.set('query0', trimmed);
  return `/monitoring/query-browser?${params.toString()}`;
};
