import {
  getGenericHTTPError,
  getStructuredHTTPError,
  LokiResponseError,
  PromDisabledMetrics,
  PromMissingLabels,
  PromUnsupported
} from '../errors';

type Response = { data: { [key: string]: string } };
class CustomError extends Error {
  constructor(code: number, public msg: string, public response: Response) {
    super(`[${code}] ${msg}`);
  }
}

describe('getGenericHTTPError', () => {
  it('should build error from JSON', () => {
    const err = {
      response: {
        data: {
          message: 'there was an error',
          code: 'ABCD'
        }
      }
    };
    expect(getGenericHTTPError(err)).toEqual('there was an error\nABCD');
  });

  it('should build error from thrown Error', () => {
    const err = new Error('there was an error [code=ABCD]');
    expect(getGenericHTTPError(err)).toEqual('Error: there was an error [code=ABCD]');
  });

  it('should build error from plain text', () => {
    const err = {
      response: {
        data: 'there was an error'
      }
    };
    expect(getGenericHTTPError(err)).toEqual('there was an error');
  });

  it('should build error from CustomError', () => {
    const err = new CustomError(404, 'not found', { data: { details: 'file xyz not found on server' } });
    expect(getGenericHTTPError(err)).toEqual('Error: [404] not found\nfile xyz not found on server');
  });

  it('should build error from unexpected response', () => {
    const err = 'unexpected response';
    expect(getGenericHTTPError(err)).toEqual('unexpected response');
  });

  it('should get Prometheus error descriptions', () => {
    const err = {
      response: {
        data: {
          promUnsupported: true,
          reason: 'because'
        }
      }
    };
    let structured = getStructuredHTTPError(err);
    expect(PromUnsupported.isTypeOf(structured)).toBe(true);
    expect(PromDisabledMetrics.isTypeOf(structured)).toBe(false);
    expect(String(structured)).toEqual(
      'This request could not be performed with Prometheus metrics (reason: because).'
    );

    structured = getStructuredHTTPError(err, 'With Context');
    expect(String(structured)).toEqual(
      'With Context: This request could not be performed with Prometheus metrics (reason: because).'
    );
  });

  it('should get Prometheus error with candidates', () => {
    const err = {
      response: {
        data: {
          promDisabledMetrics: true,
          candidates: ['foo', 'bar']
        }
      }
    };
    let structured = getStructuredHTTPError(err);
    expect(PromUnsupported.isTypeOf(structured)).toBe(false);
    expect(PromDisabledMetrics.isTypeOf(structured)).toBe(true);
    expect(String(structured)).toEqual('This request requires some metrics that are currently disabled.');
    expect((structured as PromDisabledMetrics).getSuggestions()).toEqual([
      'Enable any of the following metrics in the FlowCollector API (spec.processor.metrics.includeList): foo, bar',
      'Install and enable Loki in the FlowCollector API (spec.loki.enable)'
    ]);

    structured = getStructuredHTTPError(err, 'With Context');
    expect(String(structured)).toEqual('With Context: This request requires some metrics that are currently disabled.');
  });

  it('should get Loki Response error', () => {
    const err = {
      response: {
        data: {
          lokiResponse: true,
          message: 'max entries limit'
        }
      }
    };
    const structured = getStructuredHTTPError(err);
    expect(LokiResponseError.isTypeOf(structured)).toBe(true);
    expect(String(structured)).toEqual('max entries limit');
  });

  it('should get Prometheus error with missing labels', () => {
    const err = {
      response: {
        data: {
          promMissingLabels: true,
          missing: {
            metric1: ['foo', 'bar'],
            metric2: ['foo', 'baz'],
            metric3: ['foo', 'bar', 'baz']
          }
        }
      }
    };
    const structured = getStructuredHTTPError(err);
    expect(PromUnsupported.isTypeOf(structured)).toBe(false);
    expect(PromMissingLabels.isTypeOf(structured)).toBe(true);
    expect(String(structured)).toEqual(
      'This request could not be performed with Prometheus metrics because some of the required labels are missing.'
    );
    expect((structured as PromMissingLabels).getClosestLabelsSet(['abc', 'foo', 'bar'])).toEqual(['foo', 'bar']);
    expect((structured as PromMissingLabels).getClosestLabelsSet(['foo'])).toEqual([]);
  });
});
