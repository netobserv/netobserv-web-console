import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';

import { Config, defaultConfig } from '../../../model/config';
import { ColumnConfigSampleDefs, ShuffledColumnSample } from '../../__tests-data__/columns';
import ColumnsModal from '../columns-modal';

describe('<ColumnsModal />', () => {
  const props = {
    isModalOpen: true,
    setModalOpen: jest.fn(),
    config: { ...defaultConfig, columns: ColumnConfigSampleDefs } as Config,
    columns: ShuffledColumnSample,
    setColumns: jest.fn(),
    setColumnSizes: jest.fn(),
    activeView: 'all' as const,
    genericPrefs: { added: [], removed: [] },
    setGenericPrefs: jest.fn(),
    id: 'columns-modal'
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should render component', async () => {
    render(<ColumnsModal {...props} />);
    await act(async () => {
      jest.runAllTimers();
    });
  });

  it('should save once', async () => {
    render(<ColumnsModal {...props} />);
    await act(async () => {
      jest.runAllTimers();
    });

    const confirmButton = document.querySelector('.pf-v6-c-button.pf-m-primary') as HTMLElement;
    expect(confirmButton).toBeTruthy();

    await act(async () => {
      fireEvent.click(confirmButton);
      jest.runAllTimers();
    });
    expect(props.setColumns).toHaveBeenCalledTimes(1);
  });

  it('should update columns selected on save', async () => {
    render(<ColumnsModal {...props} />);
    await act(async () => {
      jest.runAllTimers();
    });

    await waitFor(() => {
      expect(screen.getAllByRole('checkbox').length).toBeGreaterThanOrEqual(2);
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);
      jest.runAllTimers();
    });

    const saveButton = document.querySelector('.pf-v6-c-button.pf-m-primary') as HTMLElement;
    await act(async () => {
      fireEvent.click(saveButton);
      jest.runAllTimers();
    });

    const updatedColumns = [...props.columns];
    updatedColumns[0] = { ...updatedColumns[0], isSelected: !updatedColumns[0].isSelected };
    updatedColumns[1] = { ...updatedColumns[1], isSelected: !updatedColumns[1].isSelected };
    expect(props.setColumns).toHaveBeenCalledWith(updatedColumns);
  });
});
