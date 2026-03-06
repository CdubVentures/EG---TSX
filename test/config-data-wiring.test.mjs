// ─── Config Data Wiring — Integration Tests ──────────────────────────────────
// Validates that all JSON files in config/data/ exist, have correct structure,
// and are properly referenced by their consumers (TS imports + .pyw managers).
//
// WHY: After moving JSONs from config/ → config/data/, this test suite proves
// every file is present, structurally valid, and all import/path references
// are correctly wired.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DATA_DIR = join(ROOT, 'config', 'data');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readJson(filename) {
  const fp = join(DATA_DIR, filename);
  return JSON.parse(readFileSync(fp, 'utf-8'));
}

function readFile(relPath) {
  return readFileSync(join(ROOT, relPath), 'utf-8');
}

// ─── 1. File existence ──────────────────────────────────────────────────────

describe('config/data/ — file existence', () => {
  const expected = [
    'categories.json',
    'hub-tools.json',
    'slideshow.json',
    'dashboard.json',
    'navbar-guide-sections.json',
    'image-defaults.json',
  ];

  for (const file of expected) {
    it(`${file} exists`, () => {
      const fp = join(DATA_DIR, file);
      assert.ok(existsSync(fp), `Missing: config/data/${file}`);
    });
  }

  it('config/data/ directory exists', () => {
    assert.ok(existsSync(DATA_DIR), 'config/data/ directory missing');
  });

  it('no JSON files remain in config/ root', () => {
    const configDir = join(ROOT, 'config');
    const jsonFiles = readdirSync(configDir).filter(f => f.endsWith('.json'));
    assert.deepEqual(jsonFiles, [], `Stale JSON in config/: ${jsonFiles.join(', ')}`);
  });
});

// ─── 2. categories.json — structure ─────────────────────────────────────────

