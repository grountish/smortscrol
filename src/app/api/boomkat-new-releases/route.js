import { NextResponse } from 'next/server';

// Boomkat's HTML pages sit behind a Cloudflare bot challenge, but the site
// publishes the same listing as RSS and honours the same query params, so the
// feed is the only thing we fetch from boomkat.com.
const BOOMKAT_FEED_URL =
  process.env.BOOMKAT_FEED_URL ||
  'https://boomkat.com/new-releases.rss?per_page=200&q%5Bgenre%5D=46%2C49%2C48';
// Preview audio comes from the iTunes Search API (public, no key). Boomkat is a
// UK shop, so default to the GB storefront for better catalogue overlap.
const ITUNES_COUNTRY = process.env.BOOMKAT_ITUNES_COUNTRY || 'gb';
const ITUNES_SEARCH_BASE = 'https://itunes.apple.com/search';
const ITUNES_LOOKUP_BASE = 'https://itunes.apple.com/lookup';

const FEED_TTL_MS = 15 * 60 * 1000;
const PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;
// The feed is server-rendered with 200 full reviews and routinely needs ~11s
// to first byte, so it gets a far longer leash than the iTunes lookups.
const FEED_TIMEOUT_MS = 30000;
const LOOKUP_TIMEOUT_MS = 8000;
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;
// Roughly a fifth of releases have no preview anywhere on iTunes, so look at
// more candidates than we need and stop as soon as the page is full.
const LOOKUP_CONCURRENCY = 4;
const MAX_LOOKUPS_PER_REQUEST = 48;
const REVIEW_EXCERPT_MAX = 200;
const MAX_TRACKS = 60;

// Hang the caches off globalThis so Next's dev-mode HMR, which hands the route
// a fresh module instance on every recompile, doesn't throw away a warm feed.
const cacheHome =
  globalThis.__boomkatCache ||
  (globalThis.__boomkatCache = {
    feed: { at: 0, entries: null, inFlight: null, error: null },
    previews: new Map(),
  });
const feedCache = cacheHome.feed;
const previewCache = cacheHome.previews;

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = LOOKUP_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

// Worker pool rather than lockstep chunks, so one slow iTunes lookup delays
// only itself instead of the whole batch behind it.
async function mapWithConcurrency(values, concurrency, mapper) {
  const results = new Array(values.length);
  const workerCount = Math.max(1, Math.min(concurrency, values.length));
  let cursor = 0;

  const worker = async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      // eslint-disable-next-line no-await-in-loop
      results[index] = await mapper(values[index], index);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  eacute: 'é',
  egrave: 'è',
  uuml: 'ü',
  ouml: 'ö',
  auml: 'ä',
};

function decodeEntities(text) {
  return String(text || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

function stripTags(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' '),
  ).trim();
}

function readTag(block, name) {
  const match = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'i'));
  return match ? decodeEntities(match[1].trim()) : '';
}

// The description is a small HTML document: a cover <img>, a few metadata
// paragraphs, then the Boomkat review. Split on paragraph boundaries so the
// expanded card can render real paragraphs instead of one wall of text.
function readParagraphs(html) {
  const paragraphs = [];
  const pattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match = pattern.exec(html);
  while (match) {
    const text = stripTags(match[1]);
    if (text && !paragraphs.includes(text)) {
      paragraphs.push(text);
    }
    match = pattern.exec(html);
  }
  return paragraphs;
}

function readLabelledField(html, label) {
  const match = html.match(new RegExp(`${label}:\\s*([^<]+)<`, 'i'));
  return match ? decodeEntities(match[1]).trim() : '';
}

function readLabelledLink(html, label) {
  const match = html.match(new RegExp(`${label}:\\s*<a[^>]*>([^<]+)</a>`, 'i'));
  return match ? decodeEntities(match[1]).trim() : '';
}

function truncate(text, max) {
  const value = String(text || '').trim();
  if (value.length <= max) {
    return value;
  }
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function parseFeedEntry(block, index) {
  const rawTitle = readTag(block, 'title');
  if (!rawTitle) {
    return null;
  }

  const link = readTag(block, 'link');
  const guid = readTag(block, 'guid') || String(index);
  // <description> arrives HTML-escaped, so readTag has already unescaped it
  // into a real HTML fragment by the time we pick it apart.
  const description = readTag(block, 'description');

  const dashIndex = rawTitle.indexOf(' - ');
  const artist = dashIndex > 0 ? rawTitle.slice(0, dashIndex).trim() : '';
  const album = dashIndex > 0 ? rawTitle.slice(dashIndex + 3).trim() : rawTitle.trim();

  const imageMatch = description.match(/<img[^>]+src="([^"]+)"/i);
  const genre = readLabelledLink(description, 'Genre');
  const label = readLabelledLink(description, 'Label');

  // Drop the leading metadata paragraphs so the review starts at the prose.
  const reviewParagraphs = readParagraphs(description).filter(
    (para) => !/^(Genre|Label|Formats):/i.test(para),
  );

  return {
    guid,
    artist,
    album,
    rawTitle,
    link: link || null,
    pubDate: readTag(block, 'pubDate'),
    imageUrl: imageMatch ? decodeEntities(imageMatch[1]) : null,
    genre,
    label,
    formats: readLabelledField(description, 'Formats'),
    review: truncate(reviewParagraphs.join(' '), REVIEW_EXCERPT_MAX),
    reviewFull: reviewParagraphs.join('\n\n'),
  };
}

