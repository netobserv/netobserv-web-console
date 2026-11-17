import { Button } from '@patternfly/react-core';
import { AngleDoubleDownIcon, AngleDoubleUpIcon, AngleDownIcon, AngleUpIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

export interface NetflowTableNavigationProps {
  onStart: () => void;
  onPageUp: () => void;
  onPageDown: () => void;
  onEnd: () => void;
}

export const NetflowTableNavigation: React.FC<NetflowTableNavigationProps> = ({
  onStart,
  onPageUp,
  onPageDown,
  onEnd
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');

  return (
    <div className="netflow-table-navigation" role="group" aria-label={t('Flow table navigation')}>
      <Button
        variant="plain"
        icon={<AngleDoubleUpIcon />}
        aria-label={t('Go to start')}
        title={t('Go to start')}
        data-test="table-start"
        onClick={onStart}
      />
      <Button
        variant="plain"
        icon={<AngleUpIcon />}
        aria-label={t('Page up')}
        title={t('Page up')}
        data-test="table-page-up"
        onClick={onPageUp}
      />
      <Button
        variant="plain"
        icon={<AngleDownIcon />}
        aria-label={t('Page down')}
        title={t('Page down')}
        data-test="table-page-down"
        onClick={onPageDown}
      />
      <Button
        variant="plain"
        icon={<AngleDoubleDownIcon />}
        aria-label={t('Go to end')}
        title={t('Go to end')}
        data-test="table-end"
        onClick={onEnd}
      />
    </div>
  );
};

export default NetflowTableNavigation;
