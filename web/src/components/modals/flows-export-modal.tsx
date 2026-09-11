import {
  Alert,
  Button,
  Checkbox,
  Content,
  ContentVariants,
  DataList,
  DataListCell,
  DataListCheck,
  DataListControl,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  Form,
  FormGroup,
  Label,
  LabelGroup,
  Radio
} from '@patternfly/react-core';

import _ from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { exportFlows } from '../../api/routes';
import { DEFAULT_FLOWS_EXPORT_FORMAT, ExportApiFormat } from '../../model/export-format';
import { EXPORT_MAX_LIMIT, resolveExportLimit } from '../../model/export-limit';
import { Filter } from '../../model/filters';
import { StructuredFlowQuery } from '../../model/flow-query';
import { Column, getFullColumnName } from '../../utils/columns';
import { getTimeRangeOptions, TimeRange } from '../../utils/datetime';
import { formatDuration, getDateSInMiliseconds } from '../../utils/duration';
import { downloadExportBlob } from '../../utils/export-download';
import { getFilterFullName } from '../../utils/filters-helper';
import { downloadSpreadsheetReport, FlowsExportReport } from '../../utils/flows-export-spreadsheet';
import { getLocalStorage, localStorageExportColsKey, useLocalStorage } from '../../utils/local-storage-hook';
import './flows-export-modal.css';
import Modal from './modal';

export type FlowsExportModalFormat = ExportApiFormat | 'spreadsheet';

export interface FlowsExportModalProps {
  isModalOpen: boolean;
  setModalOpen: (v: boolean) => void;
  range: number | TimeRange;
  flowQuery: StructuredFlowQuery;
  columns: Column[];
  filters: Filter[];
  id?: string;
}

