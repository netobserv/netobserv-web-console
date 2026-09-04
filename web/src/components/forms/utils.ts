/* eslint-disable @typescript-eslint/no-explicit-any */
import { K8sResourceCondition, K8sResourceKind } from '@openshift-console/dynamic-plugin-sdk';
import { UiSchema } from '@rjsf/utils';
import _ from 'lodash';
import { ClusterServiceVersionKind } from './types';

export type FlowCollectorOverallStatus = 'ready' | 'degraded' | 'pending' | 'error' | 'onHold' | 'deleting' | 'loading';

type K8sErrorLike = {
  message?: string;
  code?: number;
  status?: number;
  response?: { status?: number };
  json?: { message?: string; code?: number; reason?: string };
};

/** Human-readable message from a K8s/Console rejection (avoids "[object Object]"). */
export const k8sErrorMessage = (error: unknown): string => {
  if (!error) {
    return '';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  const e = error as K8sErrorLike;
  if (typeof e.message === 'string' && e.message) {
    return e.message;
  }
  if (typeof e.json?.message === 'string' && e.json.message) {
    return e.json.message;
  }
  return String(error);
};

/** True when a K8s watch/API error indicates the requested resource does not exist. */
export const isK8sNotFoundError = (error: unknown): boolean => {
  if (!error) {
    return false;
  }
  const e = error as K8sErrorLike;
  if (e.code === 404 || e.json?.code === 404 || e.response?.status === 404 || e.status === 404) {
    return true;
  }
  if (e.json?.reason === 'NotFound') {
    return true;
  }
  return /not found/i.test(k8sErrorMessage(error));
};

/** A 409 means the caller held a stale resourceVersion — re-fetch and retry the write. */
export const isK8sConflictError = (error: unknown): boolean => {
  if (!error) {
    return false;
  }
  const e = error as K8sErrorLike;
  if (e.code === 409 || e.json?.code === 409 || e.response?.status === 409 || e.status === 409) {
    return true;
  }
  if (e.json?.reason === 'Conflict') {
    return true;
  }
  return /conflict|the object has been modified/i.test(k8sErrorMessage(error));
};

export const getFlowCollectorOverallStatus = (
  cr: K8sResourceKind | undefined,
  loadError: unknown
): { status: FlowCollectorOverallStatus; message?: string } => {
  if (loadError && !isK8sNotFoundError(loadError)) {
    return { status: 'error', message: k8sErrorMessage(loadError) };
  }
  if (!cr) {
    return { status: 'loading' };
  }
  // Prefer this over watch-only: operator ≥1.5 no longer keeps a finalizer, so the
  // terminating window is often invisible to useK8sWatchResource. Callers can stamp
  // deletionTimestamp locally after k8sDelete succeeds.
  if (cr.metadata?.deletionTimestamp) {
    return { status: 'deleting' };
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
