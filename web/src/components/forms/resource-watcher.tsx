/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  k8sCreate,
  k8sDelete,
  k8sGet,
  K8sResourceKind,
  k8sUpdate,
  useK8sWatchResource
} from '@openshift-console/dynamic-plugin-sdk';
import { Bullseye, Spinner } from '@patternfly/react-core';
import { JSONSchema7 } from 'json-schema';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useK8sModel } from '../../utils/k8s-models-hook';
import { ErrorComponent } from '../messages/error';
import { prune } from './dynamic-form/utils';
import './forms.css';
import { ClusterServiceVersionKind, CustomResourceDefinitionKind } from './types';
import { exampleForModel, isK8sNotFoundError, k8sErrorMessage } from './utils';

export type SupportedKind = 'FlowCollector' | 'FlowCollectorSlice' | 'FlowMetric';
type DefaultFrom = 'CSVExample' | 'CRD' | 'None';
const MISSING_RESOURCE_WATCH_CONFIRMATION_DELAY_MS = 1000;
/** Poll interval after delete: Console watch cache can miss DELETED and stay stale until remount. */
const DELETE_ABSENCE_POLL_MS = 1500;
/** Cap delete-absence polling (~30s) so a stuck CR or non-404 GET cannot loop forever. */
const DELETE_ABSENCE_MAX_ATTEMPTS = 20;

export type ResourceWatcherProps = {
  group: string;
  version: string;
  kind: SupportedKind;
  name?: string;
  namespace?: string;
  onSuccess?: (data: any) => void;
  children: JSX.Element;
  skipErrors?: boolean;
  skipCRError?: boolean;
  /** Render children without waiting for the CR watch to finish (e.g. missing resource). */
  skipCRLoading?: boolean;
  defaultFrom: DefaultFrom;
};

export type ResourceWatcherContext = {
  group: string;
  version: string;
  kind: SupportedKind;
  isUpdate: boolean;
  /** True when the CR watch returned data or reported loaded. */
  crLoaded: boolean;
  /** True when the CR presence is known (exists, missing, or errored). */
  crResolved: boolean;
  schema: JSONSchema7 | null;
  data: K8sResourceKind;
  onSubmit: (data: K8sResourceKind, isDelete?: boolean) => void | Promise<void>;
  loadError: any;
  errors: string[];
  setErrors: (errors: string[]) => void;
  skipDefaults: boolean;
};

export const { Provider, Consumer } = React.createContext<ResourceWatcherContext>({
  group: '',
  version: '',
  kind: '' as SupportedKind,
  isUpdate: false,
  crLoaded: false,
  crResolved: false,
  schema: null,
  data: {},
  onSubmit: () => {
    console.error('onSubmit is not initialized !');
  },
  loadError: null,
  errors: [],
  setErrors: (errs: string[]) => {
    console.error('setErrors is not initialized !', errs);
  },
  skipDefaults: false
});

