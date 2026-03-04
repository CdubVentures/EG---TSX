import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const scriptPath = resolve(process.cwd(), 'photoshop', 'png-all-options.jsx');
const script = readFileSync(scriptPath, 'utf8');

function presetBlock(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`"${escaped}"\\s*:\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, 'm');
  const match = script.match(re);
  assert.ok(match, `Expected preset block for ${name}`);
  return match[1];
}

test('professional output names are defined for all core brand/logo presets', () => {
  const expected = {
    logo_color: 'brand-logo-horizontal-primary',
    logo_white: 'brand-logo-horizontal-mono-white',
    logo_black: 'brand-logo-horizontal-mono-black',
    logo_index: 'brand-logo-horizontal-index',
    logo_text_black: 'brand-wordmark-horizontal-mono-black',
    logo_text_white: 'brand-wordmark-horizontal-mono-white',
    logo_text_white_2: 'brand-wordmark-horizontal-mono-warmgray',
    logo_text_black_vertical: 'brand-wordmark-vertical-mono-black',
    logo_text_white_vertical: 'brand-wordmark-vertical-mono-white',
    logo_text_white_2_vertical: 'brand-wordmark-vertical-mono-warmgray'
  };

  for (const [preset, output] of Object.entries(expected)) {
    const block = presetBlock(preset);
    assert.match(
      block,
      new RegExp(`outputBaseName:\\s*"${output}"`),
      `Missing professional outputBaseName for ${preset}`
    );
  }
});

test('export path uses mapped output base name, not raw preset key', () => {
  assert.match(script, /var saveBaseName = getOutputBaseName\(mainName\);/, 'Expected save base name resolution');
  assert.match(script, /new File\(docFolder\.fsName \+ \"\/\" \+ saveBaseName \+ suffix \+ \"\.png\"\)/, 'Expected save path to use mapped output name');
});
