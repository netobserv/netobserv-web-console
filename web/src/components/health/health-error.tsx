import { Content, ContentVariants, EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import * as React from 'react';

export interface HealthErrorProps {
  title: string;
  body: string;
}

export const HealthError: React.FC<HealthErrorProps> = ({ title, body }) => {
  return (
    <div id="netobserv-error-container" className="health-tab-panel">
      <EmptyState titleText={title} headingLevel="h2" icon={ExclamationCircleIcon} data-test="error-state">
        <EmptyStateBody className="error-body">
          <Content className="netobserv-error-message" component={ContentVariants.p}>
            {body}
          </Content>
        </EmptyStateBody>
      </EmptyState>
    </div>
  );
};

export default HealthError;
