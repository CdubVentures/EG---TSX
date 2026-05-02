import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const scriptPath = resolve(process.cwd(), 'tools', 'photoshop', 'png-all-options.jsx');
const script = readFileSync(scriptPath, 'utf8');

function presetBlock(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`"${escaped}"\\s*:\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, 'm');
  const match = script.match(re);
  assert.ok(match, `Expected preset block for ${name}`);
  return match[1];
}

test('logo_text_black_vertical uses vertical rotation contract', () => {
  const block = presetBlock('logo_text_black_vertical');
  assert.match(block, /mode:\s*"H"/, 'Expected height-based mode for vertical preset');
  assert.match(block, /rotate:\s*-90/, 'Expected -90 degree rotation for vertical preset');
});
