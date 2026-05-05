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
import { Config } from '../../model/config';
import { Column, ColumnSizeMap, getDefaultColumns, getFullColumnName } from '../../utils/columns';
import './columns-modal.css';
import Modal, { ensureRootElement } from './modal';

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
  React.useEffect(() => {
    ensureRootElement();
  }, []);

  const [resetClicked, setResetClicked] = React.useState<boolean>(false);
  const [updatedColumns, setUpdatedColumns] = React.useState<Column[]>([]);
  const [filterKeys, setFilterKeys] = React.useState<string[]>([]);
  const { t } = useTranslation('plugin__netobserv-plugin');

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

  const getColumnFilterKeys = React.useCallback(() => {
    return columnFilterKeys.filter(fk => columns.some(c => isFilteredColumn(c, [fk])));
  }, [columns, isFilteredColumn]);

  const filteredColumns = React.useCallback(() => {
    return updatedColumns.filter(c => isFilteredColumn(c, filterKeys));
  }, [filterKeys, isFilteredColumn, updatedColumns]);

  const onDrop = React.useCallback(
    (event: DragDropSortDragEndEvent, items: DraggableObject[], oldIndex?: number, newIndex?: number) => {
      if (oldIndex !== undefined && newIndex !== undefined) {
        const filtered = filteredColumns();
        const draggedItem = filtered[oldIndex];
        const targetItem = filtered[newIndex];
        const result = [...updatedColumns];
        const fullOldIndex = result.findIndex(c => c.id === draggedItem.id);
        const fullNewIndex = result.findIndex(c => c.id === targetItem.id);
        const [removed] = result.splice(fullOldIndex, 1);
        result.splice(fullNewIndex, 0, removed);
        setUpdatedColumns(result);
        return true;
      }
      return false;
    },
    [updatedColumns, setUpdatedColumns, filteredColumns]
  );

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

  const draggableItems: DraggableObject[] = Array.from(
    filteredColumns().map((column, i) => {
      return {
        id: 'data-' + i,
        content: (
          <>
            <DataListControl>
              <DataListCheck
                aria-labelledby={'table-column-management-item-' + i}
                isChecked={column.isSelected}
                id={column.id}
                onChange={onCheck}
              />
            </DataListControl>
            <DataListItemCells
              dataListCells={[
                <DataListCell key={'data-list-cell-' + i} className="center">
                  <label htmlFor={column.id} id={'table-column-management-item-' + i}>
                    {getFullColumnName(column)}
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
      title={t('Manage columns')}
      isOpen={isModalOpen}
      scrollable={true}
      onClose={onClose}
      description={
        <>
          <Content>
            <Content component={ContentVariants.p}>
              {t('Selected columns will appear in the table.')}&nbsp;
              {t('Click and drag the items to reorder the columns in the table.')}
            </Content>
          </Content>
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
                      <Content component={ContentVariants.p}>{key}</Content>
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
        <DragDropSort items={draggableItems} onDrop={onDrop} variant="DataList" overlayProps={{ isCompact: true }}>
          <DataList
            aria-label="Table column management"
            data-test="table-column-management"
            id="table-column-management"
            className="centered-list"
            isCompact
          />
        </DragDropSort>
      </div>
    </Modal>
  );
};

export default ColumnsModal;
