import { TFunction } from 'i18next';
import { formatContextTabTitle, NETOBSERV_CONTEXT_OVN } from './health-context';

export type ReadonlyContextCopy = {
  summaryLabel: string;
  sectionDetails: string;
  globalHealthyTitle: string;
  globalSectionTitle: string;
  nodesHealthyTitle: string;
  nodesSectionTitle: string;
  unavailableTitle: string;
  unavailableBody: string;
  loadingLabel: string;
};

export const getReadonlyContextCopy = (contextId: string, t: TFunction): ReadonlyContextCopy => {
  if (contextId === NETOBSERV_CONTEXT_OVN) {
    return {
      summaryLabel: t('OVN-Kubernetes platform alerts'),
      sectionDetails: t(
        'Managed by the OpenShift cluster network operator. Not included in the NetObserv health score.'
      ),
      globalHealthyTitle: t('No cluster-wide OVN platform alerts'),
      globalSectionTitle: t('Cluster-wide OVN alerts'),
      nodesHealthyTitle: t('No OVN platform alerts per node'),
      nodesSectionTitle: t('OVN alerts per node'),
      unavailableTitle: t('OVN platform alerts unavailable'),
      unavailableBody: t(
        'OpenShift OVN-Kubernetes platform alerts were not found. This tab is available on OpenShift clusters using the OVN-Kubernetes network plugin.'
      ),
      loadingLabel: t('Loading OVN platform alerts')
    };
  }

  const title = formatContextTabTitle(contextId);
  return {
    summaryLabel: t('{{title}} alerts', { title }),
    sectionDetails: t('Managed by {{title}}. Not included in the NetObserv health score.', { title }),
    globalHealthyTitle: t('No cluster-wide {{title}} alerts', { title }),
    globalSectionTitle: t('Cluster-wide {{title}} alerts', { title }),
    nodesHealthyTitle: t('No {{title}} alerts per node', { title }),
    nodesSectionTitle: t('{{title}} alerts per node', { title }),
    unavailableTitle: t('{{title}} alerts unavailable', { title }),
    unavailableBody: t('No {{title}} health alerts were found on this cluster.', { title }),
    loadingLabel: t('Loading {{title}} alerts', { title })
  };
};
