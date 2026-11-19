import axios from 'axios';
import { Record } from '../ipfix';
import { canFindProxyClients, getProxyRecords } from '../proxy';

jest.mock('axios');

const record = (fields = {}): Record =>
  ({
    key: 1,
    labels: {},
    fields: {
      Proto: 6,
      SrcAddr: '10.128.0.71',
      SrcPort: 40156,
      DstAddr: '10.128.0.64',
      DstPort: 8080,
      TimeFlowStartMs: 1793629069153,
      TimeFlowEndMs: 1793629069239,
      ...fields
    }
  }) as Record;

describe('proxy correlation network scope', () => {
  it.each([undefined, [], ['', '']])('allows primary-network flows with UDN values %j', Udns => {
    expect(canFindProxyClients(record({ Udns }))).toBe(true);
  });

  it.each([{ UdnId: 'network-1' }, { Udns: ['network-1'] }, { Udns: ['', 'network-1'] }])(
    'rejects flows with a populated UDN: %j',
    fields => {
      expect(canFindProxyClients(record(fields))).toBe(false);
    }
  );

  it('omits empty UDN values from primary-network lookups', async () => {
    const get = axios.get as jest.Mock;
    get.mockResolvedValue({ data: { records: [] } });
    await getProxyRecords(record({ Udns: ['', ''] }));
    expect(get.mock.calls.at(-1)[1].params.udn).toBeUndefined();
  });
});
