import axios from 'axios';
import { Config, defaultConfig } from '../model/config';
import { buildExportQuery } from '../model/export-query';
import { FlowQuery, FlowScope, isTimeMetric, StructuredFlowQuery, structuredToRawQuery } from '../model/flow-query';
import { ContextSingleton } from '../utils/context';
import { TimeRange } from '../utils/datetime';
import { parseGenericMetrics, parseTopologyMetrics } from '../utils/metrics';
import { AlertsResult, SilencedAlert } from './alert';
import { Field } from './ipfix';
import {
  AggregatedQueryResponse,
  FlowMetricsResult,
  GenericMetricsResult,
  parseStream,
  RawTopologyMetrics,
  RecordsResult,
  Stats,
  Status,
  StreamResult
} from './loki';

export const getFlowRecords = (params: FlowQuery): Promise<RecordsResult> => {
  return axios.get(ContextSingleton.getHost() + '/api/loki/flow/records', { params }).then(r => {
    if (r.status >= 400) {
      throw new Error(`${r.statusText} [code=${r.status}]`);
    }
    const aggQR: AggregatedQueryResponse = r.data;
    return {
      records: (aggQR.result as StreamResult[]).flatMap(r => parseStream(r)),
      stats: aggQR.stats
    };
  });
};

export const getAlerts = (match: string): Promise<AlertsResult> => {
  const matchKeyEnc = encodeURIComponent('match[]');
  const matchValEnc = encodeURIComponent('{' + match + '}');
  return axios.get(`/api/prometheus/api/v1/rules?type=alert&${matchKeyEnc}=${matchValEnc}`).then(r => {
    if (r.status >= 400) {
      throw new Error(`${r.statusText} [code=${r.status}]`);
    }
    return r.data;
  });
};

export const getSilencedAlerts = (match: string): Promise<SilencedAlert[]> => {
  return axios.get(`/api/alertmanager/api/v2/silences?filter=${match}`).then(r => {
    if (r.status >= 400) {
      throw new Error(`${r.statusText} [code=${r.status}]`);
    }
    return r.data;
  });
};

export const getRecordingRules = (match: string): Promise<AlertsResult> => {
  const matchKeyEnc = encodeURIComponent('match[]');
  const matchValEnc = encodeURIComponent('{' + match + '}');
  return axios.get(`/api/prometheus/api/v1/rules?type=record&${matchKeyEnc}=${matchValEnc}`).then(r => {
    if (r.status >= 400) {
      throw new Error(`${r.statusText} [code=${r.status}]`);
    }
    return r.data;
  });
};

export const queryPrometheusMetric = (query: string): Promise<unknown> => {
  const queryEnc = encodeURIComponent(query);
  return axios.get(`/api/prometheus/api/v1/query?query=${queryEnc}`).then(r => {
    if (r.status >= 400) {
      throw new Error(`${r.statusText} [code=${r.status}]`);
    }
    return r.data;
  });
};

export const getExportFlowsURL = (q: StructuredFlowQuery, columns?: string[]): string => {
  const params = structuredToRawQuery(q);
  const exportQuery = buildExportQuery(params, columns);
  return `${ContextSingleton.getHost()}/api/loki/export?${exportQuery}`;
};

export const getRole = (): Promise<string> => {
  return axios.get(ContextSingleton.getHost() + '/role').then(r => {
    return r.data;
  });
};

export const getStatus = (forcedNamespace?: string): Promise<Status> => {
  const params = { namespace: forcedNamespace };
  return axios.get(ContextSingleton.getHost() + '/api/status', { params }).then(r => {
    if (r.status >= 400) {
      throw new Error(`${r.statusText} [code=${r.status}]`);
    }
    return r.data;
  });
};

export const getClusters = (forcedNamespace?: string): Promise<string[]> => {
  const params = { namespace: forcedNamespace };
  return axios.get(ContextSingleton.getHost() + '/api/resources/clusters', { params }).then(r => {
    if (r.status >= 400) {
      throw new Error(`${r.statusText} [code=${r.status}]`);
    }
    return r.data;
  });
};

export const getUDNs = (forcedNamespace?: string): Promise<string[]> => {
  const params = { namespace: forcedNamespace };
  return axios.get(ContextSingleton.getHost() + '/api/resources/udns', { params }).then(r => {
    if (r.status >= 400) {
      throw new Error(`${r.statusText} [code=${r.status}]`);
    }
    return r.data;
  });
};

export const getZones = (forcedNamespace?: string): Promise<string[]> => {
  const params = { namespace: forcedNamespace };
  return axios.get(ContextSingleton.getHost() + '/api/resources/zones', { params }).then(r => {
    if (r.status >= 400) {
      throw new Error(`${r.statusText} [code=${r.status}]`);
    }
    return r.data;
  });
};

export const getNamespaces = (forcedNamespace?: string): Promise<string[]> => {
  const params = { namespace: forcedNamespace };
  return axios.get(ContextSingleton.getHost() + '/api/resources/namespaces', { params }).then(r => {
    if (r.status >= 400) {
      throw new Error(`${r.statusText} [code=${r.status}]`);
    }
    return r.data;
  });
};

