import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(ROOT_DIR, 'src/data');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets/avatars');

async function downloadAndOptimizeImage(url: string, outputPath: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) {
      console.warn(`    Failed to fetch ${url} (HTTP ${res.status})`);
      return false;
    }

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    await sharp(buffer)
      .resize(400, 400, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: 85 })
      .toFile(outputPath);

    return true;
  } catch (err: any) {
    console.warn(`    Sharp/Download error for ${url}:`, err.message);
    return false;
  }
}

async function main() {
  console.log('--- Starting Permanent Avatar Caching Pipeline ---');
  fs.mkdirSync(ASSETS_DIR, { recursive: true });

  const members = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'members.json'), 'utf-8'));
  const groups = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'groups.json'), 'utf-8'));
  const companies = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'companies.json'), 'utf-8'));

  let cachedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  // 1. Process Company Avatars
  console.log(`Processing avatars for ${companies.length} companies...`);
  for (const c of companies) {
    const outputPath = path.join(ASSETS_DIR, `company_${c.id}.webp`);
    const relPath = `assets/avatars/company_${c.id}.webp`;

    if (fs.existsSync(outputPath)) {
      c.avatar_cached_path = relPath;
      skippedCount++;
      continue;
    }

    const avatarUrl = c.sns.find((s: any) => s.avatar_url)?.avatar_url;
    if (avatarUrl) {
      console.log(`  [Company: ${c.name}] Downloading & converting to WebP...`);
      const success = await downloadAndOptimizeImage(avatarUrl, outputPath);
      if (success) {
        c.avatar_cached_path = relPath;
        cachedCount++;
      } else {
        failedCount++;
      }
    }
  }

  // 1. Process Group Avatars
  console.log(`Processing avatars for ${groups.length} groups...`);
  for (const g of groups) {
    const outputPath = path.join(ASSETS_DIR, `group_${g.id}.webp`);
    const relPath = `assets/avatars/group_${g.id}.webp`;

    // Find avatar URL
    const avatarUrl = g.sns.find((s: any) => s.avatar_url)?.avatar_url;
    if (!avatarUrl) {
      console.log(`  [Group: ${g.name}] No avatar URL found.`);
      continue;
    }

    if (fs.existsSync(outputPath)) {
      g.avatar_cached_path = relPath;
      skippedCount++;
      continue;
    }

    console.log(`  [Group: ${g.name}] Downloading & converting to WebP...`);
    const success = await downloadAndOptimizeImage(avatarUrl, outputPath);
    if (success) {
      g.avatar_cached_path = relPath;
      cachedCount++;
    } else {
      failedCount++;
    }
  }

  // 2. Process Member Avatars
  console.log(`Processing avatars for ${members.length} members...`);
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const outputPath = path.join(ASSETS_DIR, `${m.id}.webp`);
    const relPath = `assets/avatars/${m.id}.webp`;

    // Find avatar URL (prefer X, then any other SNS with avatar)
    const xSns = m.sns.find((s: any) => s.platform === 'x');
    const avatarUrl = xSns?.avatar_url || m.sns.find((s: any) => s.avatar_url)?.avatar_url;

    if (!avatarUrl) {
      continue;
    }

    if (fs.existsSync(outputPath)) {
      m.avatar_cached_path = relPath;
      skippedCount++;
      continue;
    }

    console.log(`  [${i + 1}/${members.length}] ${m.stage_name}: Downloading ${avatarUrl}...`);
    const success = await downloadAndOptimizeImage(avatarUrl, outputPath);
    if (success) {
      m.avatar_cached_path = relPath;
      cachedCount++;
    } else {
      failedCount++;
    }

    // Small stagger
    await new Promise(r => setTimeout(r, 50));
  }

  fs.writeFileSync(path.join(DATA_DIR, 'members.json'), JSON.stringify(members, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'groups.json'), JSON.stringify(groups, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'companies.json'), JSON.stringify(companies, null, 2));

  console.log('\n--- Avatar Caching Pipeline Finished ---');
  console.log(`  Newly cached: ${cachedCount}`);
  console.log(`  Already cached / skipped: ${skippedCount}`);
  console.log(`  Failed / missing: ${failedCount}`);
  console.log(`  Total stored in: ${ASSETS_DIR}`);
}

main().catch(console.error);
