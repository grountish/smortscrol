import { NextResponse } from 'next/server';

// Are.na's public v2 API needs no key for reads. Everything here is a GET
// against published channels.
//
// Why this route exists rather than calling are.na from the browser: a page of
// channel contents is ~15x larger than the handful of fields a card needs,
// picking what to show takes a second round trip the client would have to wait
// on, and the results are identical for every visitor, so a shared server cache
// turns a cold multi-request walk into one warm response.
const ARENA_API = 'https://api.are.na/v2';

// Channels picked by hand. These anchor the feed: they are always in rotation,
// and they seed the related-channel graph below.
const SEED_CHANNEL_SLUGS = (process.env.ARENA_SEED_CHANNELS || '')
  .split(',')
  .map((slug) => slug.trim())
  .filter(Boolean)
  .concat([
    'a-vqfnj7we8xk',
    'drawn-learnt',
    'artbreader',
    'general-design-mrmc7kznmku',
    'layout-hierarchy-aesthetics',
  ]);

// Changing the seed list has to invalidate the harvested graph, which outlives
// a code reload because it is cached on globalThis. Without this key, editing
// the list above would keep serving the previous list for up to RELATED_TTL_MS.
const SEED_SIGNATURE = SEED_CHANNEL_SLUGS.join(',');

// Keyword discovery, used on alternating turns so the feed still wanders past
// the seeds. The generic explore endpoint (/v2/channels) is not used: sampled
// pages ran 0-4 usable channels out of 10, median channel length 1, because it
// is sorted by recent activity. Search returns 15-20 usable out of 20.
const DISCOVERY_TERMS = [
  'collage',
  'risograph',
  'brutalism',
  'textile',
  'photography',
  'typography',
  'poster design',
  'zine',
  'ceramics',
  'botanical illustration',
  'analog photography',
  'graphic design archive',
  'book cover',
  'album artwork',
  'architecture drawing',
  'illustration',
  'printmaking',
  'sculpture',
  'colour study',
  'signage',
  'weaving',
  'photobook',
  'exhibition design',
];

const SEARCH_TTL_MS = 30 * 60 * 1000;
const CONTENTS_TTL_MS = 15 * 60 * 1000;
const RELATED_TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10000;
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;
const CHANNELS_PER_TERM = 20;
const CONTENTS_PER_PAGE = 24;
// Channels shorter than this are usually abandoned drafts.
const MIN_CHANNEL_LENGTH = 20;
// Give up rather than walk the whole of are.na looking for a page of images.
const MAX_CHANNEL_HOPS = 12;
// The point of this source is discovering channels, so a batch spans several
// rather than draining one.
const MAX_PER_CHANNEL = 2;
// How deep to look inside each seed for nested channel blocks.
const RELATED_HARVEST_PAGES = 2;

// Hang caches off globalThis so Next's dev-mode HMR, which hands the route a
// fresh module instance on every recompile, doesn't throw away a warm cache.
// Each slot is filled in individually rather than assuming the whole object:
// a surviving cache from an older version of this file would otherwise be
// missing any newly added slot, and reading through it throws.
const cacheHome = (globalThis.__arenaCache ||= {});
cacheHome.search ||= new Map();
cacheHome.contents ||= new Map();
cacheHome.channel ||= new Map();
cacheHome.related ||= { at: 0, value: null, inFlight: null, seeds: null };
if (cacheHome.related.seeds && cacheHome.related.seeds !== SEED_SIGNATURE) {
  cacheHome.related = { at: 0, value: null, inFlight: null, seeds: null };
}

const searchCache = cacheHome.search;
const contentsCache = cacheHome.contents;
const channelCache = cacheHome.channel;

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Are.na responded ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function readCache(store, key, ttlMs) {
  const hit = store.get(key);
  if (!hit || Date.now() - hit.at > ttlMs) {
    return null;
  }
  return hit.value;
}

function writeCache(store, key, value, maxEntries = 300) {
  store.set(key, { at: Date.now(), value });
  if (store.size > maxEntries) {
    // Maps iterate in insertion order, so the first key is the oldest.
    store.delete(store.keys().next().value);
  }
}

// Channels worth pulling images from: populated, not flagged, readable.
// `status` is deliberately not filtered - "closed" only means other people
// can't add blocks, the contents are still public. All four seeds are "closed".
function isUsableChannel(channel) {
  return (
    channel &&
    !channel['nsfw?'] &&
    typeof channel.slug === 'string' &&
    Number.isFinite(channel.length) &&
    channel.length >= MIN_CHANNEL_LENGTH
  );
}

function toChannelRef(channel) {
  return {
    slug: channel.slug,
    title: (channel.title || channel.slug || '').trim(),
    length: channel.length,
  };
}

async function getChannel(slug) {
  const cached = readCache(channelCache, slug, RELATED_TTL_MS);
  if (cached) {
    return cached;
  }
  const json = await fetchJson(`${ARENA_API}/channels/${encodeURIComponent(slug)}`);
  const ref = toChannelRef(json);
  writeCache(channelCache, slug, ref);
  return ref;
}

