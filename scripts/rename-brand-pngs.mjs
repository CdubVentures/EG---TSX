import { resolve } from 'node:path';
import { buildRenamePlan, executeRenamePlan } from './brand-png-renamer.mjs';

const targetDir = resolve(process.cwd(), 'public', 'images', 'brands');
const plan = buildRenamePlan({ rootDir: targetDir });

if (plan.length === 0) {
  console.log('No PNG files needed renaming.');
  process.exit(0);
}

const result = executeRenamePlan({ plan });
console.log(`Renamed ${result.renamedCount} PNG files in ${targetDir}`);
