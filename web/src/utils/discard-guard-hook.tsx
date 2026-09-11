import { Button } from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../components/modals/modal';

export type DiscardGuard = {
  isDirty: boolean;
  setIsDirty: React.Dispatch<React.SetStateAction<boolean>>;
  markDirty: () => void;
  clearDirty: () => void;
  requestClose: (navigateAway: () => void) => void;
};

/**
 * Tracks unsaved-changes state and prompts the user before navigating away.
 * Returns a guard object and a `<DiscardChangesModal>` element to render.
 */
export const useDiscardGuard = (): [DiscardGuard, React.ReactElement] => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const [isDirty, setIsDirty] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const pendingAction = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    if (!isDirty) {
      return;
    }
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const markDirty = React.useCallback(() => setIsDirty(true), []);
  const clearDirty = React.useCallback(() => setIsDirty(false), []);

  const requestClose = React.useCallback(
    (navigateAway: () => void) => {
      if (isDirty) {
        pendingAction.current = navigateAway;
        setConfirmOpen(true);
      } else {
        navigateAway();
      }
    },
    [isDirty]
  );

  const onDiscard = React.useCallback(() => {
    setIsDirty(false);
    setConfirmOpen(false);
    pendingAction.current?.();
    pendingAction.current = null;
  }, []);

  const onStay = React.useCallback(() => {
    setConfirmOpen(false);
    pendingAction.current = null;
  }, []);

  const modal = (
    <Modal
      id="discard-changes-modal"
      title={t('Discard unsaved changes?')}
      isOpen={confirmOpen}
      scrollable={false}
      onClose={onStay}
      footer={
        <div className="footer">
          <Button key="stay" variant="link" onClick={onStay}>
            {t('Continue editing')}
          </Button>
          <Button key="discard" variant="primary" data-test="discard-changes-confirm" onClick={onDiscard}>
            {t('Discard changes')}
          </Button>
        </div>
      }
    >
      <p>{t('You have unsaved changes that will be lost if you leave this page.')}</p>
    </Modal>
  );

  const guard: DiscardGuard = { isDirty, setIsDirty, markDirty, clearDirty, requestClose };
  return [guard, modal];
};
