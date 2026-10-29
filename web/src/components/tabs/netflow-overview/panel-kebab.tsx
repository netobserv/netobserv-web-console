import {
  Checkbox,
  Content,
  ContentVariants,
  Divider,
  Dropdown,
  DropdownGroup,
  DropdownItem,
  MenuToggle,
  MenuToggleElement,
  Radio,
  Tooltip
} from '@patternfly/react-core';
import { EllipsisVIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { exportToPng } from '../../../utils/export';
import { useOutsideClickEvent } from '../../../utils/outside-hook';
import { OverviewPanelId } from '../../../utils/overview-panels';
import './panel-kebab.css';

export type GraphOptipn = {
  type: GraphType;
  options?: GraphType[];
};
export type GraphType = 'donut' | 'bar' | 'line' | 'bar_line';

export type PanelKebabOptions = {
  showTop?: boolean;
  showApp?: { text: string; value: boolean };
  showAppDrop?: { text: string; value: boolean };
  showOthers?: boolean;
  showNoError?: boolean;
  showInternal?: boolean;
  showOutOfScope?: boolean;
  showLast?: boolean;
  graph?: GraphOptipn;
};

export interface PanelKebabProps {
  id: OverviewPanelId;
  options?: PanelKebabOptions;
  setOptions?: (opts: PanelKebabOptions) => void;
  isDark?: boolean;
}

export const PanelKebab: React.FC<PanelKebabProps> = ({ id, options, setOptions, isDark }) => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const ref = useOutsideClickEvent(() => setShowOptions(false));
  const [showOptions, setShowOptions] = React.useState(false);

  const setShowTop = React.useCallback(
    (event: React.FormEvent<HTMLInputElement>, checked: boolean) => {
      setOptions!({ ...options, showTop: checked });
    },
    [setOptions, options]
  );

  const setShowApp = React.useCallback(
    (event: React.FormEvent<HTMLInputElement>, checked: boolean) => {
      setOptions!({ ...options, showApp: { ...options!.showApp!, value: checked } });
    },
    [setOptions, options]
  );

  const setShowAppDrop = React.useCallback(
    (event: React.FormEvent<HTMLInputElement>, checked: boolean) => {
      setOptions!({ ...options, showAppDrop: { ...options!.showAppDrop!, value: checked } });
    },
    [setOptions, options]
  );

  const setShowOthers = React.useCallback(
    (event: React.FormEvent<HTMLInputElement>, checked: boolean) => {
      setOptions!({ ...options, showOthers: checked });
    },
    [setOptions, options]
  );

  const setShowNoError = React.useCallback(
    (event: React.FormEvent<HTMLInputElement>, checked: boolean) => {
      setOptions!({ ...options, showNoError: checked });
    },
    [setOptions, options]
  );

  const setShowInternal = React.useCallback(
    (event: React.FormEvent<HTMLInputElement>, checked: boolean) => {
      setOptions!({ ...options, showInternal: checked });
    },
    [setOptions, options]
  );

  const setShowOutOfScope = React.useCallback(
    (event: React.FormEvent<HTMLInputElement>, checked: boolean) => {
      setOptions!({ ...options, showOutOfScope: checked });
    },
    [setOptions, options]
  );

  const setShowLast = React.useCallback(
    (event: React.FormEvent<HTMLInputElement>, checked: boolean) => {
      setOptions!({ ...options, showLast: checked });
    },
    [setOptions, options]
  );

  const setGraph = React.useCallback(
    (type: GraphType) => {
      setOptions!({ ...options, graph: { ...options!.graph!, type } });
    },
    [setOptions, options]
  );

  const onOverviewExport = React.useCallback(() => {
    const overview_flex = document.getElementById(id)?.children[0] as HTMLElement | undefined;
    setShowOptions(false);
    setTimeout(() => {
      exportToPng('overview_panel', overview_flex as HTMLElement, isDark, id);
    }, 100);
  }, [id, isDark]);

  const getGraphTypes = React.useCallback(() => {
    if (!options?.graph || !options.graph.options || !options?.graph?.options?.length) {
      return <></>;
    }

    return (
      <div key={`${id}-graph-type`}>
        <DropdownGroup label={t('Graph type')}>
          {options!.graph!.options.includes('donut') && (
            <DropdownItem>
              {
                <Radio
                  isChecked={!options.graph || options.graph.type === 'donut'}
                  name="graph-donut"
                  onChange={() => setGraph('donut')}
                  label={t('Donut')}
                  id="graph-donut"
                />
              }
            </DropdownItem>
          )}
          {options!.graph!.options.includes('bar') && (
            <DropdownItem>
              <Radio
                isChecked={options.graph.type === 'bar'}
                name="graph-bar"
                onChange={() => setGraph('bar')}
                label={t('Bars')}
                id="graph-bar"
              />
            </DropdownItem>
          )}
          {options!.graph!.options.includes('line') && (
            <DropdownItem>
              <Radio
                isChecked={options.graph.type === 'line'}
                name="graph-line"
                onChange={() => setGraph('line')}
                label={t('Lines')}
                id="graph-line"
              />
            </DropdownItem>
          )}
          {options!.graph!.options.includes('bar_line') && (
            <DropdownItem>
              <Radio
                isChecked={options.graph.type === 'bar_line'}
                name="graph-bar-line"
                onChange={() => setGraph('bar_line')}
                label={t('Bars and lines')}
                id="graph-bar-line"
              />
            </DropdownItem>
          )}
        </DropdownGroup>
        <Divider key="first-divider" component="li" />
      </div>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, options, setGraph]);

  const items = [];
  if (options?.graph?.options?.length) {
    items.push(getGraphTypes());
  }

  if (options?.showInternal !== undefined) {
    items.push(
      <DropdownItem key={`${id}-show-internal`}>
        <Tooltip
          content={
            <Content component={ContentVariants.p}>
              {t(
                // eslint-disable-next-line max-len
                'Show scope-internal traffic, depending on the selected scope (e.g. node-internal traffic, namespace-internal traffic)'
              )}
            </Content>
          }
        >
          <Checkbox
            id={`${id}-show-internal`}
            isChecked={options.showInternal}
            onChange={setShowInternal}
            label={t('Show internal')}
            aria-label="Show internal"
          />
        </Tooltip>
      </DropdownItem>
    );
  }

  if (options?.showOutOfScope !== undefined) {
    items.push(
      <DropdownItem key={`${id}-show-out-of-scope`}>
        <Tooltip
          content={
            <Content component={ContentVariants.p}>
              {t('Show out of scope traffic (e.g. host-network traffic when scope is different from "Node")')}
            </Content>
          }
        >
          <Checkbox
            id={`${id}-show-out-of-scope`}
            isChecked={options.showOutOfScope}
            onChange={setShowOutOfScope}
            label={t('Show out of scope')}
            aria-label="Show out of scope"
          />
        </Tooltip>
      </DropdownItem>
    );
  }

  // graph specific options
  switch (options?.graph?.type) {
    case 'donut':
      if (options?.showOthers !== undefined) {
        items.push(
          <DropdownItem key={`${id}-show-others`}>
            <Tooltip
              content={
                <Content component={ContentVariants.p}>{t('Show other traffic grouped in a separate series')}</Content>
              }
            >
              <Checkbox
                id={`${id}-show-others`}
                isChecked={options.showOthers}
                onChange={setShowOthers}
                label={t('Show others')}
                aria-label="Show others"
              />
            </Tooltip>
          </DropdownItem>
        );
      }

      if (options?.showLast !== undefined) {
        items.push(
          <DropdownItem key={`${id}-last`}>
            <Tooltip
              content={
                <Content component={ContentVariants.p}>{t('Show latest metrics of the selected timerange.')}</Content>
              }
            >
              <Checkbox
                id={`${id}-last`}
                isChecked={options.showLast}
                onChange={setShowLast}
                label={t('Show latest')}
                aria-label="Show latest"
              />
            </Tooltip>
          </DropdownItem>
        );
      }
      break;
    case 'bar':
    case 'line':
    case 'bar_line':
      if (options?.showTop !== undefined) {
        items.push(
          <DropdownItem key={`${id}-show-top`}>
            <Tooltip
              content={
                <Content component={ContentVariants.p}>{t('Show top traffic for the selected filters')}</Content>
              }
            >
              <Checkbox
                id={`${id}-show-top`}
                isChecked={options.showTop}
                onChange={setShowTop}
                label={t('Show top')}
                aria-label="Show top"
              />
            </Tooltip>
          </DropdownItem>
        );
      }

      if (options?.showApp !== undefined) {
        items.push(
          <DropdownItem key={`${id}-show-app`}>
            <Tooltip
              content={<Content component={ContentVariants.p}>{t('Show overall for the selected filters')}</Content>}
            >
              <Checkbox
                id={`${id}-show-app`}
                isChecked={options.showApp.value}
                onChange={setShowApp}
                label={options.showApp.text}
                aria-label="Show overall"
              />
            </Tooltip>
          </DropdownItem>
        );

        if (options?.showAppDrop !== undefined) {
          items.push(
            <DropdownItem key={`${id}-show-app-drop`}>
              <Tooltip
                content={
                  <Content component={ContentVariants.p}>{t('Show overall dropped for the selected filters')}</Content>
                }
              >
                <Checkbox
                  id={`${id}-show-app-drop`}
                  isChecked={options.showAppDrop!.value}
                  onChange={setShowAppDrop}
                  label={options.showAppDrop.text}
                  aria-label="Show overall dropped"
                />
              </Tooltip>
            </DropdownItem>
          );
        }
      }
      break;
  }

  if (options?.showNoError !== undefined) {
    items.push(
      <DropdownItem key={`${id}-show-noerror`}>
        <Tooltip
          content={
            <Content component={ContentVariants.p}>{t('Show NoError responses grouped in a separate series')}</Content>
          }
        >
          <Checkbox
            id={`${id}-show-noerror`}
            isChecked={options.showNoError}
            isDisabled={options.graph?.type !== 'donut' && options.showTop === false}
            onChange={setShowNoError}
            label={t('Show NoError')}
            aria-label="Show NoError"
          />
        </Tooltip>
      </DropdownItem>
    );
  }

  if (items.length > 1) {
    items.push(<Divider key="last-divider" component="li" />);
  }
  items.push(
    <DropdownItem key={`${id}-export`} data-test={`${id}-export`} onClick={onOverviewExport}>
      {t('Save panel as image')}
    </DropdownItem>
  );

  return (
    <div id={`panel-kebab-${id}-container`} ref={ref}>
      <Dropdown
        id={`panel-kebab-${id}`}
        className="panel-kebab"
        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle
            ref={toggleRef}
            aria-label="kebab dropdown toggle"
            variant="plain"
            onClick={() => setShowOptions(!showOptions)}
            isExpanded={showOptions}
          >
            <EllipsisVIcon />
          </MenuToggle>
        )}
        isOpen={showOptions}
        popperProps={{
          position: 'right'
        }}
      >
        {items}
      </Dropdown>
    </div>
  );
};
