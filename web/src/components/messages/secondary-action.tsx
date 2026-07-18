import { Button, EmptyStateActions } from '@patternfly/react-core';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Config } from '../../model/config';
import { ContextSingleton } from '../../utils/context';
import { Link } from '../../utils/url';

type ButtonLinkProps = Omit<React.ComponentProps<typeof Link>, 'to'>;

const FlowCollectorLink: React.FC<ButtonLinkProps> = props => {
  const flowCollectorK8SModel = ContextSingleton.getFlowCollectorK8SModel()!;
  return (
    <Link
      {...props}
      target="_blank"
      to={{
        pathname: `/k8s/cluster/${flowCollectorK8SModel.apiGroup}~${flowCollectorK8SModel.apiVersion}~${flowCollectorK8SModel.kind}/cluster`
      }}
    />
  );
};

const HealthDashboardLink: React.FC<ButtonLinkProps> = props => (
  <Link
    {...props}
    target="_blank"
    to={{ pathname: '/monitoring/dashboards/grafana-dashboard-netobserv-health' }}
  />
);

export interface EmptyProps {
  resetDefaultFilters?: (c?: Config) => void;
  clearFilters?: () => void;
  showMetrics?: () => void;
  showBuildInfo?: () => void;
  showConfigLimits?: () => void;
}

export const SecondaryAction: React.FC<EmptyProps> = ({
  resetDefaultFilters,
  clearFilters,
  showMetrics,
  showBuildInfo,
  showConfigLimits
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const flowCollectorK8SModel = ContextSingleton.getFlowCollectorK8SModel();
  const isStandalone = ContextSingleton.isStandalone();

  return (
    <>
      <EmptyStateActions>
        {!isStandalone && flowCollectorK8SModel && (
          <Button variant="link" component={FlowCollectorLink} data-test="flowcollector-link">
            {t('Show FlowCollector CR')}
          </Button>
        )}
        {!isStandalone && (
          <Button variant="link" component={HealthDashboardLink} data-test="health-dashboard-link">
            {t('Show health dashboard')}
          </Button>
        )}
        {clearFilters && (
          <Button id="clear-all-filters" onClick={() => clearFilters()} variant="link">
            {t('Clear all filters')}
          </Button>
        )}
        {resetDefaultFilters && (
          <Button id="reset-filters" onClick={() => resetDefaultFilters()} variant="link">
            {t('Reset defaults filters')}
          </Button>
        )}
        {showMetrics && (
          <Button id="show-metrics" onClick={() => showMetrics()} variant="link">
            {t('Show metrics')}
          </Button>
        )}
        {showBuildInfo && (
          <Button id="show-build-info" onClick={() => showBuildInfo()} variant="link">
            {t('Show build info')}
          </Button>
        )}
        {showConfigLimits && (
          <Button id="show-config-limits" onClick={() => showConfigLimits()} variant="link">
            {t('Show configuration limits')}
          </Button>
        )}
      </EmptyStateActions>
    </>
  );
};

export default SecondaryAction;
