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
import { Config } from '../../model/config';
import { Column, ColumnSizeMap, getDefaultColumns, getFullColumnName } from '../../utils/columns';
import './columns-modal.css';
import Modal from './modal';

const COLUMNS_DRAG_ZONE = 'netobs-columns-modal';

export const columnFilterKeys = ['source', 'destination', 'time', 'host', 'namespace', 'owner', 'ip', 'dns', 'tls'];

export interface ColumnsModalProps {
  isModalOpen: boolean;
  setModalOpen: (v: boolean) => void;
  columns: Column[];
  setColumns: (v: Column[]) => void;
  setColumnSizes: (v: ColumnSizeMap) => void;
  config: Config;
  id?: string;
}

export const ColumnsModal: React.FC<ColumnsModalProps> = ({
  id,
  config,
  isModalOpen,
  setModalOpen,
  columns,
  setColumns,
  setColumnSizes
}) => {
  const [resetClicked, setResetClicked] = React.useState<boolean>(false);
  const [updatedColumns, setUpdatedColumns] = React.useState<Column[]>([]);
  const [filterKeys, setFilterKeys] = React.useState<string[]>([]);
  const { t } = useTranslation('plugin__netobserv-plugin');
  const dragDescriptionId = 'columns-drag-description';

  React.useEffect(() => {
    if (isModalOpen) {
      setFilterKeys([]);
    }
  }, [isModalOpen]);

  React.useEffect(() => {
    if (!isModalOpen || _.isEmpty(updatedColumns)) {
      setUpdatedColumns(_.cloneDeep(columns));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, isModalOpen]);

  const isFilteredColumn = React.useCallback((c: Column, fks: string[]) => {
    return (
      _.isEmpty(fks) ||
      _.reduce(
        fks,
        (acc, fk) =>
          (acc =
            acc &&
            (c.id.toLowerCase().includes(fk) ||
              c.name.toLowerCase().includes(fk) ||
              c.group?.toLowerCase().includes(fk) ||
              false)),
        true
      )
    );
  }, []);

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
      setUpdatedColumns(prev => {
        const filtered = prev.filter(c => isFilteredColumn(c, filterKeys));
        if (oldIndex < 0 || oldIndex >= filtered.length || newIndex < 0 || newIndex >= filtered.length) {
          return prev;
        }
        const reorderedFiltered = [...filtered];
        const [removed] = reorderedFiltered.splice(oldIndex, 1);
        reorderedFiltered.splice(newIndex, 0, removed);
        const next: Column[] = [];
        const fq = [...reorderedFiltered];
        for (const col of prev) {
          if (isFilteredColumn(col, filterKeys)) {
            const shifted = fq.shift();
            if (shifted) {
              next.push(shifted);
            }
          } else {
            next.push(col);
          }
        }
        accepted = true;
        return next;
      });
      return accepted;
    },
    [filterKeys, isFilteredColumn]
  );

  const onCheck = React.useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (event: React.FormEvent<HTMLInputElement>, checked: boolean) => {
      if (event?.target && 'id' in event.target) {
        const columnId = (event.target as HTMLInputElement).id;
        setUpdatedColumns(prevColumns =>
          prevColumns.map(col => (col.id === columnId ? { ...col, isSelected: checked } : col))
        );
      }
    },
    []
  );

  const onReset = React.useCallback(() => {
    setResetClicked(true);
    setUpdatedColumns(
      getDefaultColumns(config.columns, config.fields).filter(c => columns.some(existing => existing.id === c.id))
    );
  }, [columns, config.columns, config.fields]);

  const isSaveDisabled = React.useCallback(() => {
    return _.isEmpty(updatedColumns.filter(c => c.isSelected));
  }, [updatedColumns]);

  const getColumnFilterKeys = React.useCallback(() => {
    return columnFilterKeys.filter(fk => columns.some(c => isFilteredColumn(c, [fk])));
  }, [columns, isFilteredColumn]);

  const filteredColumns = React.useCallback(() => {
    return updatedColumns.filter(c => isFilteredColumn(c, filterKeys));
  }, [filterKeys, isFilteredColumn, updatedColumns]);

  const isAllSelected = React.useCallback(() => {
    return _.reduce(filteredColumns(), (acc, c) => (acc = acc && c.isSelected), true);
  }, [filteredColumns]);

  const onSelectAll = React.useCallback(() => {
    const allSelected = isAllSelected();
    setUpdatedColumns(prevColumns =>
      prevColumns.map(col => (isFilteredColumn(col, filterKeys) ? { ...col, isSelected: !allSelected } : col))
    );
  }, [isAllSelected, isFilteredColumn, filterKeys]);

  const onClose = React.useCallback(() => {
    setResetClicked(false);
    setUpdatedColumns(_.cloneDeep(columns));
    setModalOpen(false);
  }, [columns, setModalOpen]);

  const onSave = React.useCallback(() => {
    if (resetClicked) {
      setColumnSizes({});
    }
    setColumns(updatedColumns);
    onClose();
  }, [resetClicked, setColumns, updatedColumns, onClose, setColumnSizes]);

  const toggleChip = React.useCallback(
    (key: string) => {
      if (filterKeys.includes(key)) {
        setFilterKeys(filterKeys.filter(k => k !== key));
      } else {
        setFilterKeys(columnFilterKeys.filter(f => f === key || filterKeys.includes(f)));
      }
    },
    [filterKeys]
  );

  return (
    <Modal
      id={id}
      title={t('Manage columns')}
      isOpen={isModalOpen}
      scrollable={true}
      onClose={onClose}
      description={
        <>
          <TextContent>
            <Text component={TextVariants.p}>
              {t('Selected columns will appear in the table.')}&nbsp;
              {t('Click and drag the items to reorder the columns in the table.')}
            </Text>
          </TextContent>
          <Flex className="popup-header-margin">
            <FlexItem flex={{ default: 'flex_4' }}>
              <Flex className="flex-gap">
                {getColumnFilterKeys().map(key => {
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
              {_.isEmpty(filteredColumns()) ? (
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
          <Button data-test="columns-reset-button" key="reset" variant="link" onClick={() => onReset()}>
            {t('Restore default columns')}
          </Button>
          <Button data-test="columns-cancel-button" key="cancel" variant="link" onClick={() => onClose()}>
            {t('Cancel')}
          </Button>
          <Tooltip content={t('At least one column must be selected')} trigger="" isVisible={isSaveDisabled()}>
            <Button
              data-test="columns-save-button"
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
      <div className="co-m-form-row" id="drag-drop-container">
        <DragDrop onDrop={onListDrop}>
          <Droppable hasNoWrapper zone={COLUMNS_DRAG_ZONE} droppableId="columns-list">
            <DataList
              aria-label="Table column management"
              data-test="table-column-management"
              id="table-column-management"
              className="centered-list"
              isCompact
            >
              {filteredColumns().map(column => {
                const rowLabelId = `table-column-management-item-${column.id}`;
                return (
                  <Draggable key={column.id} hasNoWrapper>
                    <DataListItem aria-labelledby={rowLabelId} id={`table-column-management-row-${column.id}`}>
                      <DataListItemRow>
                        <DataListControl className="netobserv-data-list-control">
                          <DataListDragButton
                            aria-label={t('Reorder column')}
                            aria-labelledby={rowLabelId}
                            aria-describedby={dragDescriptionId}
                            aria-pressed={false}
                          />
                          <DataListCheck
                            aria-labelledby={rowLabelId}
                            isChecked={column.isSelected}
                            id={column.id}
                            onChange={onCheck}
                            otherControls
                          />
                        </DataListControl>
                        <DataListItemCells
                          dataListCells={[
                            <DataListCell key={`data-list-cell-${column.id}`} className="center">
                              <label htmlFor={column.id} id={rowLabelId}>
                                {getFullColumnName(column)}
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

export default ColumnsModal;
