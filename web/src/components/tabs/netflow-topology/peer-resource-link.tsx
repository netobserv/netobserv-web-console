import { ResourceLink } from '@openshift-console/dynamic-plugin-sdk';
import { Text } from '@patternfly/react-core';
import * as React from 'react';
import { TopologyMetricPeer } from '../../../api/query-response';

export interface PeerResourceLinkProps {
  peer: TopologyMetricPeer;
}

// Map of resource kinds that need explicit group-version-kind string
const customResourceGVK: { [kind: string]: string } = {
  Gateway: 'gateway.networking.k8s.io~v1~Gateway'
};

export const PeerResourceLink: React.FC<PeerResourceLinkProps> = ({ peer }) => {
  const name = peer.getDisplayName(false, false);
  if (name) {
    if (peer.resourceKind) {
      const gvkString = customResourceGVK[peer.resourceKind];
      // Use group~version~kind format for custom resources, or plain kind for standard resources
      const kind = gvkString || peer.resourceKind;
      return <ResourceLink inline={true} kind={kind} name={name} namespace={peer.namespace} />;
    } else {
      return <Text component="p">{name}</Text>;
    }
  }
  return null;
};
