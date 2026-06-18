import { Flex, FlexItem, Text, TextContent, TextVariants } from '@patternfly/react-core';
import * as React from 'react';
import { TopologyMetricPeer } from '../../../api/query-response';
import { Filter, FilterDefinition, Filters } from '../../../model/filters';
import { NodeType } from '../../../model/flow-query';
import { PeerResourceLink } from '../../tabs/netflow-topology/peer-resource-link';
import { SummaryFilterButton } from '../../toolbar/filters/summary-filter-button';

export interface ElementFieldProps {
  id: string;
  label: string;
  filterType: NodeType;
  forcedText?: string;
  peer: TopologyMetricPeer;
  filters: Filters;
  setFilters: (filters: Filter[]) => void;
  filterDefinitions: FilterDefinition[];
}

export const ElementField: React.FC<ElementFieldProps> = ({
  id,
  label,
  filterType,
  forcedText,
  peer,
  filters,
  setFilters,
  filterDefinitions
}) => {
  return (
    <TextContent id={id} className="record-field-container">
      <Text component={TextVariants.h4}>{label}</Text>
      <Flex>
        <FlexItem flex={{ default: 'flex_1' }}>
          {forcedText ? <Text component="p">{forcedText}</Text> : <PeerResourceLink peer={peer} />}
        </FlexItem>
        <FlexItem>
          <SummaryFilterButton
            id={id + '-filter'}
            filters={filters}
            filterType={filterType}
            fields={peer}
            setFilters={setFilters}
            filterDefinitions={filterDefinitions}
          />
        </FlexItem>
      </Flex>
    </TextContent>
  );
};
