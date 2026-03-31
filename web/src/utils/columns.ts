import _ from 'lodash';
import { Record } from '../api/ipfix';
import { Feature } from '../model/config';
import { FilterId } from '../model/filters';
import { compareNumbers, compareStrings } from './base-compare';
import { computeValueFunc, fromFieldFunc } from './column-parser';
import { FieldConfig } from './fields';
import { compareIPs } from './ip';
import { comparePorts } from './port';
import { compareProtocols } from './protocol';

export enum ColumnsId {
  starttime = 'StartTime',
  endtime = 'EndTime',
  type = 'K8S_Type',
  clustername = 'ClusterName',
  udn = 'UDN',
  srczone = 'SrcZone',
  dstzone = 'DstZone',
  srctype = 'SrcK8S_Type',
  dsttype = 'DstK8S_Type',
  namespace = 'K8S_Namespace',
  srcnamespace = 'SrcK8S_Namespace',
  dstnamespace = 'DstK8S_Namespace',
  name = 'K8S_Name',
  srcname = 'SrcK8S_Name',
  dstname = 'DstK8S_Name',
  kubeobject = 'K8S_Object',
  srckubeobject = 'SrcK8S_Object',
  dstkubeobject = 'DstK8S_Object',
  addr = 'Addr',
  srcaddr = 'SrcAddr',
  dstaddr = 'DstAddr',
  mac = 'Mac',
  srcmac = 'SrcMac',
  dstmac = 'DstMac',
  port = 'Port',
  srcport = 'SrcPort',
  dstport = 'DstPort',
  addrport = 'AddrPort',
  proto = 'Proto',
  icmptype = 'IcmpType',
  icmpcode = 'IcmpCode',
  dscp = 'Dscp',
  tcpflags = 'TCPFlags',
  bytes = 'Bytes',
  packets = 'Packets',
  dropbytes = 'PktDropBytes',
  droppackets = 'PktDropPackets',
  dropstate = 'PktDropLatestState',
  dropcause = 'PktDropLatestDropCause',
  dropflags = 'PktDropLatestFlags',
  owner = 'K8S_OwnerName',
  srcowner = 'SrcK8S_OwnerName',
  dstowner = 'DstK8S_OwnerName',
  ownertype = 'K8S_OwnerType',
  srcownertype = 'SrcK8S_OwnerType',
  dstownertype = 'DstK8S_OwnerType',
  ownerkubeobject = 'K8S_OwnerObject',
  srcownerkubeobject = 'SrcK8S_OwnerObject',
  dstownerkubeobject = 'DstK8S_OwnerObject',
  host = 'K8S_HostIP',
  duration = 'FlowDuration',
  collectiontime = 'CollectionTime',
  collectionlatency = 'CollectionLatency',
  dnsid = 'DNSId',
  dnslatency = 'DNSLatency',
  dnsresponsecode = 'DNSResponseCode',
  dnserrno = 'DNSErrNo',
  hostaddr = 'K8S_HostIP',
  srchostaddr = 'SrcK8S_HostIP',
  dsthostaddr = 'DstK8S_HostIP',
  hostname = 'K8S_HostName',
  srchostname = 'SrcK8S_HostName',
  dsthostname = 'DstK8S_HostName',
  nodedir = 'FlowDirection',
  rttTime = 'TimeFlowRttMs',
  hashid = '_HashId',
  interfaces = 'Interfaces',
  ifdirs = 'IfDirections',
  flowdirints = 'FlowDirInts',
  udns = 'Udns',
  tlstypes = 'TLSTypes',
  recordtype = 'RecordType',
  bytesab = 'Bytes_AB',
  bytesba = 'Bytes_BA',
  packetsab = 'Packets_AB',
  packetsba = 'Packets_BA',
  isfirst = 'IsFirst',
  numflow = 'numFlowLogs'
}

export interface ColumnConfigDef {
  id: string;
  group?: string;
  name: string;
  field?: string;
  fields?: string[];
  calculated?: string;
  tooltip?: string;
  docURL?: string;
  filter?: string;
  default?: boolean;
  width?: number;
  feature?: Feature;
}

export interface KubeObj {
  name: string;
  kind: string;
  namespace?: string;
  showNamespace: boolean;
}
export type ColValue = string | number | KubeObj | string[] | number[] | KubeObj[] | undefined;
export const isKubeObj = (v: ColValue): v is KubeObj => {
  return (v as KubeObj)?.kind !== undefined;
};

export interface Column {
  id: ColumnsId;
  group?: string;
  name: string;
  field?: FieldConfig;
  tooltip?: string;
  docURL?: string;
  quickFilter?: FilterId;
  isSelected: boolean;
  isCommon?: boolean;
  value?: (flow: Record) => ColValue;
  fieldValue?: (flow: Record) => ColValue;
  sort(a: Record, b: Record, col: Column): number;
  // width in "em"
  width: number;
  feature?: Feature;
}

