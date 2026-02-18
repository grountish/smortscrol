import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const LOCAL_GALLERY_LIMIT_DEFAULT = toInt(process.env.LOCAL_GALLERY_LIMIT, 20);
const LOCAL_GALLERY_LIMIT_MAX = 50;
const LOCAL_GALLERY_DIR = path.join(process.cwd(), 'public', 'assets', 'local-gallery');
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toTitleFromFilename(fileName) {
  const base = fileName.replace(/\.[^/.]+$/, '');
  const cleaned = base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return 'Local photo';
  }
  return cleaned;
}

async function readGalleryFiles() {
  const dirEntries = await fs.readdir(LOCAL_GALLERY_DIR, { withFileTypes: true });

  return dirEntries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
}

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams;
  const offset = Math.max(0, toInt(searchParams.get('offset'), 0));
  const requestedLimit = toInt(searchParams.get('limit'), LOCAL_GALLERY_LIMIT_DEFAULT);
  const limit = Math.min(LOCAL_GALLERY_LIMIT_MAX, Math.max(1, requestedLimit));

  let fileNames = [];
  try {
    fileNames = await readGalleryFiles();
  } catch (error) {
    const code = error && typeof error === 'object' ? error.code : null;
    if (code !== 'ENOENT') {
      return NextResponse.json({ error: 'Could not read local gallery folder.' }, { status: 500 });
    }
  }

  if (!fileNames.length) {
    return NextResponse.json({ items: [], nextOffset: 0 });
  }

  const slice = fileNames.slice(offset, offset + limit);
  const items = slice.map((fileName, index) => ({
    id: `local-gallery-${offset + index}-${fileName}`,
    title: '*',
    detail: '_',
    tag: '-',
    imageUrl: `/assets/local-gallery/${encodeURIComponent(fileName)}`,
    webUrl: null,
  }));

  const nextOffset = offset + slice.length >= fileNames.length ? 0 : offset + slice.length;

  return NextResponse.json({
    items,
    nextOffset,
  });
}