async function fetchChannelPage(slug, page) {
  const key = `${slug}:${page}`;
  const cached = readCache(contentsCache, key, CONTENTS_TTL_MS);
  if (cached) {
    return cached;
  }

  const json = await fetchJson(
    `${ARENA_API}/channels/${encodeURIComponent(slug)}/contents?page=${page}&per=${CONTENTS_PER_PAGE}`,
  );
  const contents = Array.isArray(json?.contents) ? json.contents : [];
  writeCache(contentsCache, key, contents);
  return contents;
}

async function searchChannels(term) {
  const key = term.toLowerCase();
  const cached = readCache(searchCache, key, SEARCH_TTL_MS);
  if (cached) {
    return cached;
  }

  const json = await fetchJson(
    `${ARENA_API}/search/channels?q=${encodeURIComponent(term)}&per=${CHANNELS_PER_TERM}&page=1`,
  );
  const channels = (Array.isArray(json?.channels) ? json.channels : [])
    .filter(isUsableChannel)
    .map(toChannelRef);

  writeCache(searchCache, key, channels);
  return channels;
}

// The curated lane: the seeds, plus every channel their curators nested inside
// them. A Channel-class block is a deliberate "this belongs with that" link, so
// it tracks taste far better than a keyword search does. Are.na documents a
// /channels/:id/channels endpoint for exactly this, but it 404s on both slug
// and numeric id, so the nested blocks are the way in.
async function getCuratedChannels() {
  const cache = cacheHome.related;
  if (cache.value && cache.seeds === SEED_SIGNATURE && Date.now() - cache.at < RELATED_TTL_MS) {
    return cache.value;
  }
  if (cache.inFlight) {
    return cache.inFlight;
  }

  cache.inFlight = (async () => {
    const bySlug = new Map();

    const addChannel = (ref) => {
      if (ref && isUsableChannel(ref) && !bySlug.has(ref.slug)) {
        bySlug.set(ref.slug, ref);
      }
    };

    // Seeds first, so they always lead the rotation.
    const seeds = await Promise.all(
      SEED_CHANNEL_SLUGS.map((slug) => getChannel(slug).catch(() => null)),
    );
    seeds.forEach(addChannel);

    // Then whatever those seeds point at.
    await Promise.all(
      SEED_CHANNEL_SLUGS.map(async (slug) => {
        for (let page = 1; page <= RELATED_HARVEST_PAGES; page += 1) {
          try {
            // eslint-disable-next-line no-await-in-loop
            const contents = await fetchChannelPage(slug, page);
            contents
              .filter((block) => block?.class === 'Channel')
              .forEach((block) => addChannel(toChannelRef(block)));
            if (contents.length < CONTENTS_PER_PAGE) {
              break;
            }
          } catch {
            break;
          }
        }
      }),
    );

    const list = Array.from(bySlug.values());
    cacheHome.related = { at: Date.now(), value: list, inFlight: null, seeds: SEED_SIGNATURE };
    return list;
  })();

  try {
    return await cache.inFlight;
  } catch {
    cacheHome.related = { at: 0, value: null, inFlight: null, seeds: null };
    return SEED_CHANNEL_SLUGS.map((slug) => ({ slug, title: slug, length: MIN_CHANNEL_LENGTH }));
  }
}

// Are.na serves five renditions. `original` measured 1294KB against `display`
// at 149KB for the same block, and these cards are ~600px wide on desktop and
// full-bleed on a phone, so `display` is the one worth shipping.
function pickImageUrl(block) {
  const image = block?.image;
  if (!image) {
    return null;
  }
  return image.display?.url || image.large?.url || image.original?.url || null;
}

// Link blocks carry a thumbnail too, but it is whatever OG image the linked
// page happened to expose - logos, screenshots, article headers. This source is
// for looking at things, so only blocks that are themselves an image count.
const VISUAL_BLOCK_CLASSES = new Set(['Image', 'Media']);

