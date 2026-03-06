/**
 * CategoryDropdown.tsx — React island for category filter dropdown.
 * Replaces vanilla JS dropdown with proper React state, ARIA roles,
 * and keyboard navigation.
 *
 * Behavior (matching HBS):
 *   Desktop hover: menu opens on hover, closes on leave
 *   Click toggle: button click locks/unlocks open state
 *   Touch: tap button toggles, selecting an item closes menu
 *   Keyboard: Enter/Space toggle, Escape closes, Arrow keys navigate
 */
import { useState, useRef, useEffect, useCallback } from 'react';

interface CategoryOption {
  id: string;
  color?: string;
  hover?: string;
}

interface Props {
  categories: CategoryOption[];
}

export default function CategoryDropdown({ categories }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState('all');
  const [focusIdx, setFocusIdx] = useState(-1);
  const ddRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const allOptions: CategoryOption[] = [{ id: 'all' }, ...categories];

  const selectedOption = allOptions.find(o => o.id === selected) ?? allOptions[0];
  const label = selected === 'all' ? 'All Products' : selected;

  // WHY: Button inherits card colors from selected category for locked-state styling
  const btnStyle: Record<string, string> = {};
  if (selectedOption?.color) btnStyle['--card-color'] = selectedOption.color;
  if (selectedOption?.hover) btnStyle['--card-hover'] = selectedOption.hover;

  /* ── Close on outside click ── */
  useEffect(() => {
    if (!isOpen) return;
    function onOutside(e: MouseEvent | TouchEvent) {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
    };
  }, [isOpen]);

  /* ── Reset focus index when menu closes ── */
  useEffect(() => {
    if (!isOpen) setFocusIdx(-1);
  }, [isOpen]);

  /* ── Keyboard navigation ── */
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        setIsOpen(false);
        btnRef.current?.focus();
        e.preventDefault();
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setFocusIdx(0);
        } else {
          setFocusIdx(i => Math.min(i + 1, allOptions.length - 1));
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setFocusIdx(i => Math.max(i - 1, 0));
        }
        break;

      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setFocusIdx(0);
        } else if (focusIdx >= 0 && focusIdx < allOptions.length) {
          const opt = allOptions[focusIdx];
          if (opt) handleSelect(opt.id);
        }
        break;

      case 'Tab':
        if (isOpen) setIsOpen(false);
        break;
    }
  }, [isOpen, focusIdx, allOptions]);

  /* ── Focus the active menu item when focusIdx changes ── */
  useEffect(() => {
    if (focusIdx >= 0 && menuRef.current) {
      const items = menuRef.current.querySelectorAll<HTMLLIElement>('[role="option"]');
      items[focusIdx]?.focus();
    }
  }, [focusIdx]);

  /* ── Selection ── */
  function handleSelect(id: string) {
    setSelected(id);
    setIsOpen(false);
    btnRef.current?.focus();
  }

  // WHY: slideshow reads category from the DOM button's data-category.
  // React state must be flushed to DOM before the carousel rebuilds.
  // useEffect runs after React commits, so the attribute is current.
  // WHY isMount skip: on initial render selected='all' — same category the
  // slideshow already initialized with. Dispatching refresh here would destroy
  // the first Embla instance before its reveal completes (race condition).
  const isMount = useRef(true);
  useEffect(() => {
    if (isMount.current) { isMount.current = false; return; }
    window.dispatchEvent(new CustomEvent('slideshow:refresh'));
  }, [selected]);

  /* ── Desktop hover ── */
  function onMouseEnter() {
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      setIsOpen(true);
    }
  }

  function onMouseLeave() {
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      setIsOpen(false);
    }
  }

  return (
    <div
      ref={ddRef}
      className={`custom-dropdown${isOpen ? ' locked' : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onKeyDown={onKeyDown}
    >
      <button
        ref={btnRef}
        className="custom-dropdown-button"
        data-category={selected}
        style={selected !== 'all' ? btnStyle : undefined}
        onClick={() => setIsOpen(prev => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {label}
      </button>

      <ul
        ref={menuRef}
        className="custom-dropdown-menu"
        role="listbox"
        aria-label="Filter by category"
        style={{ display: isOpen ? 'block' : undefined }}
      >
        {allOptions.map((opt, i) => {
          const isSelected = opt.id === selected;
          const isFocused = i === focusIdx;
          const itemStyle: Record<string, string> = {};
          if (opt.color) itemStyle['--card-color'] = opt.color;
          if (opt.hover) itemStyle['--card-hover'] = opt.hover;

          return (
            <li
              key={opt.id}
              role="option"
              tabIndex={isFocused ? 0 : -1}
              aria-selected={isSelected}
              data-category={opt.id}
              data-product-color={opt.color ? 'true' : undefined}
              className={isSelected ? 'selected' : undefined}
              style={opt.color ? itemStyle : undefined}
              onClick={() => handleSelect(opt.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelect(opt.id);
                }
              }}
            >
              {opt.id === 'all' ? 'All Products' : opt.id}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
