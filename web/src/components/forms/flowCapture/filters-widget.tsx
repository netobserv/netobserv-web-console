import { Button, Divider, FormSelect, FormSelectOption, TextInput } from '@patternfly/react-core';
import { MinusCircleIcon, PlusCircleIcon } from '@patternfly/react-icons';
import { FieldProps, WidgetProps } from '@rjsf/utils';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FieldSet } from '../dynamic-form/fields';
import { FlowCaptureFilter } from './types';

const fields: Array<{ key: keyof FlowCaptureFilter; label: string }> = [
  { key: 'ip_cidr', label: 'IP CIDR' },
  { key: 'protocol', label: 'Protocol' },
  { key: 'source_port', label: 'Source port' },
  { key: 'destination_port', label: 'Destination port' },
  { key: 'port', label: 'Port' },
  { key: 'peer_ip', label: 'Peer IP' },
  { key: 'peer_cidr', label: 'Peer CIDR' },
  { key: 'action', label: 'Action' },
  { key: 'tcp_flags', label: 'TCP flags' }
];

const directionalFields = new Set<keyof FlowCaptureFilter>([
  'ip_cidr',
  'source_port',
  'destination_port',
  'port',
  'peer_ip',
  'peer_cidr'
]);

const clearFilterFields = (filter: FlowCaptureFilter): FlowCaptureFilter => {
  const cleared = { ...filter };
  fields.forEach(field => delete cleared[field.key]);
  return cleared;
};

type FlowCaptureFiltersProps = Pick<WidgetProps, 'id' | 'value' | 'onChange' | 'disabled' | 'readonly'>;

const FlowCaptureFiltersEditor: React.FC<FlowCaptureFiltersProps> = ({
  id,
  value,
  onChange,
  disabled = false,
  readonly = false
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const filters = (Array.isArray(value) ? value : []) as FlowCaptureFilter[];
  const isReadOnly = disabled || readonly;
  const selectedField = (filter: FlowCaptureFilter) => fields.find(field => filter[field.key] !== undefined);
  const update = (index: number, patch: Partial<FlowCaptureFilter>) => {
    const next = { ...filters[index], ...patch };
    Object.keys(next).forEach(key => {
      if (next[key as keyof FlowCaptureFilter] === undefined) {
        delete next[key as keyof FlowCaptureFilter];
      }
    });
    onChange(
      filters.map((filter, i) => (i === index ? next : filter)),
      undefined,
      id
    );
  };

  return (
    <div id={id} data-test={id} className="flowcapture-filters">
      {filters.map((filter, index) => {
        const selected = selectedField(filter);
        const selectedValue = selected ? filter[selected.key] : '';
        return (
          <div className="co-dynamic-form__array-field-group-item" key={`${id}-${index}`}>
            {index > 0 && <Divider className="co-divider" />}
            <div className="row co-dynamic-form__array-field-group-remove">
              <Button
                icon={<MinusCircleIcon className="co-icon-space-r" />}
                type="button"
                variant="link"
                isDisabled={isReadOnly}
                onClick={() =>
                  onChange(
                    filters.filter((_, i) => i !== index),
                    undefined,
                    id
                  )
                }
              >
                {t('Remove filter')}
              </Button>
            </div>
            <div className="flowcapture-filter-row">
              <FormSelect
                aria-label={t('Filter field')}
                isDisabled={isReadOnly}
                value={selected?.key || ''}
                onChange={(_event, next) => {
                  const reset = clearFilterFields(filter);
                  update(index, { ...reset, direction: undefined, ...(next ? { [next]: '' } : {}) });
                }}
              >
                <FormSelectOption value="" label={t('Select a field')} />
                {fields.map(field => (
                  <FormSelectOption key={field.key} value={field.key} label={t(field.label)} />
                ))}
              </FormSelect>
              <TextInput
                aria-label={t('Filter value')}
                isDisabled={isReadOnly}
                value={String(selectedValue ?? '')}
                onChange={(_event, next) => {
                  if (selected) {
                    update(index, { [selected.key]: selected.key.includes('port') ? Number(next) : next });
                  }
                }}
              />
              {selected && directionalFields.has(selected.key) ? (
                <FormSelect
                  aria-label={t('Filter direction')}
                  isDisabled={isReadOnly}
                  value={filter.direction || ''}
                  onChange={(_event, next) => update(index, { direction: next || undefined })}
                >
                  <FormSelectOption value="" label={t('Any direction')} />
                  <FormSelectOption value="ingress" label={t('Ingress')} />
                  <FormSelectOption value="egress" label={t('Egress')} />
                </FormSelect>
              ) : (
                <span className="flowcapture-filter-direction-placeholder" aria-hidden="true" />
              )}
            </div>
          </div>
        );
      })}
      <div className="row">
        <Button
          icon={<PlusCircleIcon className="co-icon-space-r" />}
          type="button"
          variant="link"
          isDisabled={isReadOnly}
          onClick={() => onChange([...filters, {}], undefined, id)}
        >
          {t('Add filter')}
        </Button>
      </div>
    </div>
  );
};

export const FlowCaptureFiltersWidget: React.FC<WidgetProps> = props => <FlowCaptureFiltersEditor {...props} />;

export const FlowCaptureFiltersField: React.FC<FieldProps> = props => (
  <FieldSet
    defaultLabel={props.schema.title}
    formData={props.formData}
    idSchema={props.idSchema}
    required={Boolean(props.required)}
    schema={props.schema}
    uiSchema={props.uiSchema || {}}
  >
    <FlowCaptureFiltersEditor
      id={props.idSchema.$id}
      value={props.formData}
      onChange={props.onChange}
      disabled={props.disabled}
      readonly={props.readonly}
    />
  </FieldSet>
);

export default FlowCaptureFiltersWidget;
