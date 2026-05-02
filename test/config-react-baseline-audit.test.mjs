import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
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
const APP_SOURCE = readFileSync(join(ROOT, 'config', 'ui', 'app.tsx'), 'utf8');
const APP_CSS = readFileSync(join(ROOT, 'config', 'ui', 'app.css'), 'utf8');

function writeText(filePath, text) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, text, 'utf8');
}

function writeJson(filePath, value) {
  writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function makeDesktopFixture() {
  const root = mkdtempSync(join(tmpdir(), 'eg-config-baseline-'));
  const cleanup = () => rmSync(root, { recursive: true, force: true });

  writeJson(join(root, 'config', 'data', 'categories.json'), {
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
  });

  writeJson(join(root, 'config', 'data', 'content.json'), {
    slots: {},
    pinned: [],
    badges: {},
    excluded: [],
  });

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

  for (const [collection, slug, withCategory] of [
    ['reviews', 'review-a', true],
    ['guides', 'guide-a', true],
    ['news', 'news-a', true],
    ['brands', 'brand-a', false],
    ['games', 'game-a', false],
  ]) {
    const frontmatter = [
      '---',
      `title: ${slug}`,
      withCategory ? 'category: mouse' : '',
      'datePublished: 2025-01-02',
      `hero: ${slug}`,
      'publish: true',
      'draft: false',
      '---',
      'body',
      '',
    ]
      .filter(Boolean)
      .join('\n');
    writeText(join(root, 'src', 'content', collection, slug, 'index.md'), frontmatter);
  }

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
sys.path.insert(0, str(repo_root / "config"))

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

        results.append({
            "status": response.status_code,
            "body": response.json(),
        })

print(json.dumps(results))
`;

function runApiScenario(projectRoot, steps) {
  const result = spawnSync(
    'python',
    ['-c', API_SCENARIO_SCRIPT, ROOT, projectRoot, JSON.stringify(steps)],
    { cwd: ROOT, encoding: 'utf8' },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Python API scenario failed');
  }

  return JSON.parse(result.stdout);
}

describe('React baseline audit contracts', () => {
  it('uses tokenized zero-radius styling for the sidebar wordmark in legacy dark mode', () => {
    assert.match(
      APP_CSS,
      /\.sidebar__logo-wordmark\s*\{[\s\S]*border-radius:\s*var\(--radius-control\);/m,
    );
    assert.doesNotMatch(
      APP_CSS,
      /\.sidebar__logo-wordmark\s*\{[\s\S]*border-radius:\s*2px;/m,
    );
  });

  it('refreshes Content payload after Categories preview for live cross-panel propagation', () => {
    const previewStart = APP_SOURCE.indexOf(
      "apiJson<PreviewPayload<CategoriesPanelPayload>>('/api/panels/categories/preview'",
    );
    assert.notEqual(previewStart, -1, 'Missing categories preview effect');

    const previewSegment = APP_SOURCE.slice(previewStart, previewStart + 2000);
    assert.match(previewSegment, /apiJson<DesktopContentPanelPayload>\('\/api\/panels\/content'\)/);
  });

  it('refreshes Index Heroes after Navbar preview so transient brand category edits propagate live', () => {
    const previewStart = APP_SOURCE.indexOf(
      "apiJson<PreviewPayload<NavbarPanelPayload>>('/api/panels/navbar/preview'",
    );
    const previewEnd = APP_SOURCE.indexOf(
      "  useEffect(() => {\n    if (!slideshowPanel || !isSlideshowDirty) {",
      previewStart,
    );

    assert.notEqual(previewStart, -1, 'Missing navbar preview effect');
    assert.notEqual(previewEnd, -1, 'Missing navbar preview effect boundary');

    const previewSegment = APP_SOURCE.slice(previewStart, previewEnd);
    assert.match(
      previewSegment,
      /apiJson<IndexHeroesPanelPayload>\([\s\S]*'\/api\/panels\/index-heroes'/,
    );
  });

  it('refreshes Index Heroes after Navbar save so follow-up edits reflect saved frontmatter state', () => {
    const saveStart = APP_SOURCE.indexOf('  const saveNavbar = () => {');
    const saveEnd = APP_SOURCE.indexOf('  const saveSlideshow = () => {', saveStart);

    assert.notEqual(saveStart, -1, 'Missing saveNavbar handler');
    assert.notEqual(saveEnd, -1, 'Missing saveNavbar handler boundary');

    const saveSegment = APP_SOURCE.slice(saveStart, saveEnd);
    assert.match(
      saveSegment,
      /apiJson<IndexHeroesPanelPayload>\([\s\S]*'\/api\/panels\/index-heroes'/,
    );
  });

  it('refreshes Index Heroes in the global save queue when Navbar is persisted through Ctrl+S', () => {
    const saveStart = APP_SOURCE.indexOf("            case 'Navbar': {");
    const saveEnd = APP_SOURCE.indexOf("            case 'Slideshow': {", saveStart);

    assert.notEqual(saveStart, -1, 'Missing global-save Navbar case');
    assert.notEqual(saveEnd, -1, 'Missing global-save Navbar case boundary');

    const saveSegment = APP_SOURCE.slice(saveStart, saveEnd);
    assert.match(
      saveSegment,
      /apiJson<IndexHeroesPanelPayload>\([\s\S]*'\/api\/panels\/index-heroes'/,
    );
  });

  it('refreshes Navbar when Categories change externally so dependent labels and colors stay current', () => {
    const watchStart = APP_SOURCE.indexOf('          const nextCategoryVersion = payload.versions.categories ?? 0;');
    const watchEnd = APP_SOURCE.indexOf('          const nextContentVersion = payload.versions.content ?? 0;', watchStart);

    assert.notEqual(watchStart, -1, 'Missing categories watch branch');
    assert.notEqual(watchEnd, -1, 'Missing categories watch branch boundary');

    const watchSegment = APP_SOURCE.slice(watchStart, watchEnd);
    assert.match(watchSegment, /apiJson<NavbarPanelPayload>\('\/api\/panels\/navbar'\)/);
  });

  it('refreshes Index Heroes when Navbar changes externally so saved brand/category edits stay in sync', () => {
    const watchStart = APP_SOURCE.indexOf('          const nextNavSectionsVersion = payload.versions.nav_sections ?? 0;');
    const watchEnd = APP_SOURCE.indexOf('          const nextSlideshowVersion = payload.versions.slideshow ?? 0;', watchStart);

    assert.notEqual(watchStart, -1, 'Missing navbar watch branch');
    assert.notEqual(watchEnd, -1, 'Missing navbar watch branch boundary');

    const watchSegment = APP_SOURCE.slice(watchStart, watchEnd);
    assert.match(
      watchSegment,
      /apiJson<IndexHeroesPanelPayload>\('\/api\/panels\/index-heroes'\)/,
    );
  });

  it('keeps backend preview behavior aligned: category color preview is visible in Content without save', () => {
    const { root, cleanup } = makeDesktopFixture();

    try {
      const [before, preview, after] = runApiScenario(root, [
        { method: 'GET', path: '/api/panels/content' },
        {
          method: 'PUT',
          path: '/api/panels/categories/preview',
          body: {
            siteColors: { primary: '#123456', secondary: '#654321' },
            categories: [
              {
                id: 'mouse',
                label: 'Mouse',
                plural: 'Mice',
                color: '#ff0000',
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
          },
        },
        { method: 'GET', path: '/api/panels/content' },
      ]);

      assert.equal(before.status, 200);
      assert.equal(preview.status, 200);
      assert.equal(after.status, 200);
      assert.equal(before.body.tabs.reviews[0].categoryColor, '#00aeff');
      assert.equal(after.body.tabs.reviews[0].categoryColor, '#ff0000');
    } finally {
      cleanup();
    }
  });
});