function buildItem(block, channel) {
  if (!VISUAL_BLOCK_CLASSES.has(block?.class)) {
    return null;
  }

  const imageUrl = pickImageUrl(block);
  if (!imageUrl) {
    return null;
  }

  const rawTitle = typeof block.title === 'string' ? block.title.trim() : '';
  // Two shapes show up: a real extension, and bare scanner/CMS output like
  // "lfa_periodicals_70sbiweekly_0001_001" - no spaces, digits and separators.
  // Falling back to the channel name would just repeat the tag on every card.
  const hasImageExtension = /\.(jpe?g|png|gif|webp|avif|tiff?)(\?.*)?$/i.test(rawTitle);
  const looksMachineNamed = !/\s/.test(rawTitle) && /[_-]/.test(rawTitle) && /\d/.test(rawTitle);
  const title = !rawTitle || hasImageExtension || looksMachineNamed ? '' : rawTitle;

  const description = typeof block.description === 'string' ? block.description.trim() : '';
  const addedBy = block.user?.full_name || block.user?.username || null;

  return {
    id: `arena-${block.id}`,
    title,
    detail: [description, addedBy && `Added by ${addedBy}`].filter(Boolean).join(' - '),
    imageUrl,
    tag: `Are.na - ${channel.title}`,
    webUrl: `https://www.are.na/block/${block.id}`,
    channelUrl: `https://www.are.na/${channel.slug}`,
  };
}

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(MAX_LIMIT, Math.max(1, toInt(searchParams.get('limit'), DEFAULT_LIMIT)));
  const requestedTerm = (searchParams.get('q') || '').trim();
  const requestedChannel = (searchParams.get('channel') || '').trim();

  // Two independent walks. `curated` steps through the seeds and their graph;
  // `search` steps through keyword results. Turns alternate so a batch mixes
  // known taste with new ground instead of being all one or the other.
  const cursor = {
    curatedIndex: Math.max(0, toInt(searchParams.get('curatedIndex'), 0)),
    curatedPage: Math.max(1, toInt(searchParams.get('curatedPage'), 1)),
    termIndex: Math.max(0, toInt(searchParams.get('termIndex'), 0)),
    channelIndex: Math.max(0, toInt(searchParams.get('channelIndex'), 0)),
    page: Math.max(1, toInt(searchParams.get('page'), 1)),
    turn: toInt(searchParams.get('turn'), 0) === 1 ? 1 : 0,
  };

  const terms = requestedTerm ? [requestedTerm] : DISCOVERY_TERMS;
  if (!searchParams.has('termIndex')) {
    // With no cursor yet, start the keyword lane somewhere random so every
    // session opens on different territory.
    cursor.termIndex = Math.floor(Math.random() * terms.length);
  }
  cursor.termIndex %= terms.length;

  let curated = [];
  if (requestedChannel) {
    // An explicit channel request pins the curated lane to just that channel.
    curated = [await getChannel(requestedChannel).catch(() => null)].filter(Boolean);
  } else {
    curated = await getCuratedChannels();
  }

  // A pinned channel or a pinned search term means the caller asked for one
  // specific thing; don't dilute it with the other lane.
  const lanes = requestedChannel ? ['curated'] : requestedTerm ? ['search'] : ['curated', 'search'];

  const items = [];
  const seenIds = new Set();
  let hops = 0;
  let lastError = null;

  const takeFrom = (contents, channel) => {
    let taken = 0;
    contents.forEach((block) => {
      if (items.length >= limit || taken >= MAX_PER_CHANNEL || seenIds.has(block?.id)) {
        return;
      }
      const item = buildItem(block, channel);
      if (item) {
        seenIds.add(block.id);
        items.push(item);
        taken += 1;
      }
    });
    return taken;
  };

  while (items.length < limit && hops < MAX_CHANNEL_HOPS) {
    hops += 1;
    const lane = lanes[cursor.turn % lanes.length];
    cursor.turn = (cursor.turn + 1) % 2;

    if (lane === 'curated') {
      if (!curated.length) {
        continue;
      }

      cursor.curatedIndex %= curated.length;
      const channel = curated[cursor.curatedIndex];
      const lastPage = Math.max(1, Math.ceil(channel.length / CONTENTS_PER_PAGE));

      let contents = [];
      try {
        // eslint-disable-next-line no-await-in-loop
        contents = await fetchChannelPage(channel.slug, cursor.curatedPage);
      } catch (error) {
        lastError = error;
      }

      takeFrom(contents, channel);

      // Always move on: the aim is a walk across channels, not a crawl through
      // one. The page only advances when the list wraps, which keeps deep
      // channels in play across many batches.
      cursor.curatedIndex += 1;
      if (cursor.curatedIndex >= curated.length) {
        cursor.curatedIndex = 0;
        cursor.curatedPage = cursor.curatedPage >= lastPage ? 1 : cursor.curatedPage + 1;
      }
      continue;
    }

    let channels = [];
    try {
      // eslint-disable-next-line no-await-in-loop
      channels = await searchChannels(terms[cursor.termIndex]);
    } catch (error) {
      lastError = error;
    }

    if (!channels.length || cursor.channelIndex >= channels.length) {
      cursor.termIndex = (cursor.termIndex + 1) % terms.length;
      cursor.channelIndex = 0;
      cursor.page = 1;
      continue;
    }

    const channel = channels[cursor.channelIndex];
    const lastPage = Math.max(1, Math.ceil(channel.length / CONTENTS_PER_PAGE));

    let contents = [];
    try {
      // eslint-disable-next-line no-await-in-loop
      contents = await fetchChannelPage(channel.slug, cursor.page);
    } catch (error) {
      lastError = error;
    }

    takeFrom(contents, channel);

    cursor.page = cursor.page >= lastPage || !contents.length ? 1 : cursor.page + 1;
    cursor.channelIndex += 1;
    if (cursor.channelIndex >= channels.length) {
      cursor.channelIndex = 0;
      cursor.termIndex = (cursor.termIndex + 1) % terms.length;
    }
  }

  if (!items.length && lastError) {
    return NextResponse.json(
      { error: lastError.message || 'Could not reach Are.na.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ items, cursor });
}
