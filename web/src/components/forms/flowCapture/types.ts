import { K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk';
import { Record } from '../../../api/ipfix';
import { Filter, FilterCompare, Filters } from '../../../model/filters';
import { NodeData } from '../../../model/topology';
import { getPort } from '../../../utils/port';
import { HealthItem, HealthStat, HealthSuperKind } from '../../health/health-helper';

export type FlowCaptureOutput = 'flows' | 'packets' | 'metrics';
export type FlowCaptureFeature =
  | 'PacketDrop'
  | 'DNSTracking'
  | 'FlowRTT'
  | 'NetworkEvents'
  | 'PacketTranslation'
  | 'UDNMapping'
  | 'IPSec'
  | 'TLSTracking'
  | 'SecondaryNetworks';

export type FlowCaptureFilter = {
  direction?: string;
  cidr?: string;
  protocol?: string;
  sourcePort?: number;
  destPort?: number;
  port?: number;
  sourcePortRange?: string;
  sourcePorts?: string;
  destPortRange?: string;
  destPorts?: string;
  portRange?: string;
  ports?: string;
  icmpType?: number;
  icmpCode?: number;
  peerIP?: string;
  peerCIDR?: string;
  action?: string;
  tcpFlags?: string;
  pktDrops?: boolean;
  sampling?: number;
};

export type FlowCaptureResource = K8sResourceKind & {
  spec?: {
    outputType?: FlowCaptureOutput;
    maxTime?: string;
    maxBytes?: number;
    sampling?: number;
    features?: FlowCaptureFeature[];
    filters?: FlowCaptureFilter[];
    queries?: string[];
    subnetLabels?: { autoDetect?: boolean };
    tlsPlaintext?: {
      minBytes?: number;
      previewBytes?: number;
      processAllowlist?: string[];
    };
    interfaces?: string[];
    excludeInterfaces?: string[];
    nodeSelector?: { [key: string]: string };
    [key: string]: unknown;
  };
};

const value = (record: Record, key: keyof Record['fields']): string | undefined => {
  const v = record.fields[key] ?? record.labels[key];
  return v === undefined || v === null ? undefined : String(v);
};

const cleanFilterValue = (input: string): string => {
  const value = input.trim();
  return value.length > 1 && value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
};

const normalizeDirection = (direction?: string): 'Ingress' | 'Egress' | undefined => {
  switch (String(direction || '').toLowerCase()) {
    case '0':
    case 'ingress':
      return 'Ingress';
    case '1':
    case 'egress':
      return 'Egress';
    default:
      return undefined;
  }
};

const normalizeProtocol = (protocol: string): string => {
  const cleaned = cleanFilterValue(protocol);
  const names: { [key: string]: string } = { '1': 'ICMP', '6': 'TCP', '17': 'UDP', '58': 'ICMPv6' };
  return names[cleaned] || cleaned;
};

const normalizeAddress = (address: string): string | undefined => {
  const cleaned = cleanFilterValue(address);
  if (!cleaned || cleaned.includes('-')) return undefined;
  if (cleaned.includes('/')) return cleaned;
  return `${cleaned}/${cleaned.includes(':') ? 128 : 32}`;
};

const flowlogsQueryOperators = (expression: string): string => {
  let result = '';
  let quoted = false;
  let escaped = false;
  for (const character of expression) {
    if (character === '"' && !escaped) quoted = !quoted;
    if (!quoted && character === '|') {
      result += ' OR ';
    } else if (!quoted && character === '&') {
      result += ' AND ';
    } else {
      result += character;
    }
    escaped = character === '\\' && !escaped;
    if (character !== '\\') escaped = false;
  }
  return result;
};

const flowlogsPipelineExpression = (expression: string): string => {
  const normalized = flowlogsQueryOperators(expression);
  return normalized.replace(
    /([A-Za-z_][A-Za-z0-9_]*)(!~|!=|>=|=|~)(\"[^\"]*\"|[^()\s]+)/g,
    (_match, field: string, operator: string, rawValue: string) => {
      const flpOperator = operator === '~' ? '=~' : operator;
      const value = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(rawValue)
        ? rawValue
        : rawValue.startsWith('"')
          ? rawValue
          : JSON.stringify(rawValue);
      return `${field}${flpOperator}${value}`;
    }
  );
};

const addressQueryFields: { [key: string]: string[] } = {
  address: ['SrcAddr', 'DstAddr'],
  src_address: ['SrcAddr'],
  dst_address: ['DstAddr']
};

const addressRegex = (value: string): string | undefined => {
  const address = normalizeAddress(value);
  if (!address) return undefined;
  const [ip, prefix] = address.split('/');
  const prefixLength = Number(prefix);
  if (ip.includes(':') || prefixLength === 32) return `^${ip.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
  const octets = ip.split('.');
  const fixedOctets = Math.floor(prefixLength / 8);
  if (prefixLength % 8 !== 0 || fixedOctets === 0) return undefined;
  return `^${octets.slice(0, fixedOctets).join('\\.')}(?:\\.[0-9]{1,3}){${4 - fixedOctets}}$`;
};

const filterQueryExpression = (filter: Filter): string | undefined => {
  const values = filter.values.filter(value => !value.disabled);
  if (values.length === 0) return undefined;

  const expressions = values.map(value => {
    const fields = addressQueryFields[filter.def.id];
    const regex = fields && addressRegex(value.v);
    if (regex) {
      const operator =
        filter.compare === FilterCompare.notEqual || filter.compare === FilterCompare.notMatch ? '!~' : '=~';
      return fields
        .map(field => `${field}${operator}${JSON.stringify(regex)}`)
        .join(operator === '!~' ? ' AND ' : ' OR ');
    }
    const expression = flowlogsPipelineExpression(filter.def.encoder([value], filter.compare, false));
    return expression.includes(' OR ') || expression.includes(' AND ') ? `(${expression})` : expression;
  });
  const joiner = [FilterCompare.notEqual, FilterCompare.notMatch].includes(filter.compare) ? ' AND ' : ' OR ';
  return expressions.join(joiner);
};

const agentFilterIds = new Set([
  'address',
  'src_address',
  'dst_address',
  'protocol',
  'direction',
  'port',
  'src_port',
  'dst_port',
  'icmp_type',
  'icmp_code',
  'tcp_flags'
]);

const agentRuleKey = (id: string): string | undefined => {
  const keys: { [key: string]: string } = {
    address: 'cidr',
    src_address: 'cidr',
    dst_address: 'cidr',
    protocol: 'protocol',
    direction: 'direction',
    port: 'port',
    src_port: 'sourcePort',
    dst_port: 'destPort',
    icmp_type: 'icmpType',
    icmp_code: 'icmpCode',
    tcp_flags: 'tcpFlags'
  };
  return keys[id];
};

const hasConflictingAgentRules = (filters: Filters): boolean => {
  const keys = new Set<string>();
  return filters.list
    .filter(filter => filter.compare === FilterCompare.equal && agentFilterIds.has(filter.def.id))
    .some(filter => {
      const key = agentRuleKey(filter.def.id);
      const values = filter.values.filter(value => !value.disabled);
      if (!key || values.length !== 1 || keys.has(key)) return true;
      keys.add(key);
      return false;
    });
};

const hasMixedAgentAndPipelineFilters = (filters: Filters): boolean => {
  const enabled = filters.list.filter(filter => filter.values.some(value => !value.disabled));
  return (
    enabled.some(filter => filter.compare === FilterCompare.equal && agentFilterIds.has(filter.def.id)) &&
    enabled.some(filter => filter.compare !== FilterCompare.equal || !agentFilterIds.has(filter.def.id))
  );
};

/** Converts active console filters to a Flowlogs-Pipeline keep-entry query. */
export const queryFromFilters = (filters: Filters, includeAgentFilters = false): string | undefined => {
  const allExpressions = filters.list.map(filterQueryExpression).filter((query): query is string => Boolean(query));
  const agentExpressions = filters.list
    .filter(filter => filter.compare !== FilterCompare.equal || !agentFilterIds.has(filter.def.id))
    .map(filterQueryExpression)
    .filter((query): query is string => Boolean(query));
  // For match:any, retaining the complete expression is required when an
  // agent-side clause is mixed with a pipeline-side clause.
  const expressions =
    includeAgentFilters || filters.match === 'any' || (filters.match === 'all' && hasConflictingAgentRules(filters))
      ? allExpressions
      : agentExpressions;
  if (expressions.length === 0) return undefined;
  return expressions.length === 1
    ? expressions[0]
    : `(${expressions.join(filters.match === 'any' ? ' OR ' : ' AND ')})`;
};

const uniqueHosts = (hosts: Array<string | undefined>): string[] => [
  ...new Set(hosts.filter((host): host is string => Boolean(host)))
];

const addNodeSelector = (capture: FlowCaptureResource, hosts: Array<string | undefined>) => {
  const uniqueHostValues = uniqueHosts(hosts);
  if (uniqueHostValues.length === 1) {
    capture.spec = {
      ...capture.spec,
      nodeSelector: { 'kubernetes.io/hostname': uniqueHostValues[0] }
    };
  }
};

const addTopologyPeer = (filters: FlowCaptureFilter[], peer: NodeData['peer'] | undefined, direction?: string) => {
  if (peer?.addr) {
    const address = normalizeAddress(peer.addr);
    if (address)
      filters.push({
        cidr: address,
        ...(normalizeDirection(direction) ? { direction: normalizeDirection(direction) } : {})
      });
  }
};

const queryValue = (value: string): string => JSON.stringify(value);

const isNodeFallback = (record: Record, side: 'Src' | 'Dst'): boolean => {
  const type = value(record, `${side}K8S_Type` as keyof Record['fields']);
  const ownerType = value(record, `${side}K8S_OwnerType` as keyof Record['fields']);
  const name = value(record, `${side}K8S_Name` as keyof Record['fields']);
  const hostName = value(record, `${side}K8S_HostName` as keyof Record['fields']);
  return type === 'Node' || ownerType === 'Node' || (Boolean(name) && name === hostName);
};

const healthScopeQuery = (kind: HealthSuperKind, resourceHealth: HealthStat): string | undefined => {
  if (!resourceHealth.name || kind === 'Global') return undefined;
  // A node capture is already constrained by spec.nodeSelector. Repeating the
  // same hostname in an FLP query is redundant.
  const scopeField = kind === 'Namespace' ? 'K8S_Namespace' : undefined;
  if (scopeField) {
    const value = queryValue(resourceHealth.name);
    return `(Src${scopeField}=${value} OR Dst${scopeField}=${value})`;
  }
  if (kind === 'Owner' && resourceHealth.k8sKind && resourceHealth.namespace) {
    const name = queryValue(resourceHealth.name);
    const namespace = queryValue(resourceHealth.namespace);
    const ownerType = queryValue(resourceHealth.k8sKind);
    return (
      `((SrcK8S_OwnerName=${name} AND SrcK8S_OwnerType=${ownerType} AND SrcK8S_Namespace=${namespace}) OR ` +
      `(DstK8S_OwnerName=${name} AND DstK8S_OwnerType=${ownerType} AND DstK8S_Namespace=${namespace}))`
    );
  }
  return undefined;
};

/** Creates a capture scoped to the resource represented by a Network Health alert. */
export const captureFromHealthItem = (
  kind: HealthSuperKind,
  resourceHealth: HealthStat,
  _item: HealthItem
): FlowCaptureResource => {
  const query = healthScopeQuery(kind, resourceHealth);
  const capture: FlowCaptureResource = {
    apiVersion: 'flows.netobserv.io/v1alpha1',
    kind: 'FlowCapture',
    metadata: { name: `flowcapture-${Date.now()}` },
    spec: {
      outputType: 'flows',
      filters: [],
      ...(query ? { queries: [query] } : {})
    }
  };
  if (kind === 'Node' && resourceHealth.name) {
    capture.spec = {
      ...capture.spec,
      nodeSelector: { 'kubernetes.io/hostname': resourceHealth.name }
    };
  }
  return capture;
};

const topologyScopeField: { [key: string]: string } = {
  namespace: 'K8S_Namespace',
  host: 'K8S_HostName',
  zone: 'K8S_Zone',
  udn: 'K8S_NetworkName',
  subnet: 'SubnetLabel'
};

const topologyPeerSideClauses = (
  peer: NodeData['peer'],
  nodeType: string,
  side: 'Src' | 'Dst',
  omitHostName: boolean
): string[] => {
  const clauses: string[] = [];
  if (peer.resource) {
    clauses.push(`${side}K8S_Type=${queryValue(peer.resource.type)}`);
    if (peer.namespace) clauses.push(`${side}K8S_Namespace=${queryValue(peer.namespace)}`);
    clauses.push(`${side}K8S_Name=${queryValue(peer.resource.name)}`);
  } else if (peer.owner) {
    clauses.push(
      `${side}K8S_OwnerType=${queryValue(peer.owner.type)}`,
      `${side}K8S_OwnerName=${queryValue(peer.owner.name)}`
    );
    if (peer.namespace) clauses.push(`${side}K8S_Namespace=${queryValue(peer.namespace)}`);
  } else {
    const scopeField = topologyScopeField[nodeType];
    const scopeValue = peer[nodeType];
    if (scopeField && typeof scopeValue === 'string' && !(omitHostName && scopeField === 'K8S_HostName')) {
      clauses.push(`${side}${scopeField}=${queryValue(scopeValue)}`);
    } else if (nodeType === 'cluster' && peer.cluster) {
      clauses.push(`K8S_ClusterName=${queryValue(peer.cluster)}`);
    }
  }
  return clauses;
};

const queryFromTopologyPeer = (
  data: NodeData,
  direction: 'ingress' | 'egress' | undefined,
  omitHostName: boolean
): string | undefined => {
  const source = topologyPeerSideClauses(data.peer, data.nodeType, 'Src', omitHostName);
  const destination = topologyPeerSideClauses(data.peer, data.nodeType, 'Dst', omitHostName);
  if (direction === 'ingress') return source.length > 0 ? source.join(' AND ') : undefined;
  if (direction === 'egress') return destination.length > 0 ? destination.join(' AND ') : undefined;
  if (source.length === 0 || destination.length === 0) return undefined;
  return `(${source.join(' AND ')} OR ${destination.join(' AND ')})`;
};

const queryFromRecord = (record: Record): string | undefined => {
  const queryFields: Array<{ field: keyof Record['fields']; side?: 'Src' | 'Dst' }> = [
    { field: 'SrcK8S_Namespace' },
    { field: 'DstK8S_Namespace' },
    { field: 'SrcK8S_Name', side: 'Src' },
    { field: 'DstK8S_Name', side: 'Dst' }
  ];
  const expressions = queryFields
    .filter(({ side }) => !side || !isNodeFallback(record, side))
    .map(({ field }) => {
      const fieldValue = value(record, field);
      return fieldValue ? `${field}=${queryValue(fieldValue)}` : undefined;
    })
    .filter((query): query is string => Boolean(query));
  return expressions.length > 0 ? expressions.join(' AND ') : undefined;
};

/** Converts the currently selected flow into the agent filter vocabulary. */
export const captureFromRecord = (record: Record): FlowCaptureResource => {
  const fields = record.fields;
  const filters: FlowCaptureFilter[] = [];
  const src = value(record, 'SrcAddr');
  const dst = value(record, 'DstAddr');
  const proto = value(record, 'Proto');
  const flowRule: FlowCaptureFilter = {
    ...(proto ? { protocol: normalizeProtocol(proto) } : {}),
    ...(fields.SrcPort ? { sourcePort: fields.SrcPort } : {}),
    ...(fields.DstPort ? { destPort: fields.DstPort } : {})
  };
  const srcAddress = src && normalizeAddress(src);
  const dstAddress = dst && normalizeAddress(dst);
  if (srcAddress) filters.push({ ...flowRule, cidr: srcAddress, direction: 'Ingress' });
  if (dstAddress) filters.push({ ...flowRule, cidr: dstAddress, direction: 'Egress' });
  if (!srcAddress && !dstAddress && Object.keys(flowRule).length > 0) filters.push(flowRule);
  const query = queryFromRecord(record);
  const interfaces = fields.Interfaces ?? record.labels.Interfaces;
  const capture: FlowCaptureResource = {
    apiVersion: 'flows.netobserv.io/v1alpha1',
    kind: 'FlowCapture',
    metadata: { name: `flowcapture-${Date.now()}` },
    spec: {
      outputType: 'flows',
      filters,
      ...(query ? { queries: [query] } : {}),
      ...(interfaces?.length ? { interfaces: [...new Set(interfaces)] } : {})
    }
  };
  addNodeSelector(capture, [value(record, 'SrcK8S_HostName'), value(record, 'DstK8S_HostName')]);
  return capture;
};

/** Converts the active console filters into the FlowCapture agent vocabulary. */
export const captureFromFilters = (filters: Filters): FlowCaptureResource => {
  const capture: FlowCaptureResource = {
    apiVersion: 'flows.netobserv.io/v1alpha1',
    kind: 'FlowCapture',
    metadata: { name: `flowcapture-${Date.now()}` },
    spec: { outputType: 'flows', filters: [] }
  };
  const captureFilters = capture.spec!.filters!;
  const skipAgentFilters = filters.match === 'any' && hasMixedAgentAndPipelineFilters(filters);
  const add = (
    filter: Filters['list'][number],
    key: keyof FlowCaptureFilter,
    direction?: string,
    transform: (input: string) => string = cleanFilterValue
  ) => {
    filter.values
      .filter(value => !value.disabled)
      .forEach(value => {
        const cleaned = transform(value.v);
        if (!cleaned) return;
        const numeric = ['port', 'sourcePort', 'destPort', 'icmpType', 'icmpCode', 'sampling'].includes(key);
        if (numeric && Number.isNaN(Number(cleaned))) return;
        captureFilters.push({
          [key]: numeric ? Number(cleaned) : cleaned,
          ...(normalizeDirection(direction) ? { direction: normalizeDirection(direction) } : {})
        } as FlowCaptureFilter);
      });
  };
  const addAddress = (filter: Filters['list'][number], direction?: string) => {
    filter.values
      .filter(value => !value.disabled)
      .forEach(value => {
        const address = normalizeAddress(value.v);
        if (address) {
          captureFilters.push({
            cidr: address,
            ...(normalizeDirection(direction) ? { direction: normalizeDirection(direction) } : {})
          });
        }
      });
  };

  filters.list
    .filter(filter => !skipAgentFilters && filter.compare === FilterCompare.equal)
    .forEach(filter => {
      switch (filter.def.id) {
        case 'address':
          addAddress(filter);
          break;
        case 'src_address':
          addAddress(filter, 'Ingress');
          break;
        case 'dst_address':
          addAddress(filter, 'Egress');
          break;
        case 'protocol':
          add(filter, 'protocol', undefined, normalizeProtocol);
          break;
        case 'direction':
          add(filter, 'direction');
          break;
        case 'port':
          add(filter, 'port');
          break;
        case 'src_port':
          add(filter, 'sourcePort', undefined, value => getPort(cleanFilterValue(value)) || cleanFilterValue(value));
          break;
        case 'dst_port':
          add(filter, 'destPort', undefined, value => getPort(cleanFilterValue(value)) || cleanFilterValue(value));
          break;
        case 'icmp_type':
          add(filter, 'icmpType');
          break;
        case 'icmp_code':
          add(filter, 'icmpCode');
          break;
        case 'tcp_flags':
          add(filter, 'tcpFlags');
          break;
        case 'pkt_drop_state':
          break;
        default:
          break;
      }
    });

  let forcePipelineQuery = false;
  if (filters.match === 'all' && captureFilters.length > 1) {
    let hasConflict = false;
    const combined = captureFilters.reduce<FlowCaptureFilter | undefined>((result, rule) => {
      if (hasConflict) return undefined;
      if (!result) return { ...rule };
      const conflicts = Object.keys(rule).some(key => result[key as keyof FlowCaptureFilter] !== undefined);
      if (conflicts) hasConflict = true;
      return conflicts ? undefined : { ...result, ...rule };
    }, undefined);
    captureFilters.splice(0, captureFilters.length);
    if (combined && !hasConflict) captureFilters.push(combined);
    else forcePipelineQuery = true;
  }

  const query = queryFromFilters(filters);
  const completeQuery = forcePipelineQuery ? queryFromFilters(filters, true) : query;
  if (completeQuery) capture.spec = { ...capture.spec, queries: [completeQuery] };

  return capture;
};

/** Creates a capture from a topology selection and retains the selected node/edge context. */
export const captureFromTopologyElement = (
  filters: Filters,
  source?: NodeData,
  destination?: NodeData
): FlowCaptureResource => {
  const capture = captureFromFilters(filters);
  const captureFilters = capture.spec!.filters!;
  addTopologyPeer(captureFilters, source?.peer, destination ? 'ingress' : undefined);
  addTopologyPeer(captureFilters, destination?.peer, 'egress');
  const hosts = [source?.peer.host, destination?.peer.host];
  const omitHostName = uniqueHosts(hosts).length === 1;
  const topologyQueries = [
    source && queryFromTopologyPeer(source, destination ? 'ingress' : undefined, omitHostName),
    destination && queryFromTopologyPeer(destination, 'egress', omitHostName)
  ].filter((query): query is string => Boolean(query));
  if (topologyQueries.length > 0) {
    const topologyQuery = topologyQueries.join(' AND ');
    const baseQuery = capture.spec?.queries?.[0];
    capture.spec = {
      ...capture.spec,
      queries: [baseQuery ? `(${baseQuery}) AND (${topologyQuery})` : topologyQuery]
    };
  }
  addNodeSelector(capture, hosts);
  return capture;
};
