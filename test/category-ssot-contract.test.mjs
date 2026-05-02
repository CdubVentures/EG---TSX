import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

function readJson(relPath) {
  return JSON.parse(readFileSync(join(ROOT, relPath), 'utf-8'));
}

function readText(relPath) {
  return readFileSync(join(ROOT, relPath), 'utf-8');
}

describe('category single source of truth contract', () => {
  it('categories.json defines collection capabilities per category', () => {
    const data = readJson('config/data/categories.json');

    for (const category of data.categories) {
      assert.equal(typeof category.collections, 'object',
        `${category.id} must define collections capability metadata`);

      for (const key of ['dataProducts', 'reviews', 'guides', 'news']) {
        assert.equal(typeof category.collections[key], 'boolean',
          `${category.id}.collections.${key} must be boolean`);
      }
    }
  });

  it('content.config.ts derives category validation from the shared contract module', () => {
    const content = readText('src/content.config.ts');

    assert.match(
      content,
      /from ['"]\.\/core\/category-contract['"]/,
      'content.config.ts must import the shared category contract module'
    );

    assert.doesNotMatch(
      content,
      /const categories = z\.enum\(\[/,
      'content.config.ts must not hardcode product category enums'
    );

    assert.doesNotMatch(
      content,
      /const reviewCategories = z\.enum\(\[/,
      'content.config.ts must not hardcode review category enums'
    );

    assert.doesNotMatch(
      content,
      /const newsCategories = z\.enum\(\[/,
      'content.config.ts must not hardcode news category enums'
    );
  });

  it('core config reads categories through the shared contract module', () => {
    const content = readText('src/core/config.ts');

    assert.match(
      content,
      /from ['"]\.\/category-contract['"]/,
      'src/core/config.ts must import the shared category contract module'
    );

    assert.doesNotMatch(
      content,
      /config\/data\/categories\.json/,
      'src/core/config.ts must not read categories.json directly'
    );
  });

  it('categories panel seeds collection metadata for new categories', () => {
    const content = readText('config/panels/categories.py');

    assert.match(
      content,
      /def default_collections\(\)(?:\s*->\s*dict)?:/,
      'config/panels/categories.py must define canonical collection defaults for new categories'
    );

    assert.match(
      content,
      /"collections": default_collections\(\)/,
      'config/panels/categories.py must write collection metadata when it creates a new category'
    );
  });

  it('vault DynamoDB table name matches the documented env contract', () => {
    const content = readText('src/features/vault/server/db.ts');

    assert.match(
      content,
      /DYNAMO_PROFILES_TABLE/,
      'vault db must read DYNAMO_PROFILES_TABLE so it matches .env.example and deployment docs'
    );

    assert.doesNotMatch(
      content,
      /DYNAMODB_TABLE_NAME/,
      'vault db must not use the undocumented DYNAMODB_TABLE_NAME env var'
    );
  });
});

describe('repo validation contract', () => {
  it('package.json exposes a dedicated JS test script', () => {
    const pkg = readJson('package.json');

    assert.equal(
      pkg.scripts['test:js'],
      'node --import tsx --test "test/**/*.test.mjs" "src/**/*.test.mjs"',
      'package.json must define test:js as the canonical Node test command'
    );
  });

  it('package.json test script delegates to the JS suite', () => {
    const pkg = readJson('package.json');

    assert.equal(
      pkg.scripts.test,
      'npm run test:js',
      'npm test must delegate to the shared JS test entrypoint'
    );
  });

  it('package.json exposes the Python config-suite entrypoint', () => {
    const pkg = readJson('package.json');

    assert.equal(
      pkg.scripts['test:py'],
      'python -m pytest config/tests',
      'package.json must define test:py for the unified config tool suite'
    );
  });

  it('package.json validate script runs type-check, JS tests, and Python tests', () => {
    const pkg = readJson('package.json');

    assert.equal(
      pkg.scripts.validate,
      'npm run type-check && npm run test:js && npm run test:py',
      'validate must cover both TS and Python config-tool contracts'
    );
  });

  it('tsconfig excludes generated build artifacts from type-checking', () => {
    const tsconfig = readJson('tsconfig.json');
    const exclude = new Set(tsconfig.exclude ?? []);

    assert.ok(
      exclude.has('infrastructure/aws/build'),
      'tsconfig must exclude infrastructure/aws/build generated artifacts'
    );
  });
});
