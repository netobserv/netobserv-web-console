import {
  Button,
  DataList,
  DataListCell,
  DataListCheck,
  DataListControl,
  DataListDragButton,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  DragDrop,
  Draggable,
  Droppable,
  Flex,
  FlexItem,
  Text,
  TextContent,
  TextVariants,
  Tooltip
} from '@patternfly/react-core';
import * as _ from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Feature } from '../../model/config';
import { RecordType } from '../../model/flow-query';
import {
  computeUpdatedGenericPrefs,
  defaultGenericPrefs,
  GenericPrefs,
  getViewPreset,
  ViewPresetId
} from '../../model/views';
import { getAvailablePanels, getOverviewPanelInfo, getPanelFeature, OverviewPanel } from '../../utils/overview-panels';
import Modal from './modal';
import './overview-panels-modal.css';

const PANELS_DRAG_ZONE = 'netobs-overview-panels-modal';

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
  const [updatedPanels, setUpdatedPanels] = React.useState<OverviewPanel[]>([]);
  const [resetClicked, setResetClicked] = React.useState<boolean>(false);
  const [filterKeys, setFilterKeys] = React.useState<string[]>([]);
  const { t } = useTranslation('plugin__netobserv-plugin');
  const dragDescriptionId = 'overview-panels-drag-description';

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

  const onListDrop = React.useCallback(
    (source: { droppableId: string; index: number }, dest?: { droppableId: string; index: number }) => {
      if (!dest || source.droppableId !== dest.droppableId) {
        return false;
      }
      const oldIndex = source.index;
      const newIndex = dest.index;
      if (oldIndex === newIndex) {
        return false;
      }
      let accepted = false;
      setUpdatedPanels(prev => {
        const filtered = prev.filter(p => isFilteredPanel(p));
        if (oldIndex < 0 || oldIndex >= filtered.length || newIndex < 0 || newIndex >= filtered.length) {
          return prev;
        }
        const reorderedFiltered = [...filtered];
        const [removed] = reorderedFiltered.splice(oldIndex, 1);
        reorderedFiltered.splice(newIndex, 0, removed);
        const next: OverviewPanel[] = [];
        const fq = [...reorderedFiltered];
        for (const panel of prev) {
          if (isFilteredPanel(panel)) {
            const shifted = fq.shift();
            if (shifted) {
              next.push(shifted);
            }
          } else {
            next.push(panel);
          }
        }
        accepted = true;
        return next;
      });
      return accepted;
    },
    [isFilteredPanel]
  );

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

  const filteredPanels = React.useCallback(() => {
    return updatedPanels.filter(p => isFilteredPanel(p));
  }, [isFilteredPanel, updatedPanels]);

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
    const { prefs, changed } = computeUpdatedGenericPrefs(
      updatedPanels.map(p => ({ id: p.id, isSelected: p.isSelected })),
      initialMap,
      genericPrefs,
      p => !!getPanelFeature(p.id)
    );
    if (changed) {
      setGenericPrefs(prefs);
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

  const flowOrConversation = recordType === 'flowLog' ? t('flow') : t('conversation');

  return (
    <Modal
      id={id}
      title={t('Manage panels')}
      isOpen={isModalOpen}
      scrollable={true}
      onClose={() => onClose()}
      description={
        <>
          <TextContent>
            <Text component={TextVariants.p}>
              {t('Selected panels will appear in the overview tab.')}&nbsp;
              {t('Click and drag the items to reorder the panels in the overview tab.')}
            </Text>
          </TextContent>
          <Flex className="popup-header-margin">
            <FlexItem flex={{ default: 'flex_4' }}>
              <Flex className="flex-gap">
                {getFilterKeys().map(key => {
                  return (
                    <FlexItem
                      key={key}
                      onClick={() => toggleChip(key)}
                      className={`custom-chip ${
                        filterKeys.includes(key) ? 'selected' : 'unselected'
                      } buttonless gap pointer`}
                    >
                      <Text component={TextVariants.p}>{key}</Text>
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
        <DragDrop onDrop={onListDrop}>
          <Droppable hasNoWrapper zone={PANELS_DRAG_ZONE} droppableId="overview-panels-list">
            <DataList
              aria-label="Overview panel management"
              data-test="overview-panel-management"
              id="overview-panel-management"
              isCompact
            >
              {filteredPanels().map(panel => {
                const info = getOverviewPanelInfo(t, panel.id, undefined, flowOrConversation);
                const rowLabelId = `overview-panel-management-item-${panel.id}`;
                return (
                  <Draggable key={panel.id} hasNoWrapper>
                    <DataListItem aria-labelledby={rowLabelId} id={`overview-panel-management-row-${panel.id}`}>
                      <DataListItemRow>
                        <DataListControl className="netobserv-data-list-control">
                          <DataListDragButton
                            aria-label={t('Reorder panel')}
                            aria-labelledby={rowLabelId}
                            aria-describedby={dragDescriptionId}
                            aria-pressed={false}
                          />
                          <DataListCheck
                            aria-labelledby={rowLabelId}
                            isChecked={panel.isSelected}
                            id={panel.id}
                            onChange={onCheck}
                            otherControls
                          />
                        </DataListControl>
                        <DataListItemCells
                          dataListCells={[
                            <DataListCell key={`data-list-cell-${panel.id}`}>
                              <label htmlFor={panel.id} id={rowLabelId}>
                                {info.title}
                                {info.chartType && <>{' (' + info.chartType + ')'}</>}
                              </label>
                            </DataListCell>
                          ]}
                        />
                      </DataListItemRow>
                    </DataListItem>
                  </Draggable>
                );
              })}
            </DataList>
          </Droppable>
          <div className="pf-v5-screen-reader" id={dragDescriptionId}>
            {t(
              // eslint-disable-next-line max-len
              'Press space or enter to begin dragging, and use the arrow keys to navigate up or down. Press enter to confirm the drag, or any other key to cancel the drag operation.'
            )}
          </div>
        </DragDrop>
      </div>
    </Modal>
  );
};

export default OverviewPanelsModal;
