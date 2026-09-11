import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';

import { RecordType } from '../../../model/flow-query';
import { ShuffledDefaultPanels } from '../../__tests-data__/panels';
import OverviewPanelsModal from '../overview-panels-modal';

describe('<OverviewPanelsModal />', () => {
  const props = {
    isModalOpen: true,
    setModalOpen: jest.fn(),
    recordType: 'flowLog' as RecordType,
    panels: ShuffledDefaultPanels,
    setPanels: jest.fn(),
    customIds: [],
    features: [],
    activeView: 'all' as const,
    genericPrefs: { added: [], removed: [] },
    setGenericPrefs: jest.fn(),
    id: 'panels-modal'
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
    render(<OverviewPanelsModal {...props} />);
    await act(async () => {
      jest.runAllTimers();
    });
  });

  it('should save once', async () => {
    render(<OverviewPanelsModal {...props} />);
    await act(async () => {
      jest.runAllTimers();
    });

    const confirmButton = document.querySelector('.pf-v6-c-button.pf-m-primary') as HTMLElement;
    expect(confirmButton).toBeTruthy();

    await act(async () => {
      fireEvent.click(confirmButton);
      jest.runAllTimers();
    });
    expect(props.setPanels).toHaveBeenCalledTimes(1);
  });

  it('should update panels selected on save', async () => {
    render(<OverviewPanelsModal {...props} />);
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

    const updatedPanels = [...props.panels];
    updatedPanels[0] = { ...updatedPanels[0], isSelected: !updatedPanels[0].isSelected };
    updatedPanels[1] = { ...updatedPanels[1], isSelected: !updatedPanels[1].isSelected };
    expect(props.setPanels).toHaveBeenCalledWith(updatedPanels);
  });
});
