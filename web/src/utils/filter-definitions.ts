import { TFunction } from 'i18next';
import * as _ from 'lodash';
import { Field } from '../api/ipfix';
import { Config } from '../model/config';
import {
  FilterCategory,
  FilterCompare,
  FilterComponent,
  FilterConfigDef,
  FilterDefinition,
  FilterId,
  FilterOption,
  FiltersEncoder,
  FilterValue
} from '../model/filters';
import { DataSource } from '../model/flow-query';
import { joinResource, SplitResource, splitResource, SplitStage } from '../model/resource';
import { getPort } from '../utils/port';
import { ColumnConfigDef } from './columns';
import {
  autocompleteCluster,
  autocompleteDirection,
  autocompleteDnsErrorCode,
  autocompleteDnsResponseCode,
  autocompleteDropCause,
  autocompleteDropState,
  autocompleteDSCP,
  autocompleteEmpty,
  autocompleteKind,
  autocompleteNamespace,
  autocompletePort,
  autocompleteProtocol,
  autocompleteResource,
  autocompleteTCPFlags,
  autocompleteUDN,
  autocompleteZone,
  findDirectionOption,
  findDnsErrorCodeOption,
  findDnsResponseCodeOption,
  findDropCauseOption,
  findDropStateOption,
  findDSCPOption,
  findProtocolOption,
  portValueToOption
} from './filter-options';
import { validateIPFilter } from './ip';
import { validateK8SName, validateStrictK8SName } from './label';

// Convenience string to filter by undefined field values
export const undefinedValue = '""';
// Unique double are allowed while typing but invalid
export const doubleQuoteValue = '"';

export const matcher = (left: string, right: string[], compare: FilterCompare) => `${left}${compare}${right.join(',')}`;

const simpleFiltersEncoder = (field: Field): FiltersEncoder => {
  return (values: FilterValue[], compare: FilterCompare, _matchAny: boolean) => {
    return matcher(
      field,
      values.map(v => v.v),
      compare
    );
  };
};

/**
 * Endpoint filters (namespace, address, …) encode as src|dst OR. Columns without a single `field`
 * use `calculated: [SrcFoo,DstFoo]` in config; when that or `filter` is missing (e.g. sample tests),
 * `endpointDualFieldFallback` supplies the ipfix pair.
 */
const parseEndpointCalculatedPair = (calculated: string): [Field, Field] | undefined => {
  const m = calculated.match(/^\s*\[\s*([A-Za-z0-9_]+)\s*,\s*([A-Za-z0-9_]+)\s*\]\s*$/);
  if (!m) {
    return undefined;
  }
  return [m[1] as Field, m[2] as Field];
};

/** When column config has no `filter` key (tests) or no `field`, map endpoint filter id → [src,dst] ipfix fields. */
const endpointDualFieldFallback: Partial<Record<FilterId, [Field, Field]>> = {
  namespace: ['SrcK8S_Namespace', 'DstK8S_Namespace'],
  name: ['SrcK8S_Name', 'DstK8S_Name'],
  owner_name: ['SrcK8S_OwnerName', 'DstK8S_OwnerName'],
  address: ['SrcAddr', 'DstAddr'],
  port: ['SrcPort', 'DstPort'],
  mac: ['SrcMac', 'DstMac'],
  host_address: ['SrcK8S_HostIP', 'DstK8S_HostIP'],
  host_name: ['SrcK8S_HostName', 'DstK8S_HostName'],
  zone: ['SrcK8S_Zone', 'DstK8S_Zone'],
  subnet_label: ['SrcSubnetLabel', 'DstSubnetLabel'],
  asn: ['SrcASN', 'DstASN']
};

const encodedFilterLabelKeys = (encoded: string): string[] =>
  encoded
    .split('|')
    .flatMap(orSegment => orSegment.split('&'))
    .map(part => part.split(/=|~/)[0])
    .filter(Boolean);

/** Endpoint filter: match if either source or destination field satisfies the clause (OR). */
const endpointEitherSideEncoder =
  (srcField: Field, dstField: Field): FiltersEncoder =>
  (values: FilterValue[], compare: FilterCompare, _matchAny: boolean) => {
    const left = simpleFiltersEncoder(srcField)(values, compare, _matchAny);
    const right = simpleFiltersEncoder(dstField)(values, compare, _matchAny);
    const isNegated = compare === FilterCompare.notEqual || compare === FilterCompare.notMatch;
    return isNegated ? `${left}&${right}` : `${left}|${right}`;
  };

