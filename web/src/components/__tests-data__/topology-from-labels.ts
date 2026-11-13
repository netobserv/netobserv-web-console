import { TopologyMetrics } from '../../api/query-response';
import { FlowScope } from '../../model/flow-query';
import { computeStepInterval, TimeRange } from '../../utils/datetime';
import { computeStats, createPeer } from '../../utils/metrics';

type MetricLabels = Record<string, string | undefined>;

const nameAndType = (name?: string, type?: string) => (name && type ? { name, type } : undefined);

const fillMissingZeros = (values: [number, number][], start: number, end: number, step: number): [number, number][] => {
  const filled = values.map(([t, v]) => [t, Number.isNaN(v) ? 0 : v] as [number, number]);
  const tolerance = step / 2;
  for (let current = start; current < end; current += step) {
    if (!filled.some(dp => dp[0] > current - tolerance && dp[0] < current + tolerance)) {
      filled.push([current, 0]);
    }
  }
  return filled.sort((a, b) => a[0] - b[0]);
};

/** Build a TopologyMetrics row for unit fixtures (peers + stats; optional range zero-fill). */
export const topologyFromLabels = (
  labels: MetricLabels,
  values: [number, string | number][],
  scope: FlowScope = 'resource',
  range?: TimeRange
): TopologyMetrics => {
  let numeric = values.map(([t, v]) => [Number(t), Number(v)] as [number, number]);
  if (range) {
    const { stepSeconds } = computeStepInterval(range);
    const first = numeric.length ? Math.min(...numeric.map(dp => dp[0])) : range.from;
    let start = first;
    while (start > range.from) {
      start -= stepSeconds;
    }
    let end = range.to;
    if (numeric.length) {
      end = Math.max(end, Math.max(...numeric.map(dp => dp[0])));
    }
    numeric = fillMissingZeros(numeric, start, end, stepSeconds);
  }
  return {
    source: createPeer({
      addr: labels.SrcAddr,
      resource: nameAndType(labels.SrcK8S_Name, labels.SrcK8S_Type),
      owner:
        labels.SrcK8S_Type !== labels.SrcK8S_OwnerType
          ? nameAndType(labels.SrcK8S_OwnerName, labels.SrcK8S_OwnerType)
          : undefined,
      namespace: labels.SrcK8S_Namespace,
      host: labels.SrcK8S_HostName,
      subnetLabel: labels.SrcSubnetLabel
    }),
    destination: createPeer({
      addr: labels.DstAddr,
      resource: nameAndType(labels.DstK8S_Name, labels.DstK8S_Type),
      owner:
        labels.DstK8S_Type !== labels.DstK8S_OwnerType
          ? nameAndType(labels.DstK8S_OwnerName, labels.DstK8S_OwnerType)
          : undefined,
      namespace: labels.DstK8S_Namespace,
      host: labels.DstK8S_HostName,
      subnetLabel: labels.DstSubnetLabel
    }),
    values: numeric,
    stats: computeStats(numeric),
    scope
  };
};