function startFeedLoad() {
  if (feedCache.inFlight) {
    return feedCache.inFlight;
  }

  feedCache.inFlight = (async () => {
    const response = await fetchWithTimeout(
      BOOMKAT_FEED_URL,
      { headers: { Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8' } },
      FEED_TIMEOUT_MS,
    );

    if (!response.ok) {
      throw new Error(`Boomkat feed responded ${response.status}.`);
    }

    const xml = await response.text();
    if (!/<rss/i.test(xml)) {
      throw new Error('Boomkat returned a non-RSS response.');
    }

    const entries = [];
    const itemPattern = /<item>([\s\S]*?)<\/item>/gi;
    let match = itemPattern.exec(xml);
    let index = 0;
    while (match) {
      const entry = parseFeedEntry(match[1], index);
      if (entry) {
        entries.push(entry);
      }
      index += 1;
      match = itemPattern.exec(xml);
    }

    feedCache.entries = entries;
    feedCache.at = Date.now();
    feedCache.error = null;
    return entries;
  })()
    .catch((error) => {
      feedCache.error = error?.message || 'Could not fetch the Boomkat feed.';
      throw error;
    })
    .finally(() => {
      feedCache.inFlight = null;
    });

  return feedCache.inFlight;
}

// Boomkat's feed needs ~11s to first byte, well past the client's per-source
// abort. So never block on it: kick off the load, serve whatever is cached
// (stale is fine), and let the next load-more pick up the fresh copy.
function getFeed() {
  const isFresh = feedCache.entries && Date.now() - feedCache.at < FEED_TTL_MS;
  if (!isFresh) {
    startFeedLoad().catch(() => {});
  }
  return feedCache.entries;
}

function normalizeForMatch(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Release titles carry a lot of shop furniture that iTunes never repeats.
function simplifyAlbum(album) {
  return normalizeForMatch(
    String(album || '')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\b(ep|lp|12|10|7|vol|volume)\b/gi, ' '),
  );
}

function tokenOverlap(left, right) {
  const leftTokens = new Set(left.split(' ').filter(Boolean));
  const rightTokens = new Set(right.split(' ').filter(Boolean));
  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }
  let shared = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      shared += 1;
    }
  });
  return shared / Math.min(leftTokens.size, rightTokens.size);
}

function looksLikeSameRelease(entry, result) {
  const wantAlbum = simplifyAlbum(entry.album);
  const gotAlbum = simplifyAlbum(result?.collectionName);
  if (!wantAlbum || !gotAlbum) {
    return false;
  }

  const albumMatch =
    gotAlbum.includes(wantAlbum) || wantAlbum.includes(gotAlbum) || tokenOverlap(wantAlbum, gotAlbum) >= 0.7;
  if (!albumMatch) {
    return false;
  }

  // "Various Artists" compilations never line up name-for-name.
  const wantArtist = normalizeForMatch(entry.artist);
  if (!wantArtist || /various/.test(wantArtist)) {
    return true;
  }

  const gotArtist = normalizeForMatch(`${result?.artistName || ''} ${result?.collectionArtistName || ''}`);
  return (
    gotArtist.includes(wantArtist) || wantArtist.includes(gotArtist) || tokenOverlap(wantArtist, gotArtist) >= 0.5
  );
}

// One matched song only tells us the album exists; the lookup gives us every
// track on it, each with its own preview.
async function fetchTracklist(collectionId) {
  const url = `${ITUNES_LOOKUP_BASE}?id=${encodeURIComponent(
    collectionId,
  )}&entity=song&limit=${MAX_TRACKS}&country=${ITUNES_COUNTRY}`;

  const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  const results = Array.isArray(payload?.results) ? payload.results : [];

  return results
    .filter((result) => result?.wrapperType === 'track' && result?.previewUrl)
    .sort(
      (left, right) =>
        (left.discNumber || 1) - (right.discNumber || 1) ||
        (left.trackNumber || 0) - (right.trackNumber || 0),
    )
    .map((result, index) => ({
      n: result.trackNumber || index + 1,
      name: result.trackName || `Track ${index + 1}`,
      audioUrl: result.previewUrl,
      seconds: Math.round((result.trackTimeMillis || 0) / 1000),
    }));
}

