import { Rule } from '@openshift-console/dynamic-plugin-sdk';
import {
  Button,
  ContentVariants,
  Drawer,
  DrawerContent,
  DrawerContentBody,
  Flex,
  FlexItem,
  PageSection,
  Tab,
  Tabs,
  Title
} from '@patternfly/react-core';
import { QuestionCircleIcon, SyncAltIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Config, defaultConfig } from '../../model/config';
import { loadConfig } from '../../utils/config';
import { getGenericHTTPError } from '../../utils/errors';
import { useHealthContexts } from '../../utils/health-contexts-hook';
import { localStorageHealthRefreshKey, useLocalStorage } from '../../utils/local-storage-hook';
import { usePoll } from '../../utils/poll-hook';
import { useTheme } from '../../utils/theme-hook';
import { RefreshDropdown } from '../dropdowns/refresh-dropdown';
import FlowCollectorStatusIndicator from '../status/flowcollector-status-indicator';
import {
  formatContextTabTitle,
  getHealthContextDefinition,
  NETOBSERV_CONTEXT_NETOBSERV,
  NETOBSERV_CONTEXT_OVN
} from './health-context';
import { fetchHealthContexts } from './health-contexts-fetcher';
import { HealthDrawerContainer } from './health-drawer-container';
import HealthError from './health-error';
import { HealthGlobal } from './health-global';
import { buildStats, HealthStats } from './health-helper';
import { HealthReadonlyContext, HealthReadonlyView } from './health-ovn';
import { HealthOvnSummary } from './health-ovn-summary';
import { HealthScoringDrawer } from './health-scoring-drawer';
import { HealthSummary } from './health-summary';
import { buildOvnStats } from './ovn-health-helper';
import { getNetobservContextStats, getOvnContextStats, HealthContextTabTitle, HealthTabTitle } from './tab-title';

import './health.css';

type NetobservSubTab = 'global' | 'per-node' | 'per-namespace' | 'per-owner';

