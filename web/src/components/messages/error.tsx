import {
  Bullseye,
  ClipboardCopy,
  ClipboardCopyVariant,
  Content,
  ContentVariants,
  EmptyState,
  EmptyStateBody,
  Spinner
} from '@patternfly/react-core';
import { ExclamationCircleIcon, ExclamationTriangleIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Status } from '../../api/loki';
import { getBuildInfo, getLimits, getLokiMetrics, getStatus } from '../../api/routes';
import { ContextSingleton } from '../../utils/context';
import {
  getGenericHTTPError,
  LokiClientError,
  LokiResponseError,
  PromDisabledMetrics,
  PromMissingLabels,
  PromUnsupported,
  StructuredError
} from '../../utils/errors';
import { ErrorSuggestions } from './error-suggestions';
import './error.css';
import { SecondaryAction } from './secondary-action';
import { StatusTexts } from './status-texts';

export type Size = 's' | 'm' | 'l';

enum LokiInfo {
  Hidden,
  Metrics,
  Build,
  Limits
}

export interface ErrorProps {
  title: string;
  error: string | StructuredError;
}

export const ErrorComponent: React.FC<ErrorProps> = ({ title, error }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const [lokiLoading, setLokiLoading] = React.useState(
    LokiClientError.isTypeOf(error) || LokiResponseError.isTypeOf(error)
  );
  const [statusLoading, setStatusLoading] = React.useState(true);
  const [status, setStatus] = React.useState<Status | undefined>();
  const [statusError, setStatusError] = React.useState<string | undefined>();
  const [infoName, setInfoName] = React.useState<string | undefined>();
  const [info, setInfo] = React.useState<string | undefined>();

  const updateInfo = React.useCallback(
    (type: LokiInfo) => {
      setLokiLoading(true);

      switch (type) {
        case LokiInfo.Build:
          setInfoName(t('Build info'));
          getBuildInfo()
            .then(data => setInfo(JSON.stringify(data, null, 2)))
            .catch(err => {
              setInfo(getGenericHTTPError(err));
            })
            .finally(() => {
              setLokiLoading(false);
            });
          break;
        case LokiInfo.Limits:
          setInfoName(t('Configuration limits'));
          getLimits()
            .then(data => setInfo(JSON.stringify(data, null, 2)))
            .catch(err => {
              setInfo(getGenericHTTPError(err));
            })
            .finally(() => {
              setLokiLoading(false);
            });
          break;
        case LokiInfo.Metrics:
          setInfoName(t('Metrics'));
          getLokiMetrics()
            .then(data => setInfo(data))
            .catch(err => {
              setInfo(getGenericHTTPError(err));
            })
            .finally(() => {
              setLokiLoading(false);
            });
          break;
        case LokiInfo.Hidden:
        default:
          setInfoName(undefined);
          setInfo(undefined);
          setLokiLoading(false);
          break;
      }
    },
    [t]
  );

  React.useEffect(() => {
    //jest crashing on getStatus not defined so we need to ensure the function is defined here
    if (!getStatus) {
      return;
    }

    getStatus(ContextSingleton.getForcedNamespace())
      .then(status => {
        setStatus(status);
        setStatusError(undefined);
      })
      .catch(err => {
        const errorMessage = getGenericHTTPError(err);
        console.error(errorMessage);
        setStatusError(errorMessage);
        setStatus(undefined);
      })
      .finally(() => {
        setStatusLoading(false);
      });
  }, []);

  // Set different error icon depending on the severity (e.g. configuration error is less severe)
  const isCritical =
    !PromUnsupported.isTypeOf(error) && !PromDisabledMetrics.isTypeOf(error) && !PromMissingLabels.isTypeOf(error);

  return (
    <div id="netobserv-error-container">
      <EmptyState
        titleText={title}
        headingLevel="h2"
        icon={isCritical ? ExclamationCircleIcon : ExclamationTriangleIcon}
        data-test="error-state"
      >
        <EmptyStateBody className="error-body">
          <Content className={isCritical ? 'netobserv-error-message' : ''} component={ContentVariants.p}>
            {String(error)}
          </Content>
          <Content className="error-text-content">
            {typeof error !== 'string' && <ErrorSuggestions error={error} compact={false} />}
            {status && <StatusTexts status={status} />}
            {statusError && (
              <Content component={ContentVariants.blockquote}>
                {t('Check for errors in health dashboard. Status endpoint is returning: {{statusError}}', {
                  statusError
                })}
              </Content>
            )}
          </Content>
        </EmptyStateBody>
        <SecondaryAction
          showMetrics={() => updateInfo(LokiInfo.Metrics)}
          showBuildInfo={() => updateInfo(LokiInfo.Build)}
          showConfigLimits={() => updateInfo(LokiInfo.Limits)}
        />
      </EmptyState>
      {lokiLoading || statusLoading ? (
        <Bullseye data-test="loading-errors">
          <Spinner size="xl" />
        </Bullseye>
      ) : (
        info && (
          <Content>
            <Content component={ContentVariants.h4}>{infoName}</Content>
            <ClipboardCopy
              data-test="clipboard-copy-error"
              isCode
              isExpanded
              hoverTip={t('Copy')}
              clickTip={t('Copied')}
              variant={ClipboardCopyVariant.expansion}
            >
              {info}
            </ClipboardCopy>
          </Content>
        )
      )}
    </div>
  );
};

export default ErrorComponent;
