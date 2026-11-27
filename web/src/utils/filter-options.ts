import { TFunction } from 'i18next';
import * as _ from 'lodash';
import protocols from 'protocol-numbers';
import { FlowDirection } from '../api/ipfix';
import { getClusters, getNamespaces, getResources, getUDNs, getZones } from '../api/routes';
import { FilterOption } from '../model/filters';
import { splitResource, SplitStage } from '../model/resource';
import { autoCompleteCache } from './autocomplete-cache';
import { ContextSingleton } from './context';
import { dnsErrors, dnsRCodes } from './dns';
import { dscpValues } from './dscp';
import { dropCauses, dropStates } from './pkt-drop';
import { getPort, getService } from './port';
import { tcpFlagsList } from './tcp-flags';
import { ReadOnlyValue, ReadOnlyValues } from './values';

export const autocompleteEmpty: (value: string) => Promise<FilterOption[]> = () => Promise.resolve([]);

const toFilterOption = (name: string): FilterOption => {
  return { name, value: name };
};

const startsWithPredicate = (itemName: string, itemValue: string, search: string) => {
  return itemValue.startsWith(search) || itemName.toLowerCase().startsWith(search.toLowerCase());
};

const includePredicate = (itemName: string, itemValue: string, search: string) => {
  return itemValue.includes(search) || itemName.toLowerCase().includes(search.toLowerCase());
};

const equalPredicate = (itemName: string, itemValue: string, search: string) => {
  return itemValue === search || itemName.toLowerCase() === search.toLowerCase();
};

const protocolOptions: FilterOption[] = Object.values(protocols)
  .map(proto => ({ name: proto.name, value: proto.value }))
  .filter(proto => !_.isEmpty(proto.name));
_.orderBy(protocolOptions, 'name');

export const autocompleteProtocol = (value: string): Promise<FilterOption[]> => {
  return Promise.resolve(protocolOptions.filter(opt => startsWithPredicate(opt.name, opt.value, value)));
};

const getDirectionOptions = (t: TFunction, allowInner: boolean): FilterOption[] => {
  const directions = [
    { name: t('Ingress'), value: String(FlowDirection.Ingress) },
    { name: t('Egress'), value: String(FlowDirection.Egress) }
  ];
  if (allowInner) {
    return directions.concat({ name: t('Inner'), value: String(FlowDirection.Inner) });
  }
  return directions;
};

export const autocompleteDirection = (t: TFunction, allowInner: boolean, value: string): Promise<FilterOption[]> => {
  return Promise.resolve(
    getDirectionOptions(t, allowInner).filter(
      o => o.value === value || o.name.toLowerCase().includes(value.toLowerCase())
    )
  );
};

const matchOptions = (opts: FilterOption[], match: string): FilterOption[] => {
  if (match) {
    return opts.filter(n => n.name.toLowerCase().startsWith(match.toLowerCase()));
  } else {
    return opts;
  }
};

export const autocompleteCluster = (value: string): Promise<FilterOption[]> => {
  const clusters = autoCompleteCache.getClusters();
  if (clusters) {
    return Promise.resolve(matchOptions(clusters.map(toFilterOption), value));
  }
  return getClusters(ContextSingleton.getForcedNamespace()).then(cs => {
    autoCompleteCache.setClusters(cs);
    return matchOptions(cs.map(toFilterOption), value);
  });
};

export const autocompleteUDN = (value: string): Promise<FilterOption[]> => {
  const clusters = autoCompleteCache.getUDNs();
  if (clusters) {
    return Promise.resolve(matchOptions(clusters.map(toFilterOption), value));
  }
  return getUDNs(ContextSingleton.getForcedNamespace()).then(udns => {
    autoCompleteCache.setUDNs(udns);
    return matchOptions(udns.map(toFilterOption), value);
  });
};

export const autocompleteZone = (value: string): Promise<FilterOption[]> => {
  const zones = autoCompleteCache.getZones();
  if (zones) {
    return Promise.resolve(matchOptions(zones.map(toFilterOption), value));
  }
  return getZones(ContextSingleton.getForcedNamespace()).then(zs => {
    autoCompleteCache.setZones(zs);
    return matchOptions(zs.map(toFilterOption), value);
  });
};

export const autocompleteNamespace = (value: string): Promise<FilterOption[]> => {
  const namespaces = autoCompleteCache.getNamespaces();
  if (namespaces) {
    return Promise.resolve(matchOptions(namespaces.map(toFilterOption), value));
  }
  return getNamespaces(ContextSingleton.getForcedNamespace()).then(ns => {
    autoCompleteCache.setNamespaces(ns);
    return matchOptions(ns.map(toFilterOption), value);
  });
};

const autocompleteName = (kind: string, namespace: string, name: string): Promise<FilterOption[]> => {
  if (autoCompleteCache.hasNames(kind, namespace)) {
    const options = (autoCompleteCache.getNames(kind, namespace) || []).map(toFilterOption);
    return Promise.resolve(matchOptions(options, name));
  }
  return getResources(namespace, kind, ContextSingleton.getForcedNamespace()).then(values => {
    autoCompleteCache.setNames(kind, namespace, values);
    return matchOptions(values.map(toFilterOption), name);
  });
};