// As owner / non-owner kind filters are mixed, they are disambiguated via this function
const kindFiltersEncoder = (base: Field, owner: Field): FiltersEncoder => {
  return (values: FilterValue[], compare: FilterCompare, matchAny: boolean) => {
    const { baseValues, ownerValues } = _.groupBy(values, value => {
      return isOwnerKind(value.v) ? 'ownerValues' : 'baseValues';
    });
    const filters: string[] = [];
    if (baseValues && baseValues.length > 0) {
      filters.push(
        matcher(
          base,
          baseValues.map(value => value.v),
          compare
        )
      );
    }
    if (ownerValues && ownerValues.length > 0) {
      filters.push(
        matcher(
          owner,
          ownerValues.map(value => value.v),
          compare
        )
      );
    }
    return filters.join(matchAny ? '|' : '&');
  };
};

const k8sResourceFiltersEncoder = (
  kind: Field,
  ownerKind: Field,
  namespace: Field,
  name: Field,
  ownerName: Field
): FiltersEncoder => {
  return (values: FilterValue[], compare: FilterCompare, matchAny: boolean) => {
    const splitValues = values.map(value => splitResource(value.v));
    return splitValues
      .map(res => {
        if (isOwnerKind(res.kind)) {
          return k8sSingleResourceEncode(ownerKind, namespace, ownerName, res, compare.includes('!'));
        } else {
          return k8sSingleResourceEncode(kind, namespace, name, res, compare.includes('!'));
        }
      })
      .join(matchAny ? '|' : '&');
  };
};

const k8sSingleResourceEncode = (kind: Field, namespace: Field, name: Field, res: SplitResource, not: boolean) => {
  if (not) {
    return `${kind}!="${res.kind}"|${namespace}!="${res.namespace}"|${name}!="${res.name}"`;
  }
  return `${kind}="${res.kind}"&${namespace}="${res.namespace}"&${name}="${res.name}"`;
};

const isOwnerKind = (kind: string) => {
  const lower = kind.toLowerCase();
  return (
    lower !== 'pod' &&
    lower !== 'service' &&
    lower !== 'node' &&
    lower !== '"pod"' &&
    lower !== '"service"' &&
    lower !== '"node"'
  );
};

const valid = (newValue: string) => ({ val: newValue });
const invalid = (msg: string) => ({ err: msg });

