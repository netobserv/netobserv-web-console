import {
  AccordionContent,
  AccordionItem,
  AccordionToggle,
  Button,
  Flex,
  FlexItem,
  Popover
} from '@patternfly/react-core';
import { FieldProps, getUiOptions, UiSchema } from '@rjsf/utils';
import classnames from 'classnames';
import { JSONSchema7 } from 'json-schema';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ContextSingleton } from '../../../utils/context';
import { useTheme } from '../../../utils/theme-hook';
import { UiSchemaOptionsWithDependency } from './types';
import { useSchemaDescription, useSchemaLabel } from './utils';

/** Token resolved at render time so FlowCollector form can deep-link without circular imports. */
export const HEALTH_RULE_WIZARD_HREF_TOKEN = '__health_rule_wizard__';

const resolveExternalHref = (href: string): string => {
  if (href === HEALTH_RULE_WIZARD_HREF_TOKEN) {
    return ContextSingleton.isStandalone() ? '/console-health-rule-wizard' : '/network-health/rules/setup';
  }
  return href;
};

export const Description: React.FC<{
  id?: string;
  label?: string;
  description?: string;
  border?: boolean;
  padding?: boolean;
  externalLink?: { href: string; text: string };
}> = ({ id, label, description, border, padding, externalLink }) => {
  const isDarkTheme = useTheme();
  const { t } = useTranslation('plugin__netobserv-plugin');

  const formatText = React.useCallback((rawText: string) => {
    const tokenized = rawText.replaceAll(/(`[a-zA-Z0-9_.]+`)/g, '@@@$1@@@');
    const tokens = tokenized.split('@@@');
    return tokens.map(t => {
      if (t === '') {
        return null;
      }
      if (t.startsWith('`') && t.endsWith('`') && t.length > 2) {
        // eslint-disable-next-line react/jsx-key
        return <pre className="backticks">{t.substring(1, t.length - 1)}</pre>;
      }
      return t;
    });
  }, []);

  if (!description && !externalLink) {
    return null;
  }

  const desc = (description || '').replaceAll('<br>', '');
  const parts = desc ? desc.split('\n') : [];
  let content = desc ? <>{formatText(desc)}</> : null;
  if (parts.length > 1) {
    content = (
      <Popover
        hasAutoWidth
        maxWidth="50%"
        position="top"
        headerContent={label}
        bodyContent={<div className={`co-pre-line description`}>{content}</div>}
      >
        <Button
          icon={
            <>
              {formatText(parts[0])} {t('(see more...)')}
            </>
          }
          className={`co-pre-line description`}
          variant="plain"
          style={{ paddingLeft: 0 }}
        />
      </Popover>
    );
  }

  return (
    <span id={id} className="help-block">
      <div
        className={`co-pre-line description ${border ? 'border' : ''} ${padding ? 'padding' : ''} ${
          isDarkTheme ? 'dark' : 'light'
        }`}
      >
        {content}
        {externalLink?.href && externalLink?.text && (
          <>
            {content ? ' ' : null}
            <Button
              component="a"
              href={resolveExternalHref(externalLink.href)}
              target="_blank"
              rel="noopener noreferrer"
              variant="link"
              isInline
              data-test="health-rules-wizard-external-link"
            >
              {externalLink.text}
            </Button>
          </>
        )}
      </div>
    </span>
  );
};

export type DescriptionFieldProps = Pick<FieldProps, 'id' | 'description' | 'schema' | 'uiSchema'> & {
  defaultLabel?: string;
};

export const DescriptionField: React.FC<DescriptionFieldProps> = ({
  id,
  description,
  defaultLabel,
  schema,
  uiSchema
}) => {
  const [, label] = useSchemaLabel(schema, uiSchema || {}, defaultLabel);
  const resolved = useSchemaDescription(schema, uiSchema || {}, description);
  const options = getUiOptions(uiSchema || {}) as UiSchemaOptionsWithDependency & {
    externalLink?: { href: string; text: string };
  };
  return <Description id={id} label={label} description={resolved} externalLink={options.externalLink} />;
};

export type FormFieldProps = {
  children?: React.ReactNode;
  id: string;
  defaultLabel?: string;
  required: boolean;
  schema: JSONSchema7;
  uiSchema: UiSchema;
};

export const FormField: React.FC<FormFieldProps> = ({ children, id, defaultLabel, required, schema, uiSchema }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const [showLabel, label] = useSchemaLabel(schema, uiSchema, defaultLabel || t('Value'));

  return (
    <div id={`${id}_field`} className="form-group spaced">
      {showLabel && label ? (
        <Flex direction={{ default: 'row' }}>
          <FlexItem flex={{ default: 'flex_1' }}>
            <label className={classnames('form-label', { 'co-required': required })} htmlFor={id}>
              {label}
            </label>
          </FlexItem>
          <FlexItem flex={{ default: 'flex_4' }}>{children}</FlexItem>
        </Flex>
      ) : (
        children
      )}
    </div>
  );
};

export type FieldSetProps = Pick<FieldProps, 'idSchema' | 'required' | 'schema' | 'uiSchema'> & {
  children?: React.ReactNode;
  defaultLabel?: string;
  /** Takes priority over schema/uiSchema title (e.g. array items with data-derived names). */
  labelOverride?: string;
  /** When true, the schema description block under the accordion title is omitted (e.g. full text only in a tooltip). */
  suppressDescription?: boolean;
};

export const FieldSet: React.FC<FieldSetProps> = props => {
  const {
    children,
    defaultLabel,
    labelOverride,
    idSchema,
    required = false,
    schema,
    suppressDescription,
    uiSchema
  } = props;
  const { defaultExpanded } = getUiOptions(uiSchema ?? {}) as UiSchemaOptionsWithDependency;
  const [expanded, setExpanded] = React.useState(idSchema['$id'] === 'root' || Boolean(defaultExpanded));
  const [showLabel, schemaLabel] = useSchemaLabel(schema, uiSchema || {}, defaultLabel);
  const label = labelOverride || schemaLabel;
  const schemaDescription = useSchemaDescription(schema, uiSchema || {});
  const description = suppressDescription ? '' : schemaDescription;
  return showLabel && label ? (
    <div id={`${idSchema.$id}_field-group`} className="form-group co-dynamic-form__field-group">
      <AccordionItem isExpanded={expanded}>
        <AccordionToggle
          id={`${idSchema.$id}_accordion-toggle`}
          data-test={`${idSchema.$id}_accordion-toggle`}
          onClick={() => setExpanded(!expanded)}
        >
          <span className={classnames({ 'co-required': required })}>{label}</span>
        </AccordionToggle>
        {description && (
          <Description
            id={`${idSchema.$id}_description`}
            label={label}
            description={description}
            border={expanded}
            padding={true}
          />
        )}
        <AccordionContent id={`${idSchema.$id}_accordion-content`} data-test={`${idSchema.$id}_accordion-content`}>
          {children}
        </AccordionContent>
      </AccordionItem>
    </div>
  ) : (
    <>{children}</>
  );
};

// no default fields as these are imported from templates
export default {};
