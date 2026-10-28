import { Alert, Button, Content, Spinner, Stack, StackItem } from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Record } from '../../../api/ipfix';
import { getProxyRecords, ProxyResponse } from '../../../api/proxy';

export const ProxyRecords: React.FC<{ record: Record }> = ({ record }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const [response, setResponse] = React.useState<ProxyResponse>();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const request = React.useRef<AbortController>();
  React.useEffect(() => {
    setResponse(undefined);
    setError(undefined);
    setLoading(false);
    return () => request.current?.abort();
  }, [record]);

  const find = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(undefined);
    try {
      const result = await getProxyRecords(record, controller.signal);
      if (!controller.signal.aborted) {
        setResponse(result);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  // Keep all observed clients: one backend TCP connection can carry many requests.
  const clients = new Map<string, { count: number; start: number; end: number; routers: Set<string> }>();
  response?.records.forEach(item => {
    const endpoint = `[${item.ProxyClientAddr}]:${item.ProxyClientPort}`;
    const client = clients.get(endpoint) || {
      count: 0,
      start: item.ProxyStartMs,
      end: item.ProxyEndMs,
      routers: new Set<string>()
    };
    client.count++;
    client.start = Math.min(client.start, item.ProxyStartMs);
    client.end = Math.max(client.end, item.ProxyEndMs);
    client.routers.add(item.ProxyInstance);
    clients.set(endpoint, client);
  });

  return (
    <Stack hasGutter>
      <StackItem>
        <Content>
          {t('Find clients reported by HAProxy for this backend connection. Supports HTTP, edge and reencrypt routes.')}
        </Content>
      </StackItem>
      <StackItem>
        <Button variant="secondary" onClick={find} isDisabled={loading}>
          {t('Find related clients')}
        </Button>
        {loading && <Spinner size="md" aria-label={t('Loading related clients')} />}
      </StackItem>
      {error && (
        <StackItem>
          <Alert isInline variant="danger" title={t('Could not query HAProxy records')}>
            {error}
          </Alert>
        </StackItem>
      )}
      {response && (
        <>
          <StackItem>
            <Alert isInline variant="info" title={t('Results may be incomplete')}>
              {t(
                // eslint-disable-next-line max-len
                'Logs are emitted when requests finish. This search allows up to 10 minutes after the flow; active requests, delayed or missing logs may be absent. TLS passthrough is unsupported.'
              )}
              {response.pending && ' ' + t('More records may arrive. Run the search again to refresh.')}
              {response.limitReached && ' ' + t('The result limit was reached. Some requests are omitted.')}
            </Alert>
          </StackItem>
          <StackItem>
            <Content>
              {t('Log reception searched from {{start}} to {{end}}', {
                start: new Date(response.searchStartMs).toLocaleString(),
                end: new Date(response.searchEndMs).toLocaleString()
              })}
            </Content>
          </StackItem>
          {clients.size === 0 && (
            <StackItem>
              <Content>{t('No matching client records found.')}</Content>
            </StackItem>
          )}
          {Array.from(clients).map(([endpoint, client]) => (
            <StackItem key={endpoint}>
              <Content component="h3">{endpoint}</Content>
              <Content>{t('Observed requests: {{count}}', { count: client.count })}</Content>
              <Content>
                {t('Request interval: {{start}} to {{end}}', {
                  start: new Date(client.start).toLocaleString(),
                  end: new Date(client.end).toLocaleString()
                })}
              </Content>
              <Content>{t('Routers: {{routers}}', { routers: Array.from(client.routers).join(', ') })}</Content>
            </StackItem>
          ))}
        </>
      )}
    </Stack>
  );
};
