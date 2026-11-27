import { parseStream } from './query-response';

describe('parseStream', () => {
  it('keeps Loki timestamps for paging at whole-second boundaries', () => {
    const timestampNs = '1700000000123456789';

    expect(
      parseStream({
        stream: {},
        values: [[timestampNs, '{"SrcAddr":"10.0.0.1"}']]
      })[0].lokiTimestampNs
    ).toBe(timestampNs);
  });
});
