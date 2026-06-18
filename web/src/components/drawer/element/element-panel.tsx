import {
  Divider,
  DrawerActions,
  DrawerCloseButton,
  DrawerHead,
  DrawerPanelBody,
  DrawerPanelContent,
  Tab,
  Tabs,
  TabTitleText,
  Text,
  TextVariants
} from '@patternfly/react-core';
import { BaseEdge } from '@patternfly/react-topology';
import _ from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { TopologyMetrics } from '../../../api/query-response';
import { RuleDetails } from '../../../components/health/rule-details';
import { Filter, FilterDefinition, Filters } from '../../../model/filters';
import { MetricType } from '../../../model/flow-query';
import { useNetflowContext } from '../../../model/netflow-context';
import { GraphElementPeer, NodeData } from '../../../model/topology';
import { defaultSize, maxSize, minSize } from '../../../utils/panel';
import { TruncateLength } from '../../dropdowns/truncate-dropdown';
import { HealthCard } from '../../health/health-card';
import { HealthSuperKind } from '../../health/health-helper';
import { PeerResourceLink } from '../../tabs/netflow-topology/peer-resource-link';
import { ElementPanelContent } from './element-panel-content';
import { ElementPanelMetrics } from './element-panel-metrics';
import './element-panel.css';

export interface ElementPanelProps {
  onClose: () => void;
  element: GraphElementPeer;
  metrics: TopologyMetrics[];
  droppedMetrics: TopologyMetrics[];
  metricType: MetricType;
  filters: Filters;
  filterDefinitions: FilterDefinition[];
  setFilters: (filters: Filter[]) => void;
  truncateLength: TruncateLength;
  id?: string;
  isDark?: boolean;
}

export const ElementPanel: React.FC<ElementPanelProps> = ({
  id,
  element,
  metrics,
  droppedMetrics,
  metricType,
  filters,
  filterDefinitions,
  setFilters,
  onClose,
  truncateLength,
  isDark
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const { caps } = useNetflowContext();
  const [activeTab, setActiveTab] = React.useState<string>('details');

  const data = element.getData();
  const noMetrics = data && data.noMetrics === true;
  let aData: NodeData;
  let bData: NodeData | undefined;
  if (element instanceof BaseEdge) {
    aData = element.getSource().getData();
    bData = element.getTarget().getData();
  } else {
    aData = data!;
  }

  // Get the element panel display name to compare with card names
  const elementName = React.useMemo(() => {
    if (element instanceof BaseEdge) {
      return undefined;
    } else {
      return data?.peer.getDisplayName(false, false);
    }
  }, [element, data]);

  const healthKind: HealthSuperKind | undefined = React.useMemo(() => {
    const nodeType = data?.nodeType;
    if (nodeType === 'host') {
      return 'Node';
    } else if (nodeType === 'namespace') {
      return 'Namespace';
    } else if (nodeType === 'owner') {
      return 'Owner';
    }
    return undefined;
  }, [data]);

  const titleContent = React.useCallback(() => {
    if (element instanceof BaseEdge) {
      return <Text component={TextVariants.h2}>{t('Edge')}</Text>;
    } else {
      if (data && elementName) {
        return <PeerResourceLink peer={data.peer} />;
      }
      return <Text component={TextVariants.h2}>{t('Unknown')}</Text>;
    }
  }, [element, elementName, data, t]);

  const showDroppedTab = caps.isPktDrop && !noMetrics && !_.isEmpty(droppedMetrics);
  const elementHealth = data?.health;
  const showHealthTab = elementHealth !== undefined && healthKind !== undefined && !_.isEmpty(elementHealth);

  React.useEffect(() => {
    if (
      (activeTab === 'metrics' && (noMetrics || _.isEmpty(metrics))) ||
      (activeTab === 'dropped' && !showDroppedTab) ||
      (activeTab === 'health' && !showHealthTab)
    ) {
      setActiveTab('details');
    }
  }, [metrics, activeTab, noMetrics, showDroppedTab, showHealthTab]);

  return (
    <DrawerPanelContent
      data-test-id={id}
      id={id}
      className="drawer-panel-content"
      isResizable
      defaultSize={defaultSize}
      minSize={minSize}
      maxSize={maxSize}
    >
      <DrawerHead id={`${id}-drawer-head`} data-test-id="drawer-head" className="drawer-head">
        {titleContent()}
        <DrawerActions>
          <DrawerCloseButton data-test-id="drawer-close-button" className="drawer-close-button" onClick={onClose} />
        </DrawerActions>
      </DrawerHead>
      <Divider />
      <DrawerPanelBody id={`${id}-drawer-body`} className="drawer-body" data-test-id="drawer-body">
        <Tabs
          id="drawer-tabs"
          activeKey={activeTab}
          usePageInsets
          onSelect={(e, key) => setActiveTab(key as string)}
          role="region"
        >
          <Tab className="drawer-tab" eventKey={'details'} title={<TabTitleText>{t('Details')}</TabTitleText>}>
            <ElementPanelContent
              element={element}
              filters={filters}
              setFilters={setFilters}
              filterDefinitions={filterDefinitions}
            />
          </Tab>
          {!noMetrics && !_.isEmpty(metrics) && (
            <Tab className="drawer-tab" eventKey={'metrics'} title={<TabTitleText>{t('Metrics')}</TabTitleText>}>
              <ElementPanelMetrics
                aData={aData}
                bData={bData}
                isGroup={element.getType() === 'group'}
                metrics={metrics}
                metricType={metricType}
                truncateLength={truncateLength}
              />
            </Tab>
          )}
          {showDroppedTab && (
            <Tab className="drawer-tab" eventKey={'dropped'} title={<TabTitleText>{t('Drops')}</TabTitleText>}>
              <ElementPanelMetrics
                aData={aData}
                bData={bData}
                isGroup={element.getType() === 'group'}
                metrics={droppedMetrics}
                metricType={metricType}
                truncateLength={truncateLength}
              />
            </Tab>
          )}
          {showHealthTab && elementHealth && healthKind && (
            <Tab className="drawer-tab" eventKey={'health'} title={<TabTitleText>{t('Health')}</TabTitleText>}>
              <>
                <HealthCard
                  key={`card-${elementHealth.name}`}
                  resourceHealth={elementHealth}
                  name={elementHealth.name}
                  k8sKind={elementHealth.k8sKind}
                  isDark={isDark || false}
                  isSelected={true}
                  hideTitle={true}
                />
                <div className="health-details">
                  <RuleDetails kind={healthKind} resourceHealth={elementHealth} />
                </div>
              </>
            </Tab>
          )}
        </Tabs>
      </DrawerPanelBody>
    </DrawerPanelContent>
  );
};

export default ElementPanel;
