import { CodeEditor, Language } from '@patternfly/react-code-editor';
import {
  Checkbox,
  Dropdown,
  DropdownItem,
  Flex,
  FlexItem,
  MenuToggle,
  MenuToggleElement,
  Switch
} from '@patternfly/react-core';
import { getSchemaType, WidgetProps } from '@rjsf/utils';
import classNames from 'classnames';
import * as _ from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../utils/theme-hook';
import { jsonSchemaNumberTypes } from './const';
import { DescriptionField } from './fields';
import { PromQLEditor } from './promql-editor';
import { AtomicFieldTemplate } from './templates';

const getPlaceholder = (uiSchema?: WidgetProps['uiSchema']): string | undefined => {
  const fromUi = uiSchema?.['ui:placeholder'];
  const fromOptions = uiSchema?.['ui:options']?.placeholder;
  const value = fromUi ?? fromOptions;
  return typeof value === 'string' && value !== '' ? value : undefined;
};

export const TextWidget: React.FC<WidgetProps> = props => {
  const {
    disabled = false,
    id,
    onBlur,
    onChange,
    onFocus,
    readonly = false,
    schema = {},
    value = '',
    uiSchema
  } = props;
  const schemaType = getSchemaType(schema);
  return jsonSchemaNumberTypes.includes(String(schemaType)) ? (
    <NumberWidget {...props} />
  ) : (
    <span
      data-test={id}
      className={classNames('pf-v6-c-form-control', {
        'pf-m-disabled': disabled,
        'pf-m-readonly': readonly
      })}
    >
      <input
        disabled={disabled}
        id={id}
        key={id}
        onBlur={onBlur && (event => onBlur(id, event.target.value))}
        onChange={({ currentTarget }) => onChange(currentTarget.value, undefined, id)}
        onFocus={onFocus && (event => onFocus(id, event.target.value))}
        placeholder={getPlaceholder(uiSchema)}
        readOnly={readonly}
        type="text"
        value={value}
      />
    </span>
  );
};

export const NumberWidget: React.FC<WidgetProps> = props => {
  const { value, id, onBlur, onChange, onFocus, uiSchema } = props;
  const numberValue = _.toNumber(value);
  return (
    <span className="pf-v6-c-form-control" data-test={id}>
      <input
        id={id}
        key={id}
        onBlur={onBlur && (event => onBlur(id, event.target.value))}
        onChange={({ currentTarget }) =>
          onChange(currentTarget.value !== '' ? _.toNumber(currentTarget.value) : '', undefined, id)
        }
        onFocus={onFocus && (event => onFocus(id, event.target.value))}
        placeholder={getPlaceholder(uiSchema)}
        type="number"
        value={_.isFinite(numberValue) ? numberValue : ''}
      />
    </span>
  );
};

export const PasswordWidget: React.FC<WidgetProps> = props => {
  const { value = '', id, onBlur, onChange, onFocus } = props;
  return (
    <span className="pf-v6-c-form-control" data-test={id}>
      <input
        key={id}
        id={id}
        type="password"
        onBlur={onBlur && (event => onBlur(id, event.target.value))}
        onChange={({ currentTarget }) => onChange(currentTarget.value, undefined, id)}
        onFocus={onFocus && (event => onFocus(id, event.target.value))}
        value={value}
      />
    </span>
  );
};

export const SwitchWidget: React.FC<WidgetProps> = props => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const { value, id, label, onBlur, onChange, onFocus } = props;
  return (
    <Switch
      data-test={id}
      id={id || label}
      key={id || label}
      isChecked={_.isNil(value) ? false : value}
      onBlur={onBlur && (event => onBlur(id, event.target.value))}
      onChange={(_event, v) => onChange(v, undefined, id)}
      onFocus={onFocus && (event => onFocus(id, event.target.value))}
      label={t('True')}
    />
  );
};

