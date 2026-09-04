import {
  Alert,
  Button,
  Checkbox,
  Content,
  ContentVariants,
  Form,
  FormGroup,
  Label,
  LabelGroup,
  Radio
} from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { NetflowMetrics } from '../../api/query-response';
import { exportMetricsReport } from '../../api/routes';
import { DEFAULT_METRICS_EXPORT_FORMAT, ExportApiFormat } from '../../model/export-format';
import { EXPORT_MAX_LIMIT } from '../../model/export-limit';
import { Filter } from '../../model/filters';
import { FlowScope, StructuredFlowQuery } from '../../model/flow-query';
import { buildMetricsExportRequest, hasExportableMetrics } from '../../model/metrics-export-query';
import { TimeRange, getTimeRangeOptions } from '../../utils/datetime';
import { formatDuration, getDateSInMiliseconds } from '../../utils/duration';
import { downloadExportBlob, metricsExportFilenamePrefix } from '../../utils/export-download';
import { getFilterFullName } from '../../utils/filters-helper';
import { MetricsExportReport, downloadSpreadsheetReport } from '../../utils/metrics-export-spreadsheet';
import Modal from './modal';

export type MetricsExportModalFormat = ExportApiFormat | 'spreadsheet';

export interface MetricsExportModalProps {
  id?: string;
  isModalOpen: boolean;
  setModalOpen: (v: boolean) => void;
  /** Topology edge aggregates only apply when exporting from the topology tab. */
  allowTopologyEdges?: boolean;
  metrics: NetflowMetrics;
  range: number | TimeRange;
  metricScope: FlowScope;
  flowQuery: StructuredFlowQuery;
  filters: Filter[];
}

