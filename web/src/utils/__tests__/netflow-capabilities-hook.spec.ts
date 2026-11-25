import { ViewId } from '../../components/netflow-traffic';
import { Config } from '../../model/config';

/**
 * Pure helpers mirroring useConfigCapabilities boolean rules for unit testing
 * without mounting the full React hook (which needs translation + config deps).
 */
function computeAllowFlags(config: Pick<Config, 'dataSources'>, selectedViewId: ViewId) {
  const allowLoki = config.dataSources.some(ds => ds === 'loki');
  const allowProm = config.dataSources.some(ds => ds === 'prom') && selectedViewId !== 'table';
  const allowMetrics = config.dataSources.some(ds => ds === 'prom' || ds === 'loki');
  const allowRawFlows = config.dataSources.some(ds => ds === 'loki');
  return { allowLoki, allowProm, allowMetrics, allowRawFlows };
}

describe('netflow capabilities — S3 vs metrics', () => {
  it('allows metrics when Prometheus is configured', () => {
    const caps = computeAllowFlags({ dataSources: ['prom'] }, 'table');
    expect(caps.allowMetrics).toBe(true);
    expect(caps.allowProm).toBe(false); // Prom disabled on Traffic flows
  });

  it('allows metrics when only Loki is configured', () => {
    const caps = computeAllowFlags({ dataSources: ['loki'] }, 'overview');
    expect(caps.allowMetrics).toBe(true);
  });
});
