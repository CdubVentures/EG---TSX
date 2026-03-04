import { readdirSync, renameSync, existsSync } from 'node:fs';
import { extname, basename, dirname, join, resolve } from 'node:path';

const KNOWN_STEM_MAP = {
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

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'asset';
}

function splitStemAndSize(fileName) {
  const stem = basename(fileName, '.png');
  const idx = stem.lastIndexOf('_');
  if (idx <= 0) return { rawStem: stem, sizeToken: '' };
  return {
    rawStem: stem.slice(0, idx),
    sizeToken: stem.slice(idx + 1)
  };
}

function toProfessionalStem(rawStem) {
  if (Object.prototype.hasOwnProperty.call(KNOWN_STEM_MAP, rawStem)) {
    return KNOWN_STEM_MAP[rawStem];
  }
  return `brand-legacy-${slugify(rawStem)}`;
}

function walkPngs(rootDir) {
  const files = [];
  const stack = [resolve(rootDir)];
  while (stack.length > 0) {
    const cur = stack.pop();
    const entries = readdirSync(cur, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(cur, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (entry.isFile() && extname(entry.name).toLowerCase() === '.png') {
        files.push(full);
      }
    }
  }
  return files;
}

function ensureUniqueTarget(targetPath, usedTargets) {
  if (!usedTargets.has(targetPath) && !existsSync(targetPath)) {
    usedTargets.add(targetPath);
    return targetPath;
  }
  const dir = dirname(targetPath);
  const ext = extname(targetPath);
  const baseNoExt = basename(targetPath, ext);
  let n = 2;
  while (true) {
    const candidate = join(dir, `${baseNoExt}-${n}${ext}`);
    if (!usedTargets.has(candidate) && !existsSync(candidate)) {
      usedTargets.add(candidate);
      return candidate;
    }
    n += 1;
  }
}

export function buildRenamePlan({ rootDir }) {
  const files = walkPngs(rootDir);
  const usedTargets = new Set();
  const plan = [];

  for (const fromPath of files) {
    const fromFileName = basename(fromPath);
    const { rawStem, sizeToken } = splitStemAndSize(fromFileName);
    const mappedStem = toProfessionalStem(rawStem);
    const toFileName = sizeToken
      ? `${mappedStem}_${sizeToken}.png`
      : `${mappedStem}.png`;

    let toPath = join(dirname(fromPath), toFileName);
    toPath = ensureUniqueTarget(toPath, usedTargets);

    if (fromPath === toPath) {
      continue;
    }

    plan.push({
      fromPath,
      toPath,
      fromFileName,
      toFileName: basename(toPath)
    });
  }

  return plan;
}

export function executeRenamePlan({ plan }) {
  const staged = [];
  for (let i = 0; i < plan.length; i += 1) {
    const step = plan[i];
    const tmpPath = join(dirname(step.fromPath), `.rename_tmp_${i}.png`);
    renameSync(step.fromPath, tmpPath);
    staged.push({ ...step, tmpPath });
  }

  for (const step of staged) {
    renameSync(step.tmpPath, step.toPath);
  }

  return { renamedCount: staged.length };
}
