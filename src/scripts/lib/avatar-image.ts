import sharp from 'sharp';

export const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Download an image and return it as a 400x400 WebP buffer, or null on failure. */
export async function fetchAsWebp(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA } });
    if (!res.ok) {
      console.warn(`    Failed to fetch ${url} (HTTP ${res.status})`);
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    return await sharp(buffer)
      .resize(400, 400, { fit: 'cover', position: 'center' })
      .webp({ quality: 85 })
      .toBuffer();
  } catch (err: any) {
    console.warn(`    Sharp/Download error for ${url}:`, err.message);
    return null;
  }
}

/** Download an image and write it to outputPath as a 400x400 WebP. */
export async function downloadAndOptimizeImage(url: string, outputPath: string): Promise<boolean> {
  const webp = await fetchAsWebp(url);
  if (!webp) return false;
  await sharp(webp).toFile(outputPath);
  return true;
}

async function thumbprint(img: Buffer | string): Promise<Buffer> {
  return sharp(img).resize(16, 16, { fit: 'fill' }).grayscale().raw().toBuffer();
}

/**
 * True when two images show the same picture, even if they were encoded
 * differently (re-compression changes bytes, not the picture).
 */
export async function looksSame(a: Buffer | string, b: Buffer | string, tolerance = 6): Promise<boolean> {
  try {
    const [ta, tb] = await Promise.all([thumbprint(a), thumbprint(b)]);
    let diff = 0;
    for (let i = 0; i < ta.length; i++) diff += Math.abs(ta[i] - tb[i]);
    return diff / ta.length <= tolerance;
  } catch {
    return false;
  }
}
