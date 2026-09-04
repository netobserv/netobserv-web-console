import { Rule } from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  AlertActionCloseButton,
  Button,
  Content,
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
import { localStorageHealthRefreshKey, useLocalStorage } from '../../utils/local-storage-hook';
import { usePoll } from '../../utils/poll-hook';
import { useTheme } from '../../utils/theme-hook';
import { getURLParams, navigateTo } from '../../utils/url';
import { RefreshDropdown } from '../dropdowns/refresh-dropdown';
import { HealthRulesManager } from '../forms/healthRule/manager';
import { healthRuleSetupPath } from '../forms/healthRule/paths';
import FlowCollectorStatusIndicator from '../status/flowcollector-status-indicator';
import { HealthDrawerContainer } from './health-drawer-container';
import HealthError from './health-error';
import { fetchNetworkHealth } from './health-fetcher';
import { HealthGlobal } from './health-global';
import { buildStats, HealthStats } from './health-helper';
import { HealthScoringDrawer } from './health-scoring-drawer';
import { HealthSummary } from './health-summary';
import { HealthTabTitle } from './tab-title';

import './health.css';

export const NetworkHealth: React.FC<{}> = ({}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const isDarkTheme = useTheme();
  const [loading, setLoading] = React.useState(false);
  const [initialized, setInitialized] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const [interval, setInterval] = useLocalStorage<number | undefined>(localStorageHealthRefreshKey, undefined);
  const [rules, setRules] = React.useState<Rule[]>([]);
  const [health, setHealth] = React.useState<HealthStats>(buildStats([]));
  const [activeTabKey, setActiveTabKey] = React.useState<string>('global');
  const [config, setConfig] = React.useState<Config>(defaultConfig);
  const [configLoaded, setConfigLoaded] = React.useState(false);
  const [isScoringDrawerOpen, setIsScoringDrawerOpen] = React.useState<boolean>(false);
  const [isRulesManagerOpen, setIsRulesManagerOpen] = React.useState(false);
  const [showCreatedAlert, setShowCreatedAlert] = React.useState(() => getURLParams().get('ruleCreated') === '1');

  // Load config on mount
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

    fetchNetworkHealth(config.recordingAnnotations || {})
      .then(res => {
        setHealth(res.stats);
        setRules(res.alertRules);
      })
      .catch(err => {
        const errStr = getGenericHTTPError(err);
        setError(errStr);
      })
      .finally(() => {
        setLoading(false);
        setInitialized(true);
      });
  }, [config]);

  usePoll(fetch, interval);
  // Run first fetch only after config is loaded so recordingAnnotations (including third-party rules without template label) is available
  React.useEffect(() => {
    if (configLoaded) {
      fetch();
    }
  }, [configLoaded, fetch]);

  // Avoid flashing empty/zero stats before the first successful (or failed) load.
  const isInitialLoading = !configLoaded || !initialized;

  const panelContent = () => {
    if (isRulesManagerOpen) {
      return <HealthRulesManager isOpen={isRulesManagerOpen} onClose={() => setIsRulesManagerOpen(false)} />;
    }
    if (isScoringDrawerOpen) {
      return <HealthScoringDrawer isOpen={isScoringDrawerOpen} onClose={() => setIsScoringDrawerOpen(false)} />;
    }
    return null;
  };

  const isDrawerOpen = isScoringDrawerOpen || isRulesManagerOpen;

  const mainContent = () => {
    return (
      <div className="health-main-content">
        {error ? (
          <HealthError title={t('Error')} body={error} />
        ) : (
          <>
            <Flex className={`health-tabs-container ${isDarkTheme ? 'dark' : ''}`}>
              <FlexItem flex={{ default: 'flex_1' }}>
                <Tabs
                  activeKey={activeTabKey}
                  onSelect={(_, tabIndex) => setActiveTabKey(String(tabIndex))}
                  role="region"
                  className={isDarkTheme ? 'dark' : ''}
                >
                  <Tab
                    eventKey={'global'}
                    title={<HealthTabTitle title={t('Global')} stats={[health.global]} />}
                    aria-label="Tab global"
                  />
                  <Tab
                    eventKey={'per-node'}
                    title={<HealthTabTitle title={t('Nodes')} stats={health.byNode} />}
                    aria-label="Tab per node"
                  />
                  <Tab
                    eventKey={'per-namespace'}
                    title={<HealthTabTitle title={t('Namespaces')} stats={health.byNamespace} />}
                    aria-label="Tab per namespace"
                  />
                  <Tab
                    eventKey={'per-owner'}
                    title={<HealthTabTitle title={t('Workloads')} stats={health.byOwner} />}
                    aria-label="Tab per owner"
                  />
                </Tabs>
              </FlexItem>
              <FlexItem className={'bottom-border'}>
                <Button
                  data-test="health-scoring-info-button"
                  className="overflow-button"
                  variant="link"
                  onClick={() => {
                    setIsRulesManagerOpen(false);
                    setIsScoringDrawerOpen(!isScoringDrawerOpen);
                  }}
                  icon={<QuestionCircleIcon />}
                >
                  {isScoringDrawerOpen ? t('Hide scoring information') : t('Show scoring information')}
                </Button>
              </FlexItem>
            </Flex>
            {activeTabKey === 'global' && <HealthGlobal info={health.global} isLoading={isInitialLoading} />}
            {activeTabKey === 'per-node' && (
              <HealthDrawerContainer
                title={t('Rule violations per node')}
                stats={health.byNode}
                kind={'Node'}
                isDark={isDarkTheme}
                isLoading={isInitialLoading}
              />
            )}
            {activeTabKey === 'per-namespace' && (
              <HealthDrawerContainer
                title={t('Rule violations per namespace')}
                stats={health.byNamespace}
                kind={'Namespace'}
                isDark={isDarkTheme}
                isLoading={isInitialLoading}
              />
            )}
            {activeTabKey === 'per-owner' && (
              <HealthDrawerContainer
                title={t('Rule violations per workload')}
                stats={health.byOwner}
                kind={'Owner'}
                isDark={isDarkTheme}
                isLoading={isInitialLoading}
              />
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <PageSection hasBodyWrapper={false} id="health-page" className={`${isDarkTheme ? 'dark' : 'light'}`}>
      <Drawer id="health-drawer" isInline={!isRulesManagerOpen} isExpanded={isDrawerOpen}>
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
                          flexWrap={{ default: 'wrap' }}
                          gap={{ default: 'gapSm' }}
                        >
                          <FlexItem>
                            <Button
                              data-test="create-health-rule-button"
                              variant="primary"
                              onClick={() => navigateTo(healthRuleSetupPath())}
                            >
                              {t('Create health rule')}
                            </Button>
                          </FlexItem>
                          <FlexItem>
                            <Button
                              data-test="manage-health-rules-button"
                              variant="secondary"
                              onClick={() => {
                                setIsScoringDrawerOpen(false);
                                setIsRulesManagerOpen(!isRulesManagerOpen);
                              }}
                            >
                              {isRulesManagerOpen ? t('Hide manage rules') : t('Manage rules')}
                            </Button>
                          </FlexItem>
                          <FlexItem className="netobserv-refresh-interval-container">
                            <Flex direction={{ default: 'column' }}>
                              <FlexItem className="netobserv-action-title">
                                <Content component={ContentVariants.h4}>{t('Refresh interval')}</Content>
                              </FlexItem>
                              <FlexItem flex={{ default: 'flex_1' }}>
                                <RefreshDropdown
                                  data-test="refresh-dropdown"
                                  id="refresh-dropdown"
                                  interval={interval}
                                  setInterval={setInterval}
                                />
                              </FlexItem>
                            </Flex>
                          </FlexItem>
                          <FlexItem className="netobserv-refresh-container">
                            <Button
                              data-test="refresh-button"
                              id="refresh-button"
                              className="co-action-refresh-button"
                              variant="primary"
                              onClick={() => fetch()}
                              icon={<SyncAltIcon style={{ animation: `spin ${loading ? 1 : 0}s linear infinite` }} />}
                            />
                          </FlexItem>
                        </Flex>
                      </FlexItem>
                    </Flex>
                  </FlexItem>
                  <FlexItem>
                    <HealthSummary
                      rules={rules}
                      stats={health}
                      forceCollapsed={isScoringDrawerOpen || isRulesManagerOpen}
                      isLoading={isInitialLoading}
                    />
                  </FlexItem>
                </Flex>
                {showCreatedAlert && (
                  <Alert
                    data-test="health-rule-created-alert"
                    variant="info"
                    isInline
                    title={t('Health rule saved')}
                    actionClose={<AlertActionCloseButton onClose={() => setShowCreatedAlert(false)} />}
                    style={{ marginTop: '1rem' }}
                  >
                    {t(
                      'It may take a short time for the rule to appear on Network Health after Prometheus reconciles.'
                    )}
                  </Alert>
                )}
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
