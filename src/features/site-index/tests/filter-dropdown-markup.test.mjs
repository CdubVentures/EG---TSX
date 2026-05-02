import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dropdownPath = path.resolve(__dirname, '..', 'components', 'FilterDropdown.astro');
const source = readFileSync(dropdownPath, 'utf8');

describe('FilterDropdown markup contract', () => {
  it('uses a real button to control the filter menu', () => {
    assert.match(
      source,
      /<button[\s\S]*type="button"[\s\S]*class="site-index__filterButton"[\s\S]*aria-label=\{`Filter \$\{type\}`\}[\s\S]*aria-controls=\{menuId\}/,
      'FilterDropdown must use a button with an aria-controls relationship'
    );
    assert.doesNotMatch(
      source,
      /role="button"/,
      'FilterDropdown must not emulate a button with role="button"'
    );
  });

  it('uses navigation links instead of listbox semantics', () => {
    assert.match(
      source,
      /<nav[\s\S]*id=\{menuId\}[\s\S]*class="site-index__filterMenu"/,
      'FilterDropdown must expose the menu as navigation'
    );
    assert.match(
      source,
      /aria-current=\{cat\.active \? 'page' : undefined\}/,
      'FilterDropdown must expose aria-current on the active filter link'
    );
    assert.doesNotMatch(source, /role="listbox"/, 'FilterDropdown must not use listbox semantics');
    assert.doesNotMatch(source, /role="option"/, 'FilterDropdown links must not use option roles');
  });
});