export const FlowsExportModal: React.FC<FlowsExportModalProps> = ({
  id,
  isModalOpen,
  setModalOpen,
  range,
  flowQuery,
  columns,
  filters
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const [format, setFormat] = React.useState<FlowsExportModalFormat>(DEFAULT_FLOWS_EXPORT_FORMAT);
  const [error, setError] = React.useState<string>();
  const [isExporting, setIsExporting] = React.useState(false);
  const [useMaxLimit, setUseMaxLimit] = React.useState(false);
  const canRaiseExportLimit = flowQuery.limit < EXPORT_MAX_LIMIT;
  const [selectedColumns, setSelectedColumns] = useLocalStorage<Column[]>(
    localStorageExportColsKey,
    //select all columns by default
    columns.map(c => ({ ...c, isSelected: true })),
    {
      id: 'id',
      criteria: 'isSelected'
    }
  );
  const [isSaveDisabled, setSaveDisabled] = React.useState<boolean>(true);
  const [isAllSelected, setAllSelected] = React.useState<boolean>(false);
  const [isExportAll, setExportAll] = React.useState<boolean>(
    //show columns details if not all columns are selected
    selectedColumns.filter(c => c.isSelected).length === columns.length
  );
  const options = getTimeRangeOptions(t);

  const getFieldNames = React.useCallback(() => {
    if (isExportAll) {
      return undefined;
    }
    return selectedColumns.filter(c => c.isSelected && c.field != undefined).map(c => c.field!.name) as
      | string[]
      | undefined;
  }, [isExportAll, selectedColumns]);

  const rangeText = React.useCallback(() => {
    if (typeof range == 'number') {
      const selectedKey = formatDuration(getDateSInMiliseconds(range)) as keyof typeof options;
      return options[selectedKey];
    } else {
      return `${t('From')} ${new Date(getDateSInMiliseconds(range.from))} ${t('To')} ${new Date(
        getDateSInMiliseconds(range.to)
      )}`;
    }
  }, [options, range, t]);

  const onExport = React.useCallback(async () => {
    setError(undefined);
    setIsExporting(true);
    try {
      const apiFormat: ExportApiFormat = format === 'spreadsheet' ? 'json' : format;
      const exportQuery: StructuredFlowQuery = {
        ...flowQuery,
        limit: resolveExportLimit(flowQuery.limit, useMaxLimit) ?? flowQuery.limit
      };
      const blob = await exportFlows(exportQuery, { format: apiFormat, columns: getFieldNames() });
      if (format === 'spreadsheet') {
        const report = JSON.parse(await blob.text()) as FlowsExportReport;
        downloadSpreadsheetReport(report);
      } else {
        downloadExportBlob(blob, 'netobserv_flows', format);
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExporting(false);
    }
  }, [flowQuery, format, getFieldNames, setModalOpen, useMaxLimit]);

  const onCheck = React.useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (event: React.FormEvent<HTMLInputElement>, checked: boolean) => {
      if (event?.target && 'id' in event.target) {
        const result = [...selectedColumns];
        const selectedColumn = result.find(col => col.id === (event.target as HTMLInputElement).id);
        if (selectedColumn) {
          selectedColumn.isSelected = !selectedColumn.isSelected;
          setSelectedColumns(result);
        }
      }
    },
    [selectedColumns, setSelectedColumns]
  );

  const onSelectAll = React.useCallback(() => {
    const result = [...selectedColumns];
    _.forEach(result, (col: Column) => {
      col.isSelected = !isAllSelected;
    });
    setSelectedColumns(result);
  }, [selectedColumns, setSelectedColumns, isAllSelected]);

  React.useEffect(() => {
    let allSelected = true;
    _.forEach(selectedColumns, (col: Column) => {
      if (!col.isSelected) {
        allSelected = false;
        return false;
      }
    });
    setAllSelected(allSelected);
  }, [selectedColumns]);

  React.useEffect(() => {
    setSaveDisabled(!isExportAll && _.isEmpty(selectedColumns.filter(col => col.isSelected)));
  }, [isExportAll, selectedColumns]);

  React.useEffect(() => {
    if (!isModalOpen) {
      setFormat(DEFAULT_FLOWS_EXPORT_FORMAT);
      setUseMaxLimit(false);
      setError(undefined);
      setIsExporting(false);
    }
  }, [isModalOpen]);

  React.useEffect(() => {
    // reload selected columns when config is loaded and popup closed
    if (!isModalOpen) {
      setSelectedColumns(
        getLocalStorage(localStorageExportColsKey, _.cloneDeep(columns), {
          id: 'id',
          criteria: 'isSelected'
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen, columns]);

  return (
    <Modal
      id={id}
      title={t('Export')}
      isOpen={isModalOpen}
      scrollable={true}
      onClose={() => setModalOpen(false)}
      description={
        <>
          <Content>
            <Content component={ContentVariants.p}>{t('Following query will be exported.')}&nbsp;</Content>
          </Content>
          <div data-test="export-chips" id="export-chips">
            <LabelGroup isClosable={false} categoryName={t('Time Range')}>
              <Label variant="outline">{rangeText()}</Label>
            </LabelGroup>
            <LabelGroup isClosable={false} categoryName={t('Limit')}>
              <Label variant="outline">{useMaxLimit && canRaiseExportLimit ? EXPORT_MAX_LIMIT : flowQuery.limit}</Label>
            </LabelGroup>
            {filters.map((filter, fIndex) => (
              <LabelGroup key={fIndex} isClosable={false} categoryName={getFilterFullName(filter.def, t)}>
                {filter.values.map((value, fvIndex) => (
                  <Label variant="outline" key={fvIndex}>
                    {value.display ? value.display : value.v}
                  </Label>
                ))}
              </LabelGroup>
            ))}
          </div>
        </>
      }
      footer={
        <>
          <Button data-test="export-close-button" key="close" variant="link" onClick={() => setModalOpen(false)}>
            {t('Close')}
          </Button>
          <Button
            data-test="export-button"
            key="confirm"
            isDisabled={isSaveDisabled || isExporting}
            isLoading={isExporting}
            variant="primary"
            onClick={() => void onExport()}
          >
            {t('Export')}
          </Button>
        </>
      }
    >
      {error && (
        <Alert variant="danger" title={t('Error')} isInline>
          {error}
        </Alert>
      )}
      <Form>
        <FormGroup label={t('Format')} fieldId="flows-export-format">
          <Radio
            id="flows-export-format-csv"
            data-test="flows-export-format-csv"
            name="flows-export-format"
            label={t('CSV')}
            isChecked={format === 'csv'}
            onChange={() => setFormat('csv')}
          />
          <Radio
            id="flows-export-format-json"
            data-test="flows-export-format-json"
            name="flows-export-format"
            label={t('JSON')}
            isChecked={format === 'json'}
            onChange={() => setFormat('json')}
          />
          <Radio
            id="flows-export-format-spreadsheet"
            data-test="flows-export-format-spreadsheet"
            name="flows-export-format"
            label={t('Spreadsheet')}
            isChecked={format === 'spreadsheet'}
            onChange={() => setFormat('spreadsheet')}
          />
        </FormGroup>
        {canRaiseExportLimit && (
          <FormGroup fieldId="flows-export-max-limit">
            <Checkbox
              data-test="flows-export-max-limit"
              id="flows-export-max-limit"
              isChecked={useMaxLimit}
              onChange={(_event, checked) => setUseMaxLimit(checked)}
              label={t('Use maximum limit')}
              description={t(
                'Use maximum limit ({{maxLimit}}) instead of the current limit ({{limit}}). This may take longer.',
                { maxLimit: EXPORT_MAX_LIMIT, limit: flowQuery.limit }
              )}
            />
          </FormGroup>
        )}
        <FormGroup fieldId="export-all">
          <Checkbox
            data-test="export-all"
            id="export-all"
            isChecked={isExportAll}
            onChange={(event, checked) => setExportAll(checked)}
            label={t('Export all data')}
            aria-label={t('Export all data')}
            description={
              <Content className="netobserv-no-child-margin">
                <Content component={ContentVariants.p}>
                  {t('Use this option to export every field and label from flows.')}
                </Content>
                <Content component={ContentVariants.p}>{t('Else pick from available columns.')}</Content>
              </Content>
            }
            body={
              !isExportAll && (
                <>
                  <Button data-test="flows-export-select-all" isInline onClick={onSelectAll} variant="link">
                    {isAllSelected ? t('Unselect all') : t('Select all')}
                  </Button>
                  <DataList aria-label="Exported fields" id="exported-fields" className="centered-list" isCompact>
                    {' '}
                    {selectedColumns.map((column, i) => (
                      <DataListItem
                        key={'data-list-item-' + i}
                        aria-labelledby={`${column.id}-name`}
                        className="data-list-item"
                        data-test={'data-' + i}
                        id={'data-' + i}
                      >
                        <DataListItemRow key={'data-list-item-row-' + i}>
                          <DataListControl>
                            <DataListCheck
                              aria-labelledby={`${column.id}-name`}
                              checked={column.isSelected}
                              data-test={column.id}
                              id={column.id}
                              onChange={onCheck}
                            />
                          </DataListControl>
                          <DataListItemCells
                            dataListCells={[
                              <DataListCell key={'data-list-cell-' + i} className="center">
                                <label htmlFor={column.id} id={`${column.id}-name`}>
                                  {getFullColumnName(column)}
                                </label>
                              </DataListCell>
                            ]}
                          />
                        </DataListItemRow>
                      </DataListItem>
                    ))}
                  </DataList>
                </>
              )
            }
          />
        </FormGroup>
      </Form>
    </Modal>
  );
};

export default FlowsExportModal;
