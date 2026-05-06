import { TFunction } from 'i18next';
import { AggregateBy, MetricFunction, MetricType, StatFunction } from '../model/flow-query';
import { Feature, isAllowed } from './features-gate';

export const dnsIdMatcher = 'dns_latency';
export const rttIdMatcher = 'rtt';
export const droppedIdMatcher = 'dropped';
export const tlsIdMatcher = 'tls_';
export const customPanelMatcher = 'custom';

export const getRateFunctionFromId = (id: string) => {
  return id.endsWith('byte_rates') ? 'bytes' : 'packets';
};

export const getFunctionFromId = (id: string) => {
  return id.includes('_min_')
    ? 'min'
    : id.includes('_max_')
    ? 'max'
    : id.includes('_p90_')
    ? 'p90'
    : id.includes('_p99_')
    ? 'p99'
    : 'avg';
};

export type OverviewPanelRateMetric = 'byte_rates' | 'packet_rates' | 'dropped_byte_rates' | 'dropped_packet_rates';
export type OverviewPanelLatencyMetric = 'dns_latency' | 'rtt';
export type OverviewPanelTopLatencyFunction = 'avg' | 'max' | 'p90' | 'p99';
export type OverviewPanelBottomLatencyFunction = 'min';
export type OverviewPanelFunction = OverviewPanelTopLatencyFunction | OverviewPanelBottomLatencyFunction;
export type OverviewPanelMetric = OverviewPanelRateMetric | OverviewPanelLatencyMetric;

export type OverviewPanelId =
  | 'overview'
  | 'top_sankey'
  | 'inbound_region'
  | `top_avg_${OverviewPanelRateMetric}`
  | `top_${OverviewPanelTopLatencyFunction}_${OverviewPanelLatencyMetric}`
  | `bottom_${OverviewPanelBottomLatencyFunction}_${OverviewPanelLatencyMetric}`
  | `${OverviewPanelRateMetric}`
  | `state_dropped_packet_rates`
  | `cause_dropped_packet_rates`
  | 'name_dns_latency_flows'
  | 'rcode_dns_latency_flows'
  | 'tls_usage_global'
  | 'tls_per_cipher_suite'
  | 'tls_per_version'
  | 'tls_per_group'
  | `custom_${StatFunction}_${AggregateBy}_${MetricType}`
  | `custom_${AggregateBy}_${MetricType}`
  | `custom_${MetricType}`;

export type OverviewPanel = {
  id: OverviewPanelId;
  isSelected: boolean;
};

export type OverviewPanelInfo = {
  title: string;
  topTitle?: string;
  totalTitle?: string;
  subtitle?: string;
  chartType?: string;
  tooltip?: string;
};

export const defaultPanelIds: OverviewPanelId[] = [
  'overview',
  'top_sankey',
  'inbound_region',
  'top_avg_byte_rates',
  'byte_rates',
  'top_avg_dropped_packet_rates',
  'dropped_packet_rates',
  'state_dropped_packet_rates',
  'cause_dropped_packet_rates',
  'top_avg_dns_latency',
  'top_p90_dns_latency',
  'name_dns_latency_flows',
  'rcode_dns_latency_flows',
  'bottom_min_rtt', // should remove from defaults?
  'top_avg_rtt',
  'top_p90_rtt',
  'tls_usage_global',
  'tls_per_version'
];

export const getDefaultOverviewPanels = (customIds?: string[]): OverviewPanel[] => {
  let ids: OverviewPanelId[] = ['tls_usage_global', 'tls_per_version', 'tls_per_group', 'tls_per_cipher_suite'];

  /* list of panels and default selection behavior
   *  isSelected can safely be used on feature related panels
   *  as these will be filtered on top anyways
   */
  if (isAllowed(Feature.Overview)) {
    ids = ids.concat(['overview', 'top_sankey', 'inbound_region']);
  }

  const metrics: OverviewPanelMetric[] = [
    'byte_rates',
    'packet_rates',
    'dropped_byte_rates',
    'dropped_packet_rates',
    'dns_latency',
    'rtt'
  ];
  const functions: OverviewPanelFunction[] = ['avg', 'min', 'max', 'p90', 'p99'];
  metrics.forEach((m: OverviewPanelMetric) => {
    // specific graph per feature
    switch (m) {
      case 'dropped_byte_rates':
        ids = ids.concat(['state_dropped_packet_rates', 'cause_dropped_packet_rates']);
        break;
      case 'dns_latency':
        ids = ids.concat(['name_dns_latency_flows', 'rcode_dns_latency_flows']);
        break;
    }

    if (['byte_rates', 'packet_rates', 'dropped_byte_rates', 'dropped_packet_rates'].includes(m)) {
      // rates
      ids.push(`top_avg_${m as OverviewPanelRateMetric}`);
      ids.push(m as OverviewPanelRateMetric);
    } else if (['dns_latency', 'rtt'].includes(m))
      // latency metrics functions
      functions.forEach((fn: OverviewPanelFunction) => {
        if (['avg', 'max', 'p90', 'p99'].includes(fn)) {
          ids.push(`top_${fn as OverviewPanelTopLatencyFunction}_${m as OverviewPanelLatencyMetric}`);
        } else {
          ids.push(`bottom_${fn as OverviewPanelBottomLatencyFunction}_${m as OverviewPanelLatencyMetric}`);
        }
      });
  });

  if (customIds) {
    ids = ids.concat(customIds.map(id => `${customPanelMatcher}_${id}` as OverviewPanelId));
  }

  return ids.map(id => {
    return { id, isSelected: defaultPanelIds.includes(id) };
  });
};

