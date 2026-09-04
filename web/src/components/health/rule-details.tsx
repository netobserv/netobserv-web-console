import { Content, ContentVariants, Flex, FlexItem, Label, Tooltip } from '@patternfly/react-core';
import { InfoCircleIcon } from '@patternfly/react-icons';
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { TFunction } from 'i18next';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { formatActiveSince } from '../../utils/datetime';
import { valueFormat } from '../../utils/format';
import { HealthColorSquare } from './health-color-square';
import {
  getAllHealthItems,
  getItemFilteredLabels,
  getLinks,
  getSeverityColor,
  HealthItem,
  HealthStat,
  HealthSuperKind
} from './health-helper';
import './rule-details.css';

export interface RuleDetailsProps {
  kind: HealthSuperKind;
  resourceHealth: HealthStat;
}

// Helper: Get direction from recording rule name
const getDirection = (ruleName?: string): 'src' | 'dst' | undefined => {
  if (!ruleName) return undefined;
  return ruleName.includes(':src:') ? 'src' : ruleName.includes(':dst:') ? 'dst' : undefined;
};

// Helper: Vertical label/value column
const VerticalField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <FlexItem>
    <Flex direction={{ default: 'column' }} gap={{ default: 'gapXs' }}>
      <FlexItem>
        <Content
          component={ContentVariants.small}
          style={{
            color: 'var(--pf-t--global--text--color--subtle)'
          }}
        >
          {label}
        </Content>
      </FlexItem>
      <FlexItem>{children}</FlexItem>
    </Flex>
  </FlexItem>
);

// Helper: Render table row (used for Global table view)
const RuleTableRow: React.FC<{
  item: HealthItem;
  resourceName: string;
  kind: HealthSuperKind;
  t: TFunction;
}> = ({ item, resourceName, kind, t }) => {
  const isAlert = item.state !== 'recording';
  const labels = React.useMemo(() => getItemFilteredLabels(item, resourceName), [item, resourceName]);
  const links = React.useMemo(() => getLinks(t, kind, item, resourceName), [item, kind, resourceName, t]);
  const direction = React.useMemo(() => getDirection(item.ruleName), [item]);

  return (
    <Tr>
      <Td dataLabel={t('Summary')}>
        <Flex gap={{ default: 'gapXs' }} alignItems={{ default: 'alignItemsCenter' }} flexWrap={{ default: 'nowrap' }}>
          <FlexItem>
            <HealthColorSquare item={item} />
          </FlexItem>
          <FlexItem>
            {item.description ? (
              <Tooltip content={item.description}>
                <span>{item.summary}</span>
              </Tooltip>
            ) : (
              <span>{item.summary}</span>
            )}
          </FlexItem>
        </Flex>
      </Td>
      <Td dataLabel={t('Mode')}>{isAlert ? t('alert') : t('recording')}</Td>
      <Td dataLabel={t('State')}>{isAlert ? item.state : ''}</Td>
      <Td dataLabel={t('Severity')}>
        <Label isCompact color={getSeverityColor(item.severity)}>
          {item.severity}
        </Label>
      </Td>
      <Td dataLabel={t('Active since')}>{item.activeAt ? formatActiveSince(t, item.activeAt) : ''}</Td>
      <Td dataLabel={t('Labels')}>
        {labels.length === 0
          ? ''
          : labels.map(kv => (
              <Label key={kv[0]}>
                {kv[0]}={kv[1]}
              </Label>
            ))}
      </Td>
      <Td dataLabel={t('Value')} className="no-wrap">
        {valueFormat(item.value, 2)} {item.metadata.unit}
      </Td>
      <Td dataLabel={t('Threshold')}>{item.threshold ? `${item.threshold} ${item.metadata.unit}` : ''}</Td>
      <Td dataLabel={t('Direction')}>{direction || ''}</Td>
      <Td dataLabel={t('Description')}>{item.description}</Td>
      <Td noPadding>
        <span data-test="rule-details-actions">
          <ActionsColumn
            isDisabled={links.length === 0}
            items={links.map(l => ({ title: <a href={l.url}>{l.name}</a> }))}
          />
        </span>
      </Td>
    </Tr>
  );
};