export const NetworkHealth: React.FC<{}> = ({}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const isDarkTheme = useTheme();
  const [loading, setLoading] = React.useState(false);
  const [initialized, setInitialized] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const [interval, setInterval] = useLocalStorage<number | undefined>(localStorageHealthRefreshKey, undefined);
  const [rules, setRules] = React.useState<Rule[]>([]);
  const [health, setHealth] = React.useState<HealthStats>(buildStats([]));
  const {
    readonlyContexts,
    availableContextIds,
    activeContextTab,
    setActiveContextTab,
    setReadonlySubTab,
    isReadonlyContext,
    activeReadonlyStats,
    activeReadonlySubTab,
    updateFromFetch
  } = useHealthContexts();
  const [activeNetobservTab, setActiveNetobservTab] = React.useState<NetobservSubTab>('global');
  const [config, setConfig] = React.useState<Config>(defaultConfig);
  const [configLoaded, setConfigLoaded] = React.useState(false);
  const [isScoringDrawerOpen, setIsScoringDrawerOpen] = React.useState<boolean>(false);

  React.useEffect(() => {
    loadConfig().then(v => {
      setConfig(v.config);
      setConfigLoaded(true);
      if (v.error) {
        console.error('Error loading config:', v.error);
      }
    });
  }, []);

  const fetch = React.useCallback(() => {
    setLoading(true);
    setError(undefined);

    Promise.all([fetchHealthContexts(config.recordingAnnotations || {})])
      .then(([contextsRes]) => {
        setHealth(contextsRes.netobserv.stats);
        setRules(contextsRes.netobserv.alertRules);
        updateFromFetch(contextsRes);
      })
      .catch(err => {
        const errStr = getGenericHTTPError(err);
        setError(errStr);
      })
      .finally(() => {
        setLoading(false);
        setInitialized(true);
      });
  }, [config, updateFromFetch]);

  usePoll(fetch, interval);
  React.useEffect(() => {
    if (configLoaded) {
      fetch();
    }
  }, [configLoaded, fetch]);

  const isInitialLoading = !configLoaded || !initialized;
  const summaryForceCollapsed = isScoringDrawerOpen;

  const getContextTabTitle = React.useCallback(
    (contextId: string) => {
      const definition = getHealthContextDefinition(contextId);
      return definition.titleKey ? t(definition.titleKey) : formatContextTabTitle(contextId);
    },
    [t]
  );

  const activeViewLabel = React.useMemo(() => {
    if (isReadonlyContext) {
      return activeReadonlySubTab === 'per-node' ? t('Nodes') : t('Global');
    }
    switch (activeNetobservTab) {
      case 'global':
        return t('Global');
      case 'per-node':
        return t('Nodes');
      case 'per-namespace':
        return t('Namespaces');
      case 'per-owner':
        return t('Workloads');
      default:
        return t('Global');
    }
  }, [activeNetobservTab, activeReadonlySubTab, isReadonlyContext, t]);

  const panelContent = () => {
    if (isScoringDrawerOpen) {
      return (
        <HealthScoringDrawer
          isOpen={isScoringDrawerOpen}
          onClose={() => setIsScoringDrawerOpen(false)}
          contextId={activeContextTab}
        />
      );
    }
    return null;
  };

  const renderContextTabs = () => (
    <Flex className={`health-tabs-container health-context-tabs-row ${isDarkTheme ? 'dark' : ''}`}>
      <FlexItem flex={{ default: 'flex_1' }}>
        <Tabs
          activeKey={activeContextTab}
          onSelect={(_, tabIndex) => setActiveContextTab(String(tabIndex))}
          aria-label={t('Health data source')}
          className={`health-context-tabs ${isDarkTheme ? 'dark' : ''}`}
          data-test="health-context-tabs"
        >
          {availableContextIds.map(contextId => {
            const definition = getHealthContextDefinition(contextId);
            const stats =
              definition.kind === 'netobserv'
                ? getNetobservContextStats(health)
                : getOvnContextStats(readonlyContexts[contextId] ?? buildOvnStats([], false));
            const testId =
              contextId === NETOBSERV_CONTEXT_NETOBSERV
                ? 'health-context-tab-netobserv'
                : `health-context-tab-${contextId}`;
            return (
              <Tab
                key={contextId}
                eventKey={contextId}
                title={<HealthContextTabTitle title={getContextTabTitle(contextId)} stats={stats} />}
                data-test={testId}
              />
            );
          })}
        </Tabs>
      </FlexItem>
      <FlexItem className={'bottom-border'}>
        <Button
          data-test={
            activeContextTab === NETOBSERV_CONTEXT_OVN
              ? 'health-ovn-info-button'
              : isReadonlyContext
              ? `health-${activeContextTab}-info-button`
              : 'health-scoring-info-button'
          }
          className="overflow-button"
          variant="link"
          onClick={() => setIsScoringDrawerOpen(!isScoringDrawerOpen)}
          icon={<QuestionCircleIcon />}
        >
          {isScoringDrawerOpen
            ? isReadonlyContext
              ? t('Hide alert information')
              : t('Hide scoring information')
            : isReadonlyContext
            ? t('Show alert information')
            : t('Show scoring information')}
        </Button>
      </FlexItem>
    </Flex>
  );

  const renderContextSummary = () => (
    <div
      key={activeContextTab}
      className="health-context-summary"
      aria-live="polite"
      data-test="health-context-summary"
    >
      {isReadonlyContext && activeReadonlyStats ? (
        <HealthOvnSummary
          contextId={activeContextTab}
          stats={activeReadonlyStats}
          forceCollapsed={summaryForceCollapsed}
          isLoading={isInitialLoading}
          activeViewLabel={activeViewLabel}
        />
      ) : (
        <HealthSummary
          rules={rules}
          stats={health}
          forceCollapsed={summaryForceCollapsed}
          isLoading={isInitialLoading}
          activeViewLabel={activeViewLabel}
        />
      )}
    </div>
  );

  const renderSubTabs = () => {
    if (isReadonlyContext && activeReadonlyStats) {
      const subTabPrefix = `health-${activeContextTab}`;
      return (
        <Tabs
          activeKey={activeReadonlySubTab}
          onSelect={(_, tabIndex) => setReadonlySubTab(activeContextTab, String(tabIndex) as HealthReadonlyView)}
          aria-label={t('{{title}} alerts', { title: getContextTabTitle(activeContextTab) })}
          className={`health-subtabs health-readonly-subtabs ${isDarkTheme ? 'dark' : ''}`}
          data-test={`${subTabPrefix}-subtabs`}
        >
          <Tab
            eventKey={'global'}
            data-test={`${subTabPrefix}-tab-global`}
            title={<HealthTabTitle title={t('Global')} stats={[activeReadonlyStats.global]} />}
            aria-label={t('Tab global alerts')}
          />
          <Tab
            eventKey={'per-node'}
            data-test={`${subTabPrefix}-tab-nodes`}
            title={<HealthTabTitle title={t('Nodes')} stats={activeReadonlyStats.byNode} />}
            aria-label={t('Tab alerts per node')}
          />
        </Tabs>
      );
    }

    return (
      <Tabs
        activeKey={activeNetobservTab}
        onSelect={(_, tabIndex) => setActiveNetobservTab(String(tabIndex) as NetobservSubTab)}
        aria-label={t('NetObserv health views')}
        className={`health-subtabs health-netobserv-subtabs ${isDarkTheme ? 'dark' : ''}`}
        data-test="health-netobserv-subtabs"
      >
        <Tab
          eventKey={'global'}
          data-test="health-netobserv-tab-global"
          title={<HealthTabTitle title={t('Global')} stats={[health.global]} />}
          aria-label={t('Tab global')}
        />
        <Tab
          eventKey={'per-node'}
          data-test="health-netobserv-tab-nodes"
          title={<HealthTabTitle title={t('Nodes')} stats={health.byNode} />}
          aria-label={t('Tab per node')}
        />
        <Tab
          eventKey={'per-namespace'}
          data-test="health-netobserv-tab-namespaces"
          title={<HealthTabTitle title={t('Namespaces')} stats={health.byNamespace} />}
          aria-label={t('Tab per namespace')}
        />
        <Tab
          eventKey={'per-owner'}
          data-test="health-netobserv-tab-workloads"
          title={<HealthTabTitle title={t('Workloads')} stats={health.byOwner} />}
          aria-label={t('Tab per owner')}
        />
      </Tabs>
    );
  };

  const renderTabContent = () => {
    const content =
      isReadonlyContext && activeReadonlyStats ? (
        <HealthReadonlyContext
          contextId={activeContextTab}
          stats={activeReadonlyStats}
          view={activeReadonlySubTab}
          isLoading={isInitialLoading}
          isDark={isDarkTheme}
        />
      ) : (
        <>
          {activeNetobservTab === 'global' && <HealthGlobal info={health.global} isDark={isDarkTheme} />}
          {activeNetobservTab === 'per-node' && (
            <HealthDrawerContainer
              title={t('Rule violations per node')}
              stats={health.byNode}
              kind={'Node'}
              isDark={isDarkTheme}
            />
          )}
          {activeNetobservTab === 'per-namespace' && (
            <HealthDrawerContainer
              title={t('Rule violations per namespace')}
              stats={health.byNamespace}
              kind={'Namespace'}
              isDark={isDarkTheme}
            />
          )}
          {activeNetobservTab === 'per-owner' && (
            <HealthDrawerContainer
              title={t('Rule violations per workload')}
              stats={health.byOwner}
              kind={'Owner'}
              isDark={isDarkTheme}
            />
          )}
        </>
      );

    return <div className="health-tab-panel">{content}</div>;
  };

  const mainContent = () => {
    return (
      <div className="health-main-content">
        {error ? (
          <HealthError title={t('Error')} body={error} />
        ) : (
          <>
            {renderContextTabs()}
            {renderContextSummary()}
            <div className="health-subtabs-container">{renderSubTabs()}</div>
            {renderTabContent()}
          </>
        )}
      </div>
    );
  };

  return (
    <PageSection hasBodyWrapper={false} id="health-page" className={`${isDarkTheme ? 'dark' : 'light'}`}>
      <Drawer id="health-drawer" isInline isExpanded={isScoringDrawerOpen}>
        <DrawerContent id="healthDrawerContent" panelContent={panelContent()}>
          <DrawerContentBody id="healthDrawerBody">
            <Flex id="health-page-content-flex" direction={{ default: 'column' }}>
              <FlexItem className="health-header-container">
                <Flex className="health-header" direction={{ default: 'column' }} gap={{ default: 'gapMd' }}>
                  <FlexItem>
                    <Flex
                      direction={{ default: 'column', md: 'row' }}
                      alignItems={{ default: 'alignItemsStretch', md: 'alignItemsCenter' }}
                      justifyContent={{ md: 'justifyContentSpaceBetween' }}
                      gap={{ default: 'gapMd' }}
                      flexWrap={{ default: 'wrap' }}
                    >
                      <FlexItem>
                        <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
                          <FlexItem>
                            <Title headingLevel={ContentVariants.h1}>{t('Network Health')}</Title>
                          </FlexItem>
                          <FlexItem>
                            <FlowCollectorStatusIndicator />
                          </FlexItem>
                        </Flex>
                      </FlexItem>
                      <FlexItem>
                        <Flex
                          direction={{ default: 'row' }}
                          alignItems={{ default: 'alignItemsFlexEnd' }}
                          gap={{ default: 'gapSm' }}
                        >
                          <FlexItem flex={{ default: 'flex_1' }}>
                            <RefreshDropdown
                              data-test="refresh-dropdown"
                              id="refresh-dropdown"
                              interval={interval}
                              setInterval={setInterval}
                            />
                          </FlexItem>
                          <FlexItem className="netobserv-refresh-container">
                            <Button
                              data-test="refresh-button"
                              id="refresh-button"
                              className="co-action-refresh-button"
                              variant="primary"
                              aria-label={t('Refresh network health')}
                              onClick={() => fetch()}
                              icon={<SyncAltIcon style={{ animation: `spin ${loading ? 1 : 0}s linear infinite` }} />}
                            />
                          </FlexItem>
                        </Flex>
                      </FlexItem>
                    </Flex>
                  </FlexItem>
                </Flex>
              </FlexItem>
              <FlexItem
                id="health-content-container"
                flex={{ default: 'flex_1' }}
                className={isDarkTheme ? 'dark' : 'light'}
              >
                {mainContent()}
              </FlexItem>
            </Flex>
          </DrawerContentBody>
        </DrawerContent>
      </Drawer>
    </PageSection>
  );
};

NetworkHealth.displayName = 'NetworkHealth';
export default NetworkHealth;
