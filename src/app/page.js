'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye,
  Heart,
  Highlighter,
  Home,
  Infinity as InfinityIcon,
  Moon,
  Square,
  Sun,
  Type,
  Volume2,
} from 'lucide-react';
import curatedArtTerms from '../data/art_highlights.json';

const CATEGORIES = [
  { key: 'feed', label: 'Feed' },
  { key: 'fav', label: 'Fav' },
  { key: 'seen', label: 'Seen' },
];

const TAB_ICONS = {
  feed: InfinityIcon,
  fav: Heart,
  seen: Eye,
};

const CATEGORY_LABELS = {
  feed: 'Feed',
  fav: 'Fav',
  seen: 'Seen',
  art: 'Art',
  'art-history': 'Art History',
  'music-history': 'Music History',
  philosophy: 'Philosophy',
  science: 'Science',
  'computer-science': 'Computer Science',
};

const PAGE_SIZE = 15;
const PAGE_SIZE_ART = 10;
const ART_CURATED_BATCH = 12;
const CONTROL_ICON_SIZE = 16;
const WIKI_PAGE_SIZE = 20;
const WIKI_RANDOM_START_MAX = 60;
const SHORT_TEXT_LIMIT = 160;
const HIDDEN_STORAGE_KEY = 'smortscroll:hidden-ids';
const SEEN_ITEMS_STORAGE_KEY = 'smortscroll:seen-items';
const FAVORITES_STORAGE_KEY = 'smortscroll:favorite-ids';
const FAVORITES_ITEMS_STORAGE_KEY = 'smortscroll:favorite-items';
const VOICE_STORAGE_KEY = 'smortscroll:voice-uri';
const CURSOR_STORAGE_KEY = 'smortscroll:cursor';
const THEME_STORAGE_KEY = 'smortscroll:theme';
const TEXT_SIZE_STORAGE_KEY = 'smortscroll:text-size';
const ART_QUERY = 'painting';
const FEED_SOURCES = [
  'art',
  'art-history',
  'music-history',
  'philosophy',
  'science',
  'computer-science',
];
const FEED_SOURCE_BATCH = 3;
const WIKI_SEARCH = {
  'art-history':
    'art history OR art movement OR painter OR sculptor OR picasso OR manet OR monet OR vangogh OR "van gogh" OR michelangelo OR "da vinci" OR cezanne OR renoir',
  'music-history': 'music history OR composer OR symphony OR jazz history OR beethoven OR mozart',
  philosophy:
    'philosophy OR philosopher OR ethics OR epistemology OR plato OR aristotle OR descartes OR hume OR spinoza OR kant OR nietzsche OR sartre',
  science:
    'science OR physics OR biology OR chemistry OR astronomy OR einstein OR newton OR curie OR darwin OR hawking OR feynman',
  'computer-science':
    'computer science OR computing OR algorithms OR turing OR hopper OR knuth OR dijkstra OR shannon OR "von neumann" OR linus torvalds',
};
const NATURAL_VOICE_HINTS = [
  'samantha',
  'karen',
  'daniel',
  'moira',
  'aaron',
  'ava',
  'serena',
  'siri',
  'premium',
  'enhanced',
  'neural',
  'natural',
];

function interleave(arrays) {
  const maxLength = Math.max(0, ...arrays.map((arr) => arr.length));
  const merged = [];

  for (let index = 0; index < maxLength; index += 1) {
    arrays.forEach((arr) => {
      if (arr[index]) {
        merged.push(arr[index]);
      }
    });
  }

  return merged;
}

