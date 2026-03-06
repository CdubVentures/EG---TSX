/**
 * RadioGroup.tsx — Custom radio button group.
 * Matches HBS .userSettings-radio-group styling exactly.
 */

import { cn } from '@shared/lib/cn';

interface RadioOption {
  value: string;
  label: string;
}

interface RadioGroupProps {
  name: string;
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function RadioGroup({ name, options, value, onChange, disabled }: RadioGroupProps) {
  return (
    <div className={cn('flex gap-4', disabled && 'opacity-50')}>
      {options.map((opt) => {
        const isChecked = opt.value === value;
        return (
          <label
            key={opt.value}
            className={cn(
              'flex items-center gap-[0.35rem]',
              disabled ? 'cursor-not-allowed' : 'cursor-pointer',
              "[font-family:'Open_Sans',_sans-serif] font-normal",
              'text-[length:var(--ft-17-16)] max-[600px]:text-[length:var(--fm-16-15)]',
              'text-[var(--auth-heading-text)] transition-colors duration-200',
              !disabled && 'hover:text-[var(--auth-dialog-text)]'
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={isChecked}
              onChange={() => onChange(opt.value)}
              disabled={disabled}
              className="hidden"
            />
            <span
              className={cn(
                'w-4 h-4 rounded-full border relative',
                'transition-[background,border-color] duration-300',
                isChecked
                  ? 'bg-[image:var(--site-background-gradient)] border-transparent'
                  : 'bg-transparent border-[var(--auth-subtitle-text)]',
                !isChecked && !disabled && 'hover:border-[var(--accent-color-3)]',
                // Inner dot when checked
                isChecked && [
                  "after:content-[''] after:absolute after:top-1/2 after:left-1/2",
                  'after:-translate-x-1/2 after:-translate-y-1/2',
                  'after:w-[0.4rem] after:h-[0.4rem] after:rounded-full after:bg-[var(--color-text-on-accent)]',
                ]
              )}
            />
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}
