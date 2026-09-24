import { buildExportQuery } from '../export-query';

describe('buildExportQuery', () => {
  it('should build without columns', () => {
    const query = buildExportQuery({
      filters: 'SrcK8S_Name%3Dtest1%2Ctest2',
      recordType: 'flowLog',
      namespace: undefined,
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

  it('should build with columns and json format', () => {
    const query = buildExportQuery(
      {
        filters: '',
        recordType: 'flowLog',
        dataSource: 'auto',
        packetLoss: 'all',
        limit: 500
      },
      { format: 'json', columns: ['foo', 'bar'] }
    );
    expect(query).toEqual(
      'filters=&recordType=flowLog&dataSource=auto&packetLoss=all&limit=500&format=json&columns=foo%2Cbar'
    );
  });
});
