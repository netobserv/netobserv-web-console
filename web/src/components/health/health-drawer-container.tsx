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
  Gallery,
  Spinner,
  Title
} from '@patternfly/react-core';
import { CheckCircleIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { HealthCard } from './health-card';
import { HealthStat, HealthSuperKind } from './health-helper';
import { RuleDetails } from './rule-details';

export interface HealthDrawerContainerProps {
  title: string;
  stats: HealthStat[];
  kind: HealthSuperKind;
  isDark: boolean;
  isLoading?: boolean;
}

export const HealthDrawerContainer: React.FC<HealthDrawerContainerProps> = ({
  title,
  stats,
  kind,
  isDark,
  isLoading
}) => {
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
            {isLoading ? (
              <Bullseye data-test="health-drawer-loading">
                <Spinner size="lg" aria-label={t('Loading network health')} />
              </Bullseye>
            ) : !hasAnyViolations ? (
              <Bullseye>
                <EmptyState
                  titleText={<Title headingLevel="h2">{t('No violations found')}</Title>}
                  icon={CheckCircleIcon}
                ></EmptyState>
              </Bullseye>
            ) : (
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
