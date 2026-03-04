/**
 * AuthDialog.tsx — `<dialog>` shell for auth popups.
 *
 * React island (client:load). Single <dialog> with two content views.
 * Uses native showModal() for FREE: focus trap, scroll lock, inert
 * background, ::backdrop, Escape key, top layer, aria-modal.
 *
 * Follows vault island pattern: useStore($authDialog) syncs with
 * nanostores atom shared across React islands + Astro <script> tags.
 */

import { useRef, useEffect, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { $auth, $authDialog, closeAuth } from '../store';
import { cn } from '@shared/lib/cn';
import LoginView from './LoginView';
import SignupView from './SignupView';

export default function AuthDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { open, view } = useStore($authDialog);
  const auth = useStore($auth);

  /* Sync dialog open/close with store */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  /* Close dialog when user becomes authenticated */
  useEffect(() => {
    if (auth.status === 'authenticated' && open) {
      closeAuth();
    }
  }, [auth.status, open]);

  /* Animated close handler */
  const handleClose = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.dataset.closing = '';
    dialog.addEventListener(
      'animationend',
      () => {
        delete dialog.dataset.closing;
        dialog.close();
        closeAuth();
      },
      { once: true }
    );
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        'auth-dialog',
        'w-[90%] max-w-[960px] max-h-[80vh]',
        'bg-[#1d2021] rounded-[7px] overflow-hidden overflow-x-auto',
        'text-[#e5e7eb] [font-family:var(--identity-font,_"Open_Sans",_sans-serif)] leading-[normal]',
        'shadow-[0_12px_32px_rgba(0,0,0,0.6)]',
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
    >
      {/* Close button */}
      {/* WHY appearance-none + p-0: strip UA <button> chrome (padding, bg-color).
           pointer-events-auto: matches HBS — always clickable during animation. */}
      <button
        className={cn(
          'absolute top-[8px] right-[9px]',
          'text-[26px] leading-[26px] text-[#6b7280]',
          'appearance-none bg-transparent border-none cursor-pointer p-0',
          'pointer-events-auto z-10',
          'hover:text-[#d1d5db]'
        )}
        onClick={handleClose}
        aria-label="Close"
      >
        &times;
      </button>

      {view === 'login' ? <LoginView /> : <SignupView />}
    </dialog>
  );
}
