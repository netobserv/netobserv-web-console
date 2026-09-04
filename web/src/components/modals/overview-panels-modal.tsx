import {
  Button,
  Content,
  ContentVariants,
  DataList,
  DataListCell,
  DataListCheck,
  DataListControl,
  DataListItemCells,
  Flex,
  FlexItem,
  Tooltip
} from '@patternfly/react-core';
import { DragDropSort, DragDropSortDragEndEvent, DraggableObject } from '@patternfly/react-drag-drop';
import * as _ from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Feature } from '../../model/config';
import { RecordType } from '../../model/flow-query';
import { defaultGenericPrefs, GenericPrefs, getViewPreset, ViewPresetId } from '../../model/views';
import { getAvailablePanels, getOverviewPanelInfo, getPanelFeature, OverviewPanel } from '../../utils/overview-panels';
import Modal, { ensureRootElement } from './modal';
import './overview-panels-modal.css';

export interface OverviewPanelsModalProps {
  isModalOpen: boolean;
  setModalOpen: (v: boolean) => void;
  recordType: RecordType;
  panels: OverviewPanel[];
  setPanels: (v: OverviewPanel[]) => void;
  customIds?: string[];
  features: Feature[];
  activeView: ViewPresetId;
  genericPrefs: GenericPrefs;
  setGenericPrefs: (v: GenericPrefs) => void;
  id?: string;
}