export type ColumnSizeMap = {
  [id in ColumnsId]?: string;
};

export type ColumnGroup = {
  title?: string;
  columns: Column[];
  expanded?: boolean;
};

export const getColumnGroups = (columns: Column[], commonGroupName?: string, sortColumns = false) => {
  const groups: ColumnGroup[] = [];

  if (commonGroupName) {
    //groups name is unique
    //ie dropdown filters
    //add empty expanded group at first
    groups.push({ columns: [], expanded: true });
    _.each(columns, col => {
      const found = groups.find(g => g.title === col.group);
      if (found) {
        found.columns.push(col);
      } else {
        groups.push({ title: col.group, columns: [col] });
      }
    });
    //set the name at the end to allow title match
    groups[0].title = commonGroupName;
  } else {
    //group with same name can be added multiple times
    //ie nested columns groups
    _.each(columns, col => {
      if (col.group && _.last(groups)?.title === col.group) {
        _.last(groups)!.columns.push(col);
      } else {
        groups.push({ title: col.group, columns: [col] });
      }
    });
  }

  if (sortColumns) {
    //sort columns by name to find filter easily
    _.each(groups, g => {
      g.columns = g.columns.sort((a, b) => a.name.localeCompare(b.name));
    });
  }
  return groups;
};

/* prefix group to column name if available
 * and column name doesn't start with group
 */
export const getFullColumnName = (col?: Column): string => {
  if (col) {
    if (col.group && !col.name.startsWith(col.group)) {
      return `${col.group} ${col.name}`;
    }
    return col.name;
  }
  return '';
};

/* remove group from column name if prefixed
 * ie DNS Response Code -> Response Code
 */
export const getShortColumnName = (col?: Column): string => {
  if (col) {
    if (col.group && col.name.startsWith(col.group)) {
      return col.name.replace(col.group, '');
    }
    return col.name;
  }
  return '';
};

const getFieldSingleValue = (rec: Record, fvFunc: (flow: Record) => ColValue): ColValue => {
  const val = fvFunc(rec);
  if (Array.isArray(val) && val.length > 0) {
    // E.g. for Bytes / Packets columns as they may include drops
    return val[0];
  }
  return val;
};

export const getDefaultColumns = (columnDefs: ColumnConfigDef[], fieldConfigs: FieldConfig[]): Column[] => {
  const columns: Column[] = [];

  // add a column for each definition
  columnDefs.forEach(d => {
    const id = d.id as ColumnsId;

    const field = !_.isEmpty(d.field) ? fieldConfigs.find(f => f.name === d.field) : undefined;
    if (!_.isEmpty(d.field) && field === undefined) {
      throw new Error('Invalid config provided. Field ' + d.field + ' of column ' + d.name + " doesn't exists.");
    }

    const fields = !_.isEmpty(d.fields) ? fieldConfigs.filter(f => d.fields!.includes(f.name)) : undefined;
    if (!_.isEmpty(d.fields) && (fields === undefined || fields!.length !== d.fields!.length)) {
      throw new Error('Invalid config provided. Fields ' + d.fields + ' of column ' + d.name + " doesn't match.");
    }

    columns.push({
      id,
      group: !_.isEmpty(d.group) ? d.group : undefined,
      name: d.name,
      field,
      tooltip: !_.isEmpty(d.tooltip) ? d.tooltip : undefined,
      docURL: !_.isEmpty(d.docURL) ? d.docURL : undefined,
      quickFilter: !_.isEmpty(d.filter) ? (d.filter as FilterId) : undefined,
      isSelected: d.default === true,
      isCommon: d.calculated !== undefined && d.calculated.startsWith('['),
      value: computeValueFunc(d, columns, fields, field),
      fieldValue: fromFieldFunc(d, fields, field),
      sort: (a: Record, b: Record, col: Column) => {
        if (!col.fieldValue) {
          return -1;
        }
        const valA = getFieldSingleValue(a, col.fieldValue);
        const valB = getFieldSingleValue(b, col.fieldValue);
        if (typeof valA === 'number' && typeof valB === 'number') {
          if (col.id.includes('Port')) {
            return comparePorts(valA, valB);
          } else if (col.id.includes('Proto')) {
            return compareProtocols(valA, valB);
          }
          return compareNumbers(valA, valB);
        } else if (typeof valA === 'string' && typeof valB === 'string') {
          if (col.id.includes('IP') && !col.id.includes('IPSec')) {
            return compareIPs(valA, valB);
          }
          return compareStrings(valA, valB);
        }
        return 0;
      },
      width: d.width || 15,
      feature: d.feature
    });
  });
  return columns;
};
