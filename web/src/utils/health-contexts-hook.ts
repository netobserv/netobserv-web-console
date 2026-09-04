import * as React from 'react';
import { isReadonlyAlertsContext, NETOBSERV_CONTEXT_NETOBSERV } from '../components/health/health-context';
import { HealthContextsState } from '../components/health/health-contexts-fetcher';
import { HealthReadonlyView } from '../components/health/health-ovn';
import { OvnHealthStats } from '../components/health/ovn-health-helper';

export const useHealthContexts = () => {
  const [readonlyContexts, setReadonlyContexts] = React.useState<Record<string, OvnHealthStats>>({});
  const [availableContextIds, setAvailableContextIds] = React.useState<string[]>([NETOBSERV_CONTEXT_NETOBSERV]);
  const [activeContextTab, setActiveContextTab] = React.useState<string>(NETOBSERV_CONTEXT_NETOBSERV);
  const [activeReadonlySubTabs, setActiveReadonlySubTabs] = React.useState<Record<string, HealthReadonlyView>>({});

  const updateFromFetch = React.useCallback(
    (contextsRes: Pick<HealthContextsState, 'readonlyContexts' | 'availableContextIds'>) => {
      setReadonlyContexts(contextsRes.readonlyContexts);
      setAvailableContextIds(contextsRes.availableContextIds);
    },
    []
  );

  React.useEffect(() => {
    if (!availableContextIds.includes(activeContextTab)) {
      setActiveContextTab(NETOBSERV_CONTEXT_NETOBSERV);
    }
  }, [activeContextTab, availableContextIds]);

  const setReadonlySubTab = React.useCallback((contextId: string, view: HealthReadonlyView) => {
    setActiveReadonlySubTabs(current => ({
      ...current,
      [contextId]: view
    }));
  }, []);

  const isReadonlyContext = isReadonlyAlertsContext(activeContextTab);
  const activeReadonlyStats = readonlyContexts[activeContextTab];
  const activeReadonlySubTab = activeReadonlySubTabs[activeContextTab] ?? 'global';

  return {
    readonlyContexts,
    availableContextIds,
    activeContextTab,
    setActiveContextTab,
    activeReadonlySubTabs,
    setReadonlySubTab,
    isReadonlyContext,
    activeReadonlyStats,
    activeReadonlySubTab,
    updateFromFetch
  };
};
