import { ResourceLink } from '@openshift-console/dynamic-plugin-sdk';
import {
  Bullseye,
  Content,
  ContentVariants,
  Drawer,
  DrawerContent,
  DrawerContentBody,
  DrawerHead,
  DrawerPanelContent,
  EmptyState,
  Flex,
  FlexItem,
  Gallery,
  Title
} from '@patternfly/react-core';
import { CheckCircleIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { valueFormat } from '../../utils/format';
import { HealthCard } from './health-card';
import { computeResourceScore, getAllHealthItems, HealthStat, HealthSuperKind } from './health-helper';
import { RuleDetails } from './rule-details';

export interface HealthDrawerContainerProps {
  title: string;
  stats: HealthStat[];
  kind: HealthSuperKind;
  isDark: boolean;
}

export const HealthDrawerContainer: React.FC<HealthDrawerContainerProps> = ({ title, stats, kind, isDark }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const [selectedItemName, setSelectedItemName] = React.useState<string | undefined>(undefined);
  const drawerRef = React.useRef<HTMLDivElement>(null);

  const onExpand = () => {
    if (drawerRef.current) {
      drawerRef.current.focus();
    }
  };

  const selectedItem = React.useMemo(() => {
    return selectedItemName ? stats.find(item => item.name === selectedItemName) : undefined;
  }, [selectedItemName, stats]);

  const breakdown = React.useMemo(
    () => (selectedItem ? computeResourceScore(selectedItem) : undefined),
    [selectedItem]
  );
  const activeCount = React.useMemo(() => (selectedItem ? getAllHealthItems(selectedItem).length : 0), [selectedItem]);

  const isExpanded = selectedItem !== undefined;
  const hasAnyViolations = stats.length > 0;

  return (
    <>
      <Drawer isExpanded={isExpanded} onExpand={onExpand} isInline>
        <DrawerContent
          panelContent={
            <DrawerPanelContent
              className={'health-gallery-drawer'}
              isResizable
              widths={{ default: 'width_33' }}
              minSize="300px"
            >
              <DrawerHead>
                <span tabIndex={isExpanded ? 0 : -1} ref={drawerRef}>
                  {selectedItem && <ResourceLink inline={true} kind={selectedItem.k8sKind} name={selectedItem.name} />}
                </span>
                {selectedItem && breakdown && (
                  <Flex
                    direction={{ default: 'column' }}
                    gap={{ default: 'gapXs' }}
                    className="health-drawer-score"
                    data-test="health-drawer-score"
                    style={{ marginTop: '0.5rem' }}
                  >
                    <Flex gap={{ default: 'gapMd' }} alignItems={{ default: 'alignItemsCenter' }}>
                      <FlexItem>
                        <Content component={ContentVariants.h1} style={{ margin: 0 }}>
                          {isNaN(breakdown.score) || !isFinite(breakdown.score) ? '-' : valueFormat(breakdown.score, 1)}
                        </Content>
                      </FlexItem>
                      <FlexItem flex={{ default: 'flex_1' }}>
                        <div
                          style={{
                            height: '8px',
                            background: 'var(--pf-t--global--border--color--default)',
                            borderRadius: '4px'
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.max(0, Math.min(10, breakdown.score)) * 10}%`,
                              borderRadius: '4px',
                              background:
                                breakdown.score < 5
                                  ? 'var(--pf-t--global--color--status--danger--default)'
                                  : breakdown.score < 7
                                  ? 'var(--pf-t--global--color--status--warning--default)'
                                  : breakdown.score < 9
                                  ? 'var(--pf-t--global--color--status--info--default)'
                                  : 'var(--pf-t--global--color--status--success--default)'
                            }}
                          />
                        </div>
                      </FlexItem>
                    </Flex>
                    <FlexItem>
                      <Content
                        component={ContentVariants.small}
                        style={{ color: 'var(--pf-t--global--text--color--subtle)' }}
                      >
                        {t('Weighted average across {{count}} active rules', { count: activeCount })}
                      </Content>
                    </FlexItem>
                  </Flex>
                )}
              </DrawerHead>
              {selectedItem && (
                <div className="health-gallery-drawer-content" data-test="health-drawer-content">
                  <RuleDetails kind={kind} resourceHealth={selectedItem} />
                </div>
              )}
            </DrawerPanelContent>
          }
        >
          <DrawerContentBody>
            <Content>
              <Content component={ContentVariants.h3}>{title}</Content>
            </Content>
            {!hasAnyViolations && (
              <Bullseye>
                <EmptyState
                  titleText={<Title headingLevel="h2">{t('No violations found')}</Title>}
                  icon={CheckCircleIcon}
                ></EmptyState>
              </Bullseye>
            )}
            {hasAnyViolations && (
              <Gallery hasGutter minWidths={{ default: '300px' }} style={{ marginRight: '1.5rem' }}>
                {stats.map(item => (
                  <HealthCard
                    key={`card-${item.name}`}
                    name={item.name}
                    k8sKind={item.k8sKind}
                    isDark={isDark}
                    resourceHealth={item}
                    isSelected={item.name === selectedItemName}
                    onClick={() => {
                      setSelectedItemName(item.name !== selectedItemName ? item.name : undefined);
                    }}
                  />
                ))}
              </Gallery>
            )}
          </DrawerContentBody>
        </DrawerContent>
      </Drawer>
    </>
  );
};