export const parseCustomMetricId = (id: string) => {
  const idParts = id.split('_');
  if (idParts.length === 0 || idParts[0] !== customPanelMatcher) {
    console.error('parseCustomMetricId called on non custom metric', id);
  }

  let isValid = true;
  let fn: MetricFunction | undefined = undefined;
  let aggregateBy: AggregateBy | undefined = undefined;
  let type: MetricType | undefined = undefined;

  if (idParts.length === 4) {
    fn = idParts[1] as MetricFunction;
    aggregateBy = idParts[2] as AggregateBy;
    type = idParts[3] as MetricType;
  } else if (idParts.length === 3) {
    aggregateBy = idParts[1] as AggregateBy;
    type = idParts[2] as MetricType;
  } else if (idParts.length === 2) {
    type = idParts[1] as MetricType;
  } else {
    isValid = false;
    console.error('invalid custom panel id', id);
  }

  if (!fn) {
    switch (type) {
      case 'Flows':
      case 'DnsFlows':
      case 'TlsFlows':
        fn = 'count';
        break;
      case 'Bytes':
      case 'Packets':
      case 'PktDropBytes':
      case 'PktDropPackets':
        fn = 'rate';
        break;
    }
  }

  return {
    isValid,
    fn,
    aggregateBy,
    type
  };
};

