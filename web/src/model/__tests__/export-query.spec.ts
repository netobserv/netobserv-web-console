import { buildExportQuery } from '../export-query';

describe('buildExportQuery', () => {
  it('should build without columns', () => {
    const query = buildExportQuery({
      filters: 'SrcK8S_Name%3Dtest1%2Ctest2',
      recordType: 'flowLog',
      tenant: undefined,
      dataSource: 'auto',
      packetLoss: 'all',
      limit: 500,
      timeRange: 300
    });
    expect(query).toEqual(
      // eslint-disable-next-line max-len
      'filters=SrcK8S_Name%253Dtest1%252Ctest2&recordType=flowLog&dataSource=auto&packetLoss=all&limit=500&timeRange=300&format=csv'
    );
  });

  it('should build with columns', () => {
    const query = buildExportQuery(
      {
        filters: '',
        recordType: 'flowLog',
        dataSource: 'auto',
        packetLoss: 'all',
        limit: 500
      },
      ['foo', 'bar']
    );
    expect(query).toEqual(
      'filters=&recordType=flowLog&dataSource=auto&packetLoss=all&limit=500&format=csv&columns=foo%2Cbar'
    );
  });
});