function shuffleArray(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

function mergeItems(currentItems, nextItems) {
  if (!nextItems.length) {
    return currentItems;
  }

  const seen = new Set(currentItems.map((item) => item.id));
  const uniqueNext = nextItems.filter((item) => !seen.has(item.id));
  return [...currentItems, ...uniqueNext];
}

function getShortText(text) {
  if (!text) {
    return '';
  }

  if (text.length <= SHORT_TEXT_LIMIT) {
    return text;
  }

  return `${text.slice(0, SHORT_TEXT_LIMIT).trimEnd()}...`;
}

function getParagraphs(text) {
  if (!text) {
    return [];
  }

  return text
    .split(/\n\s*\n+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function sanitizeWikiText(text) {
  if (!text) {
    return '';
  }

  // Replace heading-style = separators with newlines to preserve breaks.
  const withoutEquals = text.replace(/=+/g, '\n\n');

  // Normalize newlines, trim each line, collapse intra-line spaces, keep blank lines.
  const normalized = withoutEquals
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n');

  // Collapse runs of 3+ newlines to double newlines for paragraph splitting.
  return normalized.replace(/\n{3,}/g, '\n\n').trim();
}

function pickPreferredVoice(voices, preferredVoiceUri) {
  if (!voices.length) {
    return null;
  }

  if (preferredVoiceUri) {
    const matched = voices.find((voice) => voice.voiceURI === preferredVoiceUri);
    if (matched) {
      return matched;
    }
  }

  const englishVoices = voices.filter((voice) => voice.lang?.toLowerCase().startsWith('en'));
  const voicePool = englishVoices.length ? englishVoices : voices;

  const naturalMatch = voicePool.find((voice) => {
    const candidate = `${voice.name || ''} ${voice.voiceURI || ''}`.toLowerCase();
    return NATURAL_VOICE_HINTS.some((hint) => candidate.includes(hint));
  });

  return naturalMatch || voicePool[0] || voices[0] || null;
}

export default function HomePage() {
  const [category, setCategory] = useState(CATEGORIES[0].key);
  const [itemsByCategory, setItemsByCategory] = useState({});
  const [loadingByCategory, setLoadingByCategory] = useState({});
  const [errorByCategory, setErrorByCategory] = useState({});
  const [activeImage, setActiveImage] = useState(null);
  const [cursorByCategory, setCursorByCategory] = useState({});
  const [expandedIds, setExpandedIds] = useState({});
  const [loadingFullText, setLoadingFullText] = useState({});
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [seenItems, setSeenItems] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [favoriteItems, setFavoriteItems] = useState([]);
  const [installEvent, setInstallEvent] = useState(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLargeText, setIsLargeText] = useState(false);
  const [speakingItemId, setSpeakingItemId] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState(null);
  const [showBottomBar, setShowBottomBar] = useState(false);

  const inFlightRef = useRef({});
  const seenIdsRef = useRef(new Set());
  const seenItemsRef = useRef([]);
  const favoriteIdsRef = useRef(new Set());
  const favoriteItemsRef = useRef([]);
  const viewedIdsRef = useRef(new Set());
  const speakingItemIdRef = useRef(null);
  const utteranceRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const bootstrappedFeedRef = useRef(false);
  const cardRefs = useRef({});
  const readContentRefs = useRef({});
  const lastScrollYRef = useRef(0);

  const items = useMemo(() => itemsByCategory[category] || [], [itemsByCategory, category]);

  const filteredItems = useMemo(() => {
    if (category === 'seen') {
      return seenItems;
    }

    if (category === 'fav') {
      return favoriteItems;
    }

    return items.filter((item) => !hiddenIds.has(item.id) || favoriteIds.has(item.id));
  }, [category, items, hiddenIds, favoriteIds, seenItems, favoriteItems]);

  const queueSeenSave = useCallback(() => {
    if (saveTimeoutRef.current || typeof window === 'undefined') {
      return;
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      const ids = Array.from(seenIdsRef.current);
      const storedItems = seenItemsRef.current;
      const favorites = Array.from(favoriteIdsRef.current);
      const storedFavorites = favoriteItemsRef.current;

      try {
        window.localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(ids));
        window.localStorage.setItem(SEEN_ITEMS_STORAGE_KEY, JSON.stringify(storedItems));
        window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
        window.localStorage.setItem(FAVORITES_ITEMS_STORAGE_KEY, JSON.stringify(storedFavorites));
      } catch {
        // Ignore storage write failures.
      }

      saveTimeoutRef.current = null;
    }, 500);
  }, []);

  const addSeenItems = useCallback((additions) => {
    if (!additions.length) {
      return;
    }

    const existing = new Set(seenItemsRef.current.map((entry) => entry.id));
    const uniqueAdds = additions.filter((entry) => !existing.has(entry.id));
    if (!uniqueAdds.length) {
      return;
    }

    const next = [...uniqueAdds, ...seenItemsRef.current];
    seenItemsRef.current = next;
    setSeenItems(next);
  }, []);

  const toggleFavorite = useCallback(
    (item) => {
      if (!item?.id) {
        return;
      }

      const next = new Set(favoriteIdsRef.current);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }

      favoriteIdsRef.current = next;
      setFavoriteIds(next);

      if (next.has(item.id)) {
        const updated = [item, ...favoriteItemsRef.current.filter((entry) => entry.id !== item.id)];
        favoriteItemsRef.current = updated;
        setFavoriteItems(updated);
      } else {
        const updated = favoriteItemsRef.current.filter((entry) => entry.id !== item.id);
        favoriteItemsRef.current = updated;
        setFavoriteItems(updated);
      }

      queueSeenSave();
    },
    [queueSeenSave],
  );

  const markSeen = useCallback(
    (item) => {
      if (!item?.id) {
        return;
      }

      seenIdsRef.current.add(item.id);
      setHiddenIds((prev) => {
        const next = new Set(prev);
        next.add(item.id);
        return next;
      });
      addSeenItems([item]);
      queueSeenSave();
    },
    [addSeenItems, queueSeenSave],
  );

  const trackSeenByViewing = useCallback(
    (item) => {
      if (!item?.id) {
        return;
      }

      viewedIdsRef.current.add(item.id);
      addSeenItems([item]);
      queueSeenSave();
    },
    [addSeenItems, queueSeenSave],
  );

  const clearSeenHistory = useCallback(() => {
    seenIdsRef.current = new Set();
    seenItemsRef.current = [];
    viewedIdsRef.current = new Set();
    setSeenItems([]);
    setHiddenIds(new Set());
    queueSeenSave();
  }, [queueSeenSave]);

  const fetchWikiFullText = useCallback(async (title) => {
    const response = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=${encodeURIComponent(
        title,
      )}&origin=*`,
    );
    const json = await response.json();
    const pages = json?.query?.pages;
    const firstKey = pages ? Object.keys(pages)[0] : null;
    const page = firstKey ? pages[firstKey] : null;
    return page?.extract || null;
  }, []);

  const updateItemById = useCallback((id, updates) => {
    setItemsByCategory((prev) => {
      const next = {};
      Object.keys(prev).forEach((key) => {
        next[key] = prev[key].map((item) => (item.id === id ? { ...item, ...updates } : item));
      });
      return next;
    });
  }, []);

  const toggleExpand = useCallback(
    async (item) => {
      if (!item.detail) {
        return;
      }

      setExpandedIds((prev) => ({ ...prev, [item.id]: !prev[item.id] }));

      if (item.detailFull || !item.wikiTitle) {
        return;
      }

      setLoadingFullText((prev) => ({ ...prev, [item.id]: true }));
      try {
        const fullText = await fetchWikiFullText(item.wikiTitle);
        if (fullText) {
          updateItemById(item.id, { detailFull: sanitizeWikiText(fullText) });
        }
      } finally {
        setLoadingFullText((prev) => ({ ...prev, [item.id]: false }));
      }
    },
    [fetchWikiFullText, updateItemById],
  );

  const fetchBatch = useCallback(
    async (targetCategory) => {
      if (targetCategory === 'art') {
        let artCursor = cursorByCategory[targetCategory];

        if (!artCursor?.ids) {
          const idSet = new Set();

          // Prefer Met highlights with a rotating set of known artists/works.
          const curatedTerms = shuffleArray(curatedArtTerms).slice(0, ART_CURATED_BATCH);
          const curatedHighlightRequests = curatedTerms.map((term) =>
            fetch(
              `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&isHighlight=true&artistOrCulture=true&q=${encodeURIComponent(
                term,
              )}`,
            ),
          );

          const baseHighlightRequest = fetch(
            `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&isHighlight=true&artistOrCulture=true&q=${encodeURIComponent(
              ART_QUERY,
            )}`,
          );

          const highlightResponses = await Promise.all([
            baseHighlightRequest,
            ...curatedHighlightRequests,
          ]);
          const highlightJson = await Promise.all(
            highlightResponses.map((response) => response.json()),
          );

          highlightJson.forEach((entry) => {
            if (Array.isArray(entry.objectIDs)) {
              entry.objectIDs.forEach((id) => idSet.add(id));
            }
          });

          // Fallback to general search if highlights come back empty.
          if (!idSet.size) {
            const search = await fetch(
              `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(
                ART_QUERY,
              )}`,
            );
            const searchJson = await search.json();
            if (Array.isArray(searchJson.objectIDs)) {
              searchJson.objectIDs.forEach((id) => idSet.add(id));
            }
          }

          artCursor = { ids: Array.from(idSet), index: 0 };
        }

        const slice = artCursor.ids.slice(artCursor.index, artCursor.index + PAGE_SIZE_ART);
        if (!slice.length) {
          return { items: [], cursor: artCursor };
        }

        const detailRequests = slice.map((id) =>
          fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`),
        );
        const detailResponses = await Promise.all(detailRequests);
        const detailJson = await Promise.all(detailResponses.map((response) => response.json()));

        const categoryItems = detailJson
          .map((item) => ({
            id: `art-${item.objectID}`,
            title: item.title || 'Untitled work',
            detail: [
              item.artistDisplayName && `Artist: ${item.artistDisplayName}`,
              item.objectDate && `Date: ${item.objectDate}`,
              item.medium && `Medium: ${item.medium}`,
            ]
              .filter(Boolean)
              .join(' - '),
            tag: `${item.department || 'Met Collection'} - ${CATEGORY_LABELS.art}`,
            imageUrl: item.primaryImageSmall || item.primaryImage || null,
            webUrl: item.objectURL || null,
            highlight: Boolean(item.isHighlight),
          }))
          .filter((item) => item.imageUrl)
          // Prefer highlighted / better-known works first.
          .sort((a, b) => Number(b.highlight) - Number(a.highlight));

        return {
          items: categoryItems,
          cursor: {
            ids: artCursor.ids,
            index: artCursor.index + PAGE_SIZE_ART,
          },
        };
      }

      if (WIKI_SEARCH[targetCategory]) {
        const searchTopic = WIKI_SEARCH[targetCategory];
        const wikiCursor = cursorByCategory[targetCategory] || {
          offset: Math.floor(Math.random() * (WIKI_RANDOM_START_MAX + 1)),
        };
        const searchResponse = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
            searchTopic,
          )}&format=json&srlimit=${WIKI_PAGE_SIZE}&sroffset=${wikiCursor.offset}&origin=*`,
        );
        const searchJson = await searchResponse.json();
        const titles = shuffleArray(
          (searchJson?.query?.search || []).map((result) => result.title),
        );

        const summaryRequests = titles.map((title) =>
          fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`),
        );
        const summaryResponses = await Promise.all(summaryRequests);
        const summaries = await Promise.all(summaryResponses.map((response) => response.json()));

        return {
          items: summaries.map((item) => ({
            id: `${targetCategory}-${item.pageid}`,
            title: item.title,
            detail: sanitizeWikiText(item.extract),
            detailFull: null,
            wikiTitle: item.title,
            tag: `Wikipedia - ${CATEGORY_LABELS[targetCategory]}`,
            webUrl: item.content_urls?.desktop?.page || null,
            imageUrl: item.originalimage?.source || item.thumbnail?.source || null,
          })),
          cursor: { offset: wikiCursor.offset + titles.length },
        };
      }

      return { items: [], cursor: cursorByCategory[targetCategory] };
    },
    [cursorByCategory],
  );

  const loadMore = useCallback(
    async (targetCategory) => {
      if (inFlightRef.current[targetCategory]) {
        return;
      }

      inFlightRef.current[targetCategory] = true;
      setLoadingByCategory((prev) => ({ ...prev, [targetCategory]: true }));
      setErrorByCategory((prev) => ({ ...prev, [targetCategory]: null }));

      try {
        let nextItems = [];

        if (targetCategory === 'feed') {
          const nonArtSources = FEED_SOURCES.filter((source) => source !== 'art');
          const sourceBatch = [
            'art',
            ...shuffleArray(nonArtSources).slice(0, FEED_SOURCE_BATCH - 1),
          ];
          const settled = await Promise.allSettled(sourceBatch.map((source) => fetchBatch(source)));
          const successful = settled
            .map((result, index) => ({ result, source: sourceBatch[index] }))
            .filter((entry) => entry.result.status === 'fulfilled');

          if (!successful.length) {
            const firstError = settled.find((entry) => entry.status === 'rejected');
            throw firstError?.reason || new Error('Could not fetch feed sources.');
          }

          setCursorByCategory((prev) => {
            const updates = { ...prev };
            successful.forEach((entry) => {
              const batch = entry.result.value;
              if (batch.cursor) {
                updates[entry.source] = batch.cursor;
              }
            });
            return updates;
          });

          nextItems = shuffleArray(interleave(successful.map((entry) => entry.result.value.items)));
        } else {
          const batch = await fetchBatch(targetCategory);
          nextItems = batch.items;

          if (batch.cursor) {
            setCursorByCategory((prev) => ({
              ...prev,
              [targetCategory]: batch.cursor,
            }));
          }
        }

        const previouslySeenIds = new Set([
          ...Array.from(seenIdsRef.current),
          ...seenItemsRef.current.map((item) => item.id),
        ]);
        const unseenItems = nextItems.filter((item) => !previouslySeenIds.has(item.id));
        const itemsToAdd = unseenItems.length ? unseenItems : nextItems;

        setItemsByCategory((prev) => {
          const merged = mergeItems(prev[targetCategory] || [], itemsToAdd);
          const capped = targetCategory === 'feed' ? merged.slice(-200) : merged;

          return {
            ...prev,
            [targetCategory]: capped,
          };
        });
      } catch (error) {
        setErrorByCategory((prev) => ({
          ...prev,
          [targetCategory]:
            error?.message ||
            'Could not fetch new items. Check your connection or API configuration.',
        }));
      } finally {
        inFlightRef.current[targetCategory] = false;
        setLoadingByCategory((prev) => ({ ...prev, [targetCategory]: false }));
      }
    },
    [fetchBatch],
  );

  useEffect(() => {
    if (category !== 'feed' || bootstrappedFeedRef.current || loadingByCategory.feed) {
      return;
    }

    bootstrappedFeedRef.current = true;
    loadMore('feed');
  }, [category, loadMore, loadingByCategory.feed]);

  useEffect(() => {
    let active = true;

    const loadStoredState = () => {
      if (typeof window === 'undefined') {
        return;
      }

      const storedSeenIds = window.localStorage.getItem(HIDDEN_STORAGE_KEY);
      const storedSeenItems = window.localStorage.getItem(SEEN_ITEMS_STORAGE_KEY);
      const storedFavoriteIds = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
      const storedFavoriteItems = window.localStorage.getItem(FAVORITES_ITEMS_STORAGE_KEY);
      const storedCursors = window.localStorage.getItem(CURSOR_STORAGE_KEY);

      if (!active) {
        return;
      }

      if (storedSeenIds) {
        try {
          const parsed = JSON.parse(storedSeenIds);
          if (Array.isArray(parsed)) {
            const seenSet = new Set(parsed);
            setHiddenIds(seenSet);
            seenIdsRef.current = seenSet;
          }
        } catch {
          setHiddenIds(new Set());
          seenIdsRef.current = new Set();
        }
      } else {
        setHiddenIds(new Set());
        seenIdsRef.current = new Set();
      }

      if (storedSeenItems) {
        try {
          const parsedItems = JSON.parse(storedSeenItems);
          if (Array.isArray(parsedItems)) {
            setSeenItems(parsedItems);
            seenItemsRef.current = parsedItems;
            viewedIdsRef.current = new Set(parsedItems.map((item) => item.id).filter(Boolean));
          }
        } catch {
          setSeenItems([]);
          seenItemsRef.current = [];
          viewedIdsRef.current = new Set();
        }
      } else {
        viewedIdsRef.current = new Set();
      }

      if (storedFavoriteIds) {
        try {
          const parsedFavorites = JSON.parse(storedFavoriteIds);
          if (Array.isArray(parsedFavorites)) {
            const favoriteSet = new Set(parsedFavorites);
            setFavoriteIds(favoriteSet);
            favoriteIdsRef.current = favoriteSet;
          }
        } catch {
          setFavoriteIds(new Set());
          favoriteIdsRef.current = new Set();
        }
      }

      if (storedFavoriteItems) {
        try {
          const parsedItems = JSON.parse(storedFavoriteItems);
          if (Array.isArray(parsedItems)) {
            setFavoriteItems(parsedItems);
            favoriteItemsRef.current = parsedItems;
          }
        } catch {
          setFavoriteItems([]);
          favoriteItemsRef.current = [];
        }
      }

      if (storedCursors) {
        try {
          const parsed = JSON.parse(storedCursors);
          if (parsed && typeof parsed === 'object') {
            setCursorByCategory(parsed);
          }
        } catch {
          // Ignore invalid cursor cache.
        }
      }
    };

    loadStoredState();

    return () => {
      active = false;
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    setIsIos(iosDevice);
    setIsStandalone(standalone);

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallEvent(event);
    };

    const onAppInstalled = () => {
      setInstallEvent(null);
      setShowInstallGuide(false);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    if ('serviceWorker' in window.navigator) {
      window.navigator.serviceWorker.register('/sw.js').catch(() => {
        // Ignore SW registration failures.
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const onScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollYRef.current;
      const scrollingUp = delta < -6;
      const scrollingDown = delta > 6;
      const beyondHeader = currentY > 120;

      if (scrollingUp && beyondHeader) {
        setShowBottomBar(true);
      } else if (scrollingDown || !beyondHeader) {
        setShowBottomBar(false);
      }

      lastScrollYRef.current = currentY;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let storedTheme = null;
    let storedTextSize = null;

    try {
      storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      storedTextSize = window.localStorage.getItem(TEXT_SIZE_STORAGE_KEY);
    } catch {
      storedTheme = null;
      storedTextSize = null;
    }

    if (storedTheme === 'dark') {
      setIsDarkMode(true);
    }

    if (storedTextSize === 'large') {
      setIsLargeText(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? 'dark' : 'light');
    } catch {
      // Ignore storage write failures.
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(TEXT_SIZE_STORAGE_KEY, isLargeText ? 'large' : 'default');
    } catch {
      // Ignore storage write failures.
    }
  }, [isLargeText]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }

    const restoreVoice = () => {
      let storedVoiceUri = null;

      try {
        storedVoiceUri = window.localStorage.getItem(VOICE_STORAGE_KEY);
      } catch {
        storedVoiceUri = null;
      }

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = pickPreferredVoice(voices, storedVoiceUri);

      if (!preferredVoice) {
        return;
      }

      const englishVoices = voices.filter((voice) => voice.lang?.toLowerCase().startsWith('en'));
      const sortedVoicePool = (englishVoices.length ? englishVoices : voices)
        .slice()
        .sort((left, right) => left.name.localeCompare(right.name));

      setAvailableVoices(sortedVoicePool);
      setSelectedVoiceUri(preferredVoice.voiceURI);
    };

    restoreVoice();
    window.speechSynthesis.addEventListener('voiceschanged', restoreVoice);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', restoreVoice);
    };
  }, []);

  const canShowInstallButton = !isStandalone && (Boolean(installEvent) || isIos);
  const hasHiddenOnlyFeed =
    category === 'feed' && (itemsByCategory.feed?.length || 0) > 0 && filteredItems.length === 0;

  const selectedVoice = useMemo(
    () => availableVoices.find((voice) => voice.voiceURI === selectedVoiceUri) || null,
    [availableVoices, selectedVoiceUri],
  );

  const stopReadAloud = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      speakingItemIdRef.current = null;
      setSpeakingItemId(null);
      return;
    }

    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    speakingItemIdRef.current = null;
    setSpeakingItemId(null);
  }, []);

  const toggleReadAloud = useCallback(
    (item) => {
      if (!item?.id) {
        return;
      }

      if (speakingItemIdRef.current === item.id) {
        stopReadAloud();
        return;
      }

      if (
        typeof window === 'undefined' ||
        !window.speechSynthesis ||
        !window.SpeechSynthesisUtterance
      ) {
        return;
      }

      const textParts = [item.title, item.detailFull || item.detail].filter(Boolean);
      if (!textParts.length) {
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new window.SpeechSynthesisUtterance(textParts.join('. '));
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang || 'en-US';
      } else {
        utterance.lang = 'en-US';
      }
      utterance.rate = 1;
      utterance.pitch = 1;

      utterance.onend = () => {
        if (speakingItemIdRef.current === item.id) {
          utteranceRef.current = null;
          speakingItemIdRef.current = null;
          setSpeakingItemId(null);
        }
      };

      utterance.onerror = () => {
        if (speakingItemIdRef.current === item.id) {
          utteranceRef.current = null;
          speakingItemIdRef.current = null;
          setSpeakingItemId(null);
        }
      };

      utteranceRef.current = utterance;
      speakingItemIdRef.current = item.id;
      setSpeakingItemId(item.id);
      window.speechSynthesis.speak(utterance);
    },
    [selectedVoice, stopReadAloud],
  );

  const cycleVoice = useCallback(() => {
    if (!availableVoices.length) {
      return;
    }

    const currentIndex = availableVoices.findIndex((voice) => voice.voiceURI === selectedVoiceUri);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % availableVoices.length;
    const nextVoice = availableVoices[nextIndex];

    setSelectedVoiceUri(nextVoice.voiceURI);

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(VOICE_STORAGE_KEY, nextVoice.voiceURI);
      } catch {
        // Ignore storage write failures.
      }
    }

    if (speakingItemIdRef.current) {
      stopReadAloud();
    }
  }, [availableVoices, selectedVoiceUri, stopReadAloud]);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, []);

  const toggleTextSize = useCallback(() => {
    setIsLargeText((prev) => !prev);
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (installEvent) {
      installEvent.prompt();
      try {
        await installEvent.userChoice;
      } catch {
        // Ignore prompt cancellation.
      }
      setInstallEvent(null);
      return;
    }

    if (isIos) {
      setShowInstallGuide(true);
    }
  }, [installEvent, isIos]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(CURSOR_STORAGE_KEY, JSON.stringify(cursorByCategory));
    } catch {
      // Ignore storage write failures.
    }
  }, [cursorByCategory]);

  useEffect(() => () => stopReadAloud(), [stopReadAloud]);

  useEffect(() => {
    if (speakingItemId && !filteredItems.some((item) => item.id === speakingItemId)) {
      stopReadAloud();
    }
  }, [filteredItems, speakingItemId, stopReadAloud]);

  const setCardRef = useCallback((id, node) => {
    if (!id) {
      return;
    }

    if (node) {
      cardRefs.current[id] = node;
      return;
    }

    delete cardRefs.current[id];
  }, []);

  const setReadContentRef = useCallback((id, node) => {
    if (!id) {
      return;
    }

    if (node) {
      readContentRefs.current[id] = node;
      return;
    }

    delete readContentRefs.current[id];
  }, []);

  const selectArticleText = useCallback((item) => {
    if (!item?.id || typeof window === 'undefined') {
      return;
    }

    const node = readContentRefs.current[item.id];
    if (!node || !window.getSelection || !document.createRange) {
      return;
    }

    window.requestAnimationFrame(() => {
      const selection = window.getSelection();
      if (!selection) {
        return;
      }

      const range = document.createRange();
      range.selectNodeContents(node);
      selection.removeAllRanges();
      selection.addRange(range);
    });
  }, []);

  useEffect(() => {
    if (category !== 'feed' || typeof window === 'undefined' || !window.IntersectionObserver) {
      return;
    }

    const visibleItems = filteredItems.filter((item) => !viewedIdsRef.current.has(item.id));
    if (!visibleItems.length) {
      return;
    }

    const itemsById = new Map(visibleItems.map((item) => [item.id, item]));
    const observer = new window.IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const id = entry.target.getAttribute('data-item-id');
          const item = id ? itemsById.get(id) : null;
          if (!item) {
            return;
          }

          trackSeenByViewing(item);
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.35,
      },
    );

    visibleItems.forEach((item) => {
      const node = cardRefs.current[item.id];
      if (node) {
        observer.observe(node);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [category, filteredItems, trackSeenByViewing]);

  return (
    <main className={`page${isDarkMode ? ' pageDark' : ''}${isLargeText ? ' pageLargeText' : ''}`}>
      <header className="headerWrap">
        <p className="kicker">Smortscroll</p>
        <h1 className="title">Endless, but mindful.</h1>
        <p className="subtitle">A calm feed of facts, paintings, and history that keeps flowing.</p>

        <div className="topActions">
          <div className="topGroup">
            <div className="tabs" role="tablist" aria-label="Feed categories">
              {CATEGORIES.map((tab) => {
                const isActive = tab.key === category;
                const Icon = TAB_ICONS[tab.key];
                return (
                  <button
                    key={tab.key}
                    className={`tab${isActive ? ' tabActive' : ''}`}
                    onClick={() => setCategory(tab.key)}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={tab.label}
                    title={tab.label}>
                    {Icon ? <Icon size={CONTROL_ICON_SIZE} aria-hidden="true" /> : tab.label}
                  </button>
                );
              })}
            </div>

            <span className="topDivider" aria-hidden="true" />

            <div className="topControls">
              {canShowInstallButton ? (
                <button
                  className="installButton"
                  type="button"
                  onClick={handleInstallClick}
                  aria-label={installEvent ? 'Install app' : 'Add to Home Screen'}
                  title={installEvent ? 'Install app' : 'Add to Home Screen'}>
                  <Home size={CONTROL_ICON_SIZE} aria-hidden="true" />
                </button>
              ) : null}

              <button
                className="installButton"
                type="button"
                onClick={cycleVoice}
                disabled={!availableVoices.length}
                aria-label={
                  selectedVoice
                    ? `Change read aloud voice. Current: ${selectedVoice.name}`
                    : 'Change read aloud voice'
                }
                title={selectedVoice ? `Voice: ${selectedVoice.name}` : 'Change read aloud voice'}>
                <Volume2 size={CONTROL_ICON_SIZE} aria-hidden="true" />
              </button>

              <button
                className="installButton"
                type="button"
                onClick={toggleDarkMode}
                aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                title={isDarkMode ? 'Light mode' : 'Dark mode'}>
                {isDarkMode ? (
                  <Sun size={CONTROL_ICON_SIZE} aria-hidden="true" />
                ) : (
                  <Moon size={CONTROL_ICON_SIZE} aria-hidden="true" />
                )}
              </button>

              <button
                className="installButton"
                type="button"
                onClick={toggleTextSize}
                aria-label={isLargeText ? 'Use normal text size' : 'Use larger text size'}
                title={isLargeText ? 'Text: normal' : 'Text: larger'}>
                <Type size={CONTROL_ICON_SIZE} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="feed" aria-live="polite">
        {filteredItems.map((item) => {
          const isFavorite = favoriteIds.has(item.id);
          const isSpeaking = speakingItemId === item.id;
          const isExpanded = Boolean(expandedIds[item.id]);
          const isLoadingFull = Boolean(loadingFullText[item.id]);
          const fullText = item.detailFull || item.detail;
          const displayText = isExpanded
            ? isLoadingFull
              ? 'Loading full text...'
              : fullText
            : getShortText(item.detail);
          const canToggle =
            Boolean(item.detail) &&
            (item.detail.length > SHORT_TEXT_LIMIT || Boolean(item.detailFull));
          const paragraphText = isExpanded && !isLoadingFull ? getParagraphs(fullText) : null;

          return (
            <article
              key={item.id}
              ref={(node) => setCardRef(item.id, node)}
              data-item-id={item.id}
              className="card"
              onClick={canToggle ? () => toggleExpand(item) : undefined}
              onKeyDown={(event) => {
                if (!canToggle) {
                  return;
                }
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  toggleExpand(item);
                }
              }}
              role={canToggle ? 'button' : undefined}
              tabIndex={canToggle ? 0 : undefined}>
              {item.imageUrl ? (
                <button
                  className="imageButton"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setActiveImage(item.imageUrl);
                  }}>
                  <img src={item.imageUrl} className="cardImage" alt={item.title} loading="lazy" />
                </button>
              ) : null}

              <div className="cardMeta">
                <p className="cardTag">{item.tag}</p>
                <div className="cardActions">
                  {category === 'feed' ? (
                    <button
                      className="seenButton"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        markSeen(item);
                      }}
                      aria-label={`Mark ${item.title} as seen`}>
                      <Eye size={18} aria-hidden="true" />
                    </button>
                  ) : null}
                  <button
                    className="favoriteButton"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleFavorite(item);
                    }}
                    aria-label={isFavorite ? `Unfavorite ${item.title}` : `Save ${item.title}`}>
                    {isFavorite ? (
                      <Heart size={18} aria-hidden="true" fill="currentColor" />
                    ) : (
                      <Heart size={18} aria-hidden="true" />
                    )}
                  </button>
                  <button
                    className="favoriteButton"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleReadAloud(item);
                    }}
                    aria-label={
                      isSpeaking ? `Stop reading ${item.title}` : `Read aloud ${item.title}`
                    }>
                    {isSpeaking ? (
                      <Square size={18} aria-hidden="true" />
                    ) : (
                      <Volume2 size={18} aria-hidden="true" />
                    )}
                  </button>
                  <button
                    className="favoriteButton"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      selectArticleText(item);
                    }}
                    aria-label={`Select text for ${item.title}`}>
                    <Highlighter size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div ref={(node) => setReadContentRef(item.id, node)}>
                <h2 className="cardTitle">{item.title}</h2>
                {paragraphText?.length ? (
                  paragraphText.map((para, index) => (
                    <p key={`${item.id}-p-${index}`} className="cardDetail">
                      {para}
                    </p>
                  ))
                ) : displayText ? (
                  <p className="cardDetail">{displayText}</p>
                ) : null}
              </div>
              {canToggle ? (
                <p className="cardHint">{isExpanded ? 'Tap to collapse' : 'Tap to expand'}</p>
              ) : null}

              {item.webUrl ? (
                <a
                  href={item.webUrl}
                  className="cardLink"
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}>
                  Open source
                </a>
              ) : null}
            </article>
          );
        })}
      </section>

      <footer className="footer">
        {category === 'fav' && !favoriteItems.length ? (
          <div className="stateCard">
            <p className="stateTitle">No favorites yet.</p>
            <p className="stateDetail">Tap Save on a card to keep it here.</p>
          </div>
        ) : null}

        {category === 'seen' && !seenItems.length ? (
          <div className="stateCard">
            <p className="stateTitle">No seen items yet.</p>
            <p className="stateDetail">Scroll a bit and they will show up here.</p>
          </div>
        ) : null}
        {category === 'seen' && seenItems.length ? (
          <button className="retryButton" type="button" onClick={clearSeenHistory}>
            Clear seen history
          </button>
        ) : null}
        {hasHiddenOnlyFeed ? (
          <div className="stateCard">
            <p className="stateTitle">Everything in this batch is already marked seen.</p>
            <p className="stateDetail">Clear seen history to show all cards again.</p>
            <button className="retryButton" type="button" onClick={clearSeenHistory}>
              Clear seen history
            </button>
          </div>
        ) : null}

        {loadingByCategory[category] ? (
          <div className="stateCard">
            <p className="stateTitle">Loading more...</p>
            <p className="stateDetail">We are grabbing another batch.</p>
          </div>
        ) : null}

        {errorByCategory[category] ? (
          <div className="stateCard">
            <p className="stateTitle">Could not fetch this feed.</p>
            <p className="stateDetail">{errorByCategory[category]}</p>
            <button className="retryButton" type="button" onClick={() => loadMore(category)}>
              Try again
            </button>
          </div>
        ) : null}
        {category === 'feed' && !loadingByCategory[category] && !errorByCategory[category] ? (
          <button className="retryButton" type="button" onClick={() => loadMore('feed')}>
            Load more
          </button>
        ) : null}
      </footer>

      {activeImage ? (
        <div className="modalBackdrop" role="presentation" onClick={() => setActiveImage(null)}>
          <img src={activeImage} className="modalImage" alt="Expanded artwork" />
        </div>
      ) : null}

      {showInstallGuide ? (
        <div
          className="dialogBackdrop"
          role="presentation"
          onClick={() => setShowInstallGuide(false)}>
          <div
            className="dialogCard"
            role="dialog"
            aria-modal="true"
            aria-label="Install instructions"
            onClick={(event) => event.stopPropagation()}>
            <h3>Install on iPhone</h3>
            <p>1. Tap the Share button in Safari.</p>
            <p>2. Choose Add to Home Screen.</p>
            <p>3. Tap Add.</p>
            <button
              type="button"
              className="retryButton"
              onClick={() => setShowInstallGuide(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {showBottomBar ? (
        <div className="bottomBar" role="navigation" aria-label="Quick controls">
          <div className="bottomBarInner">
            <div className="tabs" role="tablist" aria-label="Feed categories (bottom)">
              {CATEGORIES.map((tab) => {
                const isActive = tab.key === category;
                const Icon = TAB_ICONS[tab.key];
                return (
                  <button
                    key={`bottom-${tab.key}`}
                    className={`tab${isActive ? ' tabActive' : ''}`}
                    onClick={() => setCategory(tab.key)}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={tab.label}
                    title={tab.label}>
                    {Icon ? <Icon size={CONTROL_ICON_SIZE} aria-hidden="true" /> : tab.label}
                  </button>
                );
              })}
            </div>

            <span className="topDivider" aria-hidden="true" />

            <div className="topControls">
              {canShowInstallButton ? (
                <button
                  className="installButton"
                  type="button"
                  onClick={handleInstallClick}
                  aria-label={installEvent ? 'Install app' : 'Add to Home Screen'}
                  title={installEvent ? 'Install app' : 'Add to Home Screen'}>
                  <Home size={CONTROL_ICON_SIZE} aria-hidden="true" />
                </button>
              ) : null}

              <button
                className="installButton"
                type="button"
                onClick={cycleVoice}
                disabled={!availableVoices.length}
                aria-label={
                  selectedVoice
                    ? `Change read aloud voice. Current: ${selectedVoice.name}`
                    : 'Change read aloud voice'
                }
                title={selectedVoice ? `Voice: ${selectedVoice.name}` : 'Change read aloud voice'}>
                <Volume2 size={CONTROL_ICON_SIZE} aria-hidden="true" />
              </button>

              <button
                className="installButton"
                type="button"
                onClick={toggleDarkMode}
                aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                title={isDarkMode ? 'Light mode' : 'Dark mode'}>
                {isDarkMode ? (
                  <Sun size={CONTROL_ICON_SIZE} aria-hidden="true" />
                ) : (
                  <Moon size={CONTROL_ICON_SIZE} aria-hidden="true" />
                )}
              </button>

              <button
                className="installButton"
                type="button"
                onClick={toggleTextSize}
                aria-label={isLargeText ? 'Use normal text size' : 'Use larger text size'}
                title={isLargeText ? 'Text: normal' : 'Text: larger'}>
                <Type size={CONTROL_ICON_SIZE} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
