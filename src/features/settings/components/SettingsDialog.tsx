/**
 * SettingsDialog.tsx — `<dialog>` shell for settings popup.
 *
 * React island (client:load). Always single-column layout.
 * Native showModal() for focus trap, scroll lock, inert background,
 * ::backdrop, Escape key, top layer, aria-modal.
 */

import { useRef, useEffect, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { $settingsDialog, closeSettings, loadPrefs } from '../store';
import { cn } from '@shared/lib/cn';
import SettingsPanel from './SettingsPanel';

export default function SettingsDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { open } = useStore($settingsDialog);

  /* Sync dialog open/close with store */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      loadPrefs();
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  /* Animated close handler — optional afterClose runs after animation finishes */
  const handleClose = useCallback((afterClose?: () => void) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.dataset.closing = '';
    dialog.addEventListener(
      'animationend',
      () => {
        delete dialog.dataset.closing;
        dialog.close();
        closeSettings();
        afterClose?.();
      },
      { once: true }
    );
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        'settings-dialog',
        'flex flex-col',
        'w-[90%] max-w-[520px] max-h-[80vh]',
        'max-[825px]:max-w-[90%]',
        'max-[600px]:w-[clamp(320px,85vw,450px)] max-[600px]:max-w-[95%]',
        'bg-[var(--auth-dialog-bg)] rounded-[7px] overflow-hidden overflow-y-auto',
        'text-[var(--auth-dialog-text)] [font-family:var(--identity-font,_"Open_Sans",_sans-serif)] leading-[normal]',
        'shadow-[var(--auth-dialog-shadow)]',
        'p-0 border-none m-auto'
      )}
      onCancel={(e) => {
        e.preventDefault();
        handleClose();
      }}
      onClick={(e) => {
        /* WHY: clicking ::backdrop fires on the dialog element itself */
        if (e.target === e.currentTarget) handleClose();
      }}
      aria-label="Settings"
    >
      <SettingsPanel onClose={handleClose} />
    </dialog>
  );
}
