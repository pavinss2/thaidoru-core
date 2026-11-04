// Fills `color.shade` on memberships that don't have one yet, guessing from
// the color name (then hex). Never overwrites a shade that is already set,
// so hand fixes stick. Run after adding members: `npm run fill:shades`.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { guessShade } from '../schemas/color-shade.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FILE = path.join(ROOT_DIR, 'src/data/memberships.json');

const memberships = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
let filled = 0;
for (const ms of memberships) {
  if (!ms.color || ms.color.shade !== undefined) continue;
  // Rebuild so the key order stays name, hex, shade.
  ms.color = { name: ms.color.name, hex: ms.color.hex, shade: guessShade(ms.color.name, ms.color.hex) };
  filled++;
  console.log(`  ${ms.id}: "${ms.color.name}" ${ms.color.hex} -> ${ms.color.shade ?? 'null (unknown)'}`);
}
fs.writeFileSync(FILE, JSON.stringify(memberships, null, 2) + '\n');
console.log(`Filled ${filled} shade(s).`);
