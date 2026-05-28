// File only used in tests or dev console

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  K8sGroupVersionKind,
  K8sModel,
  K8sResourceKindReference,
  NamespaceBarProps,
  PrometheusPollProps,
  PrometheusResponse,
  ResourceIconProps,
  ResourceLinkProps,
  ResourceYAMLEditorProps
} from '@openshift-console/dynamic-plugin-sdk';
import { CodeEditor, Language } from '@patternfly/react-code-editor';
import _ from 'lodash';
import * as React from 'react';
import { useK8sModelsWithColors } from '../src/utils/k8s-models-hook';
import { useTheme } from '../src/utils/theme-hook';
import { safeJSToYAML } from '../src/utils/yaml';
import { k8sModels } from './k8s-models';
import { Config } from '../src/model/config';
import { loadConfig } from '../src/utils/config';
import { mockK8SResource } from './mock/mock';
import { getFlowCollector } from '../src/api/routes';

// This Mapper is used to resolve @Console imports from @openshift-console for JEST / Standalone
// You can add any exports needed here
// Check "moduleNameMapper" in package.json for jest
// and "NormalModuleReplacementPlugin" in webpack.standalone.js
export class Mapper extends Error {
  constructor() {
    super('Mapper file for standalone exports');
  }
}

export function isModelFeatureFlag(_e: never) {
  return null;
}

export function useResolvedExtensions(_isModelFeatureFlag: boolean) {
  return [
    [{
      flags: {
        required: ["dummy"],
      },
      model: "",
    }],
    undefined, undefined];
}

export function useK8sModels() {
  return [
    k8sModels,
    false
  ]
}

export function getK8sModel(k8s: any, _k8sGroupVersionKind?: K8sResourceKindReference | K8sGroupVersionKind): K8sModel {
  const models = Object.keys(k8sModels);

  for (let i = 0; i < models.length; i++) {
    const model = (k8sModels as any)[models[i]];
    if (model.kind === k8s.kind) {
      return model;
    }
  }

  return {
    abbr: '',
    kind: '',
    label: '',
    labelPlural: '',
    plural: '',
    apiVersion: ''
  };
}

export function k8sGet(k8s: any): Promise<any> {
  console.debug("k8sGet", k8s);
  return Promise.resolve(k8s);
}

export function k8sCreate(k8s: any): Promise<any> {
  console.debug("k8sCreate", k8s);
  return Promise.resolve(k8s);
}

export function k8sUpdate(k8s: any): Promise<any> {
  console.debug("k8sUpdate", k8s);
  return Promise.resolve(k8s);
}

export function k8sDelete(k8s: any): Promise<any> {
  console.debug("k8sDelete", k8s);
  return Promise.resolve(k8s);
}

export function useK8sWatchResource(req: any) {
  const [loaded, setLoaded] = React.useState(false);
  const [resource, setResource] = React.useState<any | null>(null);
  const [error, setError] = React.useState<any | null>(null);
  const [config, setConfig] = React.useState<Config | null>(null);
  const [reloads, setReloads] = React.useState(0);

  React.useEffect(() => {
    loadConfig().then(v => {
      setConfig(v.config);
    });
  }, []);

  React.useEffect(() => {
    if (!config) {
      return
    }
    if (!req) {
      setError("useK8sWatchResource: No request provided");
      return;
    }

    if (config.consoleMode === 'Mock') {
      setError(null);
      mockK8SResource(req, setResource, setLoaded, reloads > 0, () => setReloads(reloads+1));
    } else {
      console.log('calling API');
      if (req.groupVersionKind?.kind === 'FlowCollector') {
        getFlowCollector().then(fc => {
          setResource(fc);
          setLoaded(true);
          setError(null);
        }).catch(err => {
          setError(err);
          setLoaded(true);
        });
      } else {
        setResource(null);
        setLoaded(true);
      }
    }
  }, [req?.groupVersionKind?.kind, req?.name, req?.namespace, config?.consoleMode, reloads]);

  return React.useMemo(() => {
    return [resource || null, loaded, error];
  }, [loaded, resource, error]);
}

export const ResourceIcon: React.FC<ResourceIconProps & { children?: React.ReactNode }> = ({
  className,
  kind,
  children,
}) => {
  const k8sModels = useK8sModelsWithColors();

  return (
    <span className={className}>
      {k8sModels[kind!] && <span
        className="co-m-resource-icon"
        style={{ backgroundColor: k8sModels[kind!].color }}
        title={kind}>
        {k8sModels[kind!].abbr}
      </span>}
      {children}
    </span>
  );
};

export const ResourceLink: React.FC<ResourceLinkProps> = ({
  className,
  displayName,
  kind,
  name,
  children,
  dataTest,
}) => {
  const k8sModels = useK8sModelsWithColors();
  const value = displayName ? displayName : name;

  return (
    <span className={className}>
      {k8sModels[kind!] && <span
        className="co-m-resource-icon"
        style={{ backgroundColor: k8sModels[kind!].color }}
        title={kind}>
        {k8sModels[kind!].abbr}
      </span>}
      <span className="co-resource-item__resource-name" data-test-id={value} data-test={dataTest}>
        {value}
      </span>
      {children}
    </span>
  );
};

export const NamespaceBar: React.FC<NamespaceBarProps> = ({
  children
}) => {
  return (
    <div>{children}</div>
  )
};

export const ResourceYAMLEditor: React.FC<ResourceYAMLEditorProps> = ({
  initialResource,
  header,
  onSave,
}) => {
  const isDarkTheme = useTheme();
  const containerHeight = document.getElementById("editor-content-container")?.clientHeight || 800;
  const footerHeight = document.getElementById("editor-toggle-footer")?.clientHeight || 0;
  return (<>
    <CodeEditor
      isDarkTheme={isDarkTheme}
      isLineNumbersVisible={true}
      isReadOnly={false}
      isMinimapVisible={true}
      isLanguageLabelVisible
      code={safeJSToYAML(initialResource)}
      language={Language.yaml}
      height={`${containerHeight - footerHeight}px`}
      onChange={(value) => onSave && onSave(value)}
    />
  </>);
};

export enum K8sResourceConditionStatus {
  True = "True",
  False = "False",
  Unknown = "Unknown"
}

export enum PrometheusEndpoint {
  label = "api/v1/label",
  query = "api/v1/query",
  queryRange = "api/v1/query_range",
  rules = "api/v1/rules",
  targets = "api/v1/targets"
}

export function usePrometheusPoll(props: PrometheusPollProps) {
  console.log("usePrometheusPoll", props);

  const [response, setResponse] = React.useState<PrometheusResponse | null>(null);

  React.useEffect(() => {
    // simulate a loading
    if (response == null) {
      setTimeout(() => {
        setResponse({
          status: "success",
          data: {
            resultType: "vector",
            result: [
              {
                metric: {
                  node: "node-1",
                  namespace: "ns-1",
                  pod: "pod-1",
                },
                value: [
                  1745832954.698,
                  "2000"
                ]
              },
              {
                metric: {
                  node: "node-2",
                  namespace: "ns-2",
                  pod: "pod-1",
                },
                value: [
                  1745832954.698,
                  "100"
                ]
              },
              {
                metric: {
                  node: "node-3",
                  namespace: "ns-1",
                  pod: "pod-1",
                },
                value: [
                  1745832954.698,
                  "400"
                ]
              },
            ],
          }
        });
      }, 1000);
    }
  }, [response]);

  return React.useMemo(() => {
    if (response == null) {
      return [null, false, null];
    } else {
      return [response, true, null];
    }
  }, [response]);
}
