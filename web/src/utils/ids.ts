/* This file contains id generation reused by QE team
 *  Please keep them updated of any change
 */

import { Record } from '../api/ipfix';
import { TopologyMetricPeer } from '../api/query-response';
import { getCustomScopeIds } from '../model/scope';

export const idUnknown = '-';

/**
 * getTopologyEdgeId gets a unique edge id between two nodes
 * source / target can be inverted. If one of these pairs already exists, the opposit will not be created
 * @param sourceId string that represent a NodeId
 * @param targetId string that represent another NodeId
 * @returns string that identify the edge
 */
export const getTopologyEdgeId = (sourceId: string, targetId: string) => {
  return `${sourceId}.${targetId}`.toLowerCase();
};

/**
 * getPeerId gets a unique peer id for provided set of fields
 * @param fields list of fields returned from metrics that identify the element
 * @returns string that identify the peer
 */
export const getPeerId = (fields: Partial<TopologyMetricPeer>): string => {
  const parts = [];
  // add scope defined outside of the special ones
  getCustomScopeIds().forEach(sc => {
    if (fields[sc]) {
      parts.push(`${sc}=${fields[sc]}`);
    }
  });
  if (fields.owner) {
    parts.push('o=' + fields.owner.type + '.' + fields.owner.name);
  }
  // add either resource info or address but not both
  // as some items can have multiple IPs
  if (fields.resource) {
    parts.push('r=' + fields.resource.type + '.' + fields.resource.name);
  } else if (fields.addr) {
    parts.push('a=' + fields.addr);
  } else if (fields.subnetLabel) {
    parts.push('sl=' + fields.subnetLabel);
  }
  return parts.length > 0 ? parts.join(',') : idUnknown;
};

export const get7Tuple = (r: Record): string => {
  return `${r.fields.SrcAddr}:${r.fields.SrcPort || 'x'}:${r.fields.SrcK8S_NetworkName || 'x'}→${r.fields.DstAddr}:${
    r.fields.DstPort || 'x'
  }:${r.fields.DstK8S_NetworkName || 'x'}@${r.fields.Proto}`;
};