describe('categories.json — structure', () => {
  const data = readJson('categories.json');

  it('has siteColors with primary and secondary', () => {
    assert.ok(data.siteColors, 'missing siteColors');
    assert.ok(data.siteColors.primary, 'missing siteColors.primary');
    assert.ok(data.siteColors.secondary, 'missing siteColors.secondary');
  });

  it('siteColors are hex strings', () => {
    assert.match(data.siteColors.primary, /^#[0-9a-fA-F]{6}$/);
    assert.match(data.siteColors.secondary, /^#[0-9a-fA-F]{6}$/);
  });

  it('has categories array', () => {
    assert.ok(Array.isArray(data.categories), 'categories must be an array');
    assert.ok(data.categories.length >= 6, `expected ≥6 categories, got ${data.categories.length}`);
  });

  it('every category has required fields', () => {
    for (const cat of data.categories) {
      assert.ok(cat.id, `category missing id: ${JSON.stringify(cat)}`);
      assert.ok(cat.label, `category ${cat.id} missing label`);
      assert.ok(cat.plural, `category ${cat.id} missing plural`);
      assert.ok(cat.color, `category ${cat.id} missing color`);
      assert.match(cat.color, /^#[0-9a-fA-F]{6}$/, `category ${cat.id} color not hex`);
      assert.ok(cat.product, `category ${cat.id} missing product`);
      assert.ok(cat.content, `category ${cat.id} missing content`);
    }
  });

  it('product/content sub-sections have boolean flags', () => {
    for (const cat of data.categories) {
      for (const sub of ['product', 'content']) {
        assert.equal(typeof cat[sub].production, 'boolean',
          `${cat.id}.${sub}.production must be boolean`);
        assert.equal(typeof cat[sub].vite, 'boolean',
          `${cat.id}.${sub}.vite must be boolean`);
      }
    }
  });

  it('category IDs are unique', () => {
    const ids = data.categories.map(c => c.id);
    const unique = new Set(ids);
    assert.equal(ids.length, unique.size, `duplicate category IDs: ${ids}`);
  });

  it('contains the 6 core product categories', () => {
    const ids = new Set(data.categories.map(c => c.id));
    for (const core of ['mouse', 'keyboard', 'monitor', 'headset', 'mousepad', 'controller']) {
      assert.ok(ids.has(core), `missing core category: ${core}`);
    }
  });

  it('mouse, keyboard, monitor are product-active', () => {
    const map = Object.fromEntries(data.categories.map(c => [c.id, c]));
    for (const id of ['mouse', 'keyboard', 'monitor']) {
      assert.equal(map[id].product.production, true, `${id} product should be production:true`);
    }
  });
});

// ─── 3. hub-tools.json — structure ──────────────────────────────────────────

describe('hub-tools.json — structure', () => {
  const data = readJson('hub-tools.json');

  it('is a non-empty object', () => {
    assert.equal(typeof data, 'object');
    assert.ok(Object.keys(data).length > 0, 'hub-tools.json is empty');
  });

  it('has tools for active product categories', () => {
    const cats = readJson('categories.json');
    const activeProductIds = cats.categories
      .filter(c => c.product.production)
      .map(c => c.id);
    for (const catId of activeProductIds) {
      assert.ok(data[catId], `missing tools for active category: ${catId}`);
      assert.ok(Array.isArray(data[catId]), `tools for ${catId} must be array`);
    }
  });

  it('every tool entry has required fields', () => {
    const requiredFields = ['tool', 'title', 'description', 'url', 'enabled'];
    for (const [catId, tools] of Object.entries(data)) {
      if (catId.startsWith('_')) continue; // skip _tooltips, _index
      if (!Array.isArray(tools)) continue;
      for (const tool of tools) {
        for (const field of requiredFields) {
          assert.ok(field in tool, `${catId} tool "${tool.title ?? '?'}" missing field: ${field}`);
        }
      }
    }
  });

  it('tool.enabled is boolean', () => {
    for (const [catId, tools] of Object.entries(data)) {
      if (catId.startsWith('_') || !Array.isArray(tools)) continue;
      for (const tool of tools) {
        assert.equal(typeof tool.enabled, 'boolean', `${catId}/${tool.tool} enabled not boolean`);
      }
    }
  });

  it('tool.navbar is boolean', () => {
    for (const [catId, tools] of Object.entries(data)) {
      if (catId.startsWith('_') || !Array.isArray(tools)) continue;
      for (const tool of tools) {
        assert.equal(typeof tool.navbar, 'boolean', `${catId}/${tool.tool} navbar not boolean`);
      }
    }
  });

  it('every tool has a non-empty url', () => {
    for (const [catId, tools] of Object.entries(data)) {
      if (catId.startsWith('_') || !Array.isArray(tools)) continue;
      for (const tool of tools) {
        assert.ok(tool.url && tool.url.length > 0, `${catId}/${tool.tool} has empty url`);
      }
    }
  });

  it('each category has a "hub" tool', () => {
    for (const [catId, tools] of Object.entries(data)) {
      if (catId.startsWith('_') || !Array.isArray(tools)) continue;
      const hubTool = tools.find(t => t.tool === 'hub');
      assert.ok(hubTool, `category ${catId} missing "hub" tool`);
    }
  });
});

// ─── 4. slideshow.json — structure ──────────────────────────────────────────

describe('slideshow.json — structure', () => {
  const data = readJson('slideshow.json');

  it('has maxSlides number', () => {
    assert.equal(typeof data.maxSlides, 'number', 'maxSlides must be a number');
    assert.ok(data.maxSlides > 0, 'maxSlides must be positive');
  });

  it('has slides array', () => {
    assert.ok(Array.isArray(data.slides), 'slides must be an array');
  });

  it('slides are non-empty strings (product slugs)', () => {
    for (const slide of data.slides) {
      assert.equal(typeof slide, 'string', `slide must be string, got ${typeof slide}`);
      assert.ok(slide.length > 0, 'slide slug must not be empty');
    }
  });

  it('slide count does not exceed maxSlides', () => {
    assert.ok(data.slides.length <= data.maxSlides,
      `${data.slides.length} slides exceeds maxSlides=${data.maxSlides}`);
  });

  it('no duplicate slide slugs', () => {
    const unique = new Set(data.slides);
    assert.equal(data.slides.length, unique.size, 'duplicate slide slugs');
  });
});

// ─── 5. dashboard.json — structure ──────────────────────────────────────────

describe('dashboard.json — structure', () => {
  const data = readJson('dashboard.json');

  it('has slots object', () => {
    assert.equal(typeof data.slots, 'object', 'slots must be an object');
  });

  it('slot keys are numeric strings 1-15', () => {
    for (const key of Object.keys(data.slots)) {
      const num = parseInt(key, 10);
      assert.ok(num >= 1 && num <= 15, `slot key "${key}" out of range 1-15`);
    }
  });

  it('slot values have collection and id', () => {
    for (const [key, val] of Object.entries(data.slots)) {
      assert.ok(val.collection, `slot ${key} missing collection`);
      assert.ok(val.id, `slot ${key} missing id`);
    }
  });

  it('has pinned array', () => {
    assert.ok(Array.isArray(data.pinned), 'pinned must be an array');
  });

  it('has badges object', () => {
    assert.equal(typeof data.badges, 'object', 'badges must be an object');
  });

  it('has excluded array', () => {
    assert.ok(Array.isArray(data.excluded), 'excluded must be an array');
  });

  it('badge values are strings', () => {
    for (const [key, val] of Object.entries(data.badges)) {
      assert.equal(typeof val, 'string', `badge "${key}" value must be string`);
    }
  });
});

// ─── 6. navbar-guide-sections.json — structure ──────────────────────────────

describe('navbar-guide-sections.json — structure', () => {
  const data = readJson('navbar-guide-sections.json');

  it('is a non-empty object', () => {
    assert.equal(typeof data, 'object');
    assert.ok(Object.keys(data).length > 0, 'navbar-guide-sections.json is empty');
  });

  it('keys are category IDs', () => {
    const cats = readJson('categories.json');
    const allIds = new Set(cats.categories.map(c => c.id));
    for (const key of Object.keys(data)) {
      assert.ok(allIds.has(key), `section key "${key}" is not a valid category ID`);
    }
  });

  it('values are arrays of strings (section names)', () => {
    for (const [catId, sections] of Object.entries(data)) {
      assert.ok(Array.isArray(sections), `${catId} sections must be an array`);
      for (const section of sections) {
        assert.equal(typeof section, 'string', `${catId} section must be string`);
        assert.ok(section.length > 0, `${catId} has empty section name`);
      }
    }
  });

  it('no duplicate sections within a category', () => {
    for (const [catId, sections] of Object.entries(data)) {
      const unique = new Set(sections);
      assert.equal(sections.length, unique.size, `${catId} has duplicate sections`);
    }
  });

  it('mouse has at least one section', () => {
    assert.ok(data.mouse, 'mouse must have sections');
    assert.ok(data.mouse.length > 0, 'mouse sections must not be empty');
  });
});

// ─── 6b. image-defaults.json — structure ─────────────────────────────────────

describe('image-defaults.json — structure', () => {
  const data = readJson('image-defaults.json');

  it('has defaults object with required keys', () => {
    assert.equal(typeof data.defaults, 'object');
    for (const key of ['defaultImageView', 'listThumbKeyBase', 'headerGame', 'viewPriority', 'viewMeta']) {
      assert.ok(key in data.defaults, `missing defaults.${key}`);
    }
  });

  it('has categories object', () => {
    assert.equal(typeof data.categories, 'object');
  });

  it('categories includes active product categories', () => {
    const cats = readJson('categories.json');
    const activeProductIds = cats.categories
      .filter(c => c.product.production)
      .map(c => c.id);
    for (const catId of activeProductIds) {
      assert.ok(catId in data.categories, `missing category: ${catId}`);
    }
  });

  it('viewMeta objectFit values are contain or cover', () => {
    for (const [view, meta] of Object.entries(data.defaults.viewMeta)) {
      assert.ok(
        meta.objectFit === 'contain' || meta.objectFit === 'cover',
        `viewMeta.${view}.objectFit must be contain or cover, got "${meta.objectFit}"`
      );
    }
  });
});

// ─── 7. Wiring — TS/Astro imports reference config/data/ ────────────────────

describe('TS/Astro imports — wired to config/data/', () => {
  it('src/core/config.ts imports config/data/categories.json', () => {
    const content = readFile('src/core/config.ts');
    assert.ok(
      content.includes("config/data/categories.json"),
      'config.ts must import from config/data/categories.json'
    );
    assert.ok(
      !content.includes("'../../config/categories.json'"),
      'config.ts still has old import path'
    );
  });

  it('src/content.config.ts imports config/data/categories.json', () => {
    const content = readFile('src/content.config.ts');
    assert.ok(
      content.includes("config/data/categories.json"),
      'content.config.ts must import from config/data/categories.json'
    );
  });

  it('src/core/hub-tools.ts imports config/data/hub-tools.json', () => {
    const content = readFile('src/core/hub-tools.ts');
    assert.ok(
      content.includes("config/data/hub-tools.json"),
      'hub-tools.ts must import from config/data/hub-tools.json'
    );
  });

  it('HomeSlideshow.astro imports config/data/slideshow.json', () => {
    const content = readFile('src/features/home/components/HomeSlideshow.astro');
    assert.ok(
      content.includes("config/data/slideshow.json"),
      'HomeSlideshow.astro must import from config/data/slideshow.json'
    );
  });

  it('src/core/config.ts imports config/data/image-defaults.json', () => {
    const content = readFile('src/core/config.ts');
    assert.ok(
      content.includes("config/data/image-defaults.json"),
      'config.ts must import from config/data/image-defaults.json'
    );
  });

  it('src/core/config.ts imports image-defaults-resolver.mjs', () => {
    const content = readFile('src/core/config.ts');
    assert.ok(
      content.includes("image-defaults-resolver.mjs"),
      'config.ts must import from image-defaults-resolver.mjs'
    );
  });

  it('GlobalNav.astro imports config/data/navbar-guide-sections.json', () => {
    const content = readFile('src/shared/layouts/GlobalNav.astro');
    assert.ok(
      content.includes("config/data/navbar-guide-sections.json"),
      'GlobalNav.astro must import from config/data/navbar-guide-sections.json'
    );
  });
});

// ─── 8. Wiring — .pyw managers reference config/data/ ───────────────────────

describe('.pyw managers — wired to config/data/', () => {
  const managers = [
    'category-manager.pyw',
    'navbar-manager.pyw',
    'hub-tools-manager.pyw',
    'slideshow-manager.pyw',
    'dashboard-manager.pyw',
    'image-manager.pyw',
  ];

  for (const mgr of managers) {
    it(`${mgr} exists`, () => {
      assert.ok(existsSync(join(ROOT, 'config', mgr)), `Missing: config/${mgr}`);
    });
  }

  it('category-manager.pyw points to config/data/categories.json', () => {
    const content = readFile('config/category-manager.pyw');
    assert.ok(
      content.includes('"config" / "data" / "categories.json"'),
      'category-manager.pyw must reference config/data/categories.json'
    );
    assert.ok(
      !content.includes('"config" / "categories.json"'),
      'category-manager.pyw still has old path'
    );
  });

  it('navbar-manager.pyw points to config/data/ for both JSONs', () => {
    const content = readFile('config/navbar-manager.pyw');
    assert.ok(
      content.includes('"config" / "data" / "categories.json"'),
      'navbar-manager.pyw must reference config/data/categories.json'
    );
    assert.ok(
      content.includes('"config" / "data" / "navbar-guide-sections.json"'),
      'navbar-manager.pyw must reference config/data/navbar-guide-sections.json'
    );
    assert.ok(
      !content.includes('"src" / "data" / "navbar-guide-sections.json"'),
      'navbar-manager.pyw still has old src/data/ path'
    );
  });

  it('hub-tools-manager.pyw points to config/data/ for both JSONs', () => {
    const content = readFile('config/hub-tools-manager.pyw');
    assert.ok(
      content.includes('"config" / "data" / "categories.json"'),
      'hub-tools-manager.pyw must reference config/data/categories.json'
    );
    assert.ok(
      content.includes('"config" / "data" / "hub-tools.json"'),
      'hub-tools-manager.pyw must reference config/data/hub-tools.json'
    );
  });

  it('slideshow-manager.pyw points to config/data/ for both JSONs', () => {
    const content = readFile('config/slideshow-manager.pyw');
    assert.ok(
      content.includes('"config" / "data" / "categories.json"'),
      'slideshow-manager.pyw must reference config/data/categories.json'
    );
    assert.ok(
      content.includes('"config" / "data" / "slideshow.json"'),
      'slideshow-manager.pyw must reference config/data/slideshow.json'
    );
  });

  it('dashboard-manager.pyw points to config/data/ for both JSONs', () => {
    const content = readFile('config/dashboard-manager.pyw');
    assert.ok(
      content.includes('"config" / "data" / "categories.json"'),
      'dashboard-manager.pyw must reference config/data/categories.json'
    );
    assert.ok(
      content.includes('"config" / "data" / "dashboard.json"'),
      'dashboard-manager.pyw must reference config/data/dashboard.json'
    );
  });

  it('image-manager.pyw points to config/data/ for both JSONs', () => {
    const content = readFile('config/image-manager.pyw');
    assert.ok(
      content.includes('"config" / "data" / "categories.json"'),
      'image-manager.pyw must reference config/data/categories.json'
    );
    assert.ok(
      content.includes('"config" / "data" / "image-defaults.json"'),
      'image-manager.pyw must reference config/data/image-defaults.json'
    );
  });
});

// ─── 9. No stale references — zero old paths in codebase ────────────────────

describe('no stale path references', () => {
  const filesToCheck = [
    'src/core/config.ts',
    'src/content.config.ts',
    'src/core/hub-tools.ts',
    'src/features/home/components/HomeSlideshow.astro',
    'src/shared/layouts/GlobalNav.astro',
    'src/core/DOMAIN.md',
    'src/features/home/DOMAIN.md',
    'src/features/vault/types.ts',
  ];

  // Old patterns that should NOT appear (path references, not bare filenames)
  const stalePatterns = [
    /['"]\.\.\/.*config\/categories\.json['"]/,    // import from config/categories.json
    /['"]\.\.\/.*config\/hub-tools\.json['"]/,
    /['"]\.\.\/.*config\/slideshow\.json['"]/,
    /['"]\.\.\/.*config\/dashboard\.json['"]/,
    /"config" \/ "categories\.json"/,              // Python path
    /"config" \/ "hub-tools\.json"/,
    /"config" \/ "slideshow\.json"/,
    /"config" \/ "dashboard\.json"/,
    /"config" \/ "image-defaults\.json"/,
    /"src" \/ "data" \/ "navbar-guide-sections\.json"/, // old navbar output path
  ];

  for (const file of filesToCheck) {
    it(`${file} has no stale config/ paths`, () => {
      const fp = join(ROOT, file);
      if (!existsSync(fp)) return; // skip if file doesn't exist
      const content = readFileSync(fp, 'utf-8');
      for (const pattern of stalePatterns) {
        assert.ok(
          !pattern.test(content),
          `${file} contains stale path matching ${pattern}`
        );
      }
    });
  }
});

// ─── 10. Cross-file consistency ─────────────────────────────────────────────

describe('cross-file consistency', () => {
  it('navbar-guide-sections categories are subset of categories.json IDs', () => {
    const cats = readJson('categories.json');
    const sections = readJson('navbar-guide-sections.json');
    const allIds = new Set(cats.categories.map(c => c.id));
    for (const catId of Object.keys(sections)) {
      assert.ok(allIds.has(catId),
        `navbar-guide-sections has "${catId}" not in categories.json`);
    }
  });

  it('hub-tools categories are subset of categories.json IDs', () => {
    const cats = readJson('categories.json');
    const tools = readJson('hub-tools.json');
    const allIds = new Set(cats.categories.map(c => c.id));
    for (const key of Object.keys(tools)) {
      if (key.startsWith('_')) continue;
      assert.ok(allIds.has(key),
        `hub-tools has category "${key}" not in categories.json`);
    }
  });

  it('slideshow slides reference valid product slug formats', () => {
    const data = readJson('slideshow.json');
    for (const slug of data.slides) {
      // Product slugs are kebab-case, may contain digits
      assert.match(slug, /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
        `slide slug "${slug}" is not valid kebab-case`);
    }
  });

  it('dashboard slot collections are valid content types', () => {
    const data = readJson('dashboard.json');
    const validCollections = new Set(['reviews', 'guides', 'news', 'brands', 'games']);
    for (const [key, val] of Object.entries(data.slots)) {
      assert.ok(validCollections.has(val.collection),
        `slot ${key} has invalid collection "${val.collection}"`);
    }
  });
});
