import { Alert, Button, Divider, FormHelperText } from '@patternfly/react-core';
import { MinusCircleIcon } from '@patternfly/react-icons/dist/esm/icons/minus-circle-icon';
import { PlusCircleIcon } from '@patternfly/react-icons/dist/esm/icons/plus-circle-icon';
import {
  ArrayFieldTemplateProps,
  DescriptionFieldProps,
  FieldTemplateProps,
  getSchemaType,
  getUiOptions,
  ObjectFieldTemplateProps
} from '@rjsf/utils';
import * as _ from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { MaybeTooltip } from '../../tooltip/maybe-tooltip';
import { jsonSchemaGroupTypes } from './const';
import { DescriptionField, FieldSet, FormField } from './fields';
import { UiSchemaOptionsWithDependency } from './types';
import { isDependencyControlUnset, useSchemaLabel } from './utils';

export const AtomicFieldTemplate: React.FC<FieldTemplateProps> = ({
  children,
  id,
  label,
  rawErrors,
  description,
  required,
  schema,
  uiSchema
}) => {
  // put description before or after children based on widget type
  const descriptionFirst = uiSchema?.['ui:descriptionFirst'] === 'true';
  return (
    <FormField id={id} defaultLabel={label} required={required || false} schema={schema} uiSchema={uiSchema || {}}>
      {descriptionFirst && description}
      {children}
      {!descriptionFirst && description}
      {!_.isEmpty(rawErrors) && (
        <>
          {_.map(rawErrors, error => (
            <FormHelperText key={error}>{_.capitalize(error)}</FormHelperText>
          ))}
        </>
      )}
    </FormField>
  );
};

export const DescriptionFieldTemplate: React.FC<DescriptionFieldProps> = props => {
  return <DescriptionField {...props} />;
};

export const FieldTemplate: React.FC<FieldTemplateProps> = props => {
  const { id, hidden, schema = {}, children, uiSchema = {}, formContext = {} } = props;
  const type = getSchemaType(schema);
  const [dependencyMet, setDependencyMet] = React.useState(true);
  React.useEffect(() => {
    const { dependency } = getUiOptions(uiSchema ?? {}) as UiSchemaOptionsWithDependency; // Type defs for this function are awful
    if (dependency) {
      setDependencyMet(() => {
        if (dependency.matchMode === 'controlUnset') {
          const spec = _.get(formContext.formData ?? {}, ['spec'], {});
          return isDependencyControlUnset(spec, dependency.controlFieldPath);
        }

        let val = _.get(formContext.formData ?? {}, ['spec'], '');
        dependency.controlFieldPath.forEach(path => {
          val = _.get(val, [path], '');
          if (Array.isArray(val)) {
            // retreive id from path
            // example root_spec_exporters_4_ipfix will return 4
            val = val[Number(id.replace(/\D/g, ''))];
          }
        });

        return dependency?.controlFieldValue === String(val);
      });
    }
  }, [uiSchema, formContext, id]);

  if (hidden) {
    return null;
  }

  const { dependency } = getUiOptions(uiSchema ?? {}) as UiSchemaOptionsWithDependency;
  const disableBecauseControlUnset = dependency?.matchMode === 'controlUnset' && String(type) === 'array';

  if (dependency && !dependencyMet && !disableBecauseControlUnset) {
    return null;
  }

  const isGroup = jsonSchemaGroupTypes.includes(String(type));
  const inner = isGroup ? children : <AtomicFieldTemplate {...props} />;

  return <>{inner}</>;
};

export const ObjectFieldTemplate: React.FC<ObjectFieldTemplateProps> = props => {
  const { idSchema, formData, properties, required, schema, title, uiSchema } = props;
  const { flat } = getUiOptions(uiSchema ?? {});
  if (flat === 'true') {
    return <>{_.map(properties || [], p => p.content)}</>;
  }

  let labelOverride: string | undefined;
  if (title && formData && typeof formData === 'object') {
    const identifier = formData.name || formData.groupBy || formData.alert || formData.record;
    if (identifier && typeof identifier === 'string' && identifier.trim()) {
      labelOverride = `${title}: ${identifier}`;
    }
  }

  return (
    <FieldSet
      defaultLabel={title}
      labelOverride={labelOverride}
      idSchema={idSchema}
      required={required}
      schema={schema}
      uiSchema={uiSchema}
    >
      <div className="co-dynamic-form__field-group-content">
        {properties?.length > 0 && _.map(properties, p => p.content)}
      </div>
    </FieldSet>
  );
};

