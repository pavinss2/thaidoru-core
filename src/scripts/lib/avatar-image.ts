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

/** True only when both images are identical in every pixel (same size, same RGBA values). */
export async function samePixels(a: Buffer | string, b: Buffer | string): Promise<boolean> {
  try {
    const [ra, rb] = await Promise.all(
      [a, b].map(img => sharp(img).ensureAlpha().raw().toBuffer({ resolveWithObject: true }))
    );
    return ra.info.width === rb.info.width && ra.info.height === rb.info.height && ra.data.equals(rb.data);
  } catch {
    return false;
  }
}
