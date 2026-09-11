import { ReadOnlyValue, ReadOnlyValues } from './values';

// https://www.iana.org/assignments/protocol-numbers/protocol-numbers.xhtml
export const icmpProto = 1;
export const icmpV6Proto = 58;
export const icmpProtos = [icmpProto, icmpV6Proto];

//https://github.com/torvalds/linux/blob/master/include/uapi/linux/icmp.h
export const icmpTypes: ReadOnlyValues = [
  { value: 0, name: 'ICMP_ECHOREPLY', description: 'Echo Reply' },
  { value: 3, name: 'ICMP_DEST_UNREACH', description: 'Destination Unreachable' },
  { value: 4, name: 'ICMP_SOURCE_QUENCH', description: 'Source Quench' },
  { value: 5, name: 'ICMP_REDIRECT', description: 'Redirect (change route)' },
  { value: 8, name: 'ICMP_ECHO', description: 'Echo Request' },
  { value: 11, name: 'ICMP_TIME_EXCEEDED', description: 'Time Exceeded' },
  { value: 12, name: 'ICMP_PARAMETERPROB', description: 'Parameter Problem' },
  { value: 13, name: 'ICMP_TIMESTAMP', description: 'Timestamp Request' },
  { value: 14, name: 'ICMP_TIMESTAMPREPLY', description: 'Timestamp Reply' },
  { value: 15, name: 'ICMP_INFO_REQUEST', description: 'Information Request' },
  { value: 16, name: 'ICMP_INFO_REPLY', description: 'Information Reply' },
  { value: 17, name: 'ICMP_ADDRESS', description: 'Address Mask Request' },
  { value: 18, name: 'ICMP_ADDRESSREPLY', description: 'Address Mask Reply' }
  //{ value: 18, name: 'NR_ICMP_TYPES' },
] as const;

export type ICMPTypesValues = (typeof icmpTypes)[number]['value'];

export type ICMPTypeNames = (typeof icmpTypes)[number]['name'];

export const icmpUnreachCodes: ReadOnlyValues = [
  { value: 0, name: 'ICMP_NET_UNREACH', description: 'Network Unreachable' },
  { value: 1, name: 'ICMP_HOST_UNREACH', description: 'Host Unreachable' },
  { value: 2, name: 'ICMP_PROT_UNREACH', description: 'Protocol Unreachable' },
  { value: 3, name: 'ICMP_PORT_UNREACH', description: 'Port Unreachable' },
  { value: 4, name: 'ICMP_FRAG_NEEDED', description: 'Fragmentation Needed/DF set' },
  { value: 5, name: 'ICMP_SR_FAILED', description: 'Source Route failed' },
  { value: 6, name: 'ICMP_NET_UNKNOWN' },
  { value: 7, name: 'ICMP_HOST_UNKNOWN' },
  { value: 8, name: 'ICMP_HOST_ISOLATED' },
  { value: 9, name: 'ICMP_NET_ANO' },
  { value: 10, name: 'ICMP_HOST_ANO' },
  { value: 11, name: 'ICMP_NET_UNR_TOS' },
  { value: 12, name: 'ICMP_HOST_UNR_TOS' },
  { value: 13, name: 'ICMP_PKT_FILTERED', description: 'Packet filtered' },
  { value: 14, name: 'ICMP_PREC_VIOLATION', description: 'Precedence violation' },
  { value: 15, name: 'ICMP_PREC_CUTOFF', description: 'Precedence cut off' }
  //{ value: 15, name: 'NR_ICMP_UNREACH', description: 'instead of hardcoding immediate value' },
] as const;

export type ICMPUnreachCodesValues = (typeof icmpUnreachCodes)[number]['value'];

export type ICMPUnreachCodesNames = (typeof icmpUnreachCodes)[number]['name'];

export const icmpRedirectCodes: ReadOnlyValues = [
  { value: 0, name: 'ICMP_REDIR_NET', description: 'Redirect Net' },
  { value: 1, name: 'ICMP_REDIR_HOST', description: 'Redirect Host' },
  { value: 2, name: 'ICMP_REDIR_NETTOS', description: 'Redirect Net for TOS' },
  { value: 3, name: 'ICMP_REDIR_HOSTTOS', description: 'Redirect Host for TOS' }
] as const;

