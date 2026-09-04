/* eslint-disable max-len */
import {
  Nav,
  NavItem,
  NavList,
  Page,
  PageSection,
  PageSidebar,
  PageSidebarBody,
  Tab,
  Tabs,
  Title
} from '@patternfly/react-core';
import { configure } from 'mobx';
import React from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router';
import FlowCollectorForm from '../components/forms/flowCollector/form';
import FlowCollectorStatus from '../components/forms/flowCollector/status';
import FlowCollectorWizard from '../components/forms/flowCollector/wizard';
import FlowCollectorSliceForm from '../components/forms/flowCollectorSlice/form';
import FlowMetricForm from '../components/forms/flowMetric/form';
import FlowMetricWizard from '../components/forms/flowMetric/wizard';
import HealthRuleWizard from '../components/forms/healthRule/wizard';
import NetworkHealth from '../components/health/network-health';
import NetflowTrafficDevTab from '../components/netflow-traffic-dev-tab';
import NetflowTrafficParent from '../components/netflow-traffic-parent';
import NetflowTab from '../components/netflow-traffic-tab';
import { ContextSingleton } from '../utils/context';
import Header from './header';
import { applyStandaloneDocumentTheme, StandaloneTheme } from './standalone-theme';

import '@patternfly/react-core/dist/styles/base.css';
import './index.css';

configure({ isolateGlobalState: true });

const allPages = [
  {
    id: 'netflow-traffic',
    name: 'Network Traffic',
    content: <NetflowTrafficParent />
  },
  {
    id: 'pod-tab',
    name: 'Pod tab',
    content: <NetflowTab obj={{ kind: 'Pod', metadata: { name: 'test', namespace: 'default' } }} />,
    addContext: true
  },
  {
    id: 'namespace-tab',
    name: 'Namespace tab',
    content: <NetflowTab obj={{ kind: 'Namespace', metadata: { name: 'test' } }} />,
    addContext: true
  },
  {
    id: 'node-tab',
    name: 'Node tab',
    content: <NetflowTab obj={{ kind: 'Node', metadata: { name: 'test' } }} />,
    addContext: true
  },
  {
    id: 'dev-tab',
    name: 'Dev tab',
    content: (
      <NetflowTrafficDevTab
        match={{
          path: '/dev-monitoring/ns/:ns',
          url: '/dev-monitoring/ns/netobserv',
          isExact: false,
          params: {
            ns: 'netobserv'
          }
        }}
      />
    ),
    addContext: true
  },
  {
    id: 'udn-tab',
    name: 'UDN tab',
    content: <NetflowTab obj={{ kind: 'UserDefinedNetwork', metadata: { name: 'my-udn', namespace: 'default' } }} />,
    addContext: true
  },
  {
    id: 'network-health',
    name: 'Network Health',
    content: <NetworkHealth />
  },
  {
    id: 'health-rule-wizard',
    name: 'Health Rule wizard',
    content: <HealthRuleWizard />
  },
  {
    id: 'flowCollector-wizard',
    name: 'FlowCollector wizard',
    content: <FlowCollectorWizard name="cluster" />
  },
  {
    id: 'flowCollector',
    name: 'FlowCollector form',
    content: <FlowCollectorForm name="cluster" />
  },
  {
    id: 'flowCollector-status',
    name: 'FlowCollector status',
    content: <FlowCollectorStatus />
  },
  {
    id: 'flowCollectorSlice',
    name: 'FlowCollectorSlice form',
    content: <FlowCollectorSliceForm name="flowCollectorSlice-sample" />
  },
  {
    id: 'flowMetric-wizard',
    name: 'FlowMetric wizard',
    content: <FlowMetricWizard name="flowmetric-sample" />
  },
  {
    id: 'flowMetric',
    name: 'FlowMetric form',
    content: <FlowMetricForm name="flowmetric-sample" />
  }
];
const endUserPages = allPages.filter(p => p.id === 'netflow-traffic' || p.id === 'network-health');

export const App: React.FunctionComponent<{ endUser?: boolean }> = ({ endUser }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [theme, setTheme] = React.useState<StandaloneTheme>('light');
  ContextSingleton.setStandalone();
  const pages = endUser ? endUserPages : allPages;

  React.useEffect(() => {
    applyStandaloneDocumentTheme(theme);
  }, [theme]);

  const onSidebarToggle = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const withContext = (content: JSX.Element, name: string) => {
    const tabScheme = theme === 'dark' ? 'dark' : theme === 'glass' ? 'glass' : 'light';
    return (
      <PageSection hasBodyWrapper={false} id="consolePageSection" className={`tab ${tabScheme}`}>
        <div style={{ padding: '1rem' }}>
          <Title headingLevel="h1">{`${name} example`}</Title>
        </div>
        <Tabs activeKey={1}>
          <Tab title="A" eventKey={0} />
          <Tab title="B" eventKey={0} />
          <Tab title="C" eventKey={0} />
          <Tab title="D" eventKey={0} />
          <Tab title="E" eventKey={0} />
          <Tab title="Network traffic" eventKey={1}>
            {content}
          </Tab>
        </Tabs>
      </PageSection>
    );
  };

  return (
    <BrowserRouter>
      <Page
        masthead={
          <Header theme={theme} setTheme={setTheme} isSidebarOpen={isSidebarOpen} onSidebarToggle={onSidebarToggle} />
        }
        sidebar={
          <PageSidebar isSidebarOpen={isSidebarOpen} id="vertical-sidebar">
            <PageSidebarBody>
              <Nav aria-label="Nav">
                <NavList>
                  {pages.map((page, index) => (
                    <NavItem itemId={index} key={page.id}>
                      <NavLink
                        id={`${page.id}-nav-item-link`}
                        to={`/console-${page.id}`}
                        className={({ isActive }) => (isActive ? 'pf-m-current' : '')}
                      >
                        {page.name}
                      </NavLink>
                    </NavItem>
                  ))}
                </NavList>
              </Nav>
            </PageSidebarBody>
          </PageSidebar>
        }
      >
        <Routes>
          {pages.map(page => {
            if (page.addContext) {
              return (
                <Route path={`/console-${page.id}`} key={page.id} element={withContext(page.content, page.name)} />
              );
            }
            return <Route path={`/console-${page.id}`} key={page.id} element={page.content} />;
          })}
          <Route path="*" element={<Navigate to={`/console-${pages[0].id}`} replace />} />
        </Routes>
      </Page>
    </BrowserRouter>
  );
};

export default App;
