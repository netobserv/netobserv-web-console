import { Switch } from '@patternfly/react-core';
import { FieldProps, RJSFSchema, UiSchema } from '@rjsf/utils';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FieldSet, FormField } from '../dynamic-form/fields';

type TLSPlaintextData = Record<string, unknown>;
const tlsPlaintextDefaults: TLSPlaintextData = { minBytes: 0, previewBytes: 256 };

/**
 * TLS plaintext is an optional object in the API: its presence enables the
 * feature. This field adds an explicit form-only checkbox for that API shape.
 */
export const TLSPlaintextField: React.FC<FieldProps> = props => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const userChanged = React.useRef(false);
  const data = React.useMemo(
    () => (props.formData && typeof props.formData === 'object' ? props.formData : {}) as TLSPlaintextData,
    [props.formData]
  );
  const displayData = React.useMemo(() => ({ ...tlsPlaintextDefaults, ...data }), [data]);
  const rootFormData = props.registry.formContext?.formData as { spec?: Record<string, unknown> } | undefined;
  const enabled = rootFormData?.spec?.tlsPlaintext !== undefined;
  const hasMissingDefaults = data.minBytes === undefined || data.previewBytes === undefined;

  // Packet captures enable TLS plaintext by default. RJSF does not populate
  // optional object fields when their dependency becomes visible, so seed the
  // API object here. Keep an explicit user disable intact across re-renders.
  React.useEffect(() => {
    if (rootFormData?.spec?.outputType === 'packets' && enabled && hasMissingDefaults && !userChanged.current) {
      props.onChange(displayData);
    }
  }, [displayData, enabled, hasMissingDefaults, props, rootFormData?.spec?.outputType]);

  const properties = (props.schema.properties || {}) as Record<string, RJSFSchema>;
  const childUISchema = (props.uiSchema || {}) as Record<string, UiSchema>;
  const SchemaField = props.registry.fields.SchemaField;
  const childIdSchemas = props.idSchema as unknown as Record<string, { $id: string }>;

  return (
    <FieldSet
      defaultLabel={props.schema.title}
      defaultExpanded={true}
      formData={props.formData}
      idSchema={props.idSchema}
      required={Boolean(props.required)}
      schema={props.schema}
      uiSchema={props.uiSchema || {}}
    >
      <FormField
        id={`${props.idSchema.$id}-enabled`}
        defaultLabel={t('Enable TLS plaintext capture')}
        required={false}
        schema={{ type: 'boolean', title: t('Enable TLS plaintext capture') }}
        uiSchema={{}}
      >
        <Switch
          id={`${props.idSchema.$id}-enabled`}
          isChecked={enabled}
          isDisabled={props.disabled || props.readonly}
          label={t('True')}
          onChange={(_event, checked) => {
            userChanged.current = true;
            props.onChange(checked ? displayData : undefined);
          }}
        />
      </FormField>
      {enabled && (
        <div className="co-dynamic-form__field-group-content">
          {Object.entries(properties).map(([name, schema]) => (
            <SchemaField
              {...props}
              key={name}
              id={`${props.idSchema.$id}_${name}`}
              formData={displayData[name]}
              idSchema={childIdSchemas[name] || { $id: `${props.idSchema.$id}_${name}` }}
              name={name}
              onChange={value => props.onChange({ ...displayData, [name]: value })}
              registry={props.registry}
              schema={schema}
              uiSchema={childUISchema[name] || {}}
            />
          ))}
        </div>
      )}
    </FieldSet>
  );
};

export default TLSPlaintextField;