export const getFilterDefinitions = (
  filterDefs: FilterConfigDef[],
  columnsDefs: ColumnConfigDef[],
  t: TFunction
): FilterDefinition[] => {
  const rejectEmptyValue = (value: string) => {
    if (_.isEmpty(value)) {
      return invalid(t('Value is empty'));
    }
    if (value === doubleQuoteValue) {
      return invalid(t('Value is malformed'));
    }
    return valid(value);
  };

  const k8sNameValidation = (value: string) => {
    if (_.isEmpty(value)) {
      return invalid(t('Value is empty'));
    }
    return value === undefinedValue || validateK8SName(value)
      ? valid(value)
      : invalid(t('Not a valid Kubernetes name'));
  };

  const k8sResourceValidation = (value: string) => {
    const resource = splitResource(value);
    if (resource.stage !== SplitStage.Completed) {
      return invalid(t('Incomplete resource name, either kind, namespace or name is missing.'));
    }
    if (resource.kind === '') {
      return invalid(t('Kind is empty'));
    }
    if (resource.namespace && !validateStrictK8SName(resource.namespace)) {
      return invalid(t('Namespace: not a valid Kubernetes name'));
    }
    if (!validateStrictK8SName(resource.name)) {
      return invalid(t('Name: not a valid Kubernetes name'));
    }
    // Make sure kind first letter is capital, rest is lower case
    resource.kind = resource.kind.charAt(0).toUpperCase() + resource.kind.slice(1).toLowerCase();
    return valid(joinResource(resource));
  };

  const k8sResourceCompletion = (value: string, selected: string) => {
    const parts = splitResource(value);
    switch (parts.stage) {
      case SplitStage.PartialKind: {
        const joined = `${selected}.`;
        return { completed: false, option: { name: joined, value: joined } };
      }
      case SplitStage.PartialNamespace: {
        const joined = `${parts.kind}.${selected}.`;
        return { completed: false, option: { name: joined, value: joined } };
      }
      case SplitStage.Completed: {
        const joined = joinResource({ ...parts, name: selected });
        return { completed: true, option: { name: joined, value: joined } };
      }
    }
  };

  const addressValidation = (value: string) => {
    if (_.isEmpty(value)) {
      return invalid(t('Value is empty'));
    }
    return validateIPFilter(value)
      ? valid(value)
      : invalid(t('Not a valid IPv4 or IPv6, nor a CIDR, nor an IP range separated by hyphen'));
  };

  const portValidation = (value: string) => {
    if (_.isEmpty(value)) {
      return invalid(t('Value is empty'));
    }
    //allow any port number or valid name / value
    if (value == undefinedValue || !isNaN(Number(value)) || getPort(value)) {
      return valid(value);
    }
    return invalid(t('Unknown port'));
  };

  const macValidation = (value: string) => {
    if (_.isEmpty(value)) {
      return invalid(t('Value is empty'));
    }
    return value == undefinedValue || /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/.test(value)
      ? valid(value)
      : invalid(t('Not a valid MAC address'));
  };

  const protoValidation = (value: string) => {
    if (_.isEmpty(value)) {
      return invalid(t('Value is empty'));
    }
    //allow any protocol number or valid name / value
    if (value == undefinedValue || !isNaN(Number(value))) {
      return valid(value);
    } else {
      const proto = findProtocolOption(value);
      if (proto) {
        return valid(proto.name);
      }
      return invalid(t('Unknown protocol'));
    }
  };

  const dirValidation = (value: string) => {
    if (_.isEmpty(value)) {
      return invalid(t('Value is empty'));
    }
    //allow 0 / 1 or Ingress / Egress
    const found = findDirectionOption(t, true, value);
    if (found) {
      return valid(found.name);
    }
    return invalid(t('Unknown direction'));
  };

  const getFuncs = (d: FilterConfigDef) => {
    const isSrc = d.id.includes('src');
    const colConfig = columnsDefs.find(c => c.filter === d.id);

    let autocomplete: (value: string) => Promise<FilterOption[]> = autocompleteEmpty;
    let findOption: (value: string) => FilterOption | undefined = () => undefined;
    let validate: (value: string) => { val?: string; err?: string } = rejectEmptyValue;
    let encoder: FiltersEncoder = simpleFiltersEncoder(colConfig?.field as Field);
    let checkCompletion:
      | ((value: string, selected: string) => { completed: boolean; option: FilterOption })
      | undefined = undefined;

    if (d.id.includes('namespace')) {
      autocomplete = autocompleteNamespace;
      validate = k8sNameValidation;
    } else if (d.id.includes('cluster')) {
      autocomplete = autocompleteCluster;
    } else if (d.id.includes('udn')) {
      autocomplete = autocompleteUDN;
    } else if (d.id.includes('zone')) {
      autocomplete = autocompleteZone;
    } else if (d.id.includes('name')) {
      validate = k8sNameValidation;
    } else if (d.id.includes('kind')) {
      autocomplete = autocompleteKind;
      encoder = kindFiltersEncoder(`${isSrc ? 'Src' : 'Dst'}K8S_Type`, `${isSrc ? 'Src' : 'Dst'}K8S_OwnerType`);
    } else if (d.id.includes('resource')) {
      autocomplete = autocompleteResource;
      validate = k8sResourceValidation;
      checkCompletion = k8sResourceCompletion;
      encoder = k8sResourceFiltersEncoder(
        `${isSrc ? 'Src' : 'Dst'}K8S_Type`,
        `${isSrc ? 'Src' : 'Dst'}K8S_OwnerType`,
        `${isSrc ? 'Src' : 'Dst'}K8S_Namespace`,
        `${isSrc ? 'Src' : 'Dst'}K8S_Name`,
        `${isSrc ? 'Src' : 'Dst'}K8S_OwnerName`
      );
    } else if (d.id.includes('address')) {
      validate = addressValidation;
    } else if (d.id.includes('port')) {
      autocomplete = autocompletePort;
      findOption = portValueToOption;
      validate = portValidation;
    } else if (d.id.includes('mac')) {
      validate = macValidation;
    } else if (d.id.includes('proto')) {
      autocomplete = autocompleteProtocol;
      findOption = findProtocolOption;
      validate = protoValidation;
    } else if (d.id.includes('direction')) {
      autocomplete = v => autocompleteDirection(t, d.id === 'nodedirection', v);
      findOption = v => findDirectionOption(t, d.id === 'nodedirection', v);
      validate = dirValidation;
    } else if (d.id.includes('drop_state')) {
      autocomplete = autocompleteDropState;
      findOption = findDropStateOption;
      encoder = simpleFiltersEncoder('PktDropLatestState');
    } else if (d.id.includes('drop_cause')) {
      autocomplete = autocompleteDropCause;
      findOption = findDropCauseOption;
      encoder = simpleFiltersEncoder('PktDropLatestDropCause');
    } else if (d.id.includes('dns_flag_response_code')) {
      autocomplete = autocompleteDnsResponseCode;
      findOption = findDnsResponseCodeOption;
    } else if (d.id.includes('dns_errno')) {
      autocomplete = autocompleteDnsErrorCode;
      findOption = findDnsErrorCodeOption;
    } else if (d.id.includes('dscp')) {
      autocomplete = autocompleteDSCP;
      findOption = findDSCPOption;
    } else if (d.id.includes('flags')) {
      autocomplete = autocompleteTCPFlags;
    }

    if (d.category === 'endpoint' && !d.id.includes('kind') && !d.id.includes('resource')) {
      const parsed =
        colConfig && !colConfig.field && colConfig.calculated
          ? parseEndpointCalculatedPair(colConfig.calculated)
          : undefined;
      const fallback = endpointDualFieldFallback[d.id as FilterId];
      const pair = parsed || fallback;
      if (pair) {
        encoder = endpointEitherSideEncoder(pair[0], pair[1]);
      }
    }

    return { autocomplete, findOption, validate, encoder, checkCompletion };
  };

  return filterDefs.map(d => {
    return {
      id: d.id as FilterId,
      name: d.name,
      component: d.component as FilterComponent,
      category: !_.isEmpty(d.category) ? (d.category as FilterCategory) : undefined,
      autoCompleteAddsQuotes: d.autoCompleteAddsQuotes === true,
      hint: !_.isEmpty(d.hint) ? d.hint : undefined,
      examples: !_.isEmpty(d.examples) ? d.examples : undefined,
      docUrl: !_.isEmpty(d.docUrl) ? d.docUrl : undefined,
      placeholder: !_.isEmpty(d.placeholder) ? d.placeholder : undefined,
      ...getFuncs(d)
    };
  });
};

