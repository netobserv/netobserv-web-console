import * as _ from 'lodash';
import { getAvailablePanels, OverviewPanel } from '../../utils/overview-panels';

export const CustomPanelsSample = ['Flows', 'DnsFlows'];
export const SamplePanel = { id: 'top_avg_byte_rates', isSelected: true } as OverviewPanel;
export const DefaultPanels = getAvailablePanels().filter(p => p.isSelected);
export const ShuffledDefaultPanels: OverviewPanel[] = _.shuffle(DefaultPanels);