export const getOverviewPanelInfo = (
  t: TFunction,
  id: OverviewPanelId,
  limit: string | number = 'X',
  type: string
): OverviewPanelInfo => {
  const metricFunction = id.includes('min_')
    ? t('minimum')
    : id.includes('max_')
    ? t('maximum')
    : id.includes('p90_')
    ? t('90th percentile')
    : id.includes('p99_')
    ? t('99th percentile')
    : t('average');

  const metricFunctionCaptitalized = metricFunction.charAt(0).toUpperCase() + metricFunction.slice(1);

  switch (id) {
    case 'overview':
      return { title: t('Network overview') };
    case 'top_sankey':
      return { title: t('Top {{limit}} {{type}} distribution', { limit, type }) };
    case 'inbound_region':
      return { title: t('Inbound {{type}} by region', { type }) };
    case 'top_avg_byte_rates':
    case 'top_avg_packet_rates': {
      const bytesOrPackets = id === 'top_avg_byte_rates' ? t('bytes rates') : t('packets rates');
      return {
        title: `${t('Top')} ${limit} ${metricFunction} ${bytesOrPackets}`,
        subtitle: `${metricFunctionCaptitalized} ${t('rate')}`,
        chartType: t('donut'),
        tooltip: t('The {{function}} {{metric}} over the selected interval', {
          function: metricFunction,
          metric: bytesOrPackets
        })
      };
    }
    case 'byte_rates':
    case 'packet_rates':
      const totalBytesOrPackets = id === 'byte_rates' ? t('bytes rates') : t('packets rates');
      return {
        title: t('Top {{limit}} {{metric}} stacked with total', { limit, metric: totalBytesOrPackets }),
        topTitle: t('Top {{limit}} {{metric}}', { limit, metric: totalBytesOrPackets }),
        totalTitle: t('Total {{metric}}', { metric: totalBytesOrPackets }),
        subtitle: t('{{function}} rate', {
          function: metricFunctionCaptitalized
        }),
        chartType: t('bars and lines'),
        tooltip: t('The top {{metric}} compared to total over the selected interval', {
          metric: totalBytesOrPackets
        })
      };
    case 'top_avg_dropped_byte_rates':
    case 'top_avg_dropped_packet_rates': {
      const bytesOrPackets =
        id === 'top_avg_dropped_byte_rates' ? t('dropped bytes rates') : t('dropped packets rates');
      return {
        title: `${t('Top')} ${limit} ${metricFunction} ${bytesOrPackets}`,
        subtitle: `${metricFunctionCaptitalized} ${t('rate')}`,
        chartType: t('donut'),
        tooltip: t('The {{function}} {{metric}} (dropped by the kernel) over the selected interval', {
          function: metricFunction,
          metric: bytesOrPackets
        })
      };
    }
    case 'dropped_byte_rates':
    case 'dropped_packet_rates':
      const bytesOrPackets = id === 'dropped_byte_rates' ? t('dropped bytes rates') : t('dropped packets rates');
      return {
        title: t('Top {{limit}} {{metric}} stacked with total', { limit, metric: bytesOrPackets }),
        topTitle: t('Top {{limit}} {{metric}}', { limit, metric: bytesOrPackets }),
        totalTitle: t('Total {{metric}}', { metric: bytesOrPackets }),
        subtitle: t('{{function}} rate', {
          function: metricFunctionCaptitalized
        }),
        chartType: t('bars and lines'),
        tooltip: t('The top {{metric}} (dropped by the kernel) compared to total over the selected interval', {
          metric: bytesOrPackets
        })
      };
    case 'state_dropped_packet_rates':
    case 'cause_dropped_packet_rates': {
      const stateOrCause = id === 'state_dropped_packet_rates' ? t('state') : t('cause');
      const stateOrCausePlural = id === 'state_dropped_packet_rates' ? t('states') : t('causes');
      return {
        title: t('Top {{limit}} packet dropped {{type}} stacked with total', { limit, type: stateOrCause }),
        topTitle: t('Top {{limit}} packet dropped {{type}}', { limit, type: stateOrCause }),
        totalTitle: t('Total packet dropped'),
        subtitle: t('Average rate'),
        chartType: t('donut or bars and lines'),
        tooltip: t(
          'The top packet dropped {{types}} (dropped by the kernel) compared total over the selected interval',
          { types: stateOrCausePlural }
        )
      };
    }
    case 'top_avg_dns_latency':
    case 'top_max_dns_latency':
    case 'top_p90_dns_latency':
    case 'top_p99_dns_latency':
    case 'bottom_min_dns_latency':
    case 'top_avg_rtt':
    case 'top_max_rtt':
    case 'top_p90_rtt':
    case 'top_p99_rtt':
    case 'bottom_min_rtt': {
      const topOrBottom = id.startsWith('top_') ? t('Top') : t('Bottom');
      const metric = id.endsWith('_dns_latency') ? t('DNS latencies') : t('TCP smoothed Round Trip Time');
      const shortMetric = id.endsWith('_dns_latency') ? t('latency') : t('RTT');
      return {
        title: `${topOrBottom} ${limit} ${metricFunction} ${metric} ${t('with overall')}`,
        topTitle: `${topOrBottom} ${limit} ${metricFunction} ${metric}`,
        totalTitle: `${t('Overall')} ${metricFunction} ${metric}`,
        chartType: t('donut or lines'),
        subtitle: `${metricFunctionCaptitalized} ${shortMetric}`,
        tooltip: t('The {{function}} {{metric}} with overall over the selected interval', {
          function: metricFunction,
          metric: metric
        })
      };
    }
    case 'name_dns_latency_flows':
      return {
        title: t('Top {{limit}} DNS name with total', { limit }),
        topTitle: t('Top {{limit}} DNS name', { limit }),
        totalTitle: t('Total DNS name'),
        chartType: t('donut or bars and lines'),
        subtitle: t('Total DNS flow count'),
        tooltip: t('The top DNS name extracted from DNS headers compared to total over the selected interval')
      };
    case 'rcode_dns_latency_flows':
      return {
        title: t('Top {{limit}} DNS response code with total', { limit }),
        topTitle: t('Top {{limit}} DNS response code', { limit }),
        totalTitle: t('Total DNS response code'),
        chartType: t('donut or bars and lines'),
        subtitle: t('Total DNS flow count'),
        tooltip: t(
          'The top DNS response code extracted from DNS response headers compared to total over the selected interval'
        )
      };
    case 'tls_usage_global':
      return {
        title: t('TLS usage'),
        topTitle: t('TLS usage (network flows per second)'),
        subtitle: t('TLS traffic'),
        chartType: t('donut or lines')
      };
    case 'tls_per_version':
      return {
        title: t('TLS usage per version'),
        topTitle: t('TLS per version (network flows per second)'),
        chartType: t('donut or lines')
      };
    case 'tls_per_group':
      return {
        title: t('TLS usage per group'),
        topTitle: t('TLS per group (network flows per second)'),
        chartType: t('donut or lines')
      };
    case 'tls_per_cipher_suite':
      return {
        title: t('TLS usage per cipher suite'),
        topTitle: t('TLS per cipher suite (network flows per second)'),
        chartType: t('donut or lines')
      };
    default:
      const parsedId = parseCustomMetricId(id);
      if (parsedId.isValid) {
        const topOrBottom = parsedId.fn !== 'min' ? t('Top') : t('Bottom');
        const functionName = parsedId.fn && parsedId.fn !== 'sum' ? ' ' + metricFunction : '';
        const typeName = `${parsedId.type}${parsedId.fn === 'rate' ? ' ' + t('rates') : ''}`;
        const metricName = parsedId.aggregateBy ? `${parsedId.aggregateBy} (${typeName})` : typeName;
        return {
          title: `${topOrBottom} ${limit}${functionName} ${metricName} ${t('with total')}`,
          topTitle: `${topOrBottom} ${limit}${functionName} ${metricName}`,
          totalTitle: `${t('Total')} ${parsedId.type}`,
          chartType: t('donut or bars and lines')
        };
      } else {
        return {
          title: `${t('Invalid custom panel id')}: ${id}`
        };
      }
  }
};