// Helper: Render card (used for Node/Namespace drawer view)
const RuleCard: React.FC<{
  item: HealthItem;
  resourceName: string;
  kind: HealthSuperKind;
  t: TFunction;
}> = ({ item, resourceName, kind, t }) => {
  const isAlert = item.state !== 'recording';
  const labels = React.useMemo(() => getItemFilteredLabels(item, resourceName), [item, resourceName]);
  const links = React.useMemo(() => getLinks(t, kind, item, resourceName), [item, kind, resourceName, t]);
  const direction = React.useMemo(() => getDirection(item.ruleName), [item]);

  return (
    <div className="rule-details-row" data-test="rule-details-row">
      <Flex direction={{ default: 'column' }} gap={{ default: 'gapSm' }}>
        {/* Header with summary and actions */}
        <Flex
          justifyContent={{ default: 'justifyContentSpaceBetween' }}
          alignItems={{ default: 'alignItemsFlexStart' }}
        >
          <Flex gap={{ default: 'gapXs' }} alignItems={{ default: 'alignItemsFlexStart' }} flex={{ default: 'flex_1' }}>
            <FlexItem>
              <HealthColorSquare item={item} />
            </FlexItem>
            <FlexItem flex={{ default: 'flex_1' }}>
              <Flex gap={{ default: 'gapXs' }} alignItems={{ default: 'alignItemsCenter' }}>
                <FlexItem>{item.summary}</FlexItem>
                {item.description && (
                  <FlexItem>
                    <Tooltip content={item.description}>
                      <InfoCircleIcon
                        style={{
                          color: 'var(--pf-t--global--text--color--subtle)'
                        }}
                      />
                    </Tooltip>
                  </FlexItem>
                )}
              </Flex>
            </FlexItem>
            <FlexItem>
              <span data-test="rule-details-actions">
                <ActionsColumn
                  isDisabled={links.length === 0}
                  items={links.map(l => ({ title: <a href={l.url}>{l.name}</a> }))}
                />
              </span>
            </FlexItem>
          </Flex>
        </Flex>

        {/* Mode, State, Severity, Value, Threshold, Active since, Direction row */}
        <Flex gap={{ default: 'gapSm' }}>
          <VerticalField label={t('Mode')}>{isAlert ? t('alert') : t('recording')}</VerticalField>
          {isAlert && <VerticalField label={t('State')}>{item.state}</VerticalField>}
          <VerticalField label={t('Severity')}>
            <Label isCompact color={getSeverityColor(item.severity)}>
              {item.severity}
            </Label>
          </VerticalField>
          <VerticalField label={t('Value')}>
            {valueFormat(item.value, 2)} {item.metadata.unit}
          </VerticalField>
          {item.threshold && (
            <VerticalField label={t('Threshold')}>
              {item.threshold} {item.metadata.unit}
            </VerticalField>
          )}
          {item.activeAt && (
            <VerticalField label={t('Active since')}>{formatActiveSince(t, item.activeAt)}</VerticalField>
          )}
          {direction && <VerticalField label={t('Direction')}>{direction}</VerticalField>}
        </Flex>

        {/* Labels */}
        {labels.length > 0 && (
          <Flex gap={{ default: 'gapXs' }} flexWrap={{ default: 'wrap' }}>
            {labels.map(kv => (
              <Label key={kv[0]} isCompact>
                {kv[0]}={kv[1]}
              </Label>
            ))}
          </Flex>
        )}
      </Flex>
    </div>
  );
};

export const RuleDetails: React.FC<RuleDetailsProps> = ({ kind, resourceHealth }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');

  const resourceName = resourceHealth.name || 'Global';
  const isGlobal = kind === 'Global';
  const allItems = getAllHealthItems(resourceHealth);

  // Global view: render table
  if (isGlobal) {
    return (
      <Table
        className="rule-details"
        data-test-rows-count={allItems.length}
        aria-label="Rule details"
        variant="compact"
      >
        <Thead>
          <Tr>
            <Th>{t('Summary')}</Th>
            <Th>{t('Mode')}</Th>
            <Th>{t('State')}</Th>
            <Th>{t('Severity')}</Th>
            <Th className="no-wrap">{t('Active since')}</Th>
            <Th>{t('Labels')}</Th>
            <Th>{t('Value')}</Th>
            <Th>{t('Threshold')}</Th>
            <Th>{t('Direction')}</Th>
            <Th>{t('Description')}</Th>
            <Th screenReaderText="Links" />
          </Tr>
        </Thead>
        <Tbody>
          {allItems.map((item, i) => (
            <RuleTableRow key={`rule-row-${i}`} item={item} resourceName={resourceName} kind={kind} t={t} />
          ))}
        </Tbody>
      </Table>
    );
  }

  // Node/Namespace view: render cards
  return (
    <Flex direction={{ default: 'column' }} gap={{ default: 'gapMd' }}>
      {allItems.map((item, i) => (
        <RuleCard key={`rule-card-${i}`} item={item} resourceName={resourceName} kind={kind} t={t} />
      ))}
    </Flex>
  );
};