export const SelectWidget: React.FC<WidgetProps> = props => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const { id, label, onBlur, onChange, onFocus, options, schema, value } = props;
  const [isOpen, setIsOpen] = React.useState(false);
  const { enumOptions = [], title } = options;
  return (
    <Dropdown
      data-test={id}
      id={id}
      isOpen={isOpen}
      onBlur={onBlur && (() => onBlur(id, value))}
      onSelect={(e, v) => {
        onChange(v, undefined, id);
        setIsOpen(false);
      }}
      onFocus={onFocus && (() => onFocus(id, value))}
      onOpenChange={(isOpen: boolean) => setIsOpen(isOpen)}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          id={`${id}-toggle`}
          data-test={id}
          ref={toggleRef}
          onClick={() => setIsOpen(!isOpen)}
          isExpanded={isOpen}
        >
          {value || t('Select {{title}}', { title: title || schema?.title || label })}
        </MenuToggle>
      )}
    >
      {enumOptions.map(option => (
        <DropdownItem id={`${id}-${option.value}`} key={option.value} value={option.value}>
          {option.label}
        </DropdownItem>
      ))}
    </Dropdown>
  );
};

export const JSONWidget: React.FC<WidgetProps> = props => {
  const isDarkTheme = useTheme();

  const { disabled = false, id, onBlur, onChange, onFocus, readonly = false, value = '{}' } = props;
  return (
    <span
      data-test={id}
      className={classNames('pf-v6-c-form-control', {
        'pf-m-disabled': disabled,
        'pf-m-readonly': readonly
      })}
    >
      <CodeEditor
        id={id}
        isDarkTheme={isDarkTheme}
        isMinimapVisible={false}
        isLineNumbersVisible={false}
        isLanguageLabelVisible={true}
        isReadOnly={readonly || disabled}
        code={value}
        onBlur={onBlur && (() => onBlur(id, value))}
        onChange={v => onChange(v, undefined, id)}
        onFocus={onFocus && (() => onFocus(id, value))}
        language={Language.json}
        height="75px"
      />
    </span>
  );
};

export const PromQLWidget: React.FC<WidgetProps> = props => {
  const { disabled = false, id, onChange, readonly = false, value = '' } = props;
  return (
    <PromQLEditor
      id={id}
      value={typeof value === 'string' ? value : ''}
      onChange={v => onChange(v, undefined, id)}
      isReadOnly={readonly || disabled}
    />
  );
};

export const ArrayCheckboxesWidget: React.FC<WidgetProps> = props => {
  const { schema, value, id, onBlur, onChange, onFocus } = props;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enums = (schema.items as any).enum || [];
  const errFunc = (value: string) => () => console.error('Function not implemented.', value);

  return (
    // since schema type is 'array' and widget is 'checkboxes', we use AtomicFieldTemplate
    // to render the field and values all at once without the add/remove buttons
    <AtomicFieldTemplate
      onKeyChange={errFunc}
      onDropPropertyClick={errFunc}
      description={<DescriptionField schema={schema} description={schema.description} />}
      {...{
        ...props,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        style: props.style as React.StyleHTMLAttributes<any> | undefined,
        readonly: props.readonly === true,
        disabled: props.disabled === true
      }}
    >
      <Flex
        className="checkboxes-container"
        data-test={id}
        direction={{ default: enums.length > 4 ? 'row' : 'column' }}
        onBlur={() => onBlur(id, value)}
        onFocus={() => onFocus(id, value)}
      >
        {enums.map((option: string, index: number) => (
          <FlexItem key={`${id}-${index}`}>
            <Checkbox
              id={`${id}-${index}`}
              data-test-id={`${id}-${option}`}
              label={option}
              isChecked={_.isNil(value) ? false : value.includes(option)}
              onClick={() =>
                onChange(
                  value.includes(option) ? value.filter((v: string) => v !== option) : [...value, option],
                  undefined,
                  id
                )
              }
            />
          </FlexItem>
        ))}
      </Flex>
    </AtomicFieldTemplate>
  );
};

export default {
  BaseInput: TextWidget,
  CheckboxWidget: SwitchWidget, // force using switch everywhere for consistency
  SwitchWidget,
  NumberWidget,
  PasswordWidget,
  SelectWidget,
  TextWidget,
  int32: NumberWidget,
  int64: NumberWidget,
  map: JSONWidget,
  arrayCheckboxes: ArrayCheckboxesWidget,
  promql: PromQLWidget
};
