import { Column, ColumnsId } from '../utils/columns';
import { getPanelFeature, OverviewPanelId } from '../utils/overview-panels';
import { Feature } from './config';
import { MetricType } from './flow-query';

export type ViewPresetId = 'all' | 'pktdrop' | 'dns' | 'rtt' | 'tls' | 'udn' | 'networkEvents' | 'packetTranslation';

export interface DraftView {
  baseViewId: ViewPresetId;
  panels: string[];
  columns: string[];
  topologyMetricType?: MetricType;
}

export interface GenericPrefs {
  added: string[]; // generic IDs user added (not in defaults)
  removed: string[]; // generic IDs user removed (were in defaults)
}

export const defaultGenericPrefs: GenericPrefs = { added: [], removed: [] };

/**
 * Compute updated generic prefs by comparing initial and updated item selections.
 * Only non-feature items are tracked. Returns updated prefs and whether any change occurred.
 */
export const computeUpdatedGenericPrefs = <T extends { id: string; isSelected: boolean }>(
  updatedItems: T[],
  initialItems: Map<string, boolean>,
  currentPrefs: GenericPrefs,
  isFeatureItem: (item: T) => boolean
): { prefs: GenericPrefs; changed: boolean } => {
  const newAdded = [...currentPrefs.added];
  const newRemoved = [...currentPrefs.removed];
  let changed = false;
  for (const item of updatedItems) {
    if (isFeatureItem(item)) continue;
    const wasSelected = initialItems.get(item.id) ?? false;
    if (item.isSelected === wasSelected) continue;
    if (item.isSelected) {
      const removedIdx = newRemoved.indexOf(item.id);
      if (removedIdx >= 0) {
        newRemoved.splice(removedIdx, 1);
        changed = true;
      }
      if (!newAdded.includes(item.id)) {
        newAdded.push(item.id);
        changed = true;
      }
    } else {
      const addedIdx = newAdded.indexOf(item.id);
      if (addedIdx >= 0) {
        newAdded.splice(addedIdx, 1);
        changed = true;
      }
      if (!newRemoved.includes(item.id)) {
        newRemoved.push(item.id);
        changed = true;
      }
    }
  }
  return { prefs: { added: newAdded, removed: newRemoved }, changed };
};

export interface ViewPreset {
  id: ViewPresetId;
  label: string; // i18n key
  requiredFeature?: Feature;
  panels?: OverviewPanelId[]; // panels to select in overview; undefined means use localStorage defaults
  columns?: string[]; // column IDs to select in table; string to support both ColumnsId enum and dynamic string IDs
  topologyMetricType?: MetricType; // default metric for topology
}

// Common base columns included in every feature view
const baseColumns: ColumnsId[] = [
  ColumnsId.endtime,
  ColumnsId.srcnamespace,
  ColumnsId.srcname,
  ColumnsId.dstnamespace,
  ColumnsId.dstname,
  ColumnsId.proto,
  ColumnsId.srcport,
  ColumnsId.dstport
];