/** Extract a short identifier from an array item's form data. */
const itemIdentifier = (item: unknown): string | undefined => {
  if (!item || typeof item !== 'object') {
    return undefined;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = item as any;
  const id = obj.name || obj.groupBy || obj.alert || obj.record;
  return typeof id === 'string' && id.trim() ? id.trim() : undefined;
};

export const ArrayFieldTemplate: React.FC<ArrayFieldTemplateProps> = ({
  idSchema,
  items,
  formData,
  onAddClick,
  required,
  schema,
  title,
  uiSchema,
  formContext
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const [, label] = useSchemaLabel(schema, uiSchema || {}, title ?? 'Items');
  const { addDisabledTooltip, dependency } = getUiOptions(uiSchema ?? {}) as UiSchemaOptionsWithDependency;

  const arrayLabelOverride = React.useMemo(() => {
    if (!Array.isArray(formData) || formData.length === 0) {
      return undefined;
    }
    const names = formData.map(itemIdentifier).filter(Boolean);
    return names.length > 0 ? `${label}: ${names.join(', ')}` : undefined;
  }, [formData, label]);
  const spec = _.get(formContext?.formData, 'spec');
  const pauseArrayEdit =
    dependency?.matchMode === 'controlUnset' &&
    Boolean(dependency.controlFieldPath?.length) &&
    !isDependencyControlUnset(spec, dependency.controlFieldPath);
  const addDisabledTooltipContent = pauseArrayEdit && addDisabledTooltip ? addDisabledTooltip : undefined;
  const itemsBlock = (
    <>
      {_.map(items ?? [], item => {
        return (
          <div className="co-dynamic-form__array-field-group-item" key={item.key}>
            {item.index > 0 && <Divider className="co-divider" />}
            {item.hasRemove && (
              <div className="row co-dynamic-form__array-field-group-remove">
                <Button
                  icon={<MinusCircleIcon className="co-icon-space-r" />}
                  id={`${item.key}_remove-btn`}
                  data-test-id={`${item.key}_remove-btn`}
                  type="button"
                  onClick={item.onDropIndexClick(item.index)}
                  variant="link"
                >
                  {t('Remove {{singularLabel}}', { singularLabel: label })}
                </Button>
              </div>
            )}
            {item.children}
          </div>
        );
      })}
    </>
  );
  return (
    <FieldSet
      defaultLabel={label}
      labelOverride={arrayLabelOverride}
      idSchema={idSchema}
      required={required}
      schema={schema}
      suppressDescription={pauseArrayEdit}
      uiSchema={uiSchema}
    >
      {pauseArrayEdit ? (
        <fieldset disabled style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
          {itemsBlock}
        </fieldset>
      ) : (
        itemsBlock
      )}
      <div className="row">
        <MaybeTooltip content={addDisabledTooltipContent}>
          <span style={{ display: 'inline-block' }}>
            <Button
              icon={<PlusCircleIcon className="co-icon-space-r" />}
              id={`${idSchema.$id}_add-btn`}
              data-test-id={`${idSchema.$id}_add-btn`}
              type="button"
              isDisabled={pauseArrayEdit}
              onClick={onAddClick}
              variant="link"
            >
              {t('Add {{singularLabel}}', { singularLabel: label })}
            </Button>
          </span>
        </MaybeTooltip>
      </div>
    </FieldSet>
  );
};

export const ErrorTemplate: React.FC<{ errors: string[] }> = ({ errors }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  return (
    <Alert
      isInline
      className="co-alert co-break-word co-alert--scrollable"
      variant="danger"
      title={t('Error')}
      data-test-id="dynamic-form-validation-errors"
    >
      {t('Fix the following errors:')}
      <ul>
        {_.map(errors, error => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </Alert>
  );
};

export default {
  FieldTemplate,
  DescriptionFieldTemplate,
  ArrayFieldTemplate,
  ObjectFieldTemplate
};
