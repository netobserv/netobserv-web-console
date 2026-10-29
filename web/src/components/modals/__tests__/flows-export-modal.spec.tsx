import { render, screen } from '@testing-library/react';
import * as React from 'react';

import { ShuffledColumnSample } from '../../../components/__tests-data__/columns';
import FlowsExportModal, { FlowsExportModalProps } from '../flows-export-modal';

jest.mock('../../../api/routes', () => ({
  exportFlows: jest.fn(() => Promise.resolve(new Blob(['test']))),
  getConfig: jest.fn(() => Promise.resolve({})),
  getRole: jest.fn(() => Promise.resolve('admin'))
}));

const emptyFilters = { match: 'all' as const, list: [] };

describe('<FlowsExportModal />', () => {
  const props: FlowsExportModalProps = {
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
    id: 'flows-export-modal'
  };

  it('should render component', async () => {
    render(<FlowsExportModal {...props} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
