import { TFunction } from 'i18next';

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

/** Generic, display-name driven copy for any read-only alerts context tab. */
export const buildGenericReadonlyCopy = (displayName: string, t: TFunction): ReadonlyContextCopy => {
  const title = displayName;
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
