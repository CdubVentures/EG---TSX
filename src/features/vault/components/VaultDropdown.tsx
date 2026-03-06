// ─── VaultDropdown ──────────────────────────────────────────────────────────
// React island hydrated inside the navbar vault mega-menu.
// Matches HBS navbar.handlebars vault structure + vault_site.js behavior.
// Left: category nav tabs with counts + clear section.
// Right: vault items grid (3 columns) + comparison buttons.

import { useState, useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import {
  $vault,
  removeFromVault,
  clearCategory,
  clearAll,
} from '../store';
import type { VaultEntry } from '../types';
import { CONFIG, plural } from '@core/config';
import { catVar } from '@core/categories';

/** Comparison buttons config — matches HBS getComparisonButtonsForCategory */
function getComparisonButtons(category: string) {
  if (category === 'mouse') {
    return [
      { text: 'Compare Everything', href: `/hubs/mouse?compare=stats&vault=user` },
      { text: 'Shape & Size Viewer', href: `/hubs/mouse?compare=shapes&vault=user` },
    ];
  }
  return [
    { text: 'Compare Everything', href: `/hubs/${category}?compare=stats&vault=user` },
  ];
}

// ─── Modern ✕ remove icon ───────────────────────────────────────────────────
function RemoveIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"
         fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="4" y1="4" x2="12" y2="12" />
      <line x1="12" y1="4" x2="4" y2="12" />
    </svg>
  );
}

export default function VaultDropdown() {
  const { entries } = useStore($vault);
  const [activeCategory, setActiveCategory] = useState<string>('mouse');
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Per-category counts
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    const cat = entry.product.category;
    counts[cat] = (counts[cat] ?? 0) + 1;
  }

  const categoryItems = entries.filter(e => e.product.category === activeCategory);
  const catCount = counts[activeCategory] ?? 0;

  // Set --navbar-vault-color on the mega-menu parent
  useEffect(() => {
    const megaMenu = document.getElementById('mega-menu-vault');
    if (megaMenu) {
      megaMenu.style.setProperty('--navbar-vault-color', catVar(activeCategory));
    }
  }, [activeCategory]);

  // Auto-cancel confirm after 10 seconds (matches HBS 2-click pattern)
  useEffect(() => {
    if (confirmTarget) {
      confirmTimerRef.current = setTimeout(() => setConfirmTarget(null), 10_000);
      return () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current); };
    }
  }, [confirmTarget]);

  function handleClearCategory(e: React.MouseEvent, cat: string) {
    e.preventDefault();
    if (confirmTarget === cat) {
      clearCategory(cat);
      setConfirmTarget(null);
    } else {
      setConfirmTarget(cat);
    }
  }

  function handleClearAll(e: React.MouseEvent) {
    e.preventDefault();
    if (confirmTarget === '__all__') {
      clearAll();
      setConfirmTarget(null);
    } else {
      setConfirmTarget('__all__');
    }
  }

  function handleCategoryClick(e: React.MouseEvent, cat: string) {
    e.preventDefault();
    setActiveCategory(cat);
    setConfirmTarget(null);
  }

  return (
    <div className="mega-menu-vault-inner">
      {/* Left column: category tabs + clear section */}
      <div className="mega-menu-left-column vault-left-column">
        <ul className="mega-menu-left-nav vault-left-nav">
          {CONFIG.categories.map((cat) => {
            const count = counts[cat] ?? 0;
            const isEmpty = count === 0;
            const isActive = activeCategory === cat;
            const classes = [
              `${cat}-color`,
              isActive ? 'active' : '',
              isEmpty ? 'empty-cat' : '',
            ].filter(Boolean).join(' ');

            return (
              <li key={cat}>
                <a
                  href="#"
                  data-category={cat}
                  className={classes}
                  onClick={(e) => handleCategoryClick(e, cat)}
                >
                  <span className={`category-icon icon-${cat}`} />
                  <span className="category-label">
                    {plural(cat)}
                    {count > 0 && (
                      <span className="vault-link-count" data-category={cat}>
                        {` (${count})`}
                      </span>
                    )}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>

        <div className="vault-clear-section">
          {catCount > 0 && (
            <a
              href="#"
              className="vault-clear-category-link"
              data-category={activeCategory}
              onClick={(e) => handleClearCategory(e, activeCategory)}
              style={confirmTarget === activeCategory ? { fontWeight: 800, textTransform: 'uppercase' } : undefined}
            >
              {confirmTarget === activeCategory ? 'Click to Confirm' : `Clear All ${plural(activeCategory)}`}
            </a>
          )}
          <a
            href="#"
            className="vault-clear-all-link"
            onClick={handleClearAll}
            style={confirmTarget === '__all__' ? { fontWeight: 800, textTransform: 'uppercase' } : undefined}
          >
            {confirmTarget === '__all__' ? 'Click to Confirm' : 'Clear All Items'}
          </a>
          {confirmTarget && (
            <div className="confirm-timer-bar" style={{ width: '0%' }} />
          )}
        </div>
      </div>

      {/* Right column: vault items for active category */}
      <div className="mega-menu-content vault-right-content">
        <div className={`vault-set${catCount === 0 ? ' vault-set-empty' : ''}`} data-category={activeCategory} style={{ display: 'flex' }}>
          {catCount === 0 ? (
            <div className="vault-nav-empty">
              <p>You have no products to compare.</p>
              <p>Browse products and add them to your comparison bin.</p>
            </div>
          ) : (
            <>
              <div className="vault-set-inner">
                {categoryItems.map(entry => (
                  <VaultItemCard
                    key={entry.product.id}
                    entry={entry}
                  />
                ))}
              </div>
              <div className="vault-comparison-row">
                {getComparisonButtons(activeCategory).map(btn => (
                  <a key={btn.href} href={btn.href} className="vault-compare-link">
                    {btn.text}
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── VaultItemCard ───────────────────────────────────────────────────────────
// Matches HBS .navbar-vault-item structure from vault_site.js renderVaultItemsForCategory

interface VaultItemCardProps {
  entry: VaultEntry;
}

function VaultItemCard({ entry }: VaultItemCardProps) {
  const { product } = entry;

  // WHY _t suffix: HBS uses NavbarVaultThumbSuffix = '_t' for vault thumbnails
  // thumbnailStem resolved via getImageWithFallback(defaultImageView chain) at add-time
  const imgSrc = `${product.imagePath}/${product.thumbnailStem}_t.webp`;
  const snapshotUrl = `/hubs/${product.category}/${product.slug}`;

  return (
    <div
      className="navbar-vault-item"
      data-itemid={product.id}
      data-category={product.category}
    >
      <div className="navbar-vault-img">
        <img src={imgSrc} alt={`${product.brand} ${product.model}`} loading="lazy" />
      </div>
      <div className="navbar-vault-info">
        <a href={snapshotUrl}>
          <span className="navbar-vault-brand">{product.brand}</span>
          <span className="navbar-vault-model">{product.model}</span>
        </a>
      </div>
      <div
        className="navbar-vault-remove"
        data-removeid={product.id}
        data-category={product.category}
        title="Remove this item"
        onClick={() => removeFromVault(product.id)}
      >
        <RemoveIcon />
      </div>
    </div>
  );
}