export const findFilter = (filterDefinitions: FilterDefinition[], id: FilterId) => {
  return filterDefinitions.find(def => def.id === id);
};

export const checkFilterAvailable = (
  fd: FilterDefinition,
  config: Config,
  dataSource: DataSource,
  filterDefinitions?: FilterDefinition[]
) => {
  const allowLoki = config.dataSources.some(ds => ds === 'loki');
  const isPromOnly = !allowLoki || dataSource === 'prom';

  // For endpoint category filters, check if both src_ and dst_ variants are available
  // If both work, the base endpoint filter should be available for "Either" functionality
  if (fd.category === 'endpoint' && isPromOnly && filterDefinitions) {
    const srcFilterId = `src_${fd.id}` as FilterId;
    const dstFilterId = `dst_${fd.id}` as FilterId;
    const srcFilter = filterDefinitions.find(def => def.id === srcFilterId);
    const dstFilter = filterDefinitions.find(def => def.id === dstFilterId);

    // Check both src_ and dst_ variants
    const checkVariant = (filter: FilterDefinition | undefined) => {
      if (!filter) return false;
      const q = filter.encoder([{ v: 'any' }], FilterCompare.match, false);
      const keys = encodedFilterLabelKeys(q);
      return keys.every(k => config.promLabels.includes(k));
    };

    const srcAvailable = checkVariant(srcFilter);
    const dstAvailable = checkVariant(dstFilter);

    // Endpoint filter is available if both src_ and dst_ variants are available
    return srcAvailable && dstAvailable;
  }

  if (isPromOnly) {
    // "encode" a dummy query to check related labels, and make sure they're all part of available prom labels
    const q = fd.encoder([{ v: 'any' }], FilterCompare.match, false);
    const keys = encodedFilterLabelKeys(q);
    for (let i = 0; i < keys.length; i++) {
      if (!config.promLabels.includes(keys[i])) {
        return false;
      }
    }
    return true;
  }

  // Check against enabled features
  const filterConfig = config.filters.find(f => f.id === fd.id);
  if (filterConfig?.feature) {
    return config.features.includes(filterConfig.feature);
  }

  const colConfig = config.columns.find(c => c.filter === fd.id);
  if (colConfig?.feature) {
    return config.features.includes(colConfig?.feature);
  }

  // Allow by default
  return true;
};
