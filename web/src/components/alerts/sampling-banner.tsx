import { Alert, AlertActionCloseButton, AlertActionLink } from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { localStorageSamplingBannerDismissedKey, useLocalStorage } from '../../utils/local-storage-hook';
import { flowCollectorPath, useNavigate } from '../../utils/url';
import './banner.css';

export interface SamplingBannerProps {
  samplingValue: number;
}

export const SamplingBanner: React.FC<SamplingBannerProps> = ({ samplingValue }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const navigate = useNavigate();
  const [isDismissed, setDismissed] = useLocalStorage<boolean>(localStorageSamplingBannerDismissedKey, false);

  // Don't show if sampling <= 1 (all flows captured) or already dismissed
  if (samplingValue <= 1 || isDismissed) {
    return null;
  }

  // Link to FlowCollector setup wizard Consumption tab (requires PR #1570)
  const configLink = flowCollectorPath('setup')?.concat('?tab=consumption');

  return (
    <div className="netobserv-alert" data-test="sampling-banner">
      <Alert
        title={t('Sampling is enabled')}
        isInline={true}
        variant="info"
        actionClose={<AlertActionCloseButton data-test-id="sampling-banner-close" onClose={() => setDismissed(true)} />}
        actionLinks={
          configLink && (
            <React.Fragment>
              <AlertActionLink data-test-id="sampling-action-link" onClick={() => navigate(configLink)}>
                {t('View sampling & resource usage')}
              </AlertActionLink>
            </React.Fragment>
          )
        }
      >
        {t(
          'Not all network flows are captured. Current sampling rate is 1:{{rate}}, meaning approximately 1 in every {{rate}} packets is captured.',
          { rate: samplingValue }
        )}
      </Alert>
    </div>
  );
};

export default SamplingBanner;
