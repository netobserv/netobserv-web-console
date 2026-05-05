import { render, screen } from '@testing-library/react';
import * as React from 'react';

import { ShuffledColumnSample } from '../../../components/__tests-data__/columns';
import ExportModal, { ExportModalProps } from '../export-modal';

jest.mock('../../../api/routes', () => ({
  getExportFlowsURL: jest.fn(() => 'http://localhost/export'),
  getConfig: jest.fn(() => Promise.resolve({})),
  getRole: jest.fn(() => Promise.resolve('admin'))
}));

const emptyFilters = { match: 'all' as const, list: [] };

describe('<ExportModal />', () => {
  const props: ExportModalProps = {
    isModalOpen: true,
    setModalOpen: jest.fn(),
    columns: ShuffledColumnSample,
    filters: [],
    range: 300,
    flowQuery: {
      recordType: 'flowLog',
      dataSource: 'auto',
      limit: 100,
      structuredFilters: emptyFilters,
      packetLoss: 'all'
    },
    id: 'export-modal'
  };

  it('should render component', async () => {
    render(<ExportModal {...props} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
