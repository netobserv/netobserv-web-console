import { UiSchema } from '@rjsf/utils';
import { TFunction } from 'i18next';

const rawFlowCaptureUISchema: UiSchema = {
  'ui:title': 'FlowCapture',
  'ui:flat': 'true',
  metadata: {
    'ui:title': 'Resource',
    'ui:flat': 'true',
    name: { 'ui:title': 'Name' },
    generateName: { 'ui:title': 'Generate name' },
    namespace: { 'ui:title': 'Namespace' },
    labels: { 'ui:widget': 'hidden' },
    'ui:order': ['name', 'generateName', 'namespace', '*']
  },
  spec: {
    'ui:title': 'Capture',
    'ui:flat': 'true',
    'ui:options': { flowCaptureFiltersGroup: true },
    outputType: { 'ui:title': 'Output type', 'ui:description': 'Choose what the agents should capture.' },
    features: {
      'ui:title': 'Features',
      'ui:widget': 'arrayCheckboxes',
      'ui:descriptionFirst': 'true',
      'ui:description': 'Select the optional eBPF features to enable for this capture.',
      'ui:dependency': { controlFieldPath: ['outputType'], controlFieldValue: ['flows', 'metrics'] }
    },
    subnetLabels: {
      'ui:title': 'Subnet labels',
      'ui:description':
        'Detect and label machine, pod, and service CIDRs on captured flows.',
      autoDetect: { 'ui:title': 'Automatically detect subnets' },
      'ui:dependency': { controlFieldPath: ['outputType'], controlFieldValue: ['flows', 'metrics'] }
    },
    tlsPlaintext: {
      'ui:title': 'TLS plaintext',
      'ui:field': 'flowCaptureTLSPlaintext',
      'ui:description': 'Capture plaintext extracted from TLS connections in packet captures.',
      'ui:dependency': { controlFieldPath: ['outputType'], controlFieldValue: 'packets' },
      minBytes: {
        'ui:title': 'Minimum bytes',
        'ui:description': 'Defaults to 0, so no plaintext events are filtered by size.'
      },
      previewBytes: {
        'ui:title': 'Preview bytes',
        'ui:description': 'Defaults to 256 bytes. Use 0 for an unlimited preview.'
      },
      processAllowlist: { 'ui:title': 'Process allowlist' }
    },
    maxTime: {
      'ui:title': 'Maximum duration',
      'ui:description': 'Defaults to 1h. For example: 5m or 1h.'
    },
    maxBytes: {
      'ui:title': 'Maximum bytes',
      'ui:description': 'Defaults to 0, which means unlimited.',
      'ui:dependency': { controlFieldPath: ['outputType'], controlFieldValue: ['flows', 'packets'] }
    },
    sampling: {
      'ui:title': 'Sampling interval',
      'ui:description': 'Defaults to 1, capturing every packet or flow.'
    },
    interfaces: {
      'ui:title': 'Interfaces',
      'ui:options': { expandWhenPopulated: true },
      'ui:description': 'Capture traffic from these interfaces. Leave empty to use all available interfaces.'
    },
    excludeInterfaces: {
      'ui:title': 'Excluded interfaces',
      'ui:options': { expandWhenPopulated: true },
      'ui:description': 'Exclude traffic from these interfaces, even when they are selected above.'
    },
    filters: {
      'ui:title': 'eBPF filters',
      'ui:field': 'flowCaptureFilters',
      'ui:options': { expandWhenPopulated: true },
      'ui:description':
        'Add agent-side filters to limit which traffic is captured. Multiple filters are combined by the agent.',
      items: {
        direction: { 'ui:title': 'Direction' },
        cidr: { 'ui:title': 'IP CIDR' },
        protocol: { 'ui:title': 'Protocol' },
        sourcePort: { 'ui:title': 'Source port' },
        destPort: { 'ui:title': 'Destination port' },
        port: { 'ui:title': 'Port' },
        sourcePortRange: { 'ui:title': 'Source port range' },
        destPortRange: { 'ui:title': 'Destination port range' },
        peerIP: { 'ui:title': 'Peer IP' },
        peerCIDR: { 'ui:title': 'Peer CIDR' },
        action: { 'ui:title': 'Action' },
        pktDrops: { 'ui:title': 'Dropped packets only' },
        sampling: { 'ui:title': 'Sampling' },
        'ui:order': [
          'direction',
          'cidr',
          'protocol',
          'sourcePort',
          'destPort',
          'port',
          'sourcePortRange',
          'destPortRange',
          'peerIP',
          'peerCIDR',
          'action',
          'pktDrops',
          'sampling',
          '*'
        ]
      }
    },
    queries: {
      'ui:title': 'FLP queries',
      'ui:description':
        'Add Flowlogs-Pipeline keep-entry expressions to apply after flow enrichment. Queries are evaluated in order.\n' +
        'Examples:\n' +
        'SrcK8S_Namespace=~"app-.*"\n' +
        'SrcK8S_Name=~".*my-pod.*" or DstK8S_Name=~".*my-pod.*"\n' +
        '(SrcK8S_Namespace="netobserv" OR (SrcK8S_Namespace="openshift-ingress" AND DstK8S_Namespace="netobserv"))',
      'ui:options': {
        expandWhenPopulated: true,
        externalLink: {
          href: 'https://github.com/netobserv/flowlogs-pipeline/blob/main/docs/filtering.md',
          text: 'Open query syntax documentation'
        }
      },
      items: {
        'ui:placeholder': 'For example: SrcK8S_Namespace=~"app-.*"'
      }
    },
    nodeSelector: {
      'ui:title': 'Node selector',
      'ui:field': 'nodeSelector',
      'ui:options': { expandWhenPopulated: true },
      'ui:description': 'Select the nodes where the capture agents should run by adding label key/value pairs.'
    },
    'ui:order': [
      'outputType',
      'features',
      'subnetLabels',
      'tlsPlaintext',
      'maxTime',
      'maxBytes',
      'sampling',
      'filters',
      'queries',
      'interfaces',
      'excludeInterfaces',
      'nodeSelector',
      '*'
    ]
  },
  'ui:order': ['metadata', 'spec', '*']
};

const translatedUISchema = (schema: unknown, t: TFunction, key?: string): unknown => {
  if (typeof schema === 'string' && ['ui:title', 'ui:description', 'ui:placeholder', 'text'].includes(key || '')) {
    return t(schema);
  }
  if (Array.isArray(schema)) return schema.map(value => translatedUISchema(value, t));
  if (!schema || typeof schema !== 'object') return schema;
  return Object.fromEntries(
    Object.entries(schema).map(([entryKey, value]) => [entryKey, translatedUISchema(value, t, entryKey)])
  );
};

export const flowCaptureUISchema = (t: TFunction): UiSchema =>
  translatedUISchema(rawFlowCaptureUISchema, t) as UiSchema;