export const viewPresets: ViewPreset[] = [
  {
    id: 'all',
    label: 'All Traffic'
    // no requiredFeature, no panels/columns override — uses localStorage defaults
  },
  {
    id: 'pktdrop',
    label: 'Packet Drops',
    requiredFeature: 'pktDrop',
    panels: [
      'top_avg_dropped_packet_rates',
      'dropped_packet_rates',
      'state_dropped_packet_rates',
      'cause_dropped_packet_rates',
      'top_avg_dropped_byte_rates',
      'dropped_byte_rates'
    ],
    columns: [
      ...baseColumns,
      ColumnsId.bytes,
      ColumnsId.packets,
      ColumnsId.dropbytes,
      ColumnsId.droppackets,
      ColumnsId.dropstate,
      ColumnsId.dropcause,
      ColumnsId.dropflags
    ],
    topologyMetricType: 'PktDropPackets'
  },
  {
    id: 'dns',
    label: 'DNS Latency',
    requiredFeature: 'dnsTracking',
    panels: [
      'top_avg_dns_latency',
      'top_p90_dns_latency',
      'top_p99_dns_latency',
      'top_max_dns_latency',
      'dns_name_flows',
      'dns_rcode_flows'
    ],
    columns: [...baseColumns, ColumnsId.dnsid, ColumnsId.dnslatency, ColumnsId.dnsresponsecode, ColumnsId.dnserrno],
    topologyMetricType: 'DnsLatencyMs'
  },
  {
    id: 'rtt',
    label: 'Flow RTT',
    requiredFeature: 'flowRTT',
    panels: ['top_avg_rtt', 'top_p90_rtt', 'top_p99_rtt', 'top_max_rtt', 'bottom_min_rtt'],
    columns: [...baseColumns, ColumnsId.bytes, ColumnsId.packets, ColumnsId.rttTime],
    topologyMetricType: 'TimeFlowRttNs'
  },
  {
    id: 'tls',
    label: 'TLS Tracking',
    requiredFeature: 'tlsTracking',
    panels: ['tls_usage_global', 'tls_per_version', 'tls_per_group', 'tls_per_cipher_suite'],
    columns: [...baseColumns, 'TLSVersion', 'TLSCipherSuite', 'TLSGroup', ColumnsId.tlstypes],
    topologyMetricType: 'TlsFlows'
  },
  {
    id: 'udn',
    label: 'UDN Mapping',
    requiredFeature: 'udnMapping',
    panels: ['top_sankey', 'top_avg_byte_rates', 'byte_rates'],
    columns: [...baseColumns, ColumnsId.udns, ColumnsId.bytes, ColumnsId.packets]
  },
  {
    id: 'networkEvents',
    label: 'Network Events',
    requiredFeature: 'networkEvents',
    panels: [
      'top_avg_dropped_packet_rates',
      'dropped_packet_rates',
      'state_dropped_packet_rates',
      'cause_dropped_packet_rates'
    ],
    columns: [
      ...baseColumns,
      ColumnsId.bytes,
      ColumnsId.packets,
      ColumnsId.dropstate,
      ColumnsId.dropcause,
      'NetworkEvents'
    ]
  },
  {
    id: 'packetTranslation',
    label: 'Packet Translation',
    requiredFeature: 'packetTranslation',
    panels: ['top_sankey', 'top_avg_byte_rates', 'byte_rates'],
    columns: [
      ...baseColumns,
      ColumnsId.srcaddr,
      ColumnsId.dstaddr,
      ColumnsId.bytes,
      ColumnsId.packets,
      'XlatSrcAddr',
      'XlatSrcPort',
      'XlatSrcK8S_Object',
      'XlatDstAddr',
      'XlatDstPort',
      'XlatDstK8S_Object',
      'XlatZoneId'
    ]
  }
];

export const getViewPreset = (id: ViewPresetId): ViewPreset | undefined => viewPresets.find(v => v.id === id);

export const getAvailableViews = (enabledFeatures: Feature[]): ViewPreset[] =>
  viewPresets.filter(v => !v.requiredFeature || enabledFeatures.includes(v.requiredFeature));

/**
 * Reconcile a draft view with current generic preferences.
 * Returns updated DraftView, or null if no feature-level changes remain (draft should be cleared).
 */
