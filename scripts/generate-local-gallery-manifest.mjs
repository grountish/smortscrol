import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const GALLERY_DIR = path.join(ROOT, 'public', 'assets', 'local-gallery');
const MANIFEST_PATH = path.join(GALLERY_DIR, 'manifest.json');
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

async function main() {
  let fileNames = [];

  try {
    const entries = await fs.readdir(GALLERY_DIR, { withFileTypes: true });

    fileNames = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => name !== 'manifest.json')
      .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
  } catch (error) {
    const code = error && typeof error === 'object' ? error.code : null;
    if (code !== 'ENOENT') {
      throw error;
    }

    await fs.mkdir(GALLERY_DIR, { recursive: true });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    files: fileNames,
  };

  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`[local-gallery] manifest written (${fileNames.length} files)`);
}

main().catch((error) => {
  console.error('[local-gallery] failed to generate manifest');
  console.error(error);
  process.exitCode = 1;
});
