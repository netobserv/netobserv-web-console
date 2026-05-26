// File only used in tests or dev console

import { K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk';
import { safeYAMLToJS } from '../src/utils/yaml';

const flowCollector = `
apiVersion: flows.netobserv.io/v1beta2
kind: FlowCollector
metadata:
  name: cluster
spec:
  namespace: netobserv
  deploymentModel: Direct
  networkPolicy:
    enable: false
    additionalNamespaces: []
  agent:
    type: eBPF
    ebpf:
      imagePullPolicy: IfNotPresent
      logLevel: info
      sampling: 50
      cacheActiveTimeout: 5s
      cacheMaxFlows: 100000
      privileged: false
      interfaces: []
      excludeInterfaces:
        - lo
      kafkaBatchSize: 1048576
      metrics:
        server:
          port: 9400
      resources:
        requests:
          memory: 50Mi
          cpu: 100m
        limits:
          memory: 800Mi
  kafka:
    address: kafka-cluster-kafka-bootstrap.netobserv
    topic: network-flows
    tls:
      enable: false
      caCert:
        type: secret
        name: kafka-cluster-cluster-ca-cert
        certFile: ca.crt
      userCert:
        type: secret
        name: flp-kafka
        certFile: user.crt
        certKey: user.key
  processor:
    imagePullPolicy: IfNotPresent
    logLevel: info
    logTypes: Flows
    metrics:
      server:
        port: 9401
      disableAlerts: []
    kafkaConsumerReplicas: 3
    kafkaConsumerAutoscaler: null
    kafkaConsumerQueueCapacity: 1000
    kafkaConsumerBatchSize: 10485760
    resources:
      requests:
        memory: 100Mi
        cpu: 100m
      limits:
        memory: 800Mi
  loki:
    enable: true
    mode: Monolithic
    monolithic:
      url: 'http://loki.netobserv.svc:3100/'
      tenantID: netobserv
      tls:
        enable: false
        caCert:
          type: configmap
          name: loki-gateway-ca-bundle
          certFile: service-ca.crt
    lokiStack:
      name: loki
    readTimeout: 30s
    writeTimeout: 10s
    writeBatchWait: 1s
    writeBatchSize: 10485760
  prometheus:
    querier:
      enable: true
      mode: Auto
      timeout: 30s
  consolePlugin:
    enable: true
    imagePullPolicy: IfNotPresent
    logLevel: info
    portNaming:
      enable: true
      portNames:
        '3100': loki
    quickFilters:
      - name: Applications
        filter:
          flow_layer: '"app"'
        default: true
      - name: Infrastructure
        filter:
          flow_layer: '"infra"'
      - name: Pods network
        filter:
          src_kind: '"Pod"'
          dst_kind: '"Pod"'
        default: true
      - name: Services network
        filter:
          dst_kind: '"Service"'
    resources:
      requests:
        memory: 50Mi
        cpu: 100m
      limits:
        memory: 100Mi
  exporters: []
`;

let flowCollectorJS: K8sResourceKind | null = null;
export const getFlowCollectorJS = (): K8sResourceKind => {
  if (flowCollectorJS === null) {
    flowCollectorJS = safeYAMLToJS(flowCollector);
  }
  return flowCollectorJS!;
};

// use an alternative sample for forms to avoid forcing the user to remove the filters / queries
const flowMetricDefaultForm = `
apiVersion: flows.netobserv.io/v1alpha1
kind: FlowMetric
metadata:
  name: flowmetric-sample
  namespace: netobserv
spec:
  type: Counter
  valueField: Bytes
  direction: Ingress
`;

let flowMetricJS: K8sResourceKind | null = null;
export const getFlowMetricJS = (): K8sResourceKind => {
  if (flowMetricJS === null) {
    flowMetricJS = safeYAMLToJS(flowMetricDefaultForm);
  }
  return flowMetricJS!;
};

const flowCollectorSliceDefaultForm = `
apiVersion: flows.netobserv.io/v1alpha1
kind: FlowCollectorSlice
metadata:
  name: flowCollectorSlice-sample
spec:
  sampling: 1
`;

let flowCollectorSliceJS: K8sResourceKind | null = null;
export const getFlowCollectorSliceJS = (): K8sResourceKind => {
  if (flowCollectorSliceJS === null) {
    flowCollectorSliceJS = safeYAMLToJS(flowCollectorSliceDefaultForm);
  }
  return flowCollectorSliceJS!;
};