export const MetricsExportModal: React.FC<MetricsExportModalProps> = ({
  id,
  isModalOpen,
  setModalOpen,
  allowTopologyEdges = false,
  metrics,
  range,
  metricScope,
  flowQuery,
  filters
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const [format, setFormat] = React.useState<MetricsExportModalFormat>(DEFAULT_METRICS_EXPORT_FORMAT);
  const [exportAllSeries, setExportAllSeries] = React.useState(false);
  const [includeTopologyEdges, setIncludeTopologyEdges] = React.useState(true);
  const canRaiseExportLimit = flowQuery.limit < EXPORT_MAX_LIMIT;
  const [error, setError] = React.useState<string>();
  const [isExporting, setIsExporting] = React.useState(false);
  const options = getTimeRangeOptions(t);

  const rangeText = React.useCallback(() => {
    if (typeof range === 'number') {
      const selectedKey = formatDuration(getDateSInMiliseconds(range)) as keyof typeof options;
      return options[selectedKey];
    }
    return `${t('From')} ${new Date(getDateSInMiliseconds(range.from))} ${t('To')} ${new Date(
      getDateSInMiliseconds(range.to)
    )}`;
  }, [options, range, t]);

  const canExport = hasExportableMetrics(metrics);
  // Topology edge aggregates only make sense on the topology tab. Overview already
  // exports the displayed panel time series (including peer kind/name on top-k charts).
  const topologyEdgesSupported = allowTopologyEdges && format === 'spreadsheet';

  const onExport = React.useCallback(async () => {
    setError(undefined);
    setIsExporting(true);
    try {
      const apiFormat: ExportApiFormat = format === 'spreadsheet' ? 'json' : format;
      const request = buildMetricsExportRequest(metrics, flowQuery, range, metricScope, {
        format: apiFormat,
        includeTopologyEdges: topologyEdgesSupported && includeTopologyEdges,
        exportAllSeries
      });
      const blob = await exportMetricsReport(request);
      const filenamePrefix = metricsExportFilenamePrefix(metricScope);
      if (format === 'spreadsheet') {
        const report = JSON.parse(await blob.text()) as MetricsExportReport;
        downloadSpreadsheetReport(report, metricsExportFilenamePrefix(report.metricScope ?? metricScope));
      } else {
        downloadExportBlob(blob, filenamePrefix, format);
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExporting(false);
    }
  }, [
    exportAllSeries,
    format,
    flowQuery,
    includeTopologyEdges,
    metricScope,
    metrics,
    range,
    setModalOpen,
    topologyEdgesSupported
  ]);

  React.useEffect(() => {
    if (!isModalOpen) {
      setFormat(DEFAULT_METRICS_EXPORT_FORMAT);
      setExportAllSeries(false);
      setIncludeTopologyEdges(true);
      setError(undefined);
      setIsExporting(false);
    }
  }, [isModalOpen]);

  return (
    <Modal
      id={id}
      title={t('Export metrics report')}
      isOpen={isModalOpen}
      scrollable={true}
      onClose={() => setModalOpen(false)}
      description={
        <>
          <Content>
            <Content component={ContentVariants.p}>
              {topologyEdgesSupported && includeTopologyEdges
                ? t('Metrics time series and topology edges will be exported.')
                : t('Metrics time series will be exported.')}
            </Content>
          </Content>
          <div data-test="metrics-export-chips" id="metrics-export-chips">
            <LabelGroup isClosable={false} categoryName={t('Time Range')}>
              <Label variant="outline">{rangeText()}</Label>
            </LabelGroup>
            <LabelGroup isClosable={false} categoryName={t('Limit')}>
              <Label variant="outline">
                {exportAllSeries && canRaiseExportLimit ? EXPORT_MAX_LIMIT : flowQuery.limit}
              </Label>
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
          <Button
            data-test="metrics-export-close-button"
            key="close"
            variant="link"
            onClick={() => setModalOpen(false)}
          >
            {t('Close')}
          </Button>
          <Button
            data-test="metrics-export-button"
            key="confirm"
            isDisabled={!canExport || isExporting}
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
      {!canExport && <Content component={ContentVariants.p}>{t('No metrics data available to export.')}</Content>}
      <Form>
        <FormGroup
          label={t('Format')}
          fieldId="metrics-export-format"
          role="radiogroup"
          aria-labelledby="metrics-export-format"
        >
          <Radio
            id="metrics-export-format-csv"
            data-test="metrics-export-format-csv"
            name="metrics-export-format"
            label={t('CSV')}
            isChecked={format === 'csv'}
            onChange={() => setFormat('csv')}
          />
          <Radio
            id="metrics-export-format-json"
            data-test="metrics-export-format-json"
            name="metrics-export-format"
            label={t('JSON')}
            isChecked={format === 'json'}
            onChange={() => setFormat('json')}
          />
          <Radio
            id="metrics-export-format-spreadsheet"
            data-test="metrics-export-format-spreadsheet"
            name="metrics-export-format"
            label={t('Spreadsheet')}
            isChecked={format === 'spreadsheet'}
            onChange={() => setFormat('spreadsheet')}
          />
        </FormGroup>
        {canRaiseExportLimit && (
          <FormGroup fieldId="metrics-export-all-series">
            <Checkbox
              data-test="metrics-export-all-series"
              id="metrics-export-all-series"
              isChecked={exportAllSeries}
              onChange={(_event, checked) => setExportAllSeries(checked)}
              label={t('Use maximum limit')}
              description={t(
                'Use maximum limit ({{maxLimit}}) instead of the current limit ({{limit}}). This may take longer.',
                { maxLimit: EXPORT_MAX_LIMIT, limit: flowQuery.limit }
              )}
            />
          </FormGroup>
        )}
        {allowTopologyEdges && (
          <FormGroup fieldId="metrics-export-topology-edges">
            <Checkbox
              data-test="metrics-export-topology-edges"
              id="metrics-export-topology-edges"
              isDisabled={!topologyEdgesSupported}
              isChecked={topologyEdgesSupported && includeTopologyEdges}
              onChange={(_event, checked) => setIncludeTopologyEdges(checked)}
              label={t('Include topology edge list')}
              description={
                topologyEdgesSupported
                  ? t('Adds a Topology edges tab with aggregate stats per flow edge.')
                  : t('Topology edge list is only available when exporting as spreadsheet.')
              }
            />
          </FormGroup>
        )}
      </Form>
    </Modal>
  );
};

export default MetricsExportModal;
