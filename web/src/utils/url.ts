/**
 * URL utilities and navigation helpers
 *
 * All router imports centralized here.
 * - Wrap useNavigate to provide stable reference across renders
 * - Components use navigate(path) instead of history.push(path)
 * - Components use navigate(-1) instead of history.goBack()
 */
import _ from 'lodash';
import { useCallback, useRef } from 'react';
import { Link as RouterLink, useNavigate as useRouterNavigate, useParams as useRouterParams } from 'react-router';

export { RouterLink as Link };

/**
 * Stable wrapper around useNavigate to prevent re-render issues.
 * Returns a memoized navigate function that doesn't change reference between renders.
 *
 * NOTE: This hook must be used within a Router context. Both Console and standalone
 * app provide this context (Console via its router, standalone via BrowserRouter).
 */
export const useNavigate = () => {
  const navigate = useRouterNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  // Return a stable callback that uses the ref
  return useCallback((to: string | number) => {
    if (typeof to === 'number') {
      navigateRef.current(to);
    } else {
      navigateRef.current(to);
    }
  }, []); // Empty deps - never changes reference
};

/**
 * Wrapper around useParams for consistent usage.
 *
 * NOTE: This hook must be used within a Router context. Both Console and standalone
 * app provide this context (Console via its router, standalone via BrowserRouter).
 */
export const useParams = <T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T => {
  return useRouterParams() as T;
};

export const netflowTrafficPath = '/netflow-traffic';
export const flowCollectorBasePath = '/k8s/cluster/flows.netobserv.io~v1beta2~FlowCollector';
export const flowCollectorNewPath = `${flowCollectorBasePath}/~new`;
export const flowCollectorSetupPath = `${flowCollectorBasePath}/setup`;
export const flowCollectorEditPath = `${flowCollectorBasePath}/edit`;
export const flowCollectorStatusPath = `${flowCollectorBasePath}/status`;

const flowCollectorPathSegment = (pathname: string = window.location.pathname): string | undefined => {
  const prefix = `${flowCollectorBasePath}/`;
  if (!pathname.startsWith(prefix)) {
    return undefined;
  }
  return pathname.slice(prefix.length).split('/')[0] || undefined;
};

/** True on Console "Create" routes (`~new` form bypass and wizard `setup`). */
export const isFlowCollectorCreatePath = (pathname: string = window.location.pathname): boolean => {
  const segment = flowCollectorPathSegment(pathname);
  return segment === '~new' || segment === 'setup';
};

/**
 * Resolves the FlowCollector instance name from the URL on edit/yaml routes.
 * Form routes use static segments (e.g. `/edit`, `/cluster/yaml`) rather than a `:name` param
 * because `/cluster` is reserved for the status page.
 */
export const getFlowCollectorResourceName = (pathname: string = window.location.pathname): string | undefined => {
  if (isFlowCollectorCreatePath(pathname)) {
    return undefined;
  }
  const segment = flowCollectorPathSegment(pathname);
  if (!segment) {
    return undefined;
  }
  if (segment === 'edit' || segment === 'cluster') {
    return 'cluster';
  }
  return segment;
};
export const flowMetricNewPath = '/k8s/cluster/flows.netobserv.io~v1alpha1~FlowMetric/~new';
export const flowCollectorSliceNewPath = '/k8s/cluster/flows.netobserv.io~v1alpha1~FlowCollectorSlice/~new';

// React-router query argument (not backend routes)
export enum URLParam {
  StartTime = 'startTime',
  EndTime = 'endTime',
  TimeRange = 'timeRange',
  Filters = 'filters',
  RefreshInterval = 'refresh',
  Limit = 'limit',
  Percentile = 'percentile',
  Match = 'match',
  PacketLoss = 'packetLoss',
  RecordType = 'recordType',
  DataSource = 'dataSource',
  ShowDuplicates = 'showDup',
  MetricFunction = 'function',
  MetricType = 'type',
  // Network Health filters (prefixed to avoid mixing with the Traffic params above,
  // which have LogQL-specific encoding)
  HealthSeverity = 'healthSeverity',
  HealthStatus = 'healthStatus',
  HealthMode = 'healthMode',
  HealthNamespace = 'healthNamespace',
  HealthName = 'healthName'
}
export type URLParams = { [k in URLParam]?: unknown };

export const hasEmptyParams = () => {
  return _.isEmpty(window.location.search);
};

export const getURLParams = () => {
  return new URLSearchParams(window.location.search);
};

export const getURLParam = (arg: URLParam) => {
  return getURLParams().get(arg);
};

export const getURLParamAsNumber = (arg: URLParam) => {
  const q = getURLParam(arg);
  if (q && !isNaN(Number(q))) {
    return Number(q);
  }
  return null;
};

export const getURLParamAsBool = (arg: URLParam) => {
  const q = getURLParam(arg);
  if (q) {
    return q === 'true';
  }
  return null;
};

export const setURLParams = (params: string) => {
  const url = new URL(window.location.href);
  const sp = new URLSearchParams(params);
  window.history.pushState({}, '', `${url.pathname}?${sp.toString()}${url.hash}`);
};

export const setURLParam = (param: URLParam, value: string, replace?: boolean) => {
  const url = new URL(window.location.href);
  const params = new URLSearchParams(window.location.search);
  params.set(param, value);
  if (replace) {
    window.history.replaceState({}, '', `${url.pathname}?${params.toString()}${url.hash}`);
  } else {
    window.history.pushState({}, '', `${url.pathname}?${params.toString()}${url.hash}`);
  }
};

export const setSomeURLParams = (params: Map<URLParam, string>, replace?: boolean) => {
  const url = new URL(window.location.href);
  const sp = new URLSearchParams(window.location.search);
  params.forEach((v, k) => sp.set(k, v));
  if (replace) {
    window.history.replaceState({}, '', `${url.pathname}?${sp.toString()}${url.hash}`);
  } else {
    window.history.pushState({}, '', `${url.pathname}?${sp.toString()}${url.hash}`);
  }
};

export const removeURLParam = (param: URLParam, replace?: boolean) => {
  const params = new URLSearchParams(window.location.search);
  if (params.has(param)) {
    params.delete(param);
    const url = new URL(window.location.href);
    if (replace) {
      window.history.replaceState({}, '', `${url.pathname}?${params.toString()}${url.hash}`);
    } else {
      window.history.pushState({}, '', `${url.pathname}?${params.toString()}${url.hash}`);
    }
  }
};

export const clearURLParams = () => {
  const url = new URL(window.location.href);
  console.info('clearing url parameters ' + url);
  window.history.pushState({}, '', url.pathname);
};

export const getPathWithParams = (pathName = '') => {
  return `${pathName}?${new URLSearchParams(window.location.search).toString()}`;
};

// Navigation helpers - utility functions
export const navigateTo = (path: string) => {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

export const navigateBack = () => {
  window.history.back();
};
