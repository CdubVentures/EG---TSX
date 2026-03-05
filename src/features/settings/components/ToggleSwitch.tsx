/**
 * ToggleSwitch.tsx — Custom toggle switch (checkbox + slider).
 * Matches HBS .userSettings-toggle-switch styling.
 */

import { cn } from '@shared/lib/cn';

interface ToggleSwitchProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export default function ToggleSwitch({ id, checked, onChange, disabled }: ToggleSwitchProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'relative w-[40px] h-[22px] shrink-0 mb-[8px]',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="opacity-0 w-0 h-0 absolute"
      />
      <span
        className={cn(
          'absolute inset-0 rounded-[20px]',
          'transition-[background-color] duration-[400ms]',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:brightness-[1.15]',
          checked
            ? 'bg-[image:var(--site-background-gradient)]'
            : 'bg-[var(--grey-color-4)]',
          // Dot
          "before:content-[''] before:absolute before:left-[2px] before:bottom-[3px]",
          'before:w-[16px] before:h-[16px] before:bg-[var(--white-color-1)] before:rounded-full',
          'before:transition-transform before:duration-[400ms]',
          checked && 'before:translate-x-[18px]'
        )}
      />
    </label>
  );
}