export const ResourceWatcher: FC<ResourceWatcherProps> = ({
  group,
  version,
  kind,
  name,
  namespace,
  onSuccess,
  children,
  skipErrors,
  skipCRError,
  skipCRLoading,
  defaultFrom
}) => {
  if (!group || !version || !kind) {
    throw new Error('ResourceForm error: apiVersion and kind must be provided');
  }
  const { t } = useTranslation('plugin__netobserv-plugin');

  const [matchingCSVs, csvLoaded, csvLoadError] = useK8sWatchResource<ClusterServiceVersionKind[]>({
    groupVersionKind: {
      group: 'operators.coreos.com',
      version: 'v1alpha1',
      kind: 'ClusterServiceVersion'
    },
    kind: 'ClusterServiceVersion',
    namespace: 'openshift-netobserv-operator',
    isList: true
  });
  const [crd, crdLoaded, crdLoadError] = useK8sWatchResource<CustomResourceDefinitionKind>({
    groupVersionKind: {
      group: 'apiextensions.k8s.io',
      version: 'v1',
      kind: 'CustomResourceDefinition'
    },
    kind: 'CustomResourceDefinition',
    name:
      kind === 'FlowCollector'
        ? 'flowcollectors.flows.netobserv.io'
        : kind === 'FlowCollectorSlice'
          ? 'flowcollectorslices.flows.netobserv.io'
          : 'flowmetrics.flows.netobserv.io',
    isList: false
  });
  const [cr, crLoaded, crLoadError] = useK8sWatchResource<K8sResourceKind>(
    name
      ? {
          groupVersionKind: {
            group,
            version,
            kind
          },
          kind,
          name,
          namespace,
          isList: false
        }
      : null
  );

  const model = useK8sModel(group, version, kind);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [missingConfirmed, setMissingConfirmed] = React.useState(false);
  // After delete: Console useK8sWatchResource can miss DELETED and keep a stale CR until remount.
  // Track the deleted uid, keep a local snapshot for UI, and confirm absence with k8sGet.
  const [deletingSnapshot, setDeletingSnapshot] = React.useState<K8sResourceKind | null>(null);
  const [deletedUid, setDeletedUid] = React.useState<string | undefined>();

  const watchUid = cr?.metadata?.uid;
  const watchHasCR = Boolean(cr?.metadata?.name || watchUid);
  // Ignore watch data that still points at the resource we just deleted.
  const isStaleWatchAfterDelete = Boolean(deletedUid && watchUid === deletedUid);
  const isCRPresent = watchHasCR && !isStaleWatchAfterDelete;
  const isDeleteInProgress = Boolean(deletingSnapshot);
  const deleteConfirmedAbsent = Boolean(deletedUid && !deletingSnapshot);
  const isCRLoaded = Boolean(!name || crLoaded || isCRPresent || isDeleteInProgress || deleteConfirmedAbsent);
  const isCRResolved = Boolean(
    isCRLoaded || crLoadError || deleteConfirmedAbsent || (skipCRLoading && missingConfirmed)
  );
  const crLoadErrorEffective =
    isCRPresent || isDeleteInProgress || isK8sNotFoundError(crLoadError) ? null : crLoadError;

  // Recreated CR (new uid) or watch finally cleared: stop treating watch as stale.
  React.useEffect(() => {
    if (deletedUid && !deletingSnapshot && (!watchUid || watchUid !== deletedUid)) {
      setDeletedUid(undefined);
    }
  }, [deletedUid, deletingSnapshot, watchUid]);

  // Confirm absence via GET — do not rely on the watch alone after delete.
  React.useEffect(() => {
    if (!deletingSnapshot || !model || !name) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const failDeletePoll = (err: unknown) => {
      setErrors([k8sErrorMessage(err) || t('Timed out waiting for resource deletion')]);
      // Fall back to watch data so the UI is not stuck in a deleting state.
      setDeletingSnapshot(null);
      setDeletedUid(undefined);
    };

    const pollUntilGone = () => {
      attempts += 1;
      if (attempts > DELETE_ABSENCE_MAX_ATTEMPTS) {
        failDeletePoll(t('Timed out waiting for resource deletion'));
        return;
      }
      k8sGet({ model, name, ns: namespace })
        .then(() => {
          if (cancelled) {
            return;
          }
          if (attempts >= DELETE_ABSENCE_MAX_ATTEMPTS) {
            failDeletePoll(t('Timed out waiting for resource deletion'));
          } else {
            timer = setTimeout(pollUntilGone, DELETE_ABSENCE_POLL_MS);
          }
        })
        .catch(err => {
          if (cancelled) {
            return;
          }
          if (isK8sNotFoundError(err)) {
            setDeletingSnapshot(null);
          } else if (attempts >= DELETE_ABSENCE_MAX_ATTEMPTS) {
            failDeletePoll(err);
          } else {
            timer = setTimeout(pollUntilGone, DELETE_ABSENCE_POLL_MS);
          }
        });
    };

    pollUntilGone();
    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [deletingSnapshot, model, name, namespace, t]);

  React.useEffect(() => {
    if (!skipCRLoading || !name) {
      setMissingConfirmed(false);
      return;
    }
    if (isCRPresent || isDeleteInProgress || crLoaded || crLoadError || deleteConfirmedAbsent) {
      setMissingConfirmed(false);
      return;
    }
    // useK8sWatchResource may never set loaded=true when the CR is absent; confirm after a short wait.
    const timer = setTimeout(() => setMissingConfirmed(true), MISSING_RESOURCE_WATCH_CONFIRMATION_DELAY_MS);
    return () => clearTimeout(timer);
  }, [skipCRLoading, name, isCRPresent, isDeleteInProgress, crLoaded, crLoadError, deleteConfirmedAbsent]);

  if (!skipErrors && (csvLoadError || crdLoadError || (!skipCRError && crLoadError))) {
    return (
      <ErrorComponent
        title={t('Unable to get {{kind}}', { kind })}
        error={`${csvLoadError || crdLoadError || crLoadError}`}
      />
    );
  } else if (
    !csvLoaded ||
    !crdLoaded ||
    (!skipCRError && !skipCRLoading && !crLoaded && !isDeleteInProgress && !deleteConfirmedAbsent)
  ) {
    return (
      <Bullseye data-test="loading-resource">
        <Spinner size="xl" />
      </Bullseye>
    );
  }

  let data: K8sResourceKind = { apiVersion: `${group}/${version}`, kind, metadata: { name: '' } };
  let useCRDDefaults = false;
  if (isDeleteInProgress || isCRPresent) {
    // While deleting, prefer the snapshot so a stale watch cannot hide deletionTimestamp.
    const source = (deletingSnapshot || cr) as K8sResourceKind;
    data = { apiVersion: `${group}/${version}`, kind, ...source };
    const deletionTimestamp = deletingSnapshot?.metadata?.deletionTimestamp || source.metadata?.deletionTimestamp;
    if (deletionTimestamp) {
      data = {
        ...data,
        metadata: {
          ...data.metadata,
          deletionTimestamp
        }
      };
    }
  } else if (defaultFrom === 'CSVExample') {
    const csv = matchingCSVs?.find(csv => csv.spec.customresourcedefinitions?.owned?.some(crd => crd.kind === kind));
    if (csv) {
      const fromCSV = exampleForModel(csv, group, version, kind);
      if (fromCSV) {
        data = fromCSV;
      } else {
        console.warn('could not find CR example in CSV for kind:', kind);
      }
    } else {
      console.warn('could not find CSV owning kind:', kind);
    }
  } else if (defaultFrom === 'CRD') {
    useCRDDefaults = true;
  }
  const schema = crd?.spec?.versions?.find(v => v.name === version)?.schema?.openAPIV3Schema || null;
  // force namespace to be present in the form when namespaced
  if (crd?.spec?.scope === 'Namespaced') {
    if (!data.metadata?.namespace) {
      data.metadata = { ...data.metadata, namespace: kind === 'FlowMetric' ? 'netobserv' : namespace || 'default' };
    }
    if (schema?.properties?.metadata) {
      (schema.properties.metadata as any).properties = {
        name: { type: 'string' },
        namespace: { type: 'string' }
      };
      (schema.properties.metadata as any).required = ['name', 'namespace'];
    }
  }

  return (
    <Provider
      value={{
        group,
        version,
        kind,
        isUpdate: isCRPresent || isDeleteInProgress,
        crLoaded: isCRLoaded,
        crResolved: isCRResolved,
        schema,
        data,
        loadError: csvLoadError || crdLoadError || crLoadErrorEffective,
        errors,
        setErrors,
        skipDefaults: !useCRDDefaults,
        onSubmit: (data, isDelete) => {
          if (isDelete) {
            return k8sDelete({
              model,
              resource: {
                apiVersion: data.apiVersion,
                kind: data.kind,
                metadata: data.metadata
              }
            })
              .then(() => {
                setErrors([]);
                setDeletedUid(data.metadata?.uid);
                setDeletingSnapshot({
                  ...data,
                  metadata: {
                    ...data.metadata,
                    deletionTimestamp: data.metadata?.deletionTimestamp || new Date().toISOString()
                  }
                });
                if (onSuccess) {
                  onSuccess(null);
                } else {
                  window.history.back();
                }
              })
              .catch(e => {
                setErrors([k8sErrorMessage(e)]);
                throw e;
              });
          }
          const apiFunc = isCRPresent ? k8sUpdate : k8sCreate;
          return apiFunc({
            data: prune(data),
            model
          })
            .then(res => {
              setErrors([]);
              if (onSuccess) {
                onSuccess(res);
              }
            })
            .catch(e => {
              setErrors([k8sErrorMessage(e)]);
              throw e;
            });
        }
      }}
    >
      {children}
    </Provider>
  );
};

export default ResourceWatcher;
