import { Button, Divider, TextInput } from '@patternfly/react-core';
import { MinusCircleIcon, PlusCircleIcon } from '@patternfly/react-icons';
import { FieldProps, WidgetProps } from '@rjsf/utils';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FieldSet } from '../dynamic-form/fields';

type NodeSelector = Record<string, string>;
type NodeSelectorRow = { key: string; value: string };

type NodeSelectorEditorProps = {
  id: string;
  value?: NodeSelector;
  onChange: (value: NodeSelector) => void;
  disabled?: boolean;
  readonly?: boolean;
};

export const NodeSelectorEditor: React.FC<NodeSelectorEditorProps> = ({
  id,
  value,
  onChange,
  disabled = false,
  readonly = false
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const selector = (value && typeof value === 'object' ? value : {}) as NodeSelector;
  const serializedSelector = JSON.stringify(selector);
  const [rows, setRows] = React.useState<NodeSelectorRow[]>(() =>
    Object.entries(selector).map(([key, entryValue]) => ({ key, value: entryValue }))
  );

  React.useEffect(() => {
    setRows(
      Object.entries(JSON.parse(serializedSelector) as NodeSelector).map(([key, entryValue]) => ({
        key,
        value: entryValue
      }))
    );
  }, [serializedSelector]);

  const commit = (nextRows: NodeSelectorRow[]) => {
    const next: NodeSelector = {};
    nextRows.forEach(row => {
      if (row.key.trim()) next[row.key.trim()] = row.value;
    });
    onChange(next);
  };

  const updateEntry = (index: number, key: string, entryValue: string) => {
    const nextRows = rows.map((row, rowIndex) => (rowIndex === index ? { key, value: entryValue } : row));
    setRows(nextRows);
    commit(nextRows);
  };

  const isReadOnly = disabled || readonly;
  return (
    <div id={id} data-test={id} className="flowcapture-node-selector">
      {rows.map((row, index) => (
        <div className="co-dynamic-form__array-field-group-item" key={`${id}-${index}`}>
          {index > 0 && <Divider className="co-divider" />}
          <div className="row co-dynamic-form__array-field-group-remove">
            <Button
              icon={<MinusCircleIcon className="co-icon-space-r" />}
              type="button"
              variant="link"
              isDisabled={isReadOnly}
              onClick={() => {
                const nextRows = rows.filter((_, rowIndex) => rowIndex !== index);
                setRows(nextRows);
                commit(nextRows);
              }}
            >
              {t('Remove selector')}
            </Button>
          </div>
          <div className="flowcapture-node-selector-row">
            <TextInput
              aria-label={t('Node selector key')}
              placeholder={t('Label key')}
              value={row.key}
              isDisabled={isReadOnly}
              onChange={(_event, next) => updateEntry(index, next, row.value)}
            />
            <TextInput
              aria-label={t('Node selector value')}
              placeholder={t('Label value')}
              value={row.value}
              isDisabled={isReadOnly}
              onChange={(_event, next) => updateEntry(index, row.key, next)}
            />
          </div>
        </div>
      ))}
      <div className="row">
        <Button
          icon={<PlusCircleIcon className="co-icon-space-r" />}
          type="button"
          variant="link"
          isDisabled={isReadOnly}
          onClick={() => setRows(previous => [...previous, { key: '', value: '' }])}
        >
          {t('Add selector')}
        </Button>
      </div>
    </div>
  );
};

/** Kept for compatibility with callers that register this as an RJSF widget. */
export const NodeSelectorWidget: React.FC<WidgetProps> = props => (
  <NodeSelectorEditor
    id={props.id}
    value={props.value as NodeSelector | undefined}
    onChange={value => props.onChange(value, undefined, props.id)}
    disabled={props.disabled}
    readonly={props.readonly}
  />
);

/** Object fields do not invoke object widgets in RJSF; use a custom field instead. */
export const NodeSelectorField: React.FC<FieldProps> = props => (
  <FieldSet
    defaultLabel={props.schema.title}
    formData={props.formData}
    idSchema={props.idSchema}
    required={Boolean(props.required)}
    schema={props.schema}
    uiSchema={props.uiSchema || {}}
  >
    <NodeSelectorEditor
      id={props.idSchema.$id}
      value={props.formData as NodeSelector | undefined}
      onChange={props.onChange}
      disabled={props.disabled}
      readonly={props.readonly}
    />
  </FieldSet>
);

export default NodeSelectorWidget;
