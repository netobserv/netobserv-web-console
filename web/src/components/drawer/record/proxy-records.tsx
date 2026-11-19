import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Flex,
  FlexItem,
  Label,
  Spinner,
  Stack,
  StackItem
} from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Record } from '../../../api/ipfix';
import { getProxyRecords, ProxyResponse } from '../../../api/proxy';
import { dateTimeMSFormatter } from '../../../utils/datetime';
import './proxy-records.css';

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
    const address = item.ProxyClientAddr.includes(':') ? `[${item.ProxyClientAddr}]` : item.ProxyClientAddr;
    const endpoint = `${address}:${item.ProxyClientPort}`;
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

  const timestamp = (ms: number) => (
    <time dateTime={new Date(ms).toISOString()}>{dateTimeMSFormatter.format(new Date(ms))}</time>
  );

  return (
    <Stack hasGutter className="proxy-records">
      <StackItem>
        <Content>
          {t('Find clients reported by HAProxy for this backend connection. Supports HTTP, edge and reencrypt routes.')}
        </Content>
      </StackItem>
      <StackItem>
        <Flex alignItems={{ default: 'alignItemsCenter' }}>
          <FlexItem>
            <Button variant="secondary" onClick={find} isDisabled={loading}>
              {t('Find related clients')}
            </Button>
          </FlexItem>
          {loading && (
            <FlexItem>
              <Spinner size="md" aria-label={t('Loading related clients')} />
            </FlexItem>
          )}
        </Flex>
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
          {clients.size === 0 && (
            <StackItem>
              <Alert isInline isPlain variant="info" title={t('No matching client records found.')} />
            </StackItem>
          )}
          {Array.from(clients).map(([endpoint, client]) => (
            <StackItem key={endpoint}>
              <Card isCompact>
                <CardTitle>
                  <Flex alignItems={{ default: 'alignItemsCenter' }}>
                    <FlexItem flex={{ default: 'flex_1' }}>
                      <code className="proxy-client-endpoint">{endpoint}</code>
                    </FlexItem>
                    <FlexItem>
                      <Label>{t('Observed requests: {{count}}', { count: client.count })}</Label>
                    </FlexItem>
                  </Flex>
                </CardTitle>
                <CardBody>
                  <DescriptionList isCompact isHorizontal>
                    <DescriptionListGroup>
                      <DescriptionListTerm>{t('First request')}</DescriptionListTerm>
                      <DescriptionListDescription>{timestamp(client.start)}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                      <DescriptionListTerm>{t('Last request')}</DescriptionListTerm>
                      <DescriptionListDescription>{timestamp(client.end)}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                      <DescriptionListTerm>{t('Routers')}</DescriptionListTerm>
                      <DescriptionListDescription>
                        {Array.from(client.routers).map(router => (
                          <div key={router}>{router}</div>
                        ))}
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                  </DescriptionList>
                </CardBody>
              </Card>
            </StackItem>
          ))}
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
            <DescriptionList isCompact isHorizontal>
              <DescriptionListGroup>
                <DescriptionListTerm>{t('Search start')}</DescriptionListTerm>
                <DescriptionListDescription>{timestamp(response.searchStartMs)}</DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>{t('Search end')}</DescriptionListTerm>
                <DescriptionListDescription>{timestamp(response.searchEndMs)}</DescriptionListDescription>
              </DescriptionListGroup>
            </DescriptionList>
          </StackItem>
        </>
      )}
    </Stack>
  );
};
