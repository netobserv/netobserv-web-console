import { ResourceLink } from '@openshift-console/dynamic-plugin-sdk';
import {
  Accordion,
  AccordionContent,
  AccordionExpandableContentBody,
  AccordionItem,
  AccordionToggle,
  Text,
  TextContent,
  TextVariants
} from '@patternfly/react-core';
import _ from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Record } from '../../api/ipfix';
import { NetflowMetrics, Stats } from '../../api/query-response';
import { RecordType } from '../../model/flow-query';
import { Warning } from '../../model/warnings';
import { compareStrings } from '../../utils/base-compare';
import { config } from '../../utils/config';
import { TimeRange } from '../../utils/datetime';
import { formatDuration, formatDurationAboveMillisecond, formatDurationAboveNanosecond } from '../../utils/duration';
import { compareIPs } from '../../utils/ip';
import { comparePorts, formatPort } from '../../utils/port';
import { formatProtocol } from '../../utils/protocol';
import { FlowsQuerySummaryContent } from './flows-query-summary-content';
import { MetricsQuerySummaryContent } from './metrics-query-summary-content';

type TypeCardinality = {
  type: string;
  objects: K8SObjectCardinality[];
};

type K8SObjectCardinality = {
  namespace?: string;
  names: string[];
};

export interface SummaryPanelContentProps {
  flows?: Record[];
  metrics: NetflowMetrics;
  type: RecordType;
  stats?: Stats;
  maxChunkAge?: number;
  limit: number;
  range: number | TimeRange;
  lastRefresh?: Date;
  lastDuration?: number;
  warning?: Warning;
  showDNSLatency?: boolean;
  showRTTLatency?: boolean;
}

