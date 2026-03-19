import * as _ from 'lodash';

export interface StructuredError {
  toString(): string;
}

export class PromUnsupported implements StructuredError {
  promUnsupported: boolean;
  constructor(public reason?: string, public context?: string) {
    this.promUnsupported = true;
  }

  toString(this: PromUnsupported): string {
    const context = this.context ? `${this.context}: ` : '';
    const reason = this.reason ? ` (reason: ${this.reason})` : '';
    return `${context}This request could not be performed with Prometheus metrics${reason}.`;
  }

  getSuggestions(): string[] {
    return [
      'Use a different scope of aggregation',
      'Install and enable Loki in the FlowCollector API (spec.loki.enable)'
    ];
  }

  static isTypeOf = (err: StructuredError | string): err is PromUnsupported => {
    return (err as PromUnsupported)?.promUnsupported !== undefined;
  };
}

export class PromDisabledMetrics implements StructuredError {
  promDisabledMetrics: boolean;
  constructor(public candidates: string[], public context?: string) {
    this.promDisabledMetrics = true;
  }

  toString(this: PromDisabledMetrics): string {
    const context = this.context ? `${this.context}: ` : '';
    return `${context}This request requires some metrics that are currently disabled.`;
  }

  getSuggestions(): string[] {
    return [
      `Enable any of the following metrics in the FlowCollector API (spec.processor.metrics.includeList): ${this.candidates.join(
        ', '
      )}`,
      'Install and enable Loki in the FlowCollector API (spec.loki.enable)'
    ];
  }

  static isTypeOf = (err: StructuredError | string): err is PromDisabledMetrics => {
    return (err as PromDisabledMetrics)?.promDisabledMetrics !== undefined;
  };
}

export class PromMissingLabels implements StructuredError {
  promMissingLabels: boolean;
  constructor(public missing: { [k: string]: string[] }, public context?: string) {
    this.promMissingLabels = true;
  }

  toString(this: PromMissingLabels): string {
    const context = this.context ? `${this.context}: ` : '';
    return `${context}This request could not be performed with Prometheus metrics because some of the required labels are missing.`;
  }

  getSuggestions(): string[] {
    let smallestSet: string[] = [];
    Object.values(this.missing).forEach(v => {
      if (smallestSet.length === 0 || smallestSet.length > v.length) {
        smallestSet = v;
      }
    });
    return [
      `Try using different filters and/or aggregations; for example, try removing these dependencies from your query: ${smallestSet.join(
        ', '
      )}`,
      'Install and enable Loki in the FlowCollector API (spec.loki.enable)'
    ];
  }

  getClosestLabelsSet(activeFilterFields: (string | undefined)[]): string[] {
    // The error contains a set of metrics for which there are missing labels
    // We want to retain the smallest set of labels that allows us to display the view by disabling as few filters as possible
    return Object.values(this.missing)
      .filter(missingLabels => {
        // Keep only those that would allow displaying the view
        const d = _.difference(missingLabels, activeFilterFields);
        return d.length === 0;
      })
      .reduce((prev, cur) => {
        // Keep smallest set
        return prev.length === 0 || prev.length > cur.length ? cur : prev;
      }, []);
  }

  static isTypeOf = (err: StructuredError | string): err is PromMissingLabels => {
    return (err as PromMissingLabels)?.promMissingLabels !== undefined;
  };
}

export class ConfigLoadError implements StructuredError {
  configLoadError: boolean;
  public message: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(public err: any) {
    this.configLoadError = true;
    this.message = getGenericHTTPError(err);
  }

  toString(this: ConfigLoadError): string {
    return this.message;
  }

  static isTypeOf = (err: StructuredError | string): err is ConfigLoadError => {
    return (err as ConfigLoadError)?.configLoadError !== undefined;
  };
}

export class LokiResponseError implements StructuredError {
  lokiResponse: boolean;
  constructor(public message: string) {
    this.lokiResponse = true;
  }

  toString(this: LokiResponseError): string {
    return this.message;
  }

  static isTypeOf = (err: StructuredError | string): err is LokiResponseError => {
    return (err as LokiResponseError)?.lokiResponse !== undefined;
  };
}

export class LokiClientError implements StructuredError {
  lokiClient: boolean;
  constructor(public message: string) {
    this.lokiClient = true;
  }

  toString(this: LokiClientError): string {
    return this.message;
  }

  static isTypeOf = (err: StructuredError | string): err is LokiClientError => {
    return (err as LokiClientError)?.lokiClient !== undefined;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getGenericHTTPError = (err: any): string => {
  if (err?.response?.data) {
    const header = err.toString === Object.prototype.toString ? '' : `${err}\n`;
    if (typeof err.response.data === 'object') {
      return (
        header +
        Object.keys(err.response.data)
          .map(key => String(err.response.data[key]))
          .join('\n')
      );
    }
    return header + String(err.response.data);
  }
  return String(err);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getStructuredHTTPError = (err: any, context?: string): StructuredError | string => {
  if (err?.response?.data && typeof err.response.data === 'object') {
    if (err.response.data.promUnsupported) {
      return new PromUnsupported(err.response.data.reason, context);
    } else if (err.response.data.promDisabledMetrics) {
      return new PromDisabledMetrics(err.response.data.candidates || [], context);
    } else if (err.response.data.promMissingLabels) {
      return new PromMissingLabels(err.response.data.missing || [], context);
    } else if (err.response.data.lokiResponse) {
      return new LokiResponseError(err.response.data.message);
    } else if (err.response.data.lokiClient) {
      return new LokiClientError(err.response.data.message);
    }
  }
  return getGenericHTTPError(err);
};
