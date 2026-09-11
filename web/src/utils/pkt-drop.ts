import { ReadOnlyValues } from './values';

const coreDropSubSystem = 0 << 16;
const ovsDropSubSystem = 3 << 16;
// https://github.com/torvalds/linux/blob/master/include/net/tcp_states.h
export const dropStates: ReadOnlyValues = [
  { value: 0, name: 'TCP_INVALID_STATE' },
  { value: 1, name: 'TCP_ESTABLISHED' },
  { value: 2, name: 'TCP_SYN_SENT' },
  { value: 3, name: 'TCP_SYN_RECV' },
  { value: 4, name: 'TCP_FIN_WAIT1' },
  { value: 5, name: 'TCP_FIN_WAIT2' },
  { value: 6, name: 'TCP_CLOSE' },
  { value: 7, name: 'TCP_CLOSE_WAIT' },
  { value: 8, name: 'TCP_LAST_ACK' },
  { value: 9, name: 'TCP_LISTEN' },
  { value: 10, name: 'TCP_CLOSING' },
  { value: 11, name: 'TCP_NEW_SYN_RECV' }
] as const;

export type DropStatesValues = (typeof dropStates)[number]['value'];

export type DropStatesNames = (typeof dropStates)[number]['name'];
// https://github.com/torvalds/linux/blob/master/include/net/dropreason-core.h
export const dropCauses: ReadOnlyValues = [
  { value: coreDropSubSystem + 2, name: 'SKB_DROP_REASON_NOT_SPECIFIED', description: 'drop reason is not specified' },
  { value: coreDropSubSystem + 3, name: 'SKB_DROP_REASON_NO_SOCKET', description: 'socket not found' },
  { value: coreDropSubSystem + 4, name: 'SKB_DROP_REASON_PKT_TOO_SMALL', description: 'packet size is too small' },
  { value: coreDropSubSystem + 5, name: 'SKB_DROP_REASON_TCP_CSUM', description: 'TCP checksum error' },
  { value: coreDropSubSystem + 6, name: 'SKB_DROP_REASON_SOCKET_FILTER', description: 'dropped by socket filter' },
  { value: coreDropSubSystem + 7, name: 'SKB_DROP_REASON_UDP_CSUM', description: 'UDP checksum error' },
  { value: coreDropSubSystem + 8, name: 'SKB_DROP_REASON_NETFILTER_DROP', description: 'dropped by netfilter' },
  {
    value: coreDropSubSystem + 9,
    name: 'SKB_DROP_REASON_OTHERHOST',
    description: "packet don't belong to current host. (interface is in promisc mode)"
  },
  { value: coreDropSubSystem + 10, name: 'SKB_DROP_REASON_IP_CSUM', description: 'IP checksum error' },
  {
    value: coreDropSubSystem + 11,
    name: 'SKB_DROP_REASON_IP_INHDR',
    description: 'there is something wrong with IP header (see IPSTATS_MIB_INHDRERRORS)'
  },
  {
    value: coreDropSubSystem + 12,
    name: 'SKB_DROP_REASON_IP_RPFILTER',
    description: 'IP rpfilter validate failed. see the document for rp_filter in ip-sysctl.rst for more information'
  },
  {
    value: coreDropSubSystem + 13,
    name: 'SKB_DROP_REASON_UNICAST_IN_L2_MULTICAST',
    description: 'destination address of L2 is multicast, but L3 is unicast.'
  },
  { value: coreDropSubSystem + 14, name: 'SKB_DROP_REASON_XFRM_POLICY', description: 'xfrm policy check failed' },
  { value: coreDropSubSystem + 15, name: 'SKB_DROP_REASON_IP_NOPROTO', description: 'no support for IP protocol' },
  { value: coreDropSubSystem + 16, name: 'SKB_DROP_REASON_SOCKET_RCVBUFF', description: 'socket receive buff is full' },
  {
    value: coreDropSubSystem + 17,
    name: 'SKB_DROP_REASON_PROTO_MEM',
    description: 'proto memory limition, such as udp packet drop out of udp_memory_allocated.'
  },
  {
    value: coreDropSubSystem + 18,
    name: 'SKB_DROP_REASON_TCP_MD5NOTFOUND',
    description: 'no MD5 hash and one expected, corresponding to LINUX_MIB_TCPMD5NOTFOUND'
  },
  {
    value: coreDropSubSystem + 19,
    name: 'SKB_DROP_REASON_TCP_MD5UNEXPECTED',
    description: "MD5 hash and we're not expecting one, corresponding to LINUX_MIB_TCPMD5UNEXPECTED"
  },
  {
    value: coreDropSubSystem + 20,
    name: 'SKB_DROP_REASON_TCP_MD5FAILURE',
    description: 'MD5 hash and its wrong, corresponding to LINUX_MIB_TCPMD5FAILURE'
  },
  {
    value: coreDropSubSystem + 21,
    name: 'SKB_DROP_REASON_SOCKET_BACKLOG',
    description: 'failed to add skb to socket backlog (see LINUX_MIB_TCPBACKLOGDROP)'
  },
  { value: coreDropSubSystem + 22, name: 'SKB_DROP_REASON_TCP_FLAGS', description: 'TCP flags invalid' },
  {
    value: coreDropSubSystem + 23,
    name: 'SKB_DROP_REASON_TCP_ZEROWINDOW',
    description: 'TCP receive window size is zero, see LINUX_MIB_TCPZEROWINDOWDROP'
  },
  {
    value: coreDropSubSystem + 24,
    name: 'SKB_DROP_REASON_TCP_OLD_DATA',
    description:
      'the TCP data reveived is already received before (spurious retrans may happened), see LINUX_MIB_DELAYEDACKLOST'
  },
  {
    value: coreDropSubSystem + 25,
    name: 'SKB_DROP_REASON_TCP_OVERWINDOW',
    description: 'the TCP data is out of window, the seq of the first byte exceed the right edges of receive window'
  },
  {
    value: coreDropSubSystem + 26,
    name: 'SKB_DROP_REASON_TCP_OFOMERGE',
    description: 'the data of skb is already in the ofo queue, corresponding to LINUX_MIB_TCPOFOMERGE'
  },
  {
    value: coreDropSubSystem + 27,
    name: 'SKB_DROP_REASON_TCP_RFC7323_PAWS',
    description: 'PAWS check, corresponding to LINUX_MIB_PAWSESTABREJECTED'
  },
  {
    value: coreDropSubSystem + 28,
    name: 'SKB_DROP_REASON_TCP_INVALID_SEQUENCE',
    description: 'Not acceptable SEQ field'
  },
  { value: coreDropSubSystem + 29, name: 'SKB_DROP_REASON_TCP_RESET', description: 'Invalid RST packet' },
  {
    value: coreDropSubSystem + 30,
    name: 'SKB_DROP_REASON_TCP_INVALID_SYN',
    description: 'Incoming packet has unexpected SYN flag'
  },
  { value: coreDropSubSystem + 31, name: 'SKB_DROP_REASON_TCP_CLOSE', description: 'TCP socket in CLOSE state' },
  {
    value: coreDropSubSystem + 32,
    name: 'SKB_DROP_REASON_TCP_FASTOPEN',
    description: 'dropped by FASTOPEN request socket'
  },
  { value: coreDropSubSystem + 33, name: 'SKB_DROP_REASON_TCP_OLD_ACK', description: 'TCP ACK is old, but in window' },
  { value: coreDropSubSystem + 34, name: 'SKB_DROP_REASON_TCP_TOO_OLD_ACK', description: 'TCP ACK is too old' },
  {
    value: coreDropSubSystem + 35,
    name: 'SKB_DROP_REASON_TCP_ACK_UNSENT_DATA',
    description: "TCP ACK for data we haven't sent yet"
  },
  {
    value: coreDropSubSystem + 36,
    name: 'SKB_DROP_REASON_TCP_OFO_QUEUE_PRUNE',
    description: 'pruned from TCP OFO queue'
  },
  { value: coreDropSubSystem + 37, name: 'SKB_DROP_REASON_TCP_OFO_DROP', description: 'data already in receive queue' },
  { value: coreDropSubSystem + 38, name: 'SKB_DROP_REASON_IP_OUTNOROUTES', description: 'route lookup failed' },
  {
    value: coreDropSubSystem + 39,
    name: 'SKB_DROP_REASON_BPF_CGROUP_EGRESS',
    description: 'dropped by BPF_PROG_TYPE_CGROUP_SKB eBPF program'
  },
  {
    value: coreDropSubSystem + 40,
    name: 'SKB_DROP_REASON_IPV6DISABLED',
    description: 'IPv6 is disabled on the device'
  },
  {
    value: coreDropSubSystem + 41,
    name: 'SKB_DROP_REASON_NEIGH_CREATEFAIL',
    description: 'failed to create neigh entry'
  },
  { value: coreDropSubSystem + 42, name: 'SKB_DROP_REASON_NEIGH_FAILED', description: 'neigh entry in failed state' },
  {
    value: coreDropSubSystem + 43,
    name: 'SKB_DROP_REASON_NEIGH_QUEUEFULL',
    description: 'arp_queue for neigh entry is full'
  },
  { value: coreDropSubSystem + 44, name: 'SKB_DROP_REASON_NEIGH_DEAD', description: 'neigh entry is dead' },
  { value: coreDropSubSystem + 45, name: 'SKB_DROP_REASON_TC_EGRESS', description: 'dropped in TC egress HOOK' },
  {
    value: coreDropSubSystem + 46,
    name: 'SKB_DROP_REASON_QDISC_DROP',
    description: 'dropped by qdisc when packet outputting (failed to enqueue to current qdisc)'
  },
  {
    value: coreDropSubSystem + 47,
    name: 'SKB_DROP_REASON_CPU_BACKLOG',
    description:
      'failed to enqueue the skb to the per CPU backlog queue. This can be caused by backlog queue full (see netdev_max_backlog in net.rst) or RPS flow limit'
  },
  { value: coreDropSubSystem + 48, name: 'SKB_DROP_REASON_XDP', description: 'dropped by XDP in input path' },
  { value: coreDropSubSystem + 49, name: 'SKB_DROP_REASON_TC_INGRESS', description: 'dropped in TC ingress HOOK' },
  {
    value: coreDropSubSystem + 50,
    name: 'SKB_DROP_REASON_UNHANDLED_PROTO',
    description: 'protocol not implemented or not supported'
  },
  {
    value: coreDropSubSystem + 51,
    name: 'SKB_DROP_REASON_SKB_CSUM',
    description: 'sk_buff checksum computation error'
  },
  { value: coreDropSubSystem + 52, name: 'SKB_DROP_REASON_SKB_GSO_SEG', description: 'gso segmentation error' },
  {
    value: coreDropSubSystem + 53,
    name: 'SKB_DROP_REASON_SKB_UCOPY_FAULT',
    description: 'ailed to copy data from user space, e.g., via zerocopy_sg_from_iter() or skb_orphan_frags_rx()'
  },
  {
    value: coreDropSubSystem + 54,
    name: 'SKB_DROP_REASON_DEV_HDR',
    description: 'device driver specific header/metadata is invalid'
  },
  {
    value: coreDropSubSystem + 55,
    name: 'SKB_DROP_REASON_DEV_READY',
    description:
      // eslint-disable-next-line max-len
      'the device is not ready to xmit/recv due to any of its data structure that is not up/ready/initialized, e.g., the IFF_UP is not set, or driver specific tun->tfiles[txq] is not initialized'
  },
  { value: coreDropSubSystem + 56, name: 'SKB_DROP_REASON_FULL_RING', description: 'ring buffer is full' },
  { value: coreDropSubSystem + 57, name: 'SKB_DROP_REASON_NOMEM', description: 'error due to OOM' },
  {
    value: coreDropSubSystem + 58,
    name: 'SKB_DROP_REASON_HDR_TRUNC',
    description:
      'failed to trunc/extract the header from networking data, e.g., failed to pull the protocol header from frags via pskb_may_pull()'
  },
  {
    value: coreDropSubSystem + 59,
    name: 'SKB_DROP_REASON_TAP_FILTER',
    description: 'dropped by (ebpf) filter directly attached to tun/tap, e.g., via TUNSETFILTEREBPF'
  },
  {
    value: coreDropSubSystem + 60,
    name: 'SKB_DROP_REASON_TAP_TXFILTER',
    description: 'dropped by tx filter implemented at tun/tap, e.g., check_filter()'
  },
  { value: coreDropSubSystem + 61, name: 'SKB_DROP_REASON_ICMP_CSUM', description: 'ICMP checksum error' },
  {
    value: coreDropSubSystem + 62,
    name: 'SKB_DROP_REASON_INVALID_PROTO',
    description: "the packet doesn't follow RFC 2211, such as a broadcasts ICMP_TIMESTAMP"
  },
  {
    value: coreDropSubSystem + 63,
    name: 'SKB_DROP_REASON_IP_INADDRERRORS',
    description: 'host unreachable, corresponding to IPSTATS_MIB_INADDRERRORS'
  },
  {
    value: coreDropSubSystem + 64,
    name: 'SKB_DROP_REASON_IP_INNOROUTES',
    description: 'network unreachable, corresponding to IPSTATS_MIB_INADDRERRORS'
  },
  {
    value: coreDropSubSystem + 65,
    name: 'SKB_DROP_REASON_PKT_TOO_BIG',
    description: 'packet size is too big (maybe exceed the MTU)'
  },
  { value: coreDropSubSystem + 66, name: 'SKB_DROP_REASON_DUP_FRAG', description: 'duplicate fragment' },
  {
    value: coreDropSubSystem + 67,
    name: 'SKB_DROP_REASON_FRAG_REASM_TIMEOUT',
    description: 'fragment reassembly timeout'
  },
  {
    value: coreDropSubSystem + 68,
    name: 'SKB_DROP_REASON_FRAG_TOO_FAR',
    description: 'ipv4 fragment too far. (/proc/sys/net/ipv4/ipfrag_max_dist)'
  },
  {
    value: coreDropSubSystem + 69,
    name: 'SKB_DROP_REASON_TCP_MINTTL',
    description: 'ipv4 ttl or ipv6 hoplimit below the threshold (IP_MINTTL or IPV6_MINHOPCOUNT)'
  },
  { value: coreDropSubSystem + 70, name: 'SKB_DROP_REASON_IPV6_BAD_EXTHDR', description: 'Bad IPv6 extension header' },
  {
    value: coreDropSubSystem + 71,
    name: 'SKB_DROP_REASON_IPV6_NDISC_FRAG',
    description: 'invalid frag (suppress_frag_ndisc)'
  },
  { value: coreDropSubSystem + 72, name: 'SKB_DROP_REASON_IPV6_NDISC_HOP_LIMIT', description: 'invalid hop limit' },
  {
    value: coreDropSubSystem + 73,
    name: 'SKB_DROP_REASON_IPV6_NDISC_BAD_CODE',
    description: 'invalid NDISC icmp6 code'
  },
  {
    value: coreDropSubSystem + 74,
    name: 'SKB_DROP_REASON_IPV6_NDISC_BAD_OPTIONS',
    description: 'invalid NDISC options'
  },
  {
    value: coreDropSubSystem + 75,
    name: 'SKB_DROP_REASON_IPV6_NDISC_NS_OTHERHOST',
    description: 'NEIGHBOUR SOLICITATION'
  },
  // https://git.kernel.org/pub/scm/linux/kernel/git/netdev/net-next.git/tree/net/openvswitch/drop.h
  {
    value: ovsDropSubSystem + 1,
    name: 'OVS_DROP_LAST_ACTION',
    description:
      'OVS dropped because a flow was configured with an implicit drop action, for example configuring network-policy'
  },
  {
    value: ovsDropSubSystem + 2,
    name: 'OVS_DROP_ACTION_ERROR',
    description: 'OVS dropped because an error occurred during action execution'
  },
  {
    value: ovsDropSubSystem + 3,
    name: 'OVS_DROP_EXPLICIT',
    description: 'OVS dropped the packet because a flow with an explicit action and no error code was programmed'
  },
  {
    value: ovsDropSubSystem + 4,
    name: 'OVS_DROP_EXPLICIT_WITH_ERROR',
    description:
      'OVS dropped the packet because a flow with an explicit action and with an error code, means an error occurred during ovs-vswitchd classification'
  },
  {
    value: ovsDropSubSystem + 5,
    name: 'OVS_DROP_METER',
    description: 'OVS dropped because OVS drop meter was created mostly QoS related drop'
  },
  {
    value: ovsDropSubSystem + 6,
    name: 'OVS_DROP_RECURSION_LIMIT',
    description: 'OVS dropped because recursion limit reached probable configuration error'
  },
  {
    value: ovsDropSubSystem + 7,
    name: 'OVS_DROP_DEFERRED_LIMIT',
    description: 'OVS dropped because of per CPU action FIFO is full'
  },
  {
    value: ovsDropSubSystem + 8,
    name: 'OVS_DROP_FRAG_L2_TOO_LONG',
    description: 'OVS dropped because L2 header too long to fragment'
  },
  {
    value: ovsDropSubSystem + 9,
    name: 'OVS_DROP_FRAG_INVALID_PROTO',
    description: 'OVS dropped because failed to fragment because of invalid protocol'
  },
  {
    value: ovsDropSubSystem + 10,
    name: 'OVS_DROP_CONNTRACK',
    description: 'OVS dropped because conntrack execution error'
  },
  {
    value: ovsDropSubSystem + 11,
    name: 'OVS_DROP_IP_TTL',
    description: 'OVS dropped because IP TTL expired'
  }
] as const;

export type DropCausesValues = (typeof dropCauses)[number]['value'];

export type DropCausesNames = (typeof dropCauses)[number]['name'];

export const coreDropCausesDocUrl = 'https://github.com/torvalds/linux/blob/master/include/net/dropreason-core.h';
export const ovsDropCausesDocUrl =
  'https://git.kernel.org/pub/scm/linux/kernel/git/netdev/net-next.git/tree/net/openvswitch/drop.h';

export const getDropCauseDescription = (name: DropCausesNames): string => {
  return dropCauses.find(v => v.name === name)?.description || 'Unknown';
};

export const getDropCauseDocUrl = (name: DropCausesNames): string => {
  if (name.startsWith('OVS_')) {
    return ovsDropCausesDocUrl;
  }

  return coreDropCausesDocUrl;
};
