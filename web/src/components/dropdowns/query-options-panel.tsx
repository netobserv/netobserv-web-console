import { Radio, Text, TextVariants, Tooltip } from '@patternfly/react-core';
import { InfoAltIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DataSource, PacketLoss, RecordType } from '../../model/flow-query';
import { QueryOptionsProps } from './query-options-dropdown';

export const topValues = [5, 10, 15];
export const limitValues = [50, 100, 500, 1000];

type RecordTypeOption = { label: string; value: RecordType };
type DataSourceOption = { label: string; value: DataSource };
type PacketLossOption = { label: string; value: PacketLoss };

// Exported for tests
export const QueryOptionsPanel: React.FC<QueryOptionsProps> = ({
  recordType,
  setRecordType,
  dataSource,
  setDataSource,
  allowLoki,
  allowProm,
  allowFlow,
  allowConnection,
  allowPktDrops,
  useTopK,
  limit,
  setLimit,
  packetLoss,
  setPacketLoss
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');

  const recordTypeOptions: RecordTypeOption[] = [
    {
      label: t('Conversation'),
      value: 'allConnections'
    },
    {
      label: t('Flow'),
      value: 'flowLog'
    }
  ];

  const dataSourceOptions: DataSourceOption[] = [
    {
      label: t('Loki'),
      value: 'loki'
    },
    {
      label: t('Prometheus'),
      value: 'prom'
    },
    {
      label: t('Auto'),
      value: 'auto'
    }
  ];

  const packetLossOptions: PacketLossOption[] = [
    {
      label: t('Fully dropped'),
      value: 'dropped'
    },
    {
      label: t('Containing drops'),
      value: 'hasDrops'
    },
    {
      label: t('Without drops'),
      value: 'sent'
    },
    {
      label: t('All'),
      value: 'all'
    }
  ];

  const values = useTopK ? topValues : limitValues;

  return (
    <>
      <div className="pf-v5-c-menu__group">
        <Tooltip
          content={t(
            // eslint-disable-next-line max-len
            'Log type to query. A conversation is an aggregation of flows between same peers. Only ended conversations will appear in Overview and Topology tabs.'
          )}
        >
          <div className="pf-v5-c-menu__group-title">
            <Text component={TextVariants.p}>
              {t('Log type')} <InfoAltIcon />
            </Text>
          </div>
        </Tooltip>
        {recordTypeOptions.map(opt => {
          const disabled =
            (!allowFlow && opt.value === 'flowLog') || (!allowConnection && opt.value === 'allConnections');
          return (
            <div key={`recordType-${opt.value}`}>
              <label className="display-dropdown-padding pf-v5-c-menu__menu-item">
                <Tooltip
                  trigger={disabled ? 'mouseenter focus' : ''}
                  content={
                    disabled
                      ? opt.value === 'allConnections'
                        ? t(
                            // eslint-disable-next-line max-len
                            'Only available when FlowCollector.processor.logTypes option equals "CONNECTIONS", "ENDED_CONNECTIONS" or "ALL"'
                          )
                        : t(
                            // eslint-disable-next-line max-len
                            'Only available when FlowCollector.processor.logTypes option equals "FLOWS" or "ALL"'
                          )
                      : undefined
                  }
                >
                  <Radio
                    isChecked={opt.value === recordType}
                    isDisabled={disabled}
                    name={`recordType-${opt.value}`}
                    onChange={() => setRecordType(opt.value)}
                    label={opt.label}
                    data-test={`recordType-${opt.value}`}
                    id={`recordType-${opt.value}`}
                    value={opt.value}
                  />
                </Tooltip>
              </label>
            </div>
          );
        })}
      </div>
      <div className="pf-v5-c-menu__group">
        <Tooltip
          content={t(
            // eslint-disable-next-line max-len
            'Which datasource to query from console plugin pod. Prometheus holds a subset of metrics compared to Loki with better performances. Select "Auto" to pick the best datasource automatically.'
          )}
        >
          <div className="pf-v5-c-menu__group-title">
            <Text component={TextVariants.p}>
              {t('Datasource')} <InfoAltIcon />
            </Text>
          </div>
        </Tooltip>
        {dataSourceOptions.map(opt => {
          const disabled = (!allowProm && opt.value === 'prom') || (!allowLoki && opt.value === 'loki');
          return (
            <div key={`dataSource-${opt.value}`}>
              <label className="display-dropdown-padding pf-v5-c-menu__menu-item">
                <Tooltip
                  trigger={disabled ? 'mouseenter focus' : ''}
                  content={
                    disabled
                      ? opt.value === 'prom'
                        ? t(
                            // eslint-disable-next-line max-len
                            'Only available when FlowCollector.prometheus.enable is true for Overview and Topology tabs'
                          )
                        : opt.value === 'loki'
                          ? t(
                              // eslint-disable-next-line max-len
                              'Only available when FlowCollector.loki.enable is true'
                            )
                          : undefined
                      : undefined
                  }
                >
                  <Radio
                    isChecked={opt.value === dataSource}
                    isDisabled={disabled}
                    name={`dataSource-${opt.value}`}
                    onChange={() => setDataSource(opt.value)}
                    label={opt.label}
                    data-test={`dataSource-${opt.value}`}
                    id={`dataSource-${opt.value}`}
                    value={opt.value}
                  />
                </Tooltip>
              </label>
            </div>
          );
        })}
      </div>
      <div className="pf-v5-c-menu__group">
        <Tooltip
          content={
            <div>
              <p className="netobserv-align-start">
                {t('Filter flows by their drop status. Only packets dropped by the kernel are monitored here.')}
              </p>
              <p className="netobserv-align-start"> - {t('Fully dropped shows the flows that are 100% dropped')}</p>
              <p className="netobserv-align-start">
                - {t('Containing drops shows the flows having at least one packet dropped')}
              </p>
              <p className="netobserv-align-start"> - {t('Without drops show the flows having 0% dropped')}</p>
              <p className="netobserv-align-start"> - {t('All shows everything')}</p>
            </div>
          }
        >
          <div className="pf-v5-c-menu__group-title">
            <Text component={TextVariants.p}>
              {t('Drops filter')} <InfoAltIcon />
            </Text>
          </div>
        </Tooltip>
        {packetLossOptions.map(opt => {
          const disabled = !allowPktDrops && opt.value !== 'all';
          return (
            <div key={`packet-loss-${opt.value}`}>
              <label className="display-dropdown-padding pf-v5-c-menu__menu-item">
                <Tooltip
                  trigger={disabled ? 'mouseenter focus' : ''}
                  content={
                    disabled
                      ? t(
                          // eslint-disable-next-line max-len
                          'Only available using eBPF with FlowCollector.agent.ebpf.features containing "PacketDrop"'
                        )
                      : undefined
                  }
                >
                  <Radio
                    isChecked={opt.value === packetLoss}
                    isDisabled={disabled}
                    name={`packet-loss-${opt.value}`}
                    onChange={() => setPacketLoss(opt.value)}
                    label={opt.label}
                    data-test={`packet-loss-${opt.value}`}
                    id={`packet-loss-${opt.value}`}
                    value={opt.value}
                  />
                </Tooltip>
              </label>
            </div>
          );
        })}
      </div>
      <div className="pf-v5-c-menu__group">
        <Tooltip
          content={
            (useTopK ? t('Top items for internal backend queries.') : t('Limit for internal backend queries.')) +
            ' ' +
            t(
              // eslint-disable-next-line max-len
              'Depending on the matching and filter settings, several queries can be performed under the cover, each with this parameter set, resulting in more results after aggregation.'
            )
          }
        >
          <div className="pf-v5-c-menu__group-title">
            <Text component={TextVariants.p}>
              {useTopK ? t('Top / Bottom') : t('Limit')} <InfoAltIcon />
            </Text>
          </div>
        </Tooltip>
        {values.map(l => (
          <div key={'limit-' + l}>
            <label className="display-dropdown-padding pf-v5-c-menu__menu-item">
              <Radio
                data-test={'limit-' + l}
                id={'limit-' + l}
                name={'limit-' + l}
                isChecked={l === limit}
                label={String(l)}
                onChange={() => setLimit(l)}
                value={String(l)}
              />
            </label>
          </div>
        ))}
      </div>
    </>
  );
};

export default QueryOptionsPanel;
