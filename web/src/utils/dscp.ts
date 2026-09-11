import { ReadOnlyValues } from './values';

export const getDSCPDocUrl = () => {
  return 'https://www.rfc-editor.org/rfc/rfc4594';
};

export const dscpValues: ReadOnlyValues = [
  { value: 48, name: 'Network Control', description: 'Network routing' },
  { value: 46, name: 'Telephony', description: 'IP Telephony bearer' },
  { value: 40, name: 'Signaling', description: 'IP Telephony signaling' },
  { value: 34, name: 'Multimedia Conferencing', description: 'H.323/V2 video conferencing (adaptive)' },
  { value: 32, name: 'Real-Time Interactive', description: 'Video conferencing and nteractive gaming' },
  { value: 26, name: 'Multimedia Streaming', description: 'Streaming video and audio on demand' },
  { value: 24, name: 'Broadcast Video', description: 'Broadcast TV & live events' },
  { value: 18, name: 'Low-Latency Data', description: 'Client/server transactions Web-based ordering' },
  { value: 16, name: 'OAM', description: 'OAM&P' },
  { value: 10, name: 'High-Throughput Data', description: 'Store and forward applications' },
  { value: 0, name: 'Standard', description: 'Undifferentiated applications' },
  { value: 8, name: 'Low-Priority Data', description: 'Any flow that has no BW assurance' }
] as const;

export type DSCPServiceClassNames = (typeof dscpValues)[number]['name'];

export const getDSCPServiceClassName = (dscp: number): DSCPServiceClassNames | undefined => {
  return dscpValues.find(v => v.value === dscp)?.name;
};

export type DSCPServiceClassDescriptions = (typeof dscpValues)[number]['description'];

export const getDSCPServiceClassDescription = (dscp: number): DSCPServiceClassDescriptions | undefined => {
  return dscpValues.find(v => v.value === dscp)?.description;
};