export const getResources = (namespace: string, kind: string, forcedNamespace?: string): Promise<string[]> => {
  const params = {
    namespace: forcedNamespace || namespace,
    kind
  };
  return axios.get(ContextSingleton.getHost() + '/api/resources/names', { params }).then(r => {
    if (r.status >= 400) {
      throw new Error(`${r.statusText} [code=${r.status}]`);
    }
    return r.data;
  });
};

export const getK8SUDNIds = (): Promise<string[]> => {
  return axios.get(ContextSingleton.getHost() + '/api/k8s/resources/udnIds').then(r => {
    if (r.status >= 400) {
      throw new Error(`${r.statusText} [code=${r.status}]`);
    }
    return r.data;
  });
};

export const getFlowMetrics = (params: FlowQuery, range: number | TimeRange): Promise<FlowMetricsResult> => {
  return getFlowMetricsGeneric(params, res => {
    return parseTopologyMetrics(
      res.result as RawTopologyMetrics[],
      range,
      params.aggregateBy as FlowScope,
      res.unixTimestamp,
      !isTimeMetric(params.type),
      res.stats.dataSources.includes('mock')
    );
  });
};

export const getFlowGenericMetrics = (
  q: StructuredFlowQuery,
  range: number | TimeRange
): Promise<GenericMetricsResult> => {
  const params = structuredToRawQuery(q);
  return getFlowMetricsGeneric(params, res => {
    return parseGenericMetrics(
      res.result as RawTopologyMetrics[],
      range,
      params.aggregateBy as Field,
      res.unixTimestamp,
      !isTimeMetric(params.type),
      res.stats.dataSources.includes('mock')
    );
  });
};

const getFlowMetricsGeneric = <T>(
  params: FlowQuery,
  mapper: (raw: AggregatedQueryResponse) => T
): Promise<{ metrics: T; stats: Stats }> => {
  return axios.get(ContextSingleton.getHost() + '/api/flow/metrics', { params }).then(r => {
    if (r.status >= 400) {
      throw new Error(`${r.statusText} [code=${r.status}]`);
    }
    const aggQR: AggregatedQueryResponse = r.data;
    return { metrics: mapper(aggQR), stats: aggQR.stats };
  });
};

export const getConfig = (): Promise<Config> => {
  return axios.get(ContextSingleton.getHost() + '/api/frontend-config').then(r => {
    if (r.status >= 400) {
      throw Error(`${r.statusText} [code=${r.status}]`);
    }
    if (!r.data) {
      return defaultConfig;
    }
    console.debug('BuildVersion:', r.data.buildVersion, 'BuildDate:', r.data.buildDate);
    return <Config>{
      buildVersion: r.data.buildVersion,
      buildDate: r.data.buildDate,
      recordTypes: r.data.recordTypes,
      panels: r.data.panels,
      columns: r.data.columns,
      portNaming: {
        enable: r.data.portNaming.enable ?? defaultConfig.portNaming.enable,
        portNames: r.data.portNaming.portNames
          ? new Map(Object.entries(r.data.portNaming.portNames))
          : defaultConfig.portNaming.portNames
      },
      filters: r.data.filters,
      scopes: r.data.scopes,
      quickFilters: r.data.quickFilters,
      alertNamespaces: r.data.alertNamespaces,
      sampling: r.data.sampling,
      features: r.data.features || defaultConfig.features,
      fields: r.data.fields || defaultConfig.fields,
      dataSources: r.data.dataSources || defaultConfig.dataSources,
      promLabels: r.data.promLabels || defaultConfig.promLabels,
      lokiLabels: r.data.lokiLabels || defaultConfig.lokiLabels,
      maxChunkAgeMs: r.data.maxChunkAgeMs,
      recordingAnnotations: r.data.recordingAnnotations || defaultConfig.recordingAnnotations
    };
  });
};

export const getLokiReady = (): Promise<string> => {
  return axios.get(ContextSingleton.getHost() + '/api/loki/ready').then(r => {
    if (r.status >= 400) {
      throw new Error(`${r.statusText} [code=${r.status}]`);
    }
    return r.data;
  });
};

export const getLokiMetrics = (): Promise<string> => {
  return axios.get(ContextSingleton.getHost() + '/api/loki/metrics').then(r => {
    if (r.status >= 400) {
      throw new Error(`${r.statusText} [code=${r.status}]`);
    }
    return r.data;
  });
};

export const getBuildInfo = (): Promise<unknown> => {
  return axios.get(ContextSingleton.getHost() + '/api/loki/buildinfo').then(r => {
    if (r.status >= 400) {
      throw new Error(`${r.statusText} [code=${r.status}]`);
    }
    return r.data;
  });
};

export const getLimits = (): Promise<unknown> => {
  return axios.get(ContextSingleton.getHost() + '/api/loki/config/limits').then(r => {
    if (r.status >= 400) {
      throw new Error(`${r.statusText} [code=${r.status}]`);
    }
    return r.data;
  });
};
