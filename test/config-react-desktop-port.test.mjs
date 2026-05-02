import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const APP_CSS = readFileSync(join(ROOT, 'config', 'ui', 'app.css'), 'utf8');
const LAUNCHER_PYW = readFileSync(join(ROOT, 'config', 'app', 'launcher.pyw'), 'utf8');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readCssVar(name) {
  const match = APP_CSS.match(new RegExp(`${escapeRegExp(name)}:\\s*([^;]+);`));
  assert.ok(match, `Missing CSS var ${name}`);
  return match[1].trim();
}

function writeText(filePath, text) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, text, 'utf8');
}

function writeJson(filePath, value) {
  writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function makeDesktopFixture() {
  const root = mkdtempSync(join(tmpdir(), 'eg-config-react-'));
  const cleanup = () => rmSync(root, { recursive: true, force: true });

  const categories = {
    siteColors: { primary: '#123456', secondary: '#654321' },
    categories: [
      {
        id: 'mouse',
        label: 'Mouse',
        plural: 'Mice',
        color: '#00aeff',
        product: { production: true, vite: true },
        content: { production: true, vite: true },
        collections: {
          dataProducts: true,
          reviews: true,
          guides: true,
          news: true,
        },
      },
    ],
  };

  const content = {
    slots: {
      '2': { collection: 'guides', id: 'guide-a' },
    },
    pinned: ['guides:guide-a'],
    badges: { 'guides:guide-a': 'Top Pick' },
    excluded: [],
    indexHeroes: {
      reviews: { all: ['reviews:review-a'] },
      news: {},
      guides: {},
      brands: {},
    },
  };

  writeJson(join(root, 'config', 'data', 'categories.json'), categories);
  writeJson(join(root, 'config', 'data', 'content.json'), content);

  for (const name of [
    'slideshow.json',
    'hub-tools.json',
    'navbar-guide-sections.json',
    'image-defaults.json',
    'ads-registry.json',
    'inline-ads-config.json',
    'cache-cdn.json',
    'direct-sponsors.json',
  ]) {
    writeJson(join(root, 'config', 'data', name), {});
  }

  writeJson(join(root, 'src', 'content', 'data-products', 'mouse', 'brand-a', 'mouse-a.json'), {
    category: 'mouse',
    slug: 'mouse-a',
    overall: 95,
    media: {
      images: [
        { view: 'front' },
      ],
    },
  });

  writeText(
    join(root, 'src', 'content', 'reviews', 'review-a', 'index.md'),
    [
      '---',
      'title: Review A',
      'category: mouse',
      'datePublished: 2025-01-02',
      'hero: review-a',
      'publish: true',
      'draft: false',
      '---',
      'Review body',
      '',
    ].join('\n'),
  );

  writeText(
    join(root, 'src', 'content', 'guides', 'guide-a', 'index.md'),
    [
      '---',
      'title: Guide A',
      'category: mouse',
      'datePublished: 2025-01-03',
      'hero: guide-a',
      'publish: true',
      'draft: false',
      '---',
      'Guide body',
      '',
    ].join('\n'),
  );

  writeText(
    join(root, 'src', 'content', 'news', 'news-a', 'index.md'),
    [
      '---',
      'title: News A',
      'category: mouse',
      'datePublished: 2025-01-04',
      'hero: news-a',
      'publish: true',
      'draft: false',
      '---',
      'News body',
      '',
    ].join('\n'),
  );

  writeText(
    join(root, 'src', 'content', 'brands', 'brand-a', 'index.md'),
    [
      '---',
      'title: Brand A',
      'datePublished: 2025-01-05',
      'hero: brand-a',
      'publish: true',
      'draft: false',
      '---',
      'Brand body',
      '',
    ].join('\n'),
  );

  writeText(
    join(root, 'src', 'content', 'games', 'game-a', 'index.md'),
    [
      '---',
      'title: Game A',
      'datePublished: 2025-01-06',
      'hero: game-a',
      'publish: true',
      'draft: false',
      '---',
      'Game body',
      '',
    ].join('\n'),
  );

  writeText(join(root, 'public', 'images', 'navbar', 'mouse.svg'), '<svg />\n');

  return { root, cleanup };
}

const API_SCENARIO_SCRIPT = `
import json
import sys
from pathlib import Path

repo_root = Path(sys.argv[1])
project_root = Path(sys.argv[2])
steps = json.loads(sys.argv[3])

sys.path.insert(0, str(repo_root / "config" / "app"))
sys.path.insert(0, str(repo_root))

import main
from runtime import ConfigRuntime
from fastapi.testclient import TestClient

main.runtime = ConfigRuntime(project_root)

results = []
with TestClient(main.app) as client:
    for step in steps:
        method = step["method"]
        path = step["path"]
        body = step.get("body")
        if method == "GET":
            response = client.get(path)
        elif method == "PUT":
            response = client.put(path, json=body)
        else:
            raise RuntimeError(f"Unsupported method: {method}")

        try:
            payload = response.json()
        except Exception:
            payload = response.text

        results.append({
            "status": response.status_code,
            "body": payload,
        })

print(json.dumps(results))
`;

function runApiScenario(projectRoot, steps) {
  const result = spawnSync(
    'python',
    ['-c', API_SCENARIO_SCRIPT, ROOT, projectRoot, JSON.stringify(steps)],
    {
      cwd: ROOT,
      encoding: 'utf8',
    },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Python API scenario failed');
  }

  return JSON.parse(result.stdout);
}

describe('React config desktop shell parity', () => {
  it('locks the shell geometry tokens to the Tk dimensions', () => {
    assert.equal(readCssVar('--sidebar-width'), '200px');
    assert.equal(readCssVar('--status-height'), '32px');
    assert.equal(readCssVar('--context-height'), '48px');
    assert.equal(readCssVar('--logo-height'), '56px');
    assert.equal(readCssVar('--nav-row-height'), '42px');
    assert.equal(readCssVar('--site-theme-height'), '52px');
    assert.equal(readCssVar('--toggle-width'), '38px');
    assert.equal(readCssVar('--toggle-height'), '20px');
    assert.equal(readCssVar('--content-main-tab-height'), 'var(--nav-row-height)');
    assert.equal(readCssVar('--content-subtab-height'), 'var(--button-height)');
    assert.equal(readCssVar('--content-pool-type-col-width'), '64px');
  });

  it('keeps the legacy dark skin fully squared off', () => {
    assert.equal(readCssVar('--radius-control'), '0px');
    assert.equal(readCssVar('--radius-surface'), '0px');
    assert.equal(readCssVar('--radius-dialog'), '0px');
    assert.equal(readCssVar('--shadow-card'), 'none');
    assert.equal(readCssVar('--shadow-dialog'), 'none');
    assert.equal(readCssVar('--shadow-toast'), 'none');
  });

  it('restores the previous opening size and minimum size in the native launcher', () => {
    assert.match(LAUNCHER_PYW, /WINDOW_WIDTH = 1859/);
    assert.match(LAUNCHER_PYW, /WINDOW_HEIGHT = 1202/);
    assert.match(LAUNCHER_PYW, /WINDOW_MIN_WIDTH = 1210/);
    assert.match(LAUNCHER_PYW, /WINDOW_MIN_HEIGHT = 886/);
  });

  it('uses a dedicated tokenized width for the Type column so it does not clip', () => {
    assert.match(APP_CSS, /grid-template-columns:[^;]+var\(--content-pool-type-col-width\)/);
  });

  it('exposes the project root name for the shell footer instead of only the app title', () => {
    const { root, cleanup } = makeDesktopFixture();

    try {
      const [bootstrap] = runApiScenario(root, [{ method: 'GET', path: '/api/bootstrap' }]);
      assert.equal(bootstrap.status, 200);
      assert.equal(bootstrap.body.shell.projectRootName, root.split(/[\\\\/]/).at(-1));
    } finally {
      cleanup();
    }
  });
});

describe('React config desktop categories preview contract', () => {
  it('previews category edits through the Python backend without writing categories.json', () => {
    const { root, cleanup } = makeDesktopFixture();

    try {
      const categoriesPath = join(root, 'config', 'data', 'categories.json');
      const beforeDisk = JSON.parse(readFileSync(categoriesPath, 'utf8'));

      const [before, preview, after] = runApiScenario(root, [
        { method: 'GET', path: '/api/bootstrap' },
        {
          method: 'PUT',
          path: '/api/panels/categories/preview',
          body: {
            siteColors: { primary: '#abcdef', secondary: '#fedcba' },
            categories: beforeDisk.categories,
          },
        },
        { method: 'GET', path: '/api/bootstrap' },
      ]);

      assert.equal(before.status, 200);
      assert.equal(before.body.shell.accent, '#123456');

      assert.equal(preview.status, 200);
      assert.equal(preview.body.shell.accent, '#abcdef');
      assert.equal(preview.body.panel.siteColors.primary, '#abcdef');

      assert.equal(after.status, 200);
      assert.equal(after.body.shell.accent, '#abcdef');

      const afterDisk = JSON.parse(readFileSync(categoriesPath, 'utf8'));
      assert.equal(afterDisk.siteColors.primary, '#123456');
    } finally {
      cleanup();
    }
  });

  it('formats category count text like Tk with a bullet between review, guide, and news counts', () => {
    const { root, cleanup } = makeDesktopFixture();

    try {
      const [panel] = runApiScenario(root, [{ method: 'GET', path: '/api/panels/categories' }]);
      assert.equal(panel.status, 200);
      assert.match(panel.body.categories[0].countText, /^1 products  \|  1 reviews · 1 guides · 1 news$/);
    } finally {
      cleanup();
    }
  });
});

describe('React config desktop content backend contract', () => {
  it('hydrates Content in bootstrap so the next panel is not a placeholder-only route', () => {
    const { root, cleanup } = makeDesktopFixture();

    try {
      const [bootstrap] = runApiScenario(root, [{ method: 'GET', path: '/api/bootstrap' }]);
      assert.equal(bootstrap.status, 200);
      assert.ok(bootstrap.body.panels.content, 'bootstrap must include panels.content');
      assert.ok(bootstrap.body.panels.indexHeroes, 'bootstrap must include panels.indexHeroes');
      assert.ok(bootstrap.body.panels.hubTools, 'bootstrap must include panels.hubTools');
      assert.equal(bootstrap.body.panels.content.summary.slotCount, 15);
    } finally {
      cleanup();
    }
  });

  it('serves a full Content panel payload with dashboard slots, pool data, and collection tabs', () => {
    const { root, cleanup } = makeDesktopFixture();

    try {
      const [panel] = runApiScenario(root, [{ method: 'GET', path: '/api/panels/content' }]);
      assert.equal(panel.status, 200);
      assert.equal(panel.body.dashboardSlots.length, 15);
      assert.equal(panel.body.manualSlots['2'], 'guides:guide-a');
      assert.equal(panel.body.summary.totalArticles, 5);
      assert.ok(Array.isArray(panel.body.articlePool));
      assert.ok(panel.body.articlePool.some((article) => article.key === 'reviews:review-a'));
      assert.ok(Array.isArray(panel.body.tabs.reviews));
      assert.ok(Array.isArray(panel.body.tabs.guides));
      assert.ok(Array.isArray(panel.body.tabs.news));
      assert.ok(Array.isArray(panel.body.tabs.brands));
      assert.ok(Array.isArray(panel.body.tabs.games));
    } finally {
      cleanup();
    }
  });

  it('previews unsaved Content editorial state without mutating content.json on disk', () => {
    const { root, cleanup } = makeDesktopFixture();

    try {
      const contentPath = join(root, 'config', 'data', 'content.json');
      const beforeDisk = JSON.parse(readFileSync(contentPath, 'utf8'));

      const [preview, panel] = runApiScenario(root, [
        {
          method: 'PUT',
          path: '/api/panels/content/preview',
          body: {
            manualSlots: { '1': 'reviews:review-a', '5': 'guides:guide-a' },
            pinned: ['reviews:review-a'],
            badges: { 'reviews:review-a': 'Editors Choice' },
            excluded: ['news:news-a'],
          },
        },
        { method: 'GET', path: '/api/panels/content' },
      ]);

      assert.equal(preview.status, 200);
      assert.equal(preview.body.panel.manualSlots['1'], 'reviews:review-a');

      assert.equal(panel.status, 200);
      assert.equal(panel.body.manualSlots['1'], 'reviews:review-a');
      assert.equal(panel.body.dashboardSlots[0].article.key, 'reviews:review-a');
      assert.deepEqual(panel.body.excluded, ['news:news-a']);

      const afterDisk = JSON.parse(readFileSync(contentPath, 'utf8'));
      assert.deepEqual(afterDisk, beforeDisk);
    } finally {
      cleanup();
    }
  });

  it('saves Content owned keys while preserving indexHeroes in content.json', () => {
    const { root, cleanup } = makeDesktopFixture();

    try {
      const contentPath = join(root, 'config', 'data', 'content.json');

      const [save] = runApiScenario(root, [
        {
          method: 'PUT',
          path: '/api/panels/content/save',
          body: {
            manualSlots: { '1': 'reviews:review-a' },
            pinned: ['reviews:review-a'],
            badges: { 'reviews:review-a': 'Top Pick' },
            excluded: ['news:news-a'],
          },
        },
      ]);

      assert.equal(save.status, 200);
      assert.equal(save.body.panel.manualSlots['1'], 'reviews:review-a');

      const onDisk = JSON.parse(readFileSync(contentPath, 'utf8'));
      assert.deepEqual(onDisk.slots['1'], { collection: 'reviews', id: 'review-a' });
      assert.deepEqual(onDisk.pinned, ['reviews:review-a']);
      assert.deepEqual(onDisk.badges, { 'reviews:review-a': 'Top Pick' });
      assert.deepEqual(onDisk.excluded, ['news:news-a']);
      assert.deepEqual(onDisk.indexHeroes, {
        reviews: { all: ['reviews:review-a'] },
        news: {},
        guides: {},
        brands: {},
      });
    } finally {
      cleanup();
    }
  });
});

describe('React config desktop hub-tools backend contract', () => {
  it('serves a full Hub Tools panel payload with categories, tools, tooltips, and index slots', () => {
    const { root, cleanup } = makeDesktopFixture();

    try {
      const [panel] = runApiScenario(root, [{ method: 'GET', path: '/api/panels/hub-tools' }]);
      assert.equal(panel.status, 200);
      assert.ok(Array.isArray(panel.body.categories));
      assert.ok(panel.body.categories.some((category) => category.id === 'mouse'));
      assert.ok(Array.isArray(panel.body.toolTypes));
      assert.equal(panel.body.toolTypes.length, 5);
      assert.ok(Array.isArray(panel.body.tools.mouse));
      assert.equal(panel.body.tools.mouse.length, 5);
      assert.equal(panel.body.tools.mouse[0].tool, 'hub');
      assert.equal(panel.body.tools.mouse[0].url, '/hubs/mouse');
      assert.equal(typeof panel.body.tooltips.hub, 'string');
      assert.ok(Array.isArray(panel.body.index.all));
      assert.ok(Array.isArray(panel.body.index.hub));
      assert.ok(Array.isArray(panel.body.index.database));
      assert.ok(Array.isArray(panel.body.index.versus));
      assert.ok(Array.isArray(panel.body.index.radar));
      assert.ok(Array.isArray(panel.body.index.shapes));
    } finally {
      cleanup();
    }
  });

  it('previews unsaved Hub Tools state without mutating hub-tools.json on disk', () => {
    const { root, cleanup } = makeDesktopFixture();

    try {
      const hubToolsPath = join(root, 'config', 'data', 'hub-tools.json');
      const beforeDisk = JSON.parse(readFileSync(hubToolsPath, 'utf8'));

      const [initialPanel] = runApiScenario(root, [{ method: 'GET', path: '/api/panels/hub-tools' }]);
      assert.equal(initialPanel.status, 200);

      const draft = {
        tools: structuredClone(initialPanel.body.tools),
        tooltips: structuredClone(initialPanel.body.tooltips),
        index: structuredClone(initialPanel.body.index),
      };
      draft.tools.mouse[0].title = 'Mouse Hub Preview';
      draft.tooltips.hub = 'Preview tooltip';
      draft.index.all = ['mouse:hub'];
      draft.index.hub = ['mouse:hub'];

      const [preview, panel] = runApiScenario(root, [
        {
          method: 'PUT',
          path: '/api/panels/hub-tools/preview',
          body: draft,
        },
        { method: 'GET', path: '/api/panels/hub-tools' },
      ]);

      assert.equal(preview.status, 200);
      assert.equal(preview.body.panel.tools.mouse[0].title, 'Mouse Hub Preview');
      assert.equal(preview.body.panel.tooltips.hub, 'Preview tooltip');
      assert.deepEqual(preview.body.panel.index.hub, ['mouse:hub']);

      assert.equal(panel.status, 200);
      assert.equal(panel.body.tools.mouse[0].title, 'Mouse Hub Preview');
      assert.equal(panel.body.tooltips.hub, 'Preview tooltip');
      assert.deepEqual(panel.body.index.hub, ['mouse:hub']);

      const afterDisk = JSON.parse(readFileSync(hubToolsPath, 'utf8'));
      assert.deepEqual(afterDisk, beforeDisk);
    } finally {
      cleanup();
    }
  });

  it('saves Hub Tools edits and persists tools, shared tooltips, and index ordering', () => {
    const { root, cleanup } = makeDesktopFixture();

    try {
      const hubToolsPath = join(root, 'config', 'data', 'hub-tools.json');
      const [initialPanel] = runApiScenario(root, [{ method: 'GET', path: '/api/panels/hub-tools' }]);
      assert.equal(initialPanel.status, 200);

      const draft = {
        tools: structuredClone(initialPanel.body.tools),
        tooltips: structuredClone(initialPanel.body.tooltips),
        index: structuredClone(initialPanel.body.index),
      };
      draft.tools.mouse[0].title = 'Mouse Hub Saved';
      draft.tools.mouse[0].navbar = false;
      draft.tooltips.hub = 'Saved tooltip copy';
      draft.index.all = ['mouse:hub'];
      draft.index.hub = ['mouse:hub'];

      const [save] = runApiScenario(root, [
        {
          method: 'PUT',
          path: '/api/panels/hub-tools/save',
          body: draft,
        },
      ]);

      assert.equal(save.status, 200);
      assert.equal(save.body.panel.tools.mouse[0].title, 'Mouse Hub Saved');
      assert.equal(save.body.panel.tools.mouse[0].navbar, false);
      assert.equal(save.body.panel.tooltips.hub, 'Saved tooltip copy');
      assert.deepEqual(save.body.panel.index.hub, ['mouse:hub']);

      const onDisk = JSON.parse(readFileSync(hubToolsPath, 'utf8'));
      assert.equal(onDisk.mouse[0].title, 'Mouse Hub Saved');
      assert.equal(onDisk.mouse[0].navbar, false);
      assert.equal(onDisk._tooltips.hub, 'Saved tooltip copy');
      assert.deepEqual(onDisk._index.hub, ['mouse:hub']);
    } finally {
      cleanup();
    }
  });
});

describe('React config desktop index-heroes backend contract', () => {
  it('serves a full Index Heroes panel payload', () => {
    const { root, cleanup } = makeDesktopFixture();

    try {
      const [panel] = runApiScenario(root, [{ method: 'GET', path: '/api/panels/index-heroes' }]);
      assert.equal(panel.status, 200);
      assert.ok(Array.isArray(panel.body.types));
      assert.ok(panel.body.types.some((type) => type.key === 'reviews'));
      assert.ok(panel.body.types.some((type) => type.key === 'brands'));
      assert.ok(panel.body.pools.reviews);
      assert.ok(panel.body.slots.reviews);
      assert.equal(panel.body.slots.reviews.length, 3);
      assert.equal(panel.body.slots.brands.length, 6);
      assert.ok(panel.body.categories.reviews.some((cat) => cat.key === '_all'));
    } finally {
      cleanup();
    }
  });

  it('previews unsaved Index Heroes state without mutating content.json on disk', () => {
    const { root, cleanup } = makeDesktopFixture();

    try {
      const contentPath = join(root, 'config', 'data', 'content.json');
      const beforeDisk = JSON.parse(readFileSync(contentPath, 'utf8'));

      const [preview, panel] = runApiScenario(root, [
        {
          method: 'PUT',
          path: '/api/panels/index-heroes/preview',
          body: {
            overrides: {
              reviews: { _all: ['reviews:review-a'] },
              news: {},
              guides: {},
              brands: {},
            },
          },
        },
        { method: 'GET', path: '/api/panels/index-heroes' },
      ]);

      assert.equal(preview.status, 200);
      assert.deepEqual(preview.body.panel.overrides.reviews._all, ['reviews:review-a']);

      assert.equal(panel.status, 200);
      assert.deepEqual(panel.body.overrides.reviews._all, ['reviews:review-a']);

      const afterDisk = JSON.parse(readFileSync(contentPath, 'utf8'));
      assert.deepEqual(afterDisk, beforeDisk);
    } finally {
      cleanup();
    }
  });

  it('saves Index Heroes while preserving other Content-owned keys', () => {
    const { root, cleanup } = makeDesktopFixture();

    try {
      const contentPath = join(root, 'config', 'data', 'content.json');

      const [save] = runApiScenario(root, [
        {
          method: 'PUT',
          path: '/api/panels/index-heroes/save',
          body: {
            overrides: {
              reviews: { _all: ['reviews:review-a'] },
              news: {},
              guides: {},
              brands: {},
            },
          },
        },
      ]);

      assert.equal(save.status, 200);
      assert.deepEqual(save.body.panel.overrides.reviews._all, ['reviews:review-a']);

      const onDisk = JSON.parse(readFileSync(contentPath, 'utf8'));
      assert.deepEqual(onDisk.indexHeroes, {
        reviews: { _all: ['reviews:review-a'] },
        news: {},
        guides: {},
        brands: {},
      });
      assert.deepEqual(onDisk.slots['2'], { collection: 'guides', id: 'guide-a' });
      assert.deepEqual(onDisk.pinned, ['guides:guide-a']);
      assert.deepEqual(onDisk.badges, { 'guides:guide-a': 'Top Pick' });
      assert.deepEqual(onDisk.excluded, []);
    } finally {
      cleanup();
    }
  });
});
