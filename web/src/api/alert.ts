import { Rule } from '@openshift-console/dynamic-plugin-sdk';

export interface AlertsResult {
  data: AlertsResultData;
  status: string;
}

export interface AlertsResultData {
  groups: AlertsGroups[];
}

export interface AlertsGroups {
  name?: string;
  file?: string;
  interval?: number;
  limit?: number;
  rules: Rule[];
}

export interface SilencedAlert {
  id: string;
  status: SilencedAlertStatus;
  matchers: SilenceMatcher[];
}

export interface SilencedAlertStatus {
  state: string;
}

export interface SilenceMatcher {
  name: string;
  value: string;
  isRegex?: boolean;
  /** Defaults to true when omitted (Alertmanager API). */
  isEqual?: boolean;
}
