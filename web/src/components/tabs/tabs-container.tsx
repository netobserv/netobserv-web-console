import { Button, Flex, FlexItem, Tab, Tabs, TabTitleText, Tooltip } from '@patternfly/react-core';
import React, { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useNetflowContext } from '../../model/netflow-context';
import { TimeRange } from '../../utils/datetime';
import { useTheme } from '../../utils/theme-hook';
import { ViewId } from '../netflow-traffic';

export interface TabsContainerProps {
  selectedViewId: ViewId;
  selectView: (v: ViewId) => void;
  showHistogram: boolean;
  setShowViewOptions: (v: boolean) => void;
  setShowHistogram: (v: boolean) => void;
  setHistogramRange: (v: TimeRange | undefined) => void;
  isShowViewOptions: boolean;
  style?: CSSProperties;
}

export const TabsContainer: React.FC<TabsContainerProps> = props => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const isDarkTheme = useTheme();
  const { caps } = useNetflowContext();
  const allowRawFlows = caps.allowRawFlows;
  const allowMetrics = caps.allowMetrics;
  // Overview/Topology need Prometheus (or Loki) metrics — not S3 raw store alone.
  const metricsUnavailableTooltip = t(
    'Only available when Prometheus and/or Loki are enabled in the FlowCollector (Overview and Topology require metrics)'
  );

  return (
    <Flex className="netflow-traffic-tabs-container" style={props.style}>
      <FlexItem id="tabs-container" flex={{ default: 'flex_1' }}>
        <Tabs
          className={`netflow-traffic-tabs ${isDarkTheme ? 'dark' : 'light'}`}
          usePageInsets
          activeKey={props.selectedViewId}
          onSelect={(event, eventkey) => props.selectView(eventkey as ViewId)}
          role="region"
        >
          <Tab
            className="overviewTabButton"
            eventKey={'overview'}
            isAriaDisabled={!allowMetrics} // required instead of 'disabled' when used with a tooltip
            tooltip={!allowMetrics ? <Tooltip content={metricsUnavailableTooltip} /> : undefined}
            title={<TabTitleText>{t('Overview')}</TabTitleText>}
          />
          <Tab
            className="tableTabButton"
            eventKey={'table'}
            isAriaDisabled={!allowRawFlows} // required instead of 'disabled' when used with a tooltip
            tooltip={
              !allowRawFlows ? (
                <Tooltip content={t('Only available when Loki is enabled in the FlowCollector')} />
              ) : undefined
            }
            title={<TabTitleText>{t('Traffic flows')}</TabTitleText>}
          />
          <Tab
            className="topologyTabButton"
            eventKey={'topology'}
            isAriaDisabled={!allowMetrics}
            tooltip={!allowMetrics ? <Tooltip content={metricsUnavailableTooltip} /> : undefined}
            title={<TabTitleText>{t('Topology')}</TabTitleText>}
          />
        </Tabs>
      </FlexItem>
      {props.selectedViewId === 'table' && (
        <FlexItem className={'bottom-border'}>
          <Button
            data-test="show-histogram-button"
            id="show-histogram-button"
            variant="link"
            className="overflow-button"
            onClick={() => {
              props.setShowViewOptions(false);
              props.setShowHistogram(!props.showHistogram);
              props.setHistogramRange(undefined);
            }}
          >
            {props.showHistogram ? t('Hide histogram') : t('Show histogram')}
          </Button>
        </FlexItem>
      )}
      <FlexItem className={'bottom-border'}>
        <Button
          data-test="show-view-options-button"
          id="show-view-options-button"
          variant="link"
          className="overflow-button"
          onClick={() => {
            props.setShowViewOptions(!props.isShowViewOptions);
            props.setShowHistogram(false);
            props.setHistogramRange(undefined);
          }}
        >
          {props.isShowViewOptions ? t('Hide advanced options') : t('Show advanced options')}
        </Button>
      </FlexItem>
    </Flex>
  );
};

export default TabsContainer;