export type ICMPRedirectCodesValues = (typeof icmpRedirectCodes)[number]['value'];

export type ICMPRedirectCodesNames = (typeof icmpRedirectCodes)[number]['name'];

export const icmpTimeExceededCodes: ReadOnlyValues = [
  { value: 0, name: 'ICMP_EXC_TTL', description: 'TTL count exceeded' },
  { value: 1, name: 'ICMP_EXC_FRAGTIME', description: 'Fragment Reass time exceeded' }
] as const;

export type ICMPTimeExceededCodesValues = (typeof icmpTimeExceededCodes)[number]['value'];

export type ICMPTimeExceededCodesNames = (typeof icmpTimeExceededCodes)[number]['name'];

// https://github.com/torvalds/linux/blob/master/include/uapi/linux/icmpv6.h
export const icmpV6Types: ReadOnlyValues = [
  { value: 1, name: 'ICMPV6_DEST_UNREACH', description: 'Destination Unreachable' },
  { value: 2, name: 'ICMPV6_PKT_TOOBIG', description: 'Packet Too Big' },
  { value: 3, name: 'ICMPV6_TIME_EXCEED', description: 'Time Exceeded' },
  { value: 4, name: 'ICMPV6_PARAMPROB', description: 'Parameter Problem' },
  { value: 128, name: 'ICMPV6_ECHO_REQUEST', description: 'Echo Request' },
  { value: 129, name: 'ICMPV6_ECHO_REPLY', description: 'Echo Reply' },
  { value: 130, name: 'ICMPV6_MGM_QUERY', description: 'Multicast Listener Query' },
  { value: 131, name: 'ICMPV6_MGM_REPORT', description: 'Multicast Listener Report' },
  { value: 132, name: 'ICMPV6_MGM_REDUCTION', description: 'Multicast Listener Done' },
  { value: 139, name: 'ICMPV6_NI_QUERY', description: 'ICMP Node Information Query' },
  { value: 140, name: 'ICMPV6_NI_REPLY', description: 'ICMP Node Information Response' },
  { value: 143, name: 'ICMPV6_MLD2_REPORT', description: 'Version 2 Multicast Listener Report' },
  { value: 144, name: 'ICMPV6_DHAAD_REQUEST', description: 'Home Agent Address Discovery Request Message' },
  { value: 145, name: 'ICMPV6_DHAAD_REPLY', description: 'Home Agent Address Discovery Reply Message' },
  { value: 146, name: 'ICMPV6_MOBILE_PREFIX_SOL', description: 'Mobile Prefix Solicitation' },
  { value: 147, name: 'ICMPV6_MOBILE_PREFIX_ADV', description: 'Mobile Prefix Advertisement' },
  { value: 151, name: 'ICMPV6_MRDISC_ADV', description: 'Multicast Router Advertisement' },
  { value: 160, name: 'ICMPV6_EXT_ECHO_REQUEST', description: 'Extended Echo Request' },
  { value: 161, name: 'ICMPV6_EXT_ECHO_REPLY', description: 'Extended Echo Reply' },
  { value: 255, name: 'ICMPV6_MSG_MAX', description: 'Reserved for expansion of ICMPv6 informational messages' }
] as const;

export type ICMPV6TypesValues = (typeof icmpV6Types)[number]['value'];

export type ICMPV6TypeNames = (typeof icmpV6Types)[number]['name'];

export const icmpV6UnreachCodes: ReadOnlyValues = [
  { value: 0, name: 'ICMPV6_NOROUTE', description: 'no route to destination' },
  {
    value: 1,
    name: 'ICMPV6_ADM_PROHIBITED',
    description: 'communication with destination administratively prohibited'
  },
  { value: 2, name: 'ICMPV6_NOT_NEIGHBOUR', description: 'beyond scope of source address' },
  { value: 3, name: 'ICMPV6_ADDR_UNREACH', description: 'address unreachable' },
  { value: 4, name: 'ICMPV6_PORT_UNREACH', description: 'port unreachable' },
  { value: 5, name: 'ICMPV6_POLICY_FAIL', description: 'source address failed ingress/egress policy' },
  { value: 6, name: 'ICMPV6_REJECT_ROUTE', description: 'reject route to destination' }
] as const;

