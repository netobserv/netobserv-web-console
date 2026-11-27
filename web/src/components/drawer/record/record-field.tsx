import { ResourceIcon, ResourceLink } from '@openshift-console/dynamic-plugin-sdk';
import { Button, Content, ContentVariants, Flex, FlexItem, Popover, Tooltip } from '@patternfly/react-core';
import { GlobeAmericasIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { FlowDirection, getDirectionDisplayString, Record } from '../../../api/ipfix';
import { Column, ColumnsId, getFullColumnName, isKubeObj, KubeObj } from '../../../utils/columns';
import { dateFormatter, getFormattedDate, timeMSFormatter, utcDateTimeFormatter } from '../../../utils/datetime';
import { dnsCodesNames, dnsErrorsValues, getDNSErrorDescription, getDNSRcodeDescription } from '../../../utils/dns';
import { getDSCPDocUrl, getDSCPServiceClassDescription, getDSCPServiceClassName } from '../../../utils/dscp';
import { formatDurationAboveMillisecond, formatDurationAboveNanosecond } from '../../../utils/duration';
import { getICMPCode, getICMPDocUrl, getICMPType, ICMPAllTypesValues, isValidICMPProto } from '../../../utils/icmp';
import { DropCausesNames, getDropCauseDescription, getDropCauseDocUrl } from '../../../utils/pkt-drop';
import { formatPort } from '../../../utils/port';
import { formatProtocol, getProtocolDocUrl } from '../../../utils/protocol';
import { getFlagsList, getTCPFlagsDocUrl } from '../../../utils/tcp-flags';
import { Link } from '../../../utils/url';
import { Size } from '../../dropdowns/table-display-dropdown';
import { FilterAddIcon, FilterRemoveIcon, FilterToggleOffIcon, FilterToggleOnIcon } from '../../icons';
import './record-field.css';

export type RecordFieldFilter = {
  type: 'filter' | 'switch';
  onClick: () => void;
  isDelete: boolean;
};

const maxArrayIndex = 2;

export type FlexValue = 'flexDefault' | 'flexNone' | 'flex_1' | 'flex_2' | 'flex_3' | 'flex_4';
export type FlexWrapValue = 'wrap' | 'wrapReverse' | 'nowrap';

export interface RecordFieldProps {
  allowPktDrops: boolean;
  flow: Record;
  column: Column;
  size?: Size;
  useLinks: boolean;
  filter?: RecordFieldFilter;
  detailed?: boolean;
  isDark?: boolean;
}

export const RecordField: React.FC<RecordFieldProps> = ({
  allowPktDrops,
  flow,
  column,
  size,
  filter,
  useLinks,
  detailed,
  isDark
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const multiLineSize = size === 'l' ? 'm' : 's';

  const errorTextValue = (value: string, text: string) => {
    return (
      <div className="record-field-flex">
        <Tooltip
          content={[
            <span className="co-nowrap" key="co-error-text">
              {text}
            </span>
          ]}
        >
          <Content
            component={ContentVariants.p}
            style={{ color: isDark ? '#C9190B' : '#A30000' }}
            className="record-field-flex"
          >
            {value}
          </Content>
        </Tooltip>
      </div>
    );
  };

  const emptyText = (errorText?: string) => {
    if (errorText) {
      return errorTextValue(t('n/a'), errorText);
    }
    return (
      <Content component="p" className="record-field-flex text-muted record-field-value">
        {t('n/a')}
      </Content>
    );
  };

  const moreText = (count: number) => {
    return (
      <Content component="p" className="record-field-flex record-field-value">{`${count} ${t('more')}...`}</Content>
    );
  };

  const emptyDnsErrorText = () => {
    return emptyText(
      flow.fields.DnsErrno
        ? `${t('DNS Error')} ${flow.fields.DnsErrno}: ${getDNSErrorDescription(
            flow.fields.DnsErrno as dnsErrorsValues
          )}`
        : undefined
    );
  };

  const simpleTextWithTooltip = (text?: string, color?: string, child?: JSX.Element, forcedSize?: Size) => {
    if (text) {
      return (
        <Content
          className={`field-text ${forcedSize || size} netobserv-no-child-margin`}
          data-test={`field-text-${text}`}
        >
          <Content className="record-field-value" component={ContentVariants.p} style={{ color }}>
            {text}
          </Content>
          <Content component={ContentVariants.p} className="record-field-tooltip">
            {text}
          </Content>
          {child}
        </Content>
      );
    }
    return undefined;
  };

  const resourceIconText = (value: string, kind: string, ns?: string, forcedSize?: Size) => {
    return (
      //force ResourceLink when ResourceIcon is not defined (ie OCP < 4.12)
      !ResourceIcon || useLinks ? (
        <ResourceLink className={size} inline={true} kind={kind} name={value} namespace={ns} />
      ) : (
        <Content className={`co-resource-item ${forcedSize || size} netobserv-no-child-margin`}>
          <ResourceIcon kind={kind} />
          <Content component={ContentVariants.p} className="co-resource-item__resource-name" data-test-id={value}>
            {value}
          </Content>
        </Content>
      )
    );
  };

  const kubeObjContainer = (k: KubeObj) => {
    const main = kubeObjContent(k.name, k.kind, k.namespace, multiLineSize);
    if (k.showNamespace && k.namespace) {
      return doubleContainer(main, kindContent('Namespace', k.namespace, multiLineSize), false, true, 'm');
    }
    return singleContainer(main);
  };

  const kubeObjContent = (
    value: string | undefined,
    kind: string | undefined,
    ns: string | undefined,
    forcedSize?: Size
  ) => {
    // Note: namespace is not mandatory here (e.g. Node objects)
    if (value && kind) {
      return (
        <div data-test={`field-resource-${kind}.${ns}.${value}`} className="force-truncate">
          {resourceIconText(value, kind, ns, forcedSize)}
          {kubeTooltip(value, kind, ns)}
        </div>
      );
    }
    return undefined;
  };

  const kubeTooltip = (value: string, kind: string, ns: string | undefined) => {
    return (
      <Content className="record-field-tooltip netobserv-no-child-margin">
        {ns && (
          <>
            <Content component={ContentVariants.h4}>{t('Namespace')}</Content>
            <Content component={ContentVariants.p}>{ns}</Content>
          </>
        )}
        <Content component={ContentVariants.h4}>{kind}</Content>
        <Content component={ContentVariants.p}>{value}</Content>
      </Content>
    );
  };

  const kindContent = (kind: 'Namespace' | 'Node', value?: string, forcedSize?: Size) => {
    if (value) {
      return (
        <div data-test={`field-kind-${kind}.${value}`} className="force-truncate">
          {resourceIconText(value, kind, undefined, forcedSize)}
          <Content className="record-field-tooltip netobserv-no-child-margin">
            <Content component={ContentVariants.h4}>{t(kind)}</Content>
            <Content component={ContentVariants.p}>{value}</Content>
          </Content>
        </div>
      );
    }
    return undefined;
  };

  const dateTimeContent = (date: Date | undefined) => {
    if (!date) {
      return emptyText();
    }

    const fullDateText = getFormattedDate(date, utcDateTimeFormatter);
    const dateText = getFormattedDate(date, dateFormatter) + ',';
    const timeText = getFormattedDate(date, timeMSFormatter);
    return singleContainer(
      <Flex data-test={`field-date-${dateText}-${timeText}`} className="record-field-date">
        <FlexItem className="record-field-date-icon-container">
          <GlobeAmericasIcon className="record-field-date-icon" />
        </FlexItem>
        <FlexItem>
          <Tooltip
            content={[
              <span className="co-nowrap" key="co-timestamp">
                {fullDateText}
              </span>
            ]}
          >
            <Content className={`datetime ${size} netobserv-no-child-margin`}>
              <Content component={ContentVariants.p}>{dateText}</Content>{' '}
              <Content component={ContentVariants.p} className="text-muted">
                {timeText}
              </Content>
            </Content>
          </Tooltip>
        </FlexItem>
      </Flex>
    );
  };

  const nthContainer = (
    children: (JSX.Element | undefined)[],
    asChild = true,
    childIcon = true,
    truncate?: boolean,
    forcedSize?: Size,
    className = ''
  ) => {
    return (
      <Flex className={`record-field-flex-container ${forcedSize || size} ${className}`} flex={{ default: 'flex_1' }}>
        {children.length > 0 ? (
          children
            .filter((_c, i) => !truncate || i < maxArrayIndex)
            .map((c, i) => {
              const child = c ? c : emptyText();
              if (i > 0 && asChild && childIcon) {
                const arrow = <span className="child-arrow">{'↪'}</span>;
                return (
                  <React.Fragment key={i}>
                    {sideBySideContainer(arrow, child, 'flexNone', 'flex_1', 'nowrap')}
                  </React.Fragment>
                );
              }
              return <React.Fragment key={i}>{child}</React.Fragment>;
            })
        ) : (
          <Content component="p" className="text-muted record-field-value">
            {t('n/a')}
          </Content>
        )}
        {truncate && children.length > maxArrayIndex && moreText(children.length - maxArrayIndex)}
      </Flex>
    );
  };

  const doubleContainer = (
    child1?: JSX.Element,
    child2?: JSX.Element,
    asChild = true,
    childIcon = true,
    forcedSize?: Size
  ) => {
    return nthContainer([child1, child2], asChild, childIcon, false, forcedSize);
  };

  const sideBySideContainer = (
    leftElement?: JSX.Element,
    rightElement?: JSX.Element,
    leftFlex: FlexValue = 'flex_1',
    rightFlex: FlexValue = 'flex_1',
    wrap: FlexWrapValue = 'wrap'
  ) => {
    return (
      <Flex direction={{ default: 'row' }} flex={{ default: 'flex_1' }} flexWrap={{ default: wrap }}>
        <FlexItem className="side-by-side" flex={{ default: leftFlex }}>
          {leftElement || emptyText()}
        </FlexItem>
        <FlexItem className="side-by-side" flex={{ default: rightFlex }}>
          {rightElement || emptyText()}
        </FlexItem>
      </Flex>
    );
  };

  const singleContainer = (child?: JSX.Element) => {
    return <div className={`record-field-content ${size}`}>{child ? child : emptyText()}</div>;
  };

  const clickableContent = (text: string, content: string, docUrl?: string) => {
    return (
      <Popover
        headerContent={text}
        bodyContent={content}
        footerContent={
          docUrl ? (
            <Button
              variant="link"
              component={(props: React.FunctionComponent) => (
                <Link {...props} target="_blank" to={{ pathname: docUrl }} />
              )}
            >
              {t('Show related documentation')}
            </Button>
          ) : undefined
        }
      >
        <Button
          icon={<Content component={ContentVariants.h4}>{text}</Content>}
          variant="plain"
          className="record-field-value-popover-button"
        />
      </Popover>
    );
  };

  const content = (c: Column, isTable: boolean) => {
    if (!c.value) {
      // Value function not configured
      return emptyText();
    }
    const value = c.value(flow);
    switch (c.id) {
      case ColumnsId.collectiontime:
      case ColumnsId.starttime:
      case ColumnsId.endtime:
        return dateTimeContent(typeof value === 'number' && !isNaN(value) ? new Date(value) : undefined);
      case ColumnsId.collectionlatency:
      case ColumnsId.duration:
      case ColumnsId.rttTime:
        return singleContainer(
          typeof value === 'number' && !isNaN(value)
            ? simpleTextWithTooltip(
                c.id === ColumnsId.rttTime
                  ? formatDurationAboveNanosecond(value as number)
                  : formatDurationAboveMillisecond(value as number)
              )
            : undefined
        );
      case ColumnsId.port:
        return doubleContainer(
          simpleTextWithTooltip(flow.fields.SrcPort ? formatPort(flow.fields.SrcPort) : ''),
          simpleTextWithTooltip(flow.fields.DstPort ? formatPort(flow.fields.DstPort) : '')
        );
      case ColumnsId.srcport:
      case ColumnsId.dstport: {
        return singleContainer(simpleTextWithTooltip(value ? formatPort(value as number) : ''));
      }
      case ColumnsId.proto: {
        if (typeof value === 'number' && !isNaN(value)) {
          const docUrl = getProtocolDocUrl();
          const protocolName = formatProtocol(value as number, t);
          return singleContainer(
            detailed
              ? clickableContent(protocolName, `${t('Value')}: ${value}`, docUrl)
              : simpleTextWithTooltip(protocolName)
          );
        } else {
          return singleContainer(emptyText());
        }
      }
      case ColumnsId.dscp: {
        let child = emptyText();
        if (typeof value === 'number' && !isNaN(value)) {
          const serviceClassName = getDSCPServiceClassName(value);
          if (serviceClassName && detailed) {
            child = clickableContent(
              serviceClassName,
              `${t('Value')}: ${value} ${t('Examples')}: ${getDSCPServiceClassDescription(value)}`,
              getDSCPDocUrl()
            );
          } else {
            child = simpleTextWithTooltip(serviceClassName || String(value))!;
          }
        }
        return singleContainer(child);
      }
      case ColumnsId.tcpflags:
      case ColumnsId.dropflags: {
        let child = emptyText();
        if (Array.isArray(value) && value.length > 0) {
          const flags = getFlagsList(value as string[]);
          const joined = value.join(', ');
          if (detailed) {
            let description = `${t('Value')}: ${value}`;
            if (flags.length === 1) {
              description += '. ' + flags[0].description;
            } else if (flags.length > 1) {
              description +=
                '. ' +
                t('The flow contains packets with various flags: ') +
                flags.map(f => f.name + ' (' + f.description + ')').join('; ');
            }
            child = clickableContent(joined, description, getTCPFlagsDocUrl());
          } else {
            child = simpleTextWithTooltip(joined)!;
          }
        }
        return singleContainer(child);
      }
      case ColumnsId.icmptype: {
        let child = emptyText();
        if (typeof value === 'number' && !isNaN(value)) {
          const proto = Number(flow.fields.Proto);
          if (isValidICMPProto(proto)) {
            const type = getICMPType(proto, value as ICMPAllTypesValues);
            if (type && detailed) {
              child = clickableContent(type.name, type.description || '', getICMPDocUrl(proto));
            } else {
              child = simpleTextWithTooltip(type?.name || String(value))!;
            }
          } else {
            child = errorTextValue(
              String(value),
              t('ICMP type provided but protocol is {{proto}}', { proto: formatProtocol(proto, t) })
            );
          }
        }
        return singleContainer(child);
      }
      case ColumnsId.icmpcode: {
        let child = emptyText();
        if (typeof value === 'number' && !isNaN(value)) {
          const proto = Number(flow.fields.Proto);
          const typez = Number(flow.fields.IcmpType) as ICMPAllTypesValues;
          if (isValidICMPProto(proto)) {
            const code = getICMPCode(proto, typez, value);
            if (code && detailed) {
              child = clickableContent(code.name, code.description || '', getICMPDocUrl(proto));
            } else {
              child = simpleTextWithTooltip(code?.name || String(value))!;
            }
          } else {
            child = errorTextValue(
              String(value),
              t('ICMP code provided but protocol is {{proto}}', { proto: formatProtocol(proto, t) })
            );
          }
        }
        return singleContainer(child);
      }
      case ColumnsId.nodedir:
      case ColumnsId.ifdirs: {
        if (Array.isArray(value)) {
          return nthContainer(
            value.map(dir => simpleTextWithTooltip(getDirectionDisplayString(String(dir) as FlowDirection, t))),
            true,
            false,
            isTable,
            multiLineSize
          );
        }
        return singleContainer(simpleTextWithTooltip(getDirectionDisplayString(String(value) as FlowDirection, t)));
      }
      case ColumnsId.interfaces: {
        if (Array.isArray(value)) {
          return nthContainer(
            value.map(iName => simpleTextWithTooltip(String(iName))),
            true,
            false,
            isTable,
            multiLineSize
          );
        }
        return singleContainer(simpleTextWithTooltip(String(value)));
      }
      case ColumnsId.udns: {
        if (Array.isArray(value)) {
          return nthContainer(
            value
              .map(iName => String(iName))
              .filter(iName => iName !== '')
              .map(iName => simpleTextWithTooltip(iName)),
            true,
            false,
            isTable
          );
        }
        return singleContainer(simpleTextWithTooltip(String(value)));
      }
      case ColumnsId.flowdirints: {
        if (
          flow.fields.Interfaces &&
          flow.fields.IfDirections &&
          Array.isArray(flow.fields.Interfaces) &&
          Array.isArray(flow.fields.IfDirections) &&
          flow.fields.Interfaces.length === flow.fields.IfDirections.length
        ) {
          return nthContainer(
            flow.fields.Interfaces.map((iName, i) =>
              sideBySideContainer(
                simpleTextWithTooltip(iName, undefined, undefined, multiLineSize),
                simpleTextWithTooltip(
                  getDirectionDisplayString(String(flow.fields.IfDirections![i]) as FlowDirection, t),
                  undefined,
                  undefined,
                  multiLineSize
                )
              )
            ),
            true,
            false,
            isTable,
            undefined,
            'flowdirints'
          );
        } else {
          return singleContainer(emptyText(t('Invalid data provided. Check JSON for details.')));
        }
      }
      case ColumnsId.packets:
      case ColumnsId.bytes:
        //show both sent / dropped counts
        if (Array.isArray(value)) {
          let droppedText = t('dropped');
          let child: JSX.Element | undefined = undefined;
          if (detailed && c.id === ColumnsId.packets && flow.fields.PktDropLatestDropCause) {
            droppedText = t('dropped by');
            child = clickableContent(
              flow.fields.PktDropLatestDropCause,
              getDropCauseDescription(flow.fields.PktDropLatestDropCause as DropCausesNames),
              getDropCauseDocUrl(flow.fields.PktDropLatestDropCause as DropCausesNames)
            );
          }

          const sentCount = value.length >= 1 && value[0] ? String(value[0]) : String(0);
          const droppedCount = allowPktDrops && value.length >= 2 && value[1] ? String(value[1]) : undefined;
          return doubleContainer(
            simpleTextWithTooltip(
              detailed ? `${sentCount} ${c.name.toLowerCase()} ${t('sent')}` : sentCount,
              allowPktDrops ? (isDark ? '#3E8635' : '#1E4F18') : undefined,
              undefined,
              multiLineSize
            ),
            droppedCount ? (
              simpleTextWithTooltip(
                detailed ? `${droppedCount} ${c.name.toLowerCase()} ${droppedText}` : droppedCount,
                isDark ? '#C9190B' : '#A30000',
                child,
                multiLineSize
              )
            ) : (
              <></>
            ),
            true,
            false
          );
        } else {
          return singleContainer(
            simpleTextWithTooltip(detailed ? `${String(value)} ${c.name.toLowerCase()} ${t('sent')}` : String(value))
          );
        }
      case ColumnsId.dropbytes:
      case ColumnsId.droppackets:
        const droppedText = t('dropped');
        const droppedCount = String(value);
        return singleContainer(
          simpleTextWithTooltip(
            detailed ? `${droppedCount} ${c.name.toLowerCase()} ${droppedText}` : droppedCount,
            isDark ? '#C9190B' : '#A30000'
          )
        );
      case ColumnsId.dnsid: {
        return singleContainer(
          typeof value === 'number' && !isNaN(value) ? simpleTextWithTooltip(String(value)) : emptyDnsErrorText()
        );
      }
      case ColumnsId.dnslatency: {
        return singleContainer(
          typeof value === 'number' && !isNaN(value)
            ? simpleTextWithTooltip(formatDurationAboveMillisecond(value as number))
            : emptyDnsErrorText()
        );
      }
      case ColumnsId.dnsresponsecode: {
        return singleContainer(
          typeof value === 'string' && value.length
            ? simpleTextWithTooltip(detailed ? `${value}: ${getDNSRcodeDescription(value as dnsCodesNames)}` : value)
            : emptyDnsErrorText()
        );
      }
      case ColumnsId.dnserrno: {
        return singleContainer(
          typeof value === 'number' && !isNaN(value)
            ? simpleTextWithTooltip(
                detailed && value ? `${value}: ${getDNSErrorDescription(value as dnsErrorsValues)}` : String(value)
              )
            : emptyText()
        );
      }
      case ColumnsId.udn: {
        const id = value as string;
        let child: JSX.Element | undefined;
        // TODO: define how to split the UDN ID
        // an alternative could be to use `calculated: kubeObject(K8S_UDN_Type,K8S_UDN_Namespace,K8S_UDN_Name,0)`
        // from config within 3 separated fields
        if (id.includes('.')) {
          const parts = id.split('.');
          child = kubeObjContent(parts[1], 'UserDefinedNetwork', parts[0]);
        } else {
          child = kubeObjContent(id, 'ClusterUserDefinedNetwork', undefined);
        }
        return singleContainer(child);
      }
      default:
        if (value === undefined) {
          return emptyText();
        }
        if (Array.isArray(value) && value.length) {
          // we can only show two values properly with containers
          if (value.length === 2) {
            const contents = value.map(v =>
              isKubeObj(v) ? kubeObjContainer(v) : simpleTextWithTooltip(String(v), undefined, undefined, multiLineSize)
            );
            return doubleContainer(contents[0], contents[1], undefined, undefined, multiLineSize);
          }
          // else we will show values as single joigned string
          return singleContainer(simpleTextWithTooltip(value.map(v => String(v)).join(', ')));
        } else if (value && isKubeObj(value)) {
          return kubeObjContainer(value);
        } else {
          return singleContainer(simpleTextWithTooltip(String(value)));
        }
    }
  };
  return filter ? (
    <Flex className={`record-field-flex-container`} flex={{ default: 'flex_1' }}>
      <FlexItem className={'record-field-flex'} flex={{ default: 'flex_1' }}>
        {content(column, false)}
      </FlexItem>
      <FlexItem>
        <Tooltip
          content={
            filter.type === 'filter'
              ? filter.isDelete
                ? t('Remove {{name}} filter', { name: getFullColumnName(column) })
                : t('Filter on {{name}}', { name: getFullColumnName(column) })
              : t('Switch {{name}} option', { name: getFullColumnName(column) })
          }
        >
          <Button variant="link" aria-label="Filter" onClick={filter.onClick}>
            {filter.type === 'filter' ? (
              filter.isDelete ? (
                <FilterRemoveIcon />
              ) : (
                <FilterAddIcon />
              )
            ) : filter.isDelete ? (
              <FilterToggleOffIcon />
            ) : (
              <FilterToggleOnIcon />
            )}
          </Button>
        </Tooltip>
      </FlexItem>
    </Flex>
  ) : (
    content(column, true)
  );
};

export default RecordField;
