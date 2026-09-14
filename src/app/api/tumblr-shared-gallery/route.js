import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

const TUMBLR_API_BASE = process.env.TUMBLR_API_BASE || 'https://api.tumblr.com/v2';
const TUMBLR_DASHBOARD_LIMIT_DEFAULT = toInt(process.env.TUMBLR_DASHBOARD_LIMIT, 20);
const TUMBLR_DASHBOARD_LIMIT_MAX = 40;
const SUMMARY_TITLE_MAX_LENGTH = 80;
const DETAIL_MAX_LENGTH = 800;

function encodeOAuth(value) {
  return encodeURIComponent(String(value ?? ''))
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

function buildOAuth1AuthorizationHeader({
  method,
  baseUrl,
  queryParams,
  consumerKey,
  consumerSecret,
  token,
  tokenSecret,
}) {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_token: token,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_version: '1.0',
  };

  const allParams = [];
  Object.entries(queryParams || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    allParams.push([encodeOAuth(key), encodeOAuth(value)]);
  });

  Object.entries(oauthParams).forEach(([key, value]) => {
    allParams.push([encodeOAuth(key), encodeOAuth(value)]);
  });

  allParams.sort((left, right) => {
    if (left[0] === right[0]) {
      return left[1] < right[1] ? -1 : left[1] > right[1] ? 1 : 0;
    }
    return left[0] < right[0] ? -1 : 1;
  });

  const normalizedParams = allParams.map(([key, value]) => `${key}=${value}`).join('&');
  const signatureBaseString = [
    method.toUpperCase(),
    encodeOAuth(baseUrl),
    encodeOAuth(normalizedParams),
  ].join('&');

  const signingKey = `${encodeOAuth(consumerSecret)}&${encodeOAuth(tokenSecret)}`;
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBaseString)
    .digest('base64');

  const authParams = {
    ...oauthParams,
    oauth_signature: signature,
  };

  const headerValue = Object.entries(authParams)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${encodeOAuth(key)}="${encodeOAuth(value)}"`)
    .join(', ');

  return `OAuth ${headerValue}`;
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanHtmlText(value) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectBlockText(post) {
  const blockTexts = [];
  const collectText = (blocks) => {
    if (!Array.isArray(blocks)) {
      return;
    }

    blocks.forEach((block) => {
      if (typeof block?.text === 'string' && block.text.trim()) {
        blockTexts.push(block.text.trim());
      }
    });
  };

  collectText(post?.content);
  if (Array.isArray(post?.trail)) {
    post.trail.forEach((trailEntry) => collectText(trailEntry?.content));
  }

  return blockTexts.join(' ');
}

function truncateAtWord(text, limit) {
  const value = String(text || '').trim();
  if (value.length <= limit) {
    return value;
  }

  const clipped = value.slice(0, limit);
  const lastSpace = clipped.lastIndexOf(' ');
  const trimmed = lastSpace > limit * 0.6 ? clipped.slice(0, lastSpace) : clipped;
  return `${trimmed.trim()}\u2026`;
}

// Tumblr only has a real headline for posts that were given one. For text posts the
// `summary` is just the opening of the body, often cut mid-sentence, so it reads as a
// description and belongs under the card title, not in it.
function looksLikeDescription(text) {
  const value = String(text || '').trim();
  if (!value) {
    return false;
  }

  if (value.length > SUMMARY_TITLE_MAX_LENGTH) {
    return true;
  }

  if (/(\.\.\.|\u2026)$/.test(value) || /\.$/.test(value)) {
    return true;
  }

  return /[.!?]["')\]]?\s+\S/.test(value);
}

function extractTextSnippet(post) {
  const fromBlocks = cleanHtmlText(collectBlockText(post));
  if (fromBlocks) {
    return fromBlocks;
  }

  return [post?.caption, post?.trail_text, post?.summary, post?.title].map(cleanHtmlText).find(Boolean) || '';
}

function pickBestMediaUrl(mediaArray) {
  if (!Array.isArray(mediaArray) || !mediaArray.length) {
    return null;
  }

  const sorted = [...mediaArray].sort((left, right) => (right?.width || 0) - (left?.width || 0));
  return sorted[0]?.url || null;
}

function extractPostImageUrls(post) {
  const urls = new Set();

  const legacyPhotos = Array.isArray(post?.photos) ? post.photos : [];
  legacyPhotos.forEach((photo) => {
    if (photo?.original_size?.url) {
      urls.add(photo.original_size.url);
      return;
    }

    if (Array.isArray(photo?.alt_sizes) && photo.alt_sizes[0]?.url) {
      urls.add(photo.alt_sizes[0].url);
    }
  });

  const collectFromBlocks = (blocks) => {
    if (!Array.isArray(blocks)) {
      return;
    }

    blocks.forEach((block) => {
      if (block?.type !== 'image' && block?.type !== 'photo') {
        return;
      }

      const fromMedia = pickBestMediaUrl(block?.media);
      if (fromMedia) {
        urls.add(fromMedia);
        return;
      }

      if (typeof block?.url === 'string' && block.url) {
        urls.add(block.url);
      }
    });
  };

  collectFromBlocks(post?.content);
  if (Array.isArray(post?.trail)) {
    post.trail.forEach((trailEntry) => collectFromBlocks(trailEntry?.content));
  }

  return Array.from(urls);
}

function stripRawUrls(text) {
  return String(text || '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s,;:]+$/, '');
}

function normalizeForComparison(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function summarizeNonJsonResponse(rawText, fallbackMessage) {
  const snippet = String(rawText || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);

  return snippet ? `${fallbackMessage} ${snippet}` : fallbackMessage;
}

async function parseJsonResponse(response, fallbackMessage) {
  const rawText = await response.text();
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error(summarizeNonJsonResponse(rawText, fallbackMessage));
  }
}

function buildPostItems(post) {
  const imageUrls = extractPostImageUrls(post);
  if (!imageUrls.length) {
    return [];
  }

  const blogName = cleanHtmlText(post?.blog?.title) || post?.blog_name || 'Tumblr post';
  const summary = stripRawUrls(cleanHtmlText(post?.summary));
  const summaryIsDescription = looksLikeDescription(summary);
  const title = summary && !summaryIsDescription ? summary : blogName;
  const bodyText = stripRawUrls(extractTextSnippet(post)) || (summaryIsDescription ? summary : '');
  const detail = truncateAtWord(bodyText, DETAIL_MAX_LENGTH);
  const normalizedTitle = normalizeForComparison(title);
  const normalizedDetail = normalizeForComparison(detail);

  let displayDetail = detail;
  if (normalizedTitle && normalizedDetail === normalizedTitle) {
    displayDetail = '';
  } else if (normalizedTitle && normalizedDetail.startsWith(normalizedTitle)) {
    displayDetail = detail.slice(title.length).replace(/^[\s:\u2013\u2014-]+/, '');
  }

  const webUrl = post?.post_url || post?.short_url || null;

  return imageUrls.map((imageUrl, index) => ({
    id: post?.id ? `tumblr-gallery-${post.id}-${index}` : `tumblr-gallery-${imageUrl}`,
    title,
    detail: displayDetail,
    tag: '-',
    imageUrl,
    webUrl,
  }));
}

export async function GET(request) {
  const accessToken = process.env.TUMBLR_ACCESS_TOKEN;
  const consumerKey = process.env.TUMBLR_CONSUMER_KEY;
  const consumerSecret = process.env.TUMBLR_CONSUMER_SECRET;
  const token = process.env.TUMBLR_TOKEN;
  const tokenSecret = process.env.TUMBLR_TOKEN_SECRET;

  if (!accessToken && !(consumerKey && consumerSecret && token && tokenSecret)) {
    return NextResponse.json(
      {
        error:
          'Tumblr shared gallery is not configured. Set TUMBLR_ACCESS_TOKEN or OAuth1 credentials (TUMBLR_CONSUMER_KEY, TUMBLR_CONSUMER_SECRET, TUMBLR_TOKEN, TUMBLR_TOKEN_SECRET).',
      },
      { status: 503 },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const offset = Math.max(0, toInt(searchParams.get('offset'), 0));
  const requestedLimit = toInt(searchParams.get('limit'), TUMBLR_DASHBOARD_LIMIT_DEFAULT);
  const limit = Math.min(TUMBLR_DASHBOARD_LIMIT_MAX, Math.max(1, requestedLimit));

  const queryParams = {
    npf: 'true',
    reblog_info: 'false',
    notes_info: 'false',
    offset: String(offset),
    limit: String(limit),
  };
  const baseUrl = `${TUMBLR_API_BASE}/user/dashboard`;
  const query = new URLSearchParams(queryParams).toString();
  const tumblrUrl = `${baseUrl}?${query}`;

  const headers = {
    Accept: 'application/json',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else {
    headers.Authorization = buildOAuth1AuthorizationHeader({
      method: 'GET',
      baseUrl,
      queryParams,
      consumerKey,
      consumerSecret,
      token,
      tokenSecret,
    });
  }

  const response = await fetch(tumblrUrl, {
    headers,
    cache: 'no-store',
  });

  const payload = await parseJsonResponse(
    response,
    'Tumblr returned a non-JSON response.',
  ).catch((error) => ({ error: error.message }));

  if (!response.ok) {
    const message =
      payload?.meta?.msg ||
      payload?.errors?.[0]?.detail ||
      payload?.error ||
      'Could not fetch Tumblr dashboard.';
    return NextResponse.json({ error: message }, { status: response.status });
  }

  if (payload?.error) {
    return NextResponse.json({ error: payload.error }, { status: 502 });
  }

  const posts = Array.isArray(payload?.response?.posts) ? payload.response.posts : [];

  const items = posts.flatMap(buildPostItems);

  const nextOffset = posts.length < limit ? 0 : offset + posts.length;

  return NextResponse.json({
    items,
    nextOffset,
  });
}
