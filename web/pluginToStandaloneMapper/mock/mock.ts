import _ from 'lodash';
import { flowCollectorSchema, flowMetricSchema, flowCollectorSliceSchema } from '../schemas';
import { getFlowCollectorJS, getFlowMetricJS, getFlowCollectorSliceJS } from '../templates';

const mockFlowCollector = () => {
  const fc = _.cloneDeep(getFlowCollectorJS());
  fc.spec!.loki.enable = false;
  fc.spec!.exporters = [{ type: "Kafka" }, { type: "OpenTelemetry" }]
  fc.status = {
    "conditions": [
      {
        "lastTransitionTime": "2025-04-08T09:01:44Z",
        "message": "4 ready components, 0 with failure, 1 pending",
        "reason": "Ready,Degraded",
        "status": "True",
        "type": "Ready"
      },
      {
        "lastTransitionTime": "2025-04-08T09:01:43Z",
        "message": "",
        "reason": "Valid",
        "status": "False",
        "type": "ConfigurationIssue"
      },
      {
        "lastTransitionTime": "2025-04-08T09:01:44Z",
        "message": "",
        "reason": "Ready",
        "status": "True",
        "type": "AgentReady"
      },
      {
        "lastTransitionTime": "2025-04-08T09:01:45Z",
        "message": "",
        "reason": "Ready",
        "status": "True",
        "type": "ProcessorReady"
      },
      {
        "lastTransitionTime": "2025-04-08T09:01:44Z",
        // eslint-disable-next-line max-len
        "message": "Deployment netobserv-plugin not ready: 1/1 (Deployment does not have minimum availability.)",
        "reason": "DeploymentNotReady",
        "status": "False",
        "type": "PluginReady"
      },
      {
        "lastTransitionTime": "2025-04-08T09:01:44Z",
        "message": "",
        "reason": "Ready",
        "status": "True",
        "type": "MonitoringReady"
      },
      {
        "lastTransitionTime": "2026-01-15T16:05:26Z",
        // eslint-disable-next-line max-len
        "message": "LokiStack has warnings [name: loki, namespace: netobserv]: Warning: schema needs update",
        "reason": "LokiStackWarnings",
        "status": "True",
        "type": "LokiWarning"
      }
    ],
    "components": {
      "agent": {
        "state": "Ready",
        "desiredReplicas": 3,
        "readyReplicas": 3
      },
      "processor": {
        "state": "Ready",
        "desiredReplicas": 1,
        "readyReplicas": 1
      },
      "plugin": {
        "state": "InProgress",
        "reason": "DeploymentNotReady",
        // eslint-disable-next-line max-len
        "message": "Deployment netobserv-plugin not ready: 1/1",
        "desiredReplicas": 1,
        "readyReplicas": 0
      }
    },
    "integrations": {
      "monitoring": {
        "state": "Ready"
      },
      "loki": {
        "state": "Unused"
      },
      "exporters": [
        {
          "name": "kafka-exporter",
          "type": "Kafka",
          "state": "Ready",
          "reason": "Configured"
        },
        {
          "name": "otel-exporter",
          "type": "OpenTelemetry",
          "state": "Ready",
          "reason": "Configured"
        }
      ]
    }
  };
  return fc;
};

// File only used in tests console
export function mockK8SResource(req: any, setResource: (r: any) => void, setLoaded: (r: boolean) => void, isReload: boolean, onChange: () => void) {
  const kind = req.kind || req.groupVersionKind.kind;
  // simulate a loading
  if (!isReload) {
    setTimeout(() => {
      switch (kind) {
        case 'CustomResourceDefinition':
          if (req.name === 'flowcollectors.flows.netobserv.io') {
            setResource({
              apiVersion: 'apiextensions.k8s.io/v1',
              kind: 'CustomResourceDefinition',
              metadata: {
                name: req.name
              },
              spec: {
                group: 'flows.netobserv.io',
                names: {
                  kind: 'FlowCollector',
                  plural: 'flowcollectors'
                },
                scope: 'Cluster',
                versions: [{
                  name: 'v1beta2',
                  served: true,
                  storage: true,
                  schema: {
                    openAPIV3Schema: flowCollectorSchema,
                  }
                }]
              }
            });
          } else if (req.name === 'flowcollectorslices.flows.netobserv.io') {
            setResource({
              apiVersion: 'apiextensions.k8s.io/v1',
              kind: 'CustomResourceDefinition',
              metadata: {
                name: req.name
              },
              spec: {
                group: 'flows.netobserv.io',
                names: {
                  kind: 'FlowCollectorSlice',
                  plural: 'flowcollectorslices'
                },
                scope: 'Namespaced',
                versions: [{
                  name: 'v1alpha1',
                  served: true,
                  storage: true,
                  schema: {
                    openAPIV3Schema: flowCollectorSliceSchema
                  }
                }]
              }
            });
          } else {
            setResource({
              apiVersion: 'apiextensions.k8s.io/v1',
              kind: 'CustomResourceDefinition',
              metadata: {
                name: req.name
              },
              spec: {
                group: 'flows.netobserv.io',
                names: {
                  kind: 'FlowMetric',
                  plural: 'flowmetrics'
                },
                scope: 'Namespaced',
                versions: [{
                  name: 'v1alpha1',
                  served: true,
                  storage: true,
                  schema: {
                    openAPIV3Schema: flowMetricSchema
                  }
                }]
              }
            });
          }
          break;
        case 'FlowCollector':
          setResource(mockFlowCollector());
          onChange();
          break;
        case 'FlowCollectorSlice':
          if (req.name === 'flowcollectorslice-sample') {
            const fcs = _.cloneDeep(getFlowCollectorSliceJS());
            setResource(fcs);
          }
          break;
        case 'FlowMetric':
          if (req.name === 'flowmetric-sample') {
            const fm = _.cloneDeep(getFlowMetricJS());
            fm.spec!.metricName = 'test_metric';
            setResource(fm);
          }
          break;
      }
      setLoaded(true);
    }, 1000);
  } else if (kind === 'FlowCollector') {
    // simulate an update
    setTimeout(() => {
      const fc = mockFlowCollector();
      if (Math.random() < 0.7 && fc.status) {
        const states = ['Ready', 'InProgress', 'Degraded', 'Failure'];
        const r = Math.random();
        if (r < 0.5 && fc.status.components) {
          const comps = ['agent', 'processor', 'plugin'];
          const comp = comps[Math.floor(Math.random() * comps.length)];
          if (fc.status.components[comp]) {
            fc.status.components[comp].state = states[Math.floor(Math.random() * states.length)];
          }
        } else if (fc.status.integrations) {
          if (fc.status.integrations.monitoring) {
            fc.status.integrations.monitoring.state = states[Math.floor(Math.random() * states.length)];
          }
        }
      }
      setResource(fc);
      onChange();
    }, 10000);
  }
}