async function findPreview(entry) {
  const cached = previewCache.get(entry.guid);
  if (cached && Date.now() - cached.at < PREVIEW_TTL_MS) {
    return cached.value;
  }

  const term = `${entry.artist} ${entry.album}`.replace(/\s+/g, ' ').trim();
  const url = `${ITUNES_SEARCH_BASE}?term=${encodeURIComponent(
    term,
  )}&entity=song&limit=8&country=${ITUNES_COUNTRY}`;

  let value = null;
  try {
    const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });
    if (response.ok) {
      const payload = await response.json();
      const results = Array.isArray(payload?.results) ? payload.results : [];
      const hit = results.find((result) => result?.previewUrl && looksLikeSameRelease(entry, result));

      if (hit) {
        const tracks = hit.collectionId ? await fetchTracklist(hit.collectionId) : [];
        value = {
          // Fall back to the single matched song if the album lookup came back
          // empty, so a match is never wasted.
          tracks: tracks.length
            ? tracks
            : [
                {
                  n: hit.trackNumber || 1,
                  name: hit.trackName || entry.album,
                  audioUrl: hit.previewUrl,
                  seconds: Math.round((hit.trackTimeMillis || 0) / 1000),
                },
              ],
          artworkUrl: (hit.artworkUrl100 || '').replace(/\/\d+x\d+bb\.jpg$/, '/600x600bb.jpg') || null,
        };
      }
    }
  } catch {
    // A failed lookup is indistinguishable from "no preview" for our purposes;
    // don't cache it as a miss so the next request can retry.
    return null;
  }

  previewCache.set(entry.guid, { at: Date.now(), value });
  return value;
}

function buildItem(entry, preview) {
  const trackCount = preview.tracks.length;
  const runtime = preview.tracks.reduce((total, track) => total + (track.seconds || 0), 0);

  const teaserParts = [
    entry.artist && `Artist: ${entry.artist}`,
    entry.label && `Label: ${entry.label}`,
    `${trackCount} track${trackCount === 1 ? '' : 's'}`,
  ].filter(Boolean);
  const detail = [teaserParts.join(' - '), entry.review].filter(Boolean).join(' \u2014 ');

  // Everything the feed knows about the release, as one lead paragraph, then
  // the review itself. getParagraphs() on the client splits these on the
  // blank lines.
  const factParts = [
    entry.artist && `Artist: ${entry.artist}`,
    entry.label && `Label: ${entry.label}`,
    entry.genre && `Genre: ${entry.genre}`,
    entry.formats && `Formats: ${entry.formats}`,
    entry.pubDate && `Released: ${entry.pubDate}`,
    `${trackCount} track${trackCount === 1 ? '' : 's'}`,
    runtime > 0 && `${Math.round(runtime / 60)} min`,
  ].filter(Boolean);

  const detailFull = [factParts.join(' \u00b7 '), entry.reviewFull].filter(Boolean).join('\n\n');

  return {
    id: `boomkat-${entry.guid}`,
    title: entry.album || entry.rawTitle,
    detail,
    detailFull,
    tag: entry.genre ? `Boomkat - ${entry.genre}` : 'Boomkat',
    imageUrl: entry.imageUrl || preview.artworkUrl || null,
    audioUrl: preview.tracks[0].audioUrl,
    tracks: preview.tracks,
    webUrl: entry.link,
  };
}

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams;
  const offset = Math.max(0, toInt(searchParams.get('offset'), 0));
  const limit = Math.min(MAX_LIMIT, Math.max(1, toInt(searchParams.get('limit'), DEFAULT_LIMIT)));

  const entries = getFeed();

  if (!entries) {
    if (feedCache.error && !feedCache.inFlight) {
      return NextResponse.json({ error: feedCache.error }, { status: 502 });
    }
    // First hit of a cold cache: hand back an empty batch so the feed simply
    // skips Boomkat this round rather than waiting on the upstream fetch.
    return NextResponse.json({ items: [], nextOffset: offset, warming: true });
  }

  if (!entries.length) {
    return NextResponse.json({ items: [], nextOffset: 0 });
  }

  const items = [];
  let cursor = offset % entries.length;
  let looked = 0;

  // Walk the feed in windows, keeping only releases that actually resolved to a
  // preview, until the page is full or we've spent our lookup budget.
  while (items.length < limit && looked < MAX_LOOKUPS_PER_REQUEST && cursor < entries.length) {
    const windowSize = Math.min(
      Math.max(limit - items.length, LOOKUP_CONCURRENCY),
      MAX_LOOKUPS_PER_REQUEST - looked,
      entries.length - cursor,
    );
    const window = entries.slice(cursor, cursor + windowSize);
    cursor += windowSize;
    looked += windowSize;

    // eslint-disable-next-line no-await-in-loop
    const previews = await mapWithConcurrency(window, LOOKUP_CONCURRENCY, findPreview);

    window.forEach((entry, index) => {
      const preview = previews[index];
      if (preview?.tracks?.length && items.length < limit) {
        items.push(buildItem(entry, preview));
      }
    });
  }

  const nextOffset = cursor >= entries.length ? 0 : cursor;

  return NextResponse.json({ items, nextOffset });
}
