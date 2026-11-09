import { UiSchema } from '@rjsf/utils';

export const flowCaptureUISchema: UiSchema = {
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
    getSubnets: {
      'ui:title': 'Get subnets',
      'ui:description':
        'Detect and label machine, pod, and service CIDRs on captured flows. This is currently supported on OpenShift clusters.',
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
        ip_cidr: { 'ui:title': 'IP CIDR' },
        protocol: { 'ui:title': 'Protocol' },
        source_port: { 'ui:title': 'Source port' },
        destination_port: { 'ui:title': 'Destination port' },
        port: { 'ui:title': 'Port' },
        source_port_range: { 'ui:title': 'Source port range' },
        destination_port_range: { 'ui:title': 'Destination port range' },
        peer_ip: { 'ui:title': 'Peer IP' },
        peer_cidr: { 'ui:title': 'Peer CIDR' },
        action: { 'ui:title': 'Action' },
        drops: { 'ui:title': 'Dropped packets only' },
        sample: { 'ui:title': 'Sample' },
        'ui:order': [
          'direction',
          'ip_cidr',
          'protocol',
          'source_port',
          'destination_port',
          'port',
          'source_port_range',
          'destination_port_range',
          'peer_ip',
          'peer_cidr',
          'action',
          'drops',
          'sample',
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
      'getSubnets',
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