export type ICMPV6UnreachCodesValues = (typeof icmpV6UnreachCodes)[number]['value'];

export type ICMPV6UnreachCodesNames = (typeof icmpV6UnreachCodes)[number]['name'];

export const icmpV6TimeExceededCodes: ReadOnlyValues = [
  { value: 0, name: 'ICMPV6_EXC_HOPLIMIT', description: 'hop limit exceeded in transit  ' },
  { value: 1, name: 'ICMPV6_EXC_FRAGTIME', description: 'fragment reassembly time exceeded  ' }
] as const;

export type ICMPV6TimeExceededCodesValues = (typeof icmpV6TimeExceededCodes)[number]['value'];

export type ICMPV6TimeExceededCodesNames = (typeof icmpV6TimeExceededCodes)[number]['name'];

export const icmpV6ParamprobCodes: ReadOnlyValues = [
  { value: 0, name: 'ICMPV6_HDR_FIELD', description: 'erroneous header field encountered' },
  { value: 1, name: 'ICMPV6_UNK_NEXTHDR', description: 'unrecognized Next Header type encountered' },
  { value: 2, name: 'ICMPV6_UNK_OPTION', description: 'unrecognized IPv6 option encountered' },
  { value: 3, name: 'ICMPV6_HDR_INCOMP', description: 'IPv6 First Fragment has incomplete IPv6 Header Chain' }
] as const;

export type ICMPV6ParamprobCodesValues = (typeof icmpV6ParamprobCodes)[number]['value'];

export type ICMPV6ParamprobCodesNames = (typeof icmpV6ParamprobCodes)[number]['name'];

export type ICMPAllTypesValues = ICMPTypesValues | ICMPV6TypesValues;

export type ICMPAllCodesValues =
  | ICMPUnreachCodesValues
  | ICMPRedirectCodesValues
  | ICMPTimeExceededCodesValues
  | ICMPV6UnreachCodesValues
  | ICMPV6TimeExceededCodesValues
  | ICMPV6ParamprobCodesValues;

export const getICMPDocUrl = (p: number): string | undefined => {
  switch (p) {
    case icmpProto:
      return 'https://github.com/torvalds/linux/blob/master/include/uapi/linux/icmp.h';
    case icmpV6Proto:
      return 'https://github.com/torvalds/linux/blob/master/include/uapi/linux/icmpv6.h';
    default:
      return undefined;
  }
};

export const isValidICMPProto = (p: number) => {
  return icmpProtos.includes(p);
};

export const getICMPType = (p: number, v: ICMPAllTypesValues): ReadOnlyValue | undefined => {
  if (!isValidICMPProto(p)) {
    return undefined;
  }
  if (p === icmpProto) {
    return icmpTypes.find(t => t.value === v);
  }
  return icmpV6Types.find(t => t.value === v);
};

export const getICMPCode = (p: number, t?: ICMPAllTypesValues, c?: ICMPAllCodesValues): ReadOnlyValue | undefined => {
  if (!isValidICMPProto(p) || t === undefined || c === undefined) {
    return undefined;
  }

  if (p == icmpProto) {
    switch (t) {
      case 3: // ICMP_DEST_UNREACH:
        return icmpUnreachCodes.find(v => v.value === c);
      case 5: // ICMP_REDIRECT:
        return icmpRedirectCodes.find(v => v.value === c);
      case 11: // ICMP_TIME_EXCEEDED:
        return icmpTimeExceededCodes.find(v => v.value === c);
      default:
        return undefined;
    }
  }
  switch (t) {
    case 1: // ICMPV6_DEST_UNREACH
      return icmpV6UnreachCodes.find(v => v.value === c);
    case 3: // ICMPV6_TIME_EXCEED
      return icmpV6TimeExceededCodes.find(v => v.value === c);
    case 4: // ICMPV6_PARAMPROB
      return icmpV6ParamprobCodes.find(v => v.value === c);
    default:
      return undefined;
  }
};