export const OverviewPanelsModal: React.FC<OverviewPanelsModalProps> = ({
  id,
  isModalOpen,
  setModalOpen,
  recordType,
  panels,
  setPanels,
  customIds,
  features,
  activeView,
  genericPrefs,
  setGenericPrefs
}) => {
  React.useEffect(() => {
    ensureRootElement();
  }, []);

  const [updatedPanels, setUpdatedPanels] = React.useState<OverviewPanel[]>([]);
  const [resetClicked, setResetClicked] = React.useState<boolean>(false);
  const [filterKeys, setFilterKeys] = React.useState<string[]>([]);
  const { t } = useTranslation('plugin__netobserv-plugin');

  React.useEffect(() => {
    if (isModalOpen) {
      setFilterKeys([]);
    }
  }, [isModalOpen]);

  const prevModalOpen = React.useRef(false);
  React.useEffect(() => {
    const justOpened = isModalOpen && !prevModalOpen.current;
    prevModalOpen.current = isModalOpen;
    if (resetClicked) return;
    if (justOpened || _.isEmpty(updatedPanels)) {
      setUpdatedPanels(_.cloneDeep(panels));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen, panels]);

  const getFilterKeys = React.useCallback(() => {
    let panelFilterKeys = ['total', 'bar', 'donut', 'line'];

    if (features.includes('pktDrop')) {
      panelFilterKeys.push('dropped');
    }

    if (features.includes('dnsTracking') || features.includes('flowRTT')) {
      panelFilterKeys = panelFilterKeys.concat(['rate', 'top', 'bottom', 'min', 'avg', 'max', 'p90', 'p99']);
      if (features.includes('dnsTracking')) {
        panelFilterKeys.push('dns');
      }
      if (features.includes('flowRTT')) {
        panelFilterKeys.push('rtt');
      }
    }

    return panelFilterKeys;
  }, [features]);

  const onCheck = React.useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (event: React.FormEvent<HTMLInputElement>, checked: boolean) => {
      if (event?.target && 'id' in event.target) {
        const panelId = (event.target as HTMLInputElement).id;
        setUpdatedPanels(prevPanels =>
          prevPanels.map(panel => (panel.id === panelId ? { ...panel, isSelected: checked } : panel))
        );
      }
    },
    []
  );

  const onReset = React.useCallback(() => {
    setResetClicked(true);
    if (activeView !== 'all') {
      // Feature view: reset to preset's panels in preset order
      const preset = getViewPreset(activeView);
      const presetPanelIds = (preset?.panels as string[]) ?? [];
      const panelMap = new Map(panels.map(p => [p.id as string, p]));
      const resetPanels = presetPanelIds
        .map(id => panelMap.get(id as string))
        .filter((p): p is OverviewPanel => p !== undefined)
        .map(p => ({ ...p, isSelected: true }));
      // Add non-preset panels as unselected at the end
      const nonPresetPanels = panels.filter(p => !presetPanelIds.includes(p.id as string));
      setUpdatedPanels([...resetPanels, ...nonPresetPanels.map(p => ({ ...p, isSelected: false }))]);
    } else {
      // "All Traffic" or custom view: reset to config defaults
      const defaults = getAvailablePanels(customIds).filter(p => panels.some(existing => existing.id === p.id));
      setUpdatedPanels(defaults);
    }
  }, [customIds, panels, activeView]);

  const isSaveDisabled = React.useCallback(() => {
    return _.isEmpty(updatedPanels.filter(p => p.isSelected));
  }, [updatedPanels]);

  const isFilteredPanel = React.useCallback(
    (p: OverviewPanel) => {
      return (
        _.isEmpty(filterKeys) ||
        _.reduce(
          filterKeys,
          (acc, fk) => {
            const panelInfo = getOverviewPanelInfo(
              t,
              p.id,
              undefined,
              recordType === 'flowLog' ? t('flow') : t('conversation')
            );
            const str = `${p.id}: ${panelInfo.title} - ${panelInfo.chartType}`;
            return (acc = acc && str.toLowerCase().includes(fk));
          },
          true
        )
      );
    },
    [filterKeys, recordType, t]
  );

  const filteredPanels = React.useCallback(() => {
    return updatedPanels.filter(p => isFilteredPanel(p));
  }, [isFilteredPanel, updatedPanels]);

  const onDrop = React.useCallback(
    (event: DragDropSortDragEndEvent, items: DraggableObject[], oldIndex?: number, newIndex?: number) => {
      if (oldIndex !== undefined && newIndex !== undefined) {
        const filtered = filteredPanels();
        const draggedItem = filtered[oldIndex];
        const targetItem = filtered[newIndex];
        const result = [...updatedPanels];
        const fullOldIndex = result.findIndex(p => p.id === draggedItem.id);
        const fullNewIndex = result.findIndex(p => p.id === targetItem.id);
        const [removed] = result.splice(fullOldIndex, 1);
        result.splice(fullNewIndex, 0, removed);
        setUpdatedPanels(result);
        return true;
      }
      return false;
    },
    [updatedPanels, setUpdatedPanels, filteredPanels]
  );

  const isAllSelected = React.useCallback(() => {
    const filtered = filteredPanels();
    return filtered.length > 0 && _.reduce(filtered, (acc, p) => (acc = acc && p.isSelected), true);
  }, [filteredPanels]);

  const onSelectAll = React.useCallback(() => {
    const allSelected = isAllSelected();
    setUpdatedPanels(prevPanels =>
      prevPanels.map(panel => (isFilteredPanel(panel) ? { ...panel, isSelected: !allSelected } : panel))
    );
  }, [isAllSelected, isFilteredPanel]);

  const onClose = React.useCallback(() => {
    setResetClicked(false);
    setUpdatedPanels(_.cloneDeep(panels));
    setModalOpen(false);
  }, [panels, setModalOpen]);

  const onSave = React.useCallback(() => {
    // On reset, clear generic prefs and skip recomputation
    if (resetClicked) {
      setGenericPrefs(defaultGenericPrefs);
      setPanels(updatedPanels);
      onClose();
      return;
    }
    // Update generic prefs only for panels the user actually toggled
    const initialMap = new Map(panels.map(p => [p.id, p.isSelected]));
    const newAdded = [...genericPrefs.added];
    const newRemoved = [...genericPrefs.removed];
    let prefsChanged = false;
    for (const panel of updatedPanels) {
      if (getPanelFeature(panel.id)) continue; // skip feature panels
      const wasSelected = initialMap.get(panel.id) ?? false;
      if (panel.isSelected === wasSelected) continue; // no change
      if (panel.isSelected) {
        const removedIdx = newRemoved.indexOf(panel.id);
        if (removedIdx >= 0) {
          newRemoved.splice(removedIdx, 1);
          prefsChanged = true;
        }
        if (!newAdded.includes(panel.id)) {
          newAdded.push(panel.id);
          prefsChanged = true;
        }
      } else {
        const addedIdx = newAdded.indexOf(panel.id);
        if (addedIdx >= 0) {
          newAdded.splice(addedIdx, 1);
          prefsChanged = true;
        }
        if (!newRemoved.includes(panel.id)) {
          newRemoved.push(panel.id);
          prefsChanged = true;
        }
      }
    }
    if (prefsChanged) {
      setGenericPrefs({ added: newAdded, removed: newRemoved });
    }

    setPanels(updatedPanels);
    onClose();
  }, [resetClicked, setPanels, updatedPanels, onClose, panels, genericPrefs, setGenericPrefs]);

  const toggleChip = React.useCallback(
    (key: string) => {
      if (filterKeys.includes(key)) {
        setFilterKeys(filterKeys.filter(k => k !== key));
      } else {
        setFilterKeys(getFilterKeys().filter(f => f === key || filterKeys.includes(f)));
      }
    },
    [filterKeys, getFilterKeys]
  );

  const draggableItems: DraggableObject[] = Array.from(
    filteredPanels().map((panel, i) => {
      const info = getOverviewPanelInfo(
        t,
        panel.id,
        undefined,
        recordType === 'flowLog' ? t('flow') : t('conversation')
      );
      return {
        id: 'data-' + i,
        content: (
          <>
            <DataListControl>
              <DataListCheck
                aria-labelledby={'overview-panel-management-item-' + i}
                isChecked={panel.isSelected}
                id={panel.id}
                data-test={`overview-panel-checkbox-${panel.id}`}
                onChange={onCheck}
              />
            </DataListControl>
            <DataListItemCells
              dataListCells={[
                <DataListCell key={'data-list-cell-' + i}>
                  <label htmlFor={panel.id} id={'overview-panel-management-item-' + i}>
                    {info.title}
                    {info.chartType && <>{' (' + info.chartType + ')'}</>}
                  </label>
                </DataListCell>
              ]}
            />
          </>
        )
      };
    })
  );

  return (
    <Modal
      id={id}
      title={t('Manage panels')}
      isOpen={isModalOpen}
      scrollable={true}
      onClose={() => onClose()}
      description={
        <>
          <Content>
            <Content component={ContentVariants.p}>
              {t('Selected panels will appear in the overview tab.')}&nbsp;
              {t('Click and drag the items to reorder the panels in the overview tab.')}
            </Content>
          </Content>
          <Flex className="popup-header-margin">
            <FlexItem flex={{ default: 'flex_4' }}>
              <Flex className="flex-gap">
                {getFilterKeys().map(key => {
                  return (
                    <FlexItem
                      key={key}
                      data-test={`filter-chip-${key}`}
                      onClick={() => toggleChip(key)}
                      className={`custom-chip ${
                        filterKeys.includes(key) ? 'selected' : 'unselected'
                      } buttonless gap pointer`}
                    >
                      <Content component={ContentVariants.p}>{key}</Content>
                    </FlexItem>
                  );
                })}
              </Flex>
            </FlexItem>
            <FlexItem flex={{ default: 'flex_1' }} className="flex-center">
              {_.isEmpty(filteredPanels()) ? (
                <Button isInline onClick={() => setFilterKeys([])} variant="link">
                  {t('Clear filters')}
                </Button>
              ) : (
                <Button isInline onClick={onSelectAll} variant="link">
                  {`${isAllSelected() ? t('Unselect all') : t('Select all')}${
                    !_.isEmpty(filterKeys) ? ' ' + filterKeys.join(',') : ''
                  }`}
                </Button>
              )}
            </FlexItem>
          </Flex>
        </>
      }
      footer={
        <>
          <Button data-test="panels-reset-button" key="reset" variant="link" onClick={() => onReset()}>
            {t('Restore default panels')}
          </Button>
          <Button data-test="panels-cancel-button" key="cancel" variant="link" onClick={() => onClose()}>
            {t('Cancel')}
          </Button>
          <Tooltip content={t('At least one panel must be selected')} isVisible={isSaveDisabled()}>
            <Button
              data-test="panels-save-button"
              isDisabled={isSaveDisabled()}
              key="confirm"
              variant="primary"
              onClick={() => onSave()}
            >
              {t('Save')}
            </Button>
          </Tooltip>
        </>
      }
    >
      <div className="co-m-form-row" id="drag-drop-container-overview">
        <DragDropSort items={draggableItems} onDrop={onDrop} variant="DataList" overlayProps={{ isCompact: true }}>
          <DataList
            aria-label="Overview panel management"
            data-test="overview-panel-management"
            id="overview-panel-management"
            isCompact
          />
        </DragDropSort>
      </div>
    </Modal>
  );
};

export default OverviewPanelsModal;
