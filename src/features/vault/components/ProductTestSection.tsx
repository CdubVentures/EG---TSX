// ─── ProductTestSection ─────────────────────────────────────────────────────
// Temporary home page test section to verify the product data pipeline:
// product JSON -> Astro collection -> component -> images.
// Will be replaced by real home page sections in Phase 4.6+.
// TODO: use imageDefaults(category) when permanent card component is built

import { useState } from 'react';
import { CONFIG, plural } from '@core/config';
import type { VaultProduct } from '../types';
import VaultToggleButton from './VaultToggleButton';

const CATEGORIES = CONFIG.categories;

interface ProductTestSectionProps {
  products: VaultProduct[];
}

export default function ProductTestSection({ products }: ProductTestSectionProps) {
  const [activeCategory, setActiveCategory] = useState<string>('mouse');

  const filtered = products.filter(p => p.category === activeCategory);

  // Per-category counts for tab badges
  const counts: Record<string, number> = {};
  for (const p of products) {
    counts[p.category] = (counts[p.category] ?? 0) + 1;
  }

  return (
    <section className="product-test-section">
      <h2 className="product-test-title">Product Data Pipeline Test</h2>
      <p className="product-test-subtitle">
        All {products.length} products across {Object.keys(counts).length} categories.
        Click + COMPARE to test vault.
      </p>

      {/* Category tabs */}
      <div className="product-test-tabs">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            type="button"
            className={`product-test-tab${activeCategory === cat ? ' active' : ''}`}
            onClick={() => setActiveCategory(cat)}
            style={activeCategory === cat
              ? { borderBottomColor: `var(--cat-${cat})`, color: `var(--cat-${cat})` }
              : undefined
            }
          >
            {plural(cat)}
            <span className="product-test-tab-count">{counts[cat] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="product-test-grid">
        {filtered.map(product => (
          <div key={product.id} className="product-test-card">
            <div className="product-test-card-img">
              <img
                src={`${product.imagePath}/${product.thumbnailStem}_s.webp`}
                alt={`${product.brand} ${product.model}`}
                loading="lazy"
                onError={(e) => {
                  // Fallback: try feature-image if top doesn't exist
                  const img = e.currentTarget;
                  if (!img.dataset.fallback) {
                    img.dataset.fallback = '1';
                    img.src = `${product.imagePath}/feature-image_s.webp`;
                  }
                }}
              />
            </div>
            <div className="product-test-card-info">
              <span className="product-test-card-brand">{product.brand}</span>
              <span className="product-test-card-model">{product.model}</span>
            </div>
            <VaultToggleButton product={product} />
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="product-test-empty">No products in this category.</p>
      )}
    </section>
  );
}