export const autocompleteKind = (value: string): Promise<FilterOption[]> => {
  const options = autoCompleteCache.getKinds().map(toFilterOption);
  return Promise.resolve(matchOptions(options, value));
};

export const autocompleteResource = (value: string): Promise<FilterOption[]> => {
  const parts = splitResource(value);
  switch (parts.stage) {
    case SplitStage.PartialKind:
      return autocompleteKind(parts.kind);
    case SplitStage.PartialNamespace:
      return autocompleteNamespace(parts.namespace);
    case SplitStage.Completed:
      return autocompleteName(parts.kind, parts.namespace, parts.name);
  }
};

export const autocompletePort = (value: string): Promise<FilterOption[]> => {
  const opt = portValueToOption(value);
  return Promise.resolve(opt ? [opt] : []);
};

export const portValueToOption = (value: string): FilterOption | undefined => {
  const isNumber = !isNaN(Number(value));
  const foundService = isNumber ? getService(Number(value)) : null;
  const foundPort = !isNumber ? getPort(value) : null;
  if (foundService) {
    return { name: foundService, value: value };
  } else if (foundPort) {
    return { name: value, value: foundPort };
  }
  return undefined;
};

type ROVMapping = {
  rov: ReadOnlyValues;
  mapper: (v: ReadOnlyValue) => FilterOption;
};

// map only names here since codes are stringified in storage
const dropStateMapping: ROVMapping = {
  rov: dropStates,
  mapper: (v: ReadOnlyValue): FilterOption => ({ name: v.name.replace('TCP_', ''), value: v.name })
};
const dropCauseMapping: ROVMapping = {
  rov: dropCauses,
  mapper: (v: ReadOnlyValue): FilterOption => ({ name: v.name.replace('SKB_DROP_REASON_', ''), value: v.name })
};
const dnsRCodeMapping: ROVMapping = {
  rov: dnsRCodes,
  mapper: (v: ReadOnlyValue): FilterOption => ({ name: v.name, value: v.name })
};
const dnsErrMapping: ROVMapping = {
  rov: dnsErrors,
  mapper: (v: ReadOnlyValue): FilterOption => ({ name: v.name, value: String(v.value) })
};
const dscpMapping: ROVMapping = {
  rov: dscpValues,
  mapper: (v: ReadOnlyValue): FilterOption => ({ name: v.name, value: String(v.value) })
};

const autocompleteFromROV = (value: string, mapping: ROVMapping) => {
  const filtered = mapping.rov.filter(opt => includePredicate(opt.name, String(opt.value), value)).map(mapping.mapper);
  return Promise.resolve(filtered);
};

export const autocompleteDropState = (value: string): Promise<FilterOption[]> => {
  return autocompleteFromROV(value, dropStateMapping);
};

export const autocompleteDropCause = (value: string): Promise<FilterOption[]> => {
  return autocompleteFromROV(value, dropCauseMapping);
};

export const autocompleteDnsResponseCode = (value: string): Promise<FilterOption[]> => {
  return autocompleteFromROV(value, dnsRCodeMapping);
};

export const autocompleteDnsErrorCode = (value: string): Promise<FilterOption[]> => {
  return autocompleteFromROV(value, dnsErrMapping);
};

export const autocompleteDSCP = (value: string): Promise<FilterOption[]> => {
  return autocompleteFromROV(value, dscpMapping);
};

export const autocompleteTCPFlags = (value: string): Promise<FilterOption[]> => {
  return Promise.resolve(
    tcpFlagsList
      .filter(opt => opt.name.toLowerCase().includes(value.toLowerCase()))
      .map(v => ({ name: v.name, value: v.name }))
  );
};

export const findProtocolOption = (search: string) => {
  return protocolOptions.find(opt => equalPredicate(opt.name, opt.value, search));
};

export const findDirectionOption = (t: TFunction, allowInner: boolean, search: string) => {
  return getDirectionOptions(t, allowInner).find(opt => equalPredicate(opt.name, opt.value, search));
};

const findFromROV = (search: string, mapping: ROVMapping): FilterOption | undefined => {
  const rov = mapping.rov.find(opt => equalPredicate(opt.name, String(opt.value), search));
  return rov ? mapping.mapper(rov) : undefined;
};

export const findDropStateOption = (search: string): FilterOption | undefined => {
  return findFromROV(search, dropStateMapping);
};

export const findDropCauseOption = (search: string): FilterOption | undefined => {
  return findFromROV(search, dropCauseMapping);
};

export const findDnsResponseCodeOption = (search: string): FilterOption | undefined => {
  return findFromROV(search, dnsRCodeMapping);
};

export const findDnsErrorCodeOption = (search: string): FilterOption | undefined => {
  return findFromROV(search, dnsErrMapping);
};

export const findDSCPOption = (search: string): FilterOption | undefined => {
  return findFromROV(search, dscpMapping);
};
