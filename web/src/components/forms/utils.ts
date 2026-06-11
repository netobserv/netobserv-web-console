/* eslint-disable @typescript-eslint/no-explicit-any */
import { K8sResourceCondition, K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk';
import { UiSchema } from '@rjsf/utils';
import _ from 'lodash';
import { ClusterServiceVersionKind } from './types';

export type FlowCollectorOverallStatus = 'ready' | 'degraded' | 'pending' | 'error' | 'onHold' | 'loading';

export const getFlowCollectorOverallStatus = (
  cr: K8sResourceKind | undefined,
  loadError: unknown
): { status: FlowCollectorOverallStatus; message?: string } => {
  if (loadError) {
    return { status: 'error', message: String(loadError) };
  }
  if (!cr) {
    return { status: 'loading' };
  }
  if (cr.spec?.execution?.mode === 'OnHold') {
    return { status: 'onHold' };
  }
  const conditions = cr.status?.conditions as K8sResourceCondition[] | undefined;
  if (!conditions) {
    return { status: 'pending' };
  }
  const message =
    conditions
      .filter(c => c.type !== 'Ready' && c.status === 'True' && c.message)
      .map(c => c.message)
      .join('; ') || undefined;
  const readyCondition = conditions.find(c => c.type === 'Ready');
  if (readyCondition?.status === 'True') {
    if (readyCondition.reason === 'Ready,Degraded') {
      return { status: 'degraded', message };
    }
    return { status: 'ready' };
  }
  if (readyCondition?.status === 'False') {
    return readyCondition.reason === 'Pending' ? { status: 'pending' } : { status: 'error', message };
  }
  return { status: 'pending' };
};

export const appendRecursive = (obj: any, key: string, value?: string) => {
  if (!obj) {
    return obj;
  }

  const originalKey = `${key}_original`;
  if (value !== undefined) {
    // backup original value if exists
    if (obj[key]) {
      obj[originalKey] = obj[key];
    }
    // set key / value
    obj[key] = value;
  } else if (obj[originalKey]) {
    // restore original key
    obj[key] = obj[originalKey];
  } else {
    // delete the key
    delete obj[key];
  }

  // recursively apply key and value on all children objects
  Object.keys(obj).forEach(k => {
    if (typeof obj[k] === 'object') {
      obj[k] = appendRecursive(obj[k], key, value);
    }
  });
  return obj;
};

export const setFlat = (obj: any) => {
  if (!obj) {
    return obj;
  }

  // show current object
  delete obj['ui:widget'];
  // hide accordion
  obj['ui:flat'] = 'true';
  return obj;
};

export const getFilteredUISchema = (ui: UiSchema, paths: string[]) => {
  // clone provided ui schema to avoid altering original object
  const clonedSchema = _.cloneDeep(ui);
  // hide all the fields
  const filteredUi = appendRecursive(clonedSchema, 'ui:widget', 'hidden');
  // show expected ones
  paths.forEach((path: string) => {
    const keys = path.split('.');
    let current = filteredUi;
    keys.forEach(key => {
      setFlat(current);
      // move to next item
      current = current[key];
    });
    setFlat(current);
    // show all the fields under specified path
    current = appendRecursive(current, 'ui:widget');
  });

  return filteredUi;
};

export const getUpdatedCR = (data: any, updatedData: any) => {
  // Only merge metadata and spec from the form event. Return a new object so parent
  // setState always sees a new reference; in-place mutation + same ref skips React
  // re-renders, which breaks ui:dependency fields (e.g. Loki monolithic) until some
  // unrelated update (e.g. a K8s watch) forces a redraw.
  return {
    ...(data ?? {}),
    metadata: updatedData.metadata,
    spec: updatedData.spec
  };
};

export const exampleForModel = (csv: ClusterServiceVersionKind, group: string, version: string, kind: string) => {
  return parseALMExamples(csv).find((s: K8sResourceKind) => s.kind === kind && s.apiVersion === `${group}/${version}`);
};

export const parseALMExamples = (csv: ClusterServiceVersionKind): K8sResourceKind[] => {
  try {
    return JSON.parse(csv?.metadata?.annotations?.['alm-examples'] ?? '[]');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Unable to parse ALM expamples\n', e);
    return [];
  }
};