export const SummaryPanelContent: React.FC<SummaryPanelContentProps> = ({
  flows,
  metrics,
  type,
  stats,
  maxChunkAge,
  limit,
  range,
  lastRefresh,
  lastDuration,
  warning,
  showDNSLatency,
  showRTTLatency
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const [expanded, setExpanded] = React.useState<string>('');

  const accordionItem = (id: string, label: string, content: JSX.Element) => {
    return (
      <AccordionItem key={id}>
        <AccordionToggle
          onClick={() => {
            if (id === expanded) {
              setExpanded('');
            } else {
              setExpanded(id);
            }
          }}
          id={id}
          isExpanded={expanded === id}
          data-test={`query-summary-toggle-${id}`}
        >
          {label}
        </AccordionToggle>
        <AccordionContent id={`${id}-content`} isHidden={expanded !== id} isCustomContent>
          {content}
        </AccordionContent>
      </AccordionItem>
    );
  };

  const typeCardinalityContent = (tc: TypeCardinality) => {
    return (
      <>
        {tc.objects
          .sort((a, b) => compareStrings(a.namespace ? a.namespace : '', b.namespace ? b.namespace : ''))
          .flatMap(o => (
            <AccordionExpandableContentBody key={`${tc.type}-${o.namespace}`}>
              {o.namespace && <ResourceLink kind={'Namespace'} name={o.namespace} />}
              {o.names
                .sort((a, b) => compareStrings(a, b))
                .map(n => (
                  <div
                    key={`${tc.type}-${n}-${o.namespace}`}
                    className={o.namespace ? 'summary-container-grouped' : ''}
                  >
                    <ResourceLink kind={tc.type} name={n} namespace={o.namespace} />
                  </div>
                ))}
            </AccordionExpandableContentBody>
          ))}
      </>
    );
  };

  const listCardinalityContent = (
    values: (string | number)[],
    compareFn?: (a: string | number, b: string | number) => number
  ) => {
    const sortedStrings = compareFn
      ? (values.sort((a: string | number, b: string | number) => compareFn(a, b)) as string[])
      : values;
    return (
      <>
        {sortedStrings.map((v: string) => (
          <AccordionExpandableContentBody key={v}>
            <Text component="p">{v}</Text>
          </AccordionExpandableContentBody>
        ))}
      </>
    );
  };

  const configContent = () => {
    return (
      <TextContent className="summary-text-container">
        <Text component={TextVariants.h3}>{`${t('Configuration')}`}</Text>
        <Text component="p" className="summary-config-item">{`${t('Sampling')}: ${config.sampling}`}</Text>
        {maxChunkAge && (
          <Text component="p" className="summary-config-item">{`${t('Max chunk age')}: ${formatDuration(
            maxChunkAge
          )}`}</Text>
        )}
      </TextContent>
    );
  };

  const versionContent = () => {
    return (
      <TextContent className="summary-text-container">
        <Text component={TextVariants.h3}>{`${t('Version')}`}</Text>
        <Text component="p" className="summary-config-item">{`${t('Number')}: ${config.buildVersion}`}</Text>
        <Text component="p" className="summary-config-item">{`${t('Date')}: ${config.buildDate}`}</Text>
      </TextContent>
    );
  };

  const cardinalityContent = () => {
    const rateMetrics = metrics.rate.map(r => r.bytes || r.packets).or([]);

    //regroup all k8s objects per type + namespace
    const namespaces: string[] = [];
    const typesCardinality: TypeCardinality[] = [];
    let addresses: string[] = [];
    let ports: number[] = [];
    let protocols: number[] = [];

    if (flows && flows.length) {
      //list all types
      const types = Array.from(new Set(flows.flatMap(f => [f.labels.SrcK8S_Type, f.labels.DstK8S_Type])));
      types
        .filter((t: string | undefined) => t !== undefined)
        .forEach((type: string) => {
          const tc: TypeCardinality = { type, objects: [] };

          const typeFilteredFlows = flows.filter(f => [f.labels.SrcK8S_Type, f.labels.DstK8S_Type].includes(type));
          //list all namespaces of this type
          const typeNamespaces = new Set(
            typeFilteredFlows.flatMap(f => [f.labels.SrcK8S_Namespace, f.labels.DstK8S_Namespace])
          );
          typeNamespaces.forEach(namespace => {
            const namespaceFilteredFlows = typeFilteredFlows.filter(f =>
              [f.labels.SrcK8S_Namespace, f.labels.DstK8S_Namespace].includes(namespace)
            );

            const nsObject: K8SObjectCardinality = {
              namespace,
              names: []
            };

            //add all names of this namespace of type
            namespaceFilteredFlows.forEach(record => {
              const srcName =
                record.labels.SrcK8S_Type === type && record.labels.SrcK8S_Namespace === namespace
                  ? record.fields.SrcK8S_Name
                  : undefined;
              if (srcName && !nsObject.names.includes(srcName)) {
                nsObject.names.push(srcName);
              }
              const dstName =
                record.labels.DstK8S_Type === type && record.labels.DstK8S_Namespace === namespace
                  ? record.fields.DstK8S_Name
                  : undefined;
              if (dstName && !nsObject.names.includes(dstName)) {
                nsObject.names.push(dstName);
              }
            });

            if (!_.isEmpty(nsObject.names)) {
              tc.objects.push(nsObject);
            }

            if (namespace && !namespaces.includes(namespace)) {
              namespaces.push(namespace);
            }
          });
          typesCardinality.push(tc);
        });

      addresses = Array.from(
        new Set(flows.map(f => f.fields.SrcAddr || '').concat(flows.map(f => f.fields.DstAddr || '')))
      );
      ports = Array.from(
        new Set(
          flows
            .filter(f => f.fields.SrcPort)
            .map(f => f.fields.SrcPort)
            .concat(flows.filter(f => f.fields.DstPort).map(f => f.fields.DstPort)) as number[]
        )
      );
      protocols = Array.from(new Set(flows.map(f => f.fields.Proto || NaN)));
    } else if (rateMetrics) {
      function manageTypeCardinality(hostName?: string, namespace?: string, type?: string, name?: string) {
        if (namespace && !namespaces.includes(namespace)) {
          namespaces.push(namespace);
        }

        if (type) {
          let tc = typesCardinality.find(t => t.type === type);
          if (!tc) {
            tc = { type: type, objects: [] };
            typesCardinality.push(tc);
          }

          let object = tc.objects.find(o => o.namespace === namespace);
          if (!object) {
            object = { names: [], namespace: namespace };
            tc.objects.push(object);
          }

          if (name && !object.names.includes(name)) {
            object.names.push(name);
          }
        }

        if (hostName) {
          manageTypeCardinality('', '', 'Node', hostName);
        }
      }

      rateMetrics.forEach(m => {
        manageTypeCardinality(m.source.host, m.source.namespace, m.source.resource?.type, m.source.resource?.name);
        manageTypeCardinality(
          m.destination.host,
          m.destination.namespace,
          m.destination.resource?.type,
          m.destination.resource?.name
        );
      });

      addresses = Array.from(
        new Set(rateMetrics.map(m => m.source.addr).concat(rateMetrics.map(m => m.destination.addr)))
      ).filter(v => !_.isEmpty(v)) as string[];
    }

    if (!_.isEmpty(namespaces)) {
      typesCardinality.push({
        type: 'Namespace',
        objects: [{ names: namespaces }]
      });
    }

    return addresses.length || typesCardinality.length || ports.length || protocols.length ? (
      <TextContent className="summary-text-container">
        <Text component={TextVariants.h3}>{`${t('Cardinality')} ${
          !_.isEmpty(rateMetrics) ? t('(top {{limit}} metrics)', { limit }) : ''
        }`}</Text>
        <Accordion id="cardinality-accordion">
          {addresses.length
            ? accordionItem(
                'addresses',
                t('{{n}} IP(s)', { n: addresses.length }),
                listCardinalityContent(addresses, compareIPs)
              )
            : undefined}
          {typesCardinality.length
            ? typesCardinality.map(tc =>
                accordionItem(
                  tc.type,
                  `${tc.objects.map(o => o.names.length).reduce((a, b) => a + b, 0)} ${tc.type}(s)`,
                  typeCardinalityContent(tc)
                )
              )
            : undefined}
          {ports.length
            ? accordionItem(
                'ports',
                t('{{n}} Port(s)', { n: ports.length }),
                listCardinalityContent(
                  //sort ports before format to keep number order
                  ports.sort((p1, p2) => comparePorts(p1, p2)).map(p => formatPort(p))
                )
              )
            : undefined}
          {protocols.length
            ? accordionItem(
                'protocols',
                t('{{n}} Protocol(s)', { n: protocols.length }),
                listCardinalityContent(
                  protocols.map(p => formatProtocol(p, t)),
                  compareStrings
                )
              )
            : undefined}
        </Accordion>
      </TextContent>
    ) : undefined;
  };

  const dnsLatency = (filteredFlows: Record[]) => {
    const filteredDNSFlows = filteredFlows.filter(f => f.fields.DnsLatencyMs !== undefined);

    const dnsLatency = filteredDNSFlows.length
      ? filteredDNSFlows.map(f => f.fields.DnsLatencyMs!).reduce((a, b) => a + b, 0) / filteredDNSFlows.length
      : NaN;

    return (
      <Text component="p" className="summary-config-item">{`${t('DNS latency')}: ${
        isNaN(dnsLatency) ? t('n/a') : formatDurationAboveMillisecond(dnsLatency)
      }`}</Text>
    );
  };

  const rttLatency = (filteredFlows: Record[]) => {
    const filteredRTTFlows = filteredFlows.filter(f => f.fields.TimeFlowRttNs !== undefined);

    const rtt = filteredRTTFlows.length
      ? filteredRTTFlows.map(f => f.fields.TimeFlowRttNs!).reduce((a, b) => a + b, 0) / filteredRTTFlows.length
      : NaN;

    return (
      <Text component="p" className="summary-config-item">{`${t('Flow RTT')}: ${
        isNaN(rtt) ? t('n/a') : formatDurationAboveNanosecond(rtt)
      }`}</Text>
    );
  };

  const timeContent = () => {
    const filteredFlows = flows || [];
    const duration = filteredFlows.length
      ? filteredFlows
          .map(f => (f.fields.TimeFlowEndMs || 0) - (f.fields.TimeFlowStartMs || 0))
          .reduce((a, b) => a + b, 0) / filteredFlows.length
      : 0;
    const collectionLatency = filteredFlows.length
      ? filteredFlows
          .map(f => (f.fields.TimeReceived || 0) * 1000 - (f.fields.TimeFlowEndMs || 0))
          .reduce((a, b) => a + b, 0) / filteredFlows.length
      : 0;

    return flows && flows.length ? (
      <TextContent className="summary-text-container">
        <Text component={TextVariants.h3}>{`${t('Average time')}`}</Text>
        <Text component="p" className="summary-config-item">{`${t('Duration')}: ${formatDurationAboveMillisecond(
          duration
        )}`}</Text>
        {showRTTLatency ? rttLatency(filteredFlows) : <></>}
        <Text component="p" className="summary-config-item">{`${t(
          'Collection latency'
        )}: ${formatDurationAboveMillisecond(collectionLatency)}`}</Text>
        {showDNSLatency ? dnsLatency(filteredFlows) : <></>}
      </TextContent>
    ) : (
      <></>
    );
  };

  return (
    <div className="scrollable-panel">
      <TextContent className="summary-text-container">
        {!_.isEmpty(flows) && stats?.limitReached && (
          <Text component={TextVariants.p}>
            {t(
              // eslint-disable-next-line max-len
              'Flow per request limit reached, following metrics can be inaccurate. Narrow down your search or increase limit.'
            )}
          </Text>
        )}
        <Text component={TextVariants.h3}>{`${t('Results')} ${
          _.isEmpty(flows) ? t('(top {{limit}} metrics)', { limit }) : ''
        }`}</Text>
        {_.isEmpty(flows) ? (
          <MetricsQuerySummaryContent
            className="summary-container-grouped"
            direction="column"
            metrics={metrics}
            numQueries={stats?.numQueries}
            dataSources={stats?.dataSources}
            lastRefresh={lastRefresh}
            lastDuration={lastDuration}
            warning={warning}
          />
        ) : (
          <FlowsQuerySummaryContent
            className="summary-container-grouped"
            direction="column"
            type={type}
            flows={flows!}
            numQueries={stats?.numQueries}
            limitReached={stats?.limitReached || false}
            range={range}
            lastRefresh={lastRefresh}
            lastDuration={lastDuration}
            warning={warning}
          />
        )}
      </TextContent>

      {timeContent()}

      {cardinalityContent()}

      {configContent()}

      {versionContent()}
    </div>
  );
};

export default SummaryPanelContent;
