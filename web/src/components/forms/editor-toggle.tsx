import { ActionGroup, Alert, Button, Flex, FlexItem, Radio } from '@patternfly/react-core';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ContextSingleton } from '../../utils/context';
import './forms.css';

export enum EditorType {
  FORM = 'form',
  WIZARD = 'wizard',
  YAML = 'yaml'
}

type EditorToggleProps = {
  type: EditorType;
  onChange: (newValue: EditorType) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onDelete: () => void;
  formChild: JSX.Element;
  wizardChild?: JSX.Element;
  yamlChild: JSX.Element;
  updated: boolean;
  isUpdate: boolean;
  onReload: () => void;
};

export const EditorToggle: FC<EditorToggleProps> = ({
  type,
  onChange,
  onSubmit,
  onCancel,
  onReload,
  onDelete,
  formChild,
  wizardChild,
  yamlChild,
  updated,
  isUpdate
}) => {
  const { t } = useTranslation('plugin__netobserv-plugin');

  return (
    <Flex
      className="editor-toggle-container"
      flex={{ default: 'flex_1' }}
      direction={{ default: 'column' }}
      flexWrap={{ default: 'nowrap' }}
    >
      <FlexItem flex={{ default: 'flexNone' }}>
        <Flex
          className="editor-toggle"
          alignItems={{ default: 'alignItemsCenter' }}
          aria-labelledby="radio-group-title-editor-toggle"
          role="radiogroup"
          spaceItems={{ default: 'spaceItemsMd' }}
        >
          <label className="editor-toggle-label" id="radio-group-title-editor-toggle">
            {t('Configure via:')}
          </label>
          {wizardChild && (
            <Radio
              data-test={`${EditorType.WIZARD}-view-input`}
              id={EditorType.WIZARD}
              isChecked={type === EditorType.WIZARD}
              label={t('Wizard')}
              name={EditorType.WIZARD}
              onChange={(event, checked) => checked && onChange(EditorType.WIZARD)}
              value={EditorType.WIZARD}
            />
          )}
          <Radio
            data-test={`${EditorType.FORM}-view-input`}
            id={EditorType.FORM}
            isChecked={type === EditorType.FORM}
            label={t('Form')}
            name={EditorType.FORM}
            onChange={(event, checked) => checked && onChange(EditorType.FORM)}
            value={EditorType.FORM}
          />
          <Radio
            data-test={`${EditorType.YAML}-view-input`}
            id={EditorType.YAML}
            isChecked={type === EditorType.YAML}
            label={t('YAML')}
            name={EditorType.YAML}
            onChange={(event, checked) => checked && onChange(EditorType.YAML)}
            value={EditorType.YAML}
          />
        </Flex>
      </FlexItem>
      <FlexItem id="editor-content-container" flex={{ default: 'flex_1' }}>
        {type === EditorType.FORM ? formChild : type === EditorType.WIZARD ? wizardChild : yamlChild}
      </FlexItem>
      {type !== EditorType.WIZARD && (type === EditorType.FORM || ContextSingleton.isStandalone()) && (
        <FlexItem id="editor-toggle-footer" style={{ paddingBottom: '30px' }}>
          {updated && (
            <Alert isInline className="co-alert" variant="info" title={t('This object has been updated.')}>
              {t('Click reload to see the new version.')}
            </Alert>
          )}
          <ActionGroup className="pf-v6-c-form">
            <Button
              id={isUpdate ? 'update-resource-button' : 'create-resource-button'}
              data-test-id={isUpdate ? 'update-resource-button' : 'create-resource-button'}
              type="submit"
              onClick={onSubmit}
              variant="primary"
            >
              {isUpdate ? t('Update') : t('Create')}
            </Button>
            {updated && (
              <Button
                id="reload-resource-button"
                data-test-id="reload-resource-button"
                type="submit"
                onClick={onReload}
                variant="secondary"
              >
                {t('Reload')}
              </Button>
            )}
            <Button
              id="cancel-resource-button"
              data-test-id="cancel-resource-button"
              onClick={onCancel}
              variant="secondary"
            >
              {t('Cancel')}
            </Button>
            {isUpdate && (
              <Button
                id="delete-resource-button"
                data-test-id="delete-resource-button"
                type="submit"
                onClick={onDelete}
                variant="danger"
              >
                {t('Delete')}
              </Button>
            )}
          </ActionGroup>
        </FlexItem>
      )}
    </Flex>
  );
};
