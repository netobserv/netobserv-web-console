import { Divider, MenuToggle, MenuToggleElement, Select, SelectOption } from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { NetflowContext } from '../../model/netflow-context';
import { DraftView, ViewPresetId } from '../../model/views';
import { useOutsideClickEvent } from '../../utils/outside-hook';

// i18n extraction hints for dynamic view labels
// t('All Traffic') t('Packet Drops') t('DNS Latency') t('Flow RTT') t('TLS Tracking') t('UDN Mapping') t('Network Events') t('Packet Translation')
// t('Custom') t('Discard changes')

export interface ViewSelectorProps {
  activeView: ViewPresetId;
  setActiveView: (view: ViewPresetId) => void;
  draftView: DraftView | null;
  onDiscardDraft: () => void;
}

export const ViewSelector: React.FC<ViewSelectorProps> = ({ activeView, setActiveView, draftView, onDiscardDraft }) => {
  const { caps } = React.useContext(NetflowContext);
  const availableViews = caps.availableViews;
  const { t } = useTranslation('plugin__netobserv-plugin');
  const ref = useOutsideClickEvent(() => setOpen(false));
  const [isOpen, setOpen] = React.useState(false);

  const isOnDraftView = draftView !== null && draftView.baseViewId === activeView;

  const onSelect = (_: unknown, value: string | number | undefined) => {
    if (!value) {
      setOpen(false);
      return;
    }
    if (value === '__discard_draft__') {
      onDiscardDraft();
      setOpen(false);
      return;
    }
    if (value !== activeView) {
      setActiveView(value as ViewPresetId);
    }
    setOpen(false);
  };

  const activeLabel = availableViews.find(v => v.id === activeView)?.label ?? 'All Traffic';

  return (
    <div id="view-selector-container" data-test="view-selector-container" ref={ref}>
      <Select
        data-test="view-selector-select"
        id="view-selector-dropdown"
        isOpen={isOpen}
        onSelect={onSelect}
        selected={activeView}
        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle
            ref={toggleRef}
            onClick={() => setOpen(!isOpen)}
            isExpanded={isOpen}
            data-test="view-selector-dropdown"
          >
            {isOnDraftView ? `${t('Custom')} ${t('View')}: ${t(activeLabel)}` : `${t('View')}: ${t(activeLabel)}`}
          </MenuToggle>
        )}
      >
        {availableViews.map(view => (
          <SelectOption
            key={view.id}
            value={view.id}
            isSelected={activeView === view.id}
            id={`view-option-${view.id}`}
            data-test={`view-option-${view.id}`}
          >
            {t(view.label)}
          </SelectOption>
        ))}
        {isOnDraftView && <Divider key="draft-divider" />}
        {isOnDraftView && (
          <SelectOption
            key="discard-draft"
            value="__discard_draft__"
            id="view-option-discard-draft"
            data-test="view-option-discard-draft"
          >
            {t('Discard changes')}
          </SelectOption>
        )}
      </Select>
    </div>
  );
};
