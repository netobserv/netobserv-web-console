import { K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk';
import { Record } from '../../../api/ipfix';
import { Filter, FilterCompare, Filters } from '../../../model/filters';
import { NodeData } from '../../../model/topology';
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
  ip_cidr?: string;
  protocol?: string;
  source_port?: number;
  destination_port?: number;
  port?: number;
  source_port_range?: string;
  source_ports?: string;
  destination_port_range?: string;
  destination_ports?: string;
  port_range?: string;
  ports?: string;
  icmp_type?: number;
  icmp_code?: number;
  peer_ip?: string;
  peer_cidr?: string;
  action?: string;
  tcp_flags?: string;
  drops?: boolean;
  sample?: number;
};

export type FlowCaptureResource = K8sResourceKind & {
  spec?: {
    outputType?: FlowCaptureOutput;
    features?: FlowCaptureFeature[];
    filters?: FlowCaptureFilter[];
    queries?: string[];
    getSubnets?: boolean;
    interfaces?: string[];
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

const filterQueryExpression = (filter: Filter): string | undefined => {
  const values = filter.values.filter(value => !value.disabled);
  if (values.length === 0) return undefined;

  const expressions = values.map(value => {
    const expression = flowlogsQueryOperators(filter.def.encoder([value], filter.compare, false));
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
  'tcp_flags',
  'pkt_drop_state'
]);

/** Converts active console filters to a Flowlogs-Pipeline keep-entry query. */
export const queryFromFilters = (filters: Filters): string | undefined => {
  const expressions = filters.list
    .filter(filter => filter.compare !== FilterCompare.equal || !agentFilterIds.has(filter.def.id))
    .map(filterQueryExpression)
    .filter((query): query is string => Boolean(query));
  if (expressions.length === 0) return undefined;
  return expressions.length === 1
    ? expressions[0]
    : `(${expressions.join(filters.match === 'any' ? ' OR ' : ' AND ')})`;
};

const uniqueHosts = (hosts: Array<string | undefined>): string[] =>
  [...new Set(hosts.filter((host): host is string => Boolean(host)))];

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
    filters.push({ ip_cidr: `${peer.addr}/32`, ...(direction ? { direction } : {}) });
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
    return `((SrcK8S_OwnerName=${name} AND SrcK8S_OwnerType=${ownerType} AND SrcK8S_Namespace=${namespace}) OR ` +
      `(DstK8S_OwnerName=${name} AND DstK8S_OwnerType=${ownerType} AND DstK8S_Namespace=${namespace}))`;
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
  if (src) filters.push({ ip_cidr: `${src}/32`, direction: 'ingress' });
  if (dst) filters.push({ ip_cidr: `${dst}/32`, direction: 'egress' });
  if (proto) filters.push({ protocol: proto });
  if (fields.SrcPort) filters.push({ source_port: fields.SrcPort });
  if (fields.DstPort) filters.push({ destination_port: fields.DstPort });
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
  const query = queryFromFilters(filters);
  const capture: FlowCaptureResource = {
    apiVersion: 'flows.netobserv.io/v1alpha1',
    kind: 'FlowCapture',
    metadata: { name: `flowcapture-${Date.now()}` },
    spec: { outputType: 'flows', filters: [], ...(query ? { queries: [query] } : {}) }
  };
  const captureFilters = capture.spec!.filters!;
  const add = (filter: Filters['list'][number], key: keyof FlowCaptureFilter, direction?: string) => {
    filter.values
      .filter(value => !value.disabled)
      .forEach(value => {
        const cleaned = cleanFilterValue(value.v);
        if (!cleaned) return;
        const numeric = ['port', 'source_port', 'destination_port', 'icmp_type', 'icmp_code', 'sample'].includes(key);
        captureFilters.push({
          [key]: numeric ? Number(cleaned) : cleaned,
          ...(direction ? { direction } : {})
        } as FlowCaptureFilter);
      });
  };

  filters.list
    .filter(filter => filter.compare === FilterCompare.equal)
    .forEach(filter => {
      switch (filter.def.id) {
        case 'address':
          add(filter, 'ip_cidr');
          break;
        case 'src_address':
          add(filter, 'ip_cidr', 'ingress');
          break;
        case 'dst_address':
          add(filter, 'ip_cidr', 'egress');
          break;
        case 'protocol':
          add(filter, 'protocol');
          break;
        case 'direction':
          add(filter, 'direction');
          break;
        case 'port':
          add(filter, 'port');
          break;
        case 'src_port':
          add(filter, 'source_port');
          break;
        case 'dst_port':
          add(filter, 'destination_port');
          break;
        case 'icmp_type':
          add(filter, 'icmp_type');
          break;
        case 'icmp_code':
          add(filter, 'icmp_code');
          break;
        case 'tcp_flags':
          add(filter, 'tcp_flags');
          break;
        case 'pkt_drop_state':
          add(filter, 'action');
          break;
        default:
          break;
      }
    });

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