export const reconcileDraftWithGenericPrefs = (
  draft: DraftView,
  genericColumnPrefs: GenericPrefs,
  genericPanelPrefs: GenericPrefs,
  availableColumns: Column[]
): DraftView | null => {
  const preset = getViewPreset(draft.baseViewId);
  if (!preset?.columns || !preset?.panels) return draft;

  // Compute expected base: preset + generic prefs
  const expectedCols = new Set(preset.columns);
  genericColumnPrefs.removed.forEach(id => expectedCols.delete(id));
  genericColumnPrefs.added.forEach(id => expectedCols.add(id));
  const expectedPanels = new Set(preset.panels as string[]);
  genericPanelPrefs.removed.forEach(id => expectedPanels.delete(id));
  genericPanelPrefs.added.forEach(id => expectedPanels.add(id));

  // Detect feature-level differences between draft and expected
  const presetColSet = new Set(preset.columns);
  const draftColSet = new Set(draft.columns);
  const addedFeatureCols = draft.columns.filter(id => {
    const col = availableColumns.find(c => c.id === id);
    return col?.feature && !presetColSet.has(id);
  });
  const removedFeatureCols = preset.columns.filter(id => {
    const col = availableColumns.find(c => c.id === id);
    return col?.feature && !draftColSet.has(id);
  });

  const presetPanelSet = new Set(preset.panels as string[]);
  const draftPanelSet = new Set(draft.panels);
  const addedFeaturePanels = draft.panels.filter(id => getPanelFeature(id) && !presetPanelSet.has(id));
  const removedFeaturePanels = (preset.panels as string[]).filter(id => getPanelFeature(id) && !draftPanelSet.has(id));

  const hasFeatureChanges =
    addedFeatureCols.length > 0 ||
    removedFeatureCols.length > 0 ||
    addedFeaturePanels.length > 0 ||
    removedFeaturePanels.length > 0;

  // Check if draft order differs from expected (preset + generic prefs)
  // Build deterministic expected arrays: preset order, minus removed, plus added at end
  const expectedColsArr = (preset.columns || []).filter(id => !genericColumnPrefs.removed.includes(id));
  genericColumnPrefs.added.forEach(id => {
    if (!expectedColsArr.includes(id)) expectedColsArr.push(id);
  });
  const expectedPanelsArr = ((preset.panels as string[]) || []).filter(id => !genericPanelPrefs.removed.includes(id));
  genericPanelPrefs.added.forEach(id => {
    if (!expectedPanelsArr.includes(id)) expectedPanelsArr.push(id);
  });
  const colsMatch =
    draft.columns.length === expectedColsArr.length && !draft.columns.some((id, i) => id !== expectedColsArr[i]);
  const panelsMatch =
    draft.panels.length === expectedPanelsArr.length && !draft.panels.some((id, i) => id !== expectedPanelsArr[i]);
  const hasOrderChange = !colsMatch || !panelsMatch;

  // Clear draft if: no feature changes AND no order change
  if (!hasFeatureChanges && !hasOrderChange) {
    return null;
  }

  // Rebuild draft preserving order: start from draft order, add missing expected, remove deleted
  const removedColSet = new Set(removedFeatureCols);
  const updatedColSet = new Set([...expectedCols, ...addedFeatureCols]);
  removedColSet.forEach(id => updatedColSet.delete(id));
  // Keep draft order for existing columns
  const updatedCols = draft.columns.filter(id => updatedColSet.has(id));
  // Insert new columns in their availableColumns order relative to existing ones
  const availableOrder = availableColumns.map(c => c.id as string);
  updatedColSet.forEach(id => {
    if (!updatedCols.includes(id)) {
      // Find insertion point: place after the last column that precedes this one in availableColumns order
      const idxInAvailable = availableOrder.indexOf(id);
      let insertAt = updatedCols.length; // default: append at end
      for (let i = updatedCols.length - 1; i >= 0; i--) {
        const existingIdx = availableOrder.indexOf(updatedCols[i]);
        if (existingIdx !== -1 && existingIdx < idxInAvailable) {
          insertAt = i + 1;
          break;
        }
        if (i === 0) {
          insertAt = 0;
        }
      }
      updatedCols.splice(insertAt, 0, id);
    }
  });

  const removedPanelSet = new Set(removedFeaturePanels);
  const updatedPanelSet = new Set([...expectedPanels, ...addedFeaturePanels]);
  removedPanelSet.forEach(id => updatedPanelSet.delete(id));
  const updatedPanels = draft.panels.filter(id => updatedPanelSet.has(id));
  updatedPanelSet.forEach(id => {
    if (!updatedPanels.includes(id)) updatedPanels.push(id);
  });

  return {
    ...draft,
    columns: updatedCols,
    panels: updatedPanels
  };
};
