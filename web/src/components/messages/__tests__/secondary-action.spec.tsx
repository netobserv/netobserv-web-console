import { K8sModel } from '@openshift-console/dynamic-plugin-sdk';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { ContextSingleton } from '../../../utils/context';
import { SecondaryAction } from '../secondary-action';

jest.mock('../../../utils/url', () => ({
  Link: ({
    to,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: { pathname: string };
  }) => <a {...props} href={to.pathname} />
}));

const flowCollectorModel = {
  apiGroup: 'flows.netobserv.io',
  apiVersion: 'v1beta2',
  kind: 'FlowCollector'
} as K8sModel;

describe('<SecondaryAction />', () => {
  afterEach(() => {
    ContextSingleton.setFlowCollectorK8SModel(undefined);
    jest.restoreAllMocks();
  });

  it('shows OpenShift console links in plugin mode', () => {
    jest.spyOn(ContextSingleton, 'isStandalone').mockReturnValue(false);
    ContextSingleton.setFlowCollectorK8SModel(flowCollectorModel);

    render(<SecondaryAction />);

    const flowCollectorLink = screen.getByRole('link', { name: 'Show FlowCollector CR' });
    expect(flowCollectorLink).toHaveAttribute(
      'href',
      '/k8s/cluster/flows.netobserv.io~v1beta2~FlowCollector/cluster'
    );
    expect(flowCollectorLink).toHaveAttribute('target', '_blank');

    const healthDashboardLink = screen.getByRole('link', { name: 'Show health dashboard' });
    expect(healthDashboardLink).toHaveAttribute('href', '/monitoring/dashboards/grafana-dashboard-netobserv-health');
    expect(healthDashboardLink).toHaveAttribute('target', '_blank');
  });

  it('hides OpenShift console links in standalone mode and preserves other actions', () => {
    jest.spyOn(ContextSingleton, 'isStandalone').mockReturnValue(true);
    ContextSingleton.setFlowCollectorK8SModel(flowCollectorModel);
    const clearFilters = jest.fn();

    render(<SecondaryAction clearFilters={clearFilters} />);

    expect(screen.queryByRole('link', { name: 'Show FlowCollector CR' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Show health dashboard' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear all filters' }));
    expect(clearFilters).toHaveBeenCalledTimes(1);
  });
});
