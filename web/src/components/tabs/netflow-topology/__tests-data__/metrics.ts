import { RawTopologyMetrics, TopologyMetrics } from '../../../../api/query-response';
import { parseTopologyMetrics } from '../../../../utils/metrics';

export const responseSample = {
  status: 'success',
  data: {
    resultType: 'matrix',
    result: [
      {
        metric: {
          DstAddr: '10.129.0.15',
          DstK8S_Name: 'loki-distributor-loki-76598c8449-csmh2',
          DstK8S_Namespace: 'network-observability',
          DstK8S_OwnerName: 'loki-distributor-loki',
          DstK8S_OwnerType: 'Deployment',
          DstK8S_Type: 'Pod',
          SrcAddr: '10.131.0.18',
          SrcK8S_Name: 'flowlogs-pipeline-69b6669d59-f76sh',
          SrcK8S_Namespace: 'network-observability',
          SrcK8S_OwnerName: 'flowlogs-pipeline',
          SrcK8S_OwnerType: 'Deployment',
          SrcK8S_Type: 'Pod'
        },
        values: [
          [1647965100, '2210400'],
          [1647965200, '919800'],
          [1647965300, '3517100']
        ]
      },
      {
        metric: {
          DstAddr: '10.130.0.15',
          DstK8S_Name: 'loki-distributor-loki-76598c8449-ngp4d',
          DstK8S_Namespace: 'network-observability',
          DstK8S_OwnerName: 'loki-distributor-loki',
          DstK8S_OwnerType: 'Deployment',
          DstK8S_Type: 'Pod',
          SrcAddr: '10.131.0.18',
          SrcK8S_Name: 'flowlogs-pipeline-69b6669d59-f76sh',
          SrcK8S_Namespace: 'network-observability',
          SrcK8S_OwnerName: 'flowlogs-pipeline',
          SrcK8S_OwnerType: 'Deployment',
          SrcK8S_Type: 'Pod'
        },
        values: [
          [1647965100, '1491100'],
          [1647965200, '1611400'],
          [1647965300, '858100']
        ]
      },
      {
        metric: {
          DstAddr: '10.131.0.18',
          DstK8S_Name: 'flowlogs-pipeline-69b6669d59-f76sh',
          DstK8S_Namespace: 'network-observability',
          DstK8S_OwnerName: 'flowlogs-pipeline',
          DstK8S_OwnerType: 'Deployment',
          DstK8S_Type: 'Pod',
          SrcAddr: '10.129.0.15',
          SrcK8S_Name: 'loki-distributor-loki-76598c8449-csmh2',
          SrcK8S_Namespace: 'network-observability',
          SrcK8S_OwnerName: 'loki-distributor-loki',
          SrcK8S_OwnerType: 'Deployment',
          SrcK8S_Type: 'Pod'
        },
        values: [
          [1647965100, '128300'],
          [1647965200, '105300'],
          [1647965300, '52000']
        ]
      },
      {
        metric: {
          DstAddr: '10.131.0.18',
          DstK8S_Name: 'flowlogs-pipeline-69b6669d59-f76sh',
          DstK8S_Namespace: 'network-observability',
          DstK8S_OwnerName: 'flowlogs-pipeline',
          DstK8S_OwnerType: 'Deployment',
          DstK8S_Type: 'Pod',
          SrcAddr: '10.130.0.15',
          SrcK8S_Name: 'loki-distributor-loki-76598c8449-ngp4d',
          SrcK8S_Namespace: 'network-observability',
          SrcK8S_OwnerName: 'loki-distributor-loki',
          SrcK8S_OwnerType: 'Deployment',
          SrcK8S_Type: 'Pod'
        },
        values: [
          [1647965100, '104700'],
          [1647965200, '47600'],
          [1647965300, '46300']
        ]
      },
      {
        metric: {
          DstAddr: '10.131.0.18',
          DstK8S_Name: 'flowlogs-pipeline-69b6669d59-f76sh',
          DstK8S_Namespace: 'network-observability',
          DstK8S_OwnerName: 'flowlogs-pipeline',
          DstK8S_OwnerType: 'Deployment',
          DstK8S_Type: 'Pod',
          SrcAddr: '10.131.0.7',
          SrcK8S_Name: 'dns-default-klz8q',
          SrcK8S_Namespace: 'openshift-dns',
          SrcK8S_OwnerName: 'dns-default',
          SrcK8S_OwnerType: 'DaemonSet',
          SrcK8S_Type: 'Pod'
        },
        values: [
          [1647965100, '20500'],
          [1647965200, '42100'],
          [1647965300, '43200']
        ]
      },
      {
        metric: {
          DstAddr: '10.131.0.18',
          DstK8S_Name: 'flowlogs-pipeline-69b6669d59-f76sh',
          DstK8S_Namespace: 'network-observability',
          DstK8S_OwnerName: 'flowlogs-pipeline',
          DstK8S_OwnerType: 'Deployment',
          DstK8S_Type: 'Pod',
          SrcAddr: '100.64.0.2'
        },
        values: [
          [1647965100, '801800'],
          [1647965200, '891300'],
          [1647965300, '1089700']
        ]
      },
      {
        metric: {
          DstAddr: '10.131.0.18',
          DstK8S_Name: 'flowlogs-pipeline-69b6669d59-f76sh',
          DstK8S_Namespace: 'network-observability',
          DstK8S_OwnerName: 'flowlogs-pipeline',
          DstK8S_OwnerType: 'Deployment',
          DstK8S_Type: 'Pod',
          SrcAddr: '100.64.0.3'
        },
        values: [
          [1647965100, '1304200'],
          [1647965200, '1932100'],
          [1647965300, '1336400']
        ]
      },
      {
        metric: {
          DstAddr: '10.131.0.18',
          DstK8S_Name: 'flowlogs-pipeline-69b6669d59-f76sh',
          DstK8S_Namespace: 'network-observability',
          DstK8S_OwnerName: 'flowlogs-pipeline',
          DstK8S_OwnerType: 'Deployment',
          DstK8S_Type: 'Pod',
          SrcAddr: '100.64.0.4'
        },
        values: [
          [1647965100, '1428500'],
          [1647965200, '1330400'],
          [1647965300, '949100']
        ]
      },
      {
        metric: {
          DstAddr: '10.131.0.18',
          DstK8S_Name: 'flowlogs-pipeline-69b6669d59-f76sh',
          DstK8S_Namespace: 'network-observability',
          DstK8S_OwnerName: 'flowlogs-pipeline',
          DstK8S_OwnerType: 'Deployment',
          DstK8S_Type: 'Pod',
          SrcAddr: '172.30.0.10',
          SrcK8S_Name: 'dns-default',
          SrcK8S_Namespace: 'openshift-dns',
          SrcK8S_OwnerName: 'dns-default',
          SrcK8S_OwnerType: 'Service',
          SrcK8S_Type: 'Service'
        },
        values: [
          [1647965100, '63700'],
          [1647965200, '168400'],
          [1647965300, '85300']
        ]
      },
      {
        metric: {
          DstAddr: '10.131.0.18',
          DstK8S_Name: 'flowlogs-pipeline-69b6669d59-f76sh',
          DstK8S_Namespace: 'network-observability',
          DstK8S_OwnerName: 'flowlogs-pipeline',
          DstK8S_OwnerType: 'Deployment',
          DstK8S_Type: 'Pod',
          SrcAddr: '172.30.116.84',
          SrcK8S_Name: 'loki-distributor-http-loki',
          SrcK8S_Namespace: 'network-observability',
          SrcK8S_OwnerName: 'loki-distributor-http-loki',
          SrcK8S_OwnerType: 'Service',
          SrcK8S_Type: 'Service'
        },
        values: [
          [1647965100, '55900'],
          [1647965200, '47100'],
          [1647965300, '88100']
        ]
      },
      {
        metric: {
          DstAddr: '172.30.0.10',
          DstK8S_Name: 'dns-default',
          DstK8S_Namespace: 'openshift-dns',
          DstK8S_OwnerName: 'dns-default',
          DstK8S_OwnerType: 'Service',
          DstK8S_Type: 'Service',
          SrcAddr: '10.131.0.18',
          SrcK8S_Name: 'flowlogs-pipeline-69b6669d59-f76sh',
          SrcK8S_Namespace: 'network-observability',
          SrcK8S_OwnerName: 'flowlogs-pipeline',
          SrcK8S_OwnerType: 'Deployment',
          SrcK8S_Type: 'Pod'
        },
        values: [
          [1647965100, '22400'],
          [1647965200, '33600'],
          [1647965300, '22400']
        ]
      },
      {
        metric: {
          DstAddr: '172.30.116.84',
          DstK8S_Name: 'loki-distributor-http-loki',
          DstK8S_Namespace: 'network-observability',
          DstK8S_OwnerName: 'loki-distributor-http-loki',
          DstK8S_OwnerType: 'Service',
          DstK8S_Type: 'Service',
          SrcAddr: '10.131.0.18',
          SrcK8S_Name: 'flowlogs-pipeline-69b6669d59-f76sh',
          SrcK8S_Namespace: 'network-observability',
          SrcK8S_OwnerName: 'flowlogs-pipeline',
          SrcK8S_OwnerType: 'Deployment',
          SrcK8S_Type: 'Pod'
        },
        values: [
          [1647965100, '458800'],
          [1647965200, '1789200'],
          [1647965300, '932000']
        ]
      }
    ],
    stats: {
      summary: {
        bytesProcessedPerSecond: 105976603,
        linesProcessedPerSecond: 100026,
        totalBytesProcessed: 24590613,
        totalLinesProcessed: 23210,
        execTime: 0.23203813
      },
      store: {
        totalChunksRef: 74,
        totalChunksDownloaded: 74,
        chunksDownloadTime: 0.000732113,
        headChunkBytes: 0,
        headChunkLines: 0,
        decompressedBytes: 1664739,
        decompressedLines: 1564,
        compressedBytes: 186000,
        totalDuplicates: 0
      },
      ingester: {
        totalReached: 1,
        totalChunksMatched: 687,
        totalBatches: 1,
        totalLinesSent: 289,
        headChunkBytes: 12768113,
        headChunkLines: 12263,
        decompressedBytes: 10157761,
        decompressedLines: 9383,
        compressedBytes: 968090,
        totalDuplicates: 0
      }
    }
  }
};

export const dataSample = parseTopologyMetrics(
  responseSample.data.result as RawTopologyMetrics[],
  { from: 1647965100, to: 1647965400 },
  'resource',
  0,
  true
) as TopologyMetrics[];
