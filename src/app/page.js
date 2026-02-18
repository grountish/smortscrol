'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookText,
  ChevronsDown,
  ChevronDown,
  Eye,
  Heart,
  Highlighter,
  Infinity as InfinityIcon,
  Info,
  Leaf,
  Minus,
  Moon,
  Play,
  Settings2,
  SlidersHorizontal,
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
  'tumblr-gallery': 'Tumblr',
  'local-gallery': '*',
  'art-history': 'Art History',
  'music-history': 'Music History',
  philosophy: 'Philosophy',
  science: 'Science',
  'computer-science': 'Computer Science',
  cinema: 'Cinema',
  'cinema-history': 'Cinema History',
  feminism: 'Feminism',
  'history-facts': 'History',
  neurobiology: 'Neurobiology',
  'anthropology-facts': 'Anthropology',
};

const PAGE_SIZE = 15;
const PAGE_SIZE_ART = 10;
const LOAD_MORE_BATCH_MAX = 7;
const ART_CURATED_BATCH = 12;
const CONTROL_ICON_SIZE = 16;
const AVERAGE_READING_WPM = 220;
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
const MINDFUL_SCORE_STORAGE_KEY = 'smortscroll:mindful-score';
const READING_GUIDE_STORAGE_KEY = 'smortscroll:reading-guide';
const AUTO_SCROLL_STORAGE_KEY = 'smortscroll:auto-scroll';
const AUTO_SCROLL_STEP_PX = 100;
const AUTO_SCROLL_STEP_MS = 5500;
const FALLBACK_IMAGE_URL = '/icons/icon-512.png';
const BREATH_BREAK_INTERVAL_MS = 5 * 60 * 1000;
const MINDFUL_SCORE_MIN = 0;
const MINDFUL_SCORE_MAX = 9999;
const MINDFUL_SCROLL_SPEED_MEDIUM = 1200;
const MINDFUL_SCROLL_SPEED_FAST = 1800;
const MINDFUL_SCORE_PENALTY_MEDIUM = -1;
const MINDFUL_SCORE_PENALTY_FAST = -2;
const MINDFUL_SCORE_PENALTY_MEDIUM_DOWN = -2;
const MINDFUL_SCORE_PENALTY_FAST_DOWN = -3;
const MINDFUL_SCROLL_PENALTY_COOLDOWN_MS = 420;
const MINDFUL_SCORE_PASSIVE_INTERVAL = 15000;
const MINDFUL_SCORE_PASSIVE_GAIN = 1;
const MINDFUL_PASSIVE_BLOCK_AFTER_FAST_SCROLL_MS = 20000;
const BOTTOM_BAR_SHOW_SCROLL_PX = 28;
const BOTTOM_BAR_HIDE_SCROLL_PX = 40;
const BOTTOM_BAR_SCROLL_DELTA_MIN = 2;
const TUMBLR_SOURCE_KEY = 'tumblr-gallery';
const LOCAL_GALLERY_SOURCE_KEY = 'local-gallery';
const TUMBLR_INSERT_EVERY = 10;
const LOCAL_GALLERY_INSERT_EVERY = 20;
const ART_QUERY = 'painting';
const FEED_SOURCES = [
  'art',
  'tumblr-gallery',
  'local-gallery',
  'art-history',
  'music-history',
  'philosophy',
  'science',
  'computer-science',
  'cinema',
  'cinema-history',
  'feminism',
  'history-facts',
  'neurobiology',
  'anthropology-facts',
];
const FEED_SOURCE_BATCH = 3;
const READ_TIME_SOURCES = new Set([
  'art-history',
  'music-history',
  'philosophy',
  'science',
  'computer-science',
  'cinema',
  'cinema-history',
  'feminism',
  'history-facts',
  'neurobiology',
  'anthropology-facts',
]);
const PHILOSOPHER_NAMES = [
  'Socrates',
  'Plato',
  'Aristotle',
  'Heraclitus',
  'Epicurus',
  'Lucretius',
  'Confucius',
  'Laozi',
  'Nagarjuna',
  'Avicenna',
  'Averroes',
  'Thomas Aquinas',
  'René Descartes',
  'Baruch Spinoza',
  'Gottfried Wilhelm Leibniz',
  'David Hume',
  'John Locke',
  'Jean-Jacques Rousseau',
  'Immanuel Kant',
  'G. W. F. Hegel',
  'Arthur Schopenhauer',
  'John Stuart Mill',
  'Søren Kierkegaard',
  'Karl Marx',
  'Friedrich Nietzsche',
  'Henri Bergson',
  'Marquis de Sade',
  'Bertrand Russell',
  'Ludwig Wittgenstein',
  'Martin Heidegger',
  'Jean-Paul Sartre',
  'Hannah Arendt',
  'Simone de Beauvoir',
  'Albert Camus',
  'W. E. B. Du Bois',
  'Frantz Fanon',
  'Hypatia',
  'G. E. M. Anscombe',
  'Philippa Foot',
  'Mary Midgley',
  'Martha Nussbaum',
  'Judith Butler',
  'Angela Davis',
  'Byung-Chul Han',
  'Slavoj Žižek',
];
const PHILOSOPHER_BATCH_SIZE = 8;
const WIKI_SEARCH = {
  'art-history':
    'art history OR art movement OR painter OR sculptor OR picasso OR manet OR monet OR vangogh OR "van gogh" OR michelangelo OR "da vinci" OR cezanne OR renoir OR "aristide maillol" OR "henrietta rae" OR "aristide maillol" OR "female painter" OR gentileschi OR "frida kahlo" OR "georgia o keeffe" OR "mary cassatt" OR "berthe morisot" OR "suzanne valadon" OR "tamara de lempicka" OR "leonor fini" OR "alice neel" OR "lynette yiadom"',
  'music-history':
    'music history OR composer OR symphony OR jazz history OR beethoven OR mozart OR "florence price" OR "nina simone" OR "billie holiday" OR "ella fitzgerald" OR "clara schumann" OR "fanny mendelssohn" OR "hildegard von bingen" OR "louise farrenc" OR "lili boulanger" OR "ethel smyth" OR "margaret bonds"',
  philosophy:
    'plato OR aristotle OR socrates OR heraclitus OR epicurus OR epicuro OR lucretius OR lucrecious OR confucius OR "laozi" OR "nagarjuna" OR "avicenna" OR "averroes" OR "thomas aquinas" OR "rene descartes" OR "baruch spinoza" OR spinoza OR "gottfried leibniz" OR "david hume" OR "john locke" OR "jean-jacques rousseau" OR "immanuel kant" OR "g.w.f. hegel" OR "arthur schopenhauer" OR "john stuart mill" OR "soren kierkegaard" OR "karl marx" OR "friedrich nietzsche" OR "henri bergson" OR bergson OR "marquis de sade" OR "marques de sade" OR "donatien alphonse francois" OR "bertrand russell" OR "ludwig wittgenstein" OR "martin heidegger" OR "jean-paul sartre" OR "hannah arendt" OR "simone de beauvoir" OR "albert camus" OR "w.e.b. du bois" OR "frantz fanon" OR "hypatia" OR "elizabeth anscombe" OR "philippa foot" OR "mary midgley" OR "susan wolf" OR "martha nussbaum" OR "judith butler" OR "angela davis" OR "byung-chul han" OR "slavoj zizek"',
  science:
    'science OR physics OR biology OR chemistry OR astronomy OR einstein OR newton OR curie OR darwin OR hawking OR feynman OR "marie curie" OR "chandra" OR "vera rubin" OR "cecilia payne" OR "rosalind franklin" OR "jocelyn bell" OR "ada lovelace" OR "hedy lamarr" OR "katherine johnson" OR "dorothy hodgkin" OR "barbara mcclintock"',
  'computer-science':
    'computer science OR computing OR algorithms OR turing OR hopper OR knuth OR dijkstra OR shannon OR "von neumann" OR linus torvalds OR "ada lovelace" OR "grace hopper" OR "karen spärck jones" OR "frances allen" OR "barbara liskov" OR "jean sammet" OR "radia perlman" OR "adele goldberg" OR "margaret hamilton" OR "mary lou jepsen" OR "fei fei li"',
  cinema:
    'cinema OR film OR filmmaker OR director OR screenwriter OR cinematography OR "agnes varda" OR "chloe zhao" OR "kathryn bigelow" OR "greta gerwig" OR "ava duvernay" OR "sofia coppola" OR "satyajit ray" OR "akira kurosawa" OR "hayao miyazaki" OR "francois truffaut"',
  'cinema-history':
    'history of cinema OR film history OR silent film OR german expressionism OR french new wave OR italian neorealism OR hollywood golden age OR "new hollywood" OR "parallel cinema" OR "iranian new wave" OR "japanese cinema history" OR "african cinema" OR "latin american cinema"',
  feminism:
    'feminism OR feminist theory OR gender equality OR women rights OR suffrage OR intersectional feminism OR simone de beauvoir OR bell hooks OR judith butler OR angela davis OR gloria steinem OR emma goldman OR roxane gay',
  'history-facts':
    'curious history facts OR weird history OR historical trivia OR little known history OR surprising events in history OR unusual inventions history OR strange ancient practices',
  neurobiology:
    'neurobiology OR neuroscience OR brain science OR neurons OR synapse OR neuroplasticity OR hippocampus OR amygdala OR prefrontal cortex OR neurotransmitters OR oliver sacks OR eric kandel',
  'anthropology-facts':
    'curious anthropologic facts OR anthropology facts OR cultural anthropology OR human evolution OR archaeology discoveries OR ancient cultures OR rites and rituals OR kinship systems OR margaret mead OR claude levi strauss OR mary douglas',
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

function estimateReadingLines(item) {
  const text = [item?.title, item?.description, item?.summary, item?.content]
    .filter((part) => typeof part === 'string' && part.trim())
    .join(' ')
    .trim();

  if (!text) {
    return 2;
  }

  const estimated = Math.ceil(text.length / 80);
  return Math.min(36, Math.max(2, estimated));
}

function estimateReadMinutes(item) {
  const text = [item?.title, item?.detailFull || item?.detail]
    .filter((part) => typeof part === 'string' && part.trim())
    .join(' ')
    .trim();

  if (!text) {
    return 1;
  }

  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / AVERAGE_READING_WPM));
}

function shouldShowReadMinutes(item, isExpanded, isLoadingFull) {
  const source = getItemSource(item);
  if (!READ_TIME_SOURCES.has(source)) {
    return false;
  }

  if (!isExpanded || isLoadingFull) {
    return false;
  }

  return true;
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

function getItemSource(item) {
  if (item?.source) {
    return item.source;
  }

  const id = item?.id || '';
  return FEED_SOURCES.find((sourceKey) => id.startsWith(`${sourceKey}-`)) || 'unknown';
}

function pickBalancedFeedItems(items, maxItems) {
  if (!items.length || maxItems <= 0) {
    return [];
  }

  const buckets = new Map();
  items.forEach((item) => {
    const source = getItemSource(item);
    if (!buckets.has(source)) {
      buckets.set(source, []);
    }
    buckets.get(source).push(item);
  });

  const picked = [];
  const sourceKeys = shuffleArray(Array.from(buckets.keys()).filter((key) => key !== 'unknown'));

  sourceKeys.forEach((source) => {
    if (picked.length >= maxItems) {
      return;
    }

    const sourceItems = buckets.get(source);
    const firstItem = sourceItems?.shift();
    if (firstItem) {
      picked.push(firstItem);
    }
  });

  const remainingPool = shuffleArray(Array.from(buckets.values()).flat());
  for (const item of remainingPool) {
    if (picked.length >= maxItems) {
      break;
    }
    picked.push(item);
  }

  return picked;
}

function countCadenceSlots(existingCount, batchSize, interval) {
  let slots = 0;
  for (let index = 1; index <= batchSize; index += 1) {
    if ((existingCount + index) % interval === 0) {
      slots += 1;
    }
  }
  return slots;
}

function arrangeFeedWithCadence(items, existingCount) {
  if (!items.length) {
    return [];
  }

  const tumblrPool = [];
  const localGalleryPool = [];
  const nonTumblrPool = [];

  items.forEach((item) => {
    const source = getItemSource(item);

    if (source === TUMBLR_SOURCE_KEY) {
      tumblrPool.push(item);
      return;
    }

    if (source === LOCAL_GALLERY_SOURCE_KEY) {
      localGalleryPool.push(item);
      return;
    }

    nonTumblrPool.push(item);
  });

  const arranged = [];
  for (let index = 1; index <= items.length; index += 1) {
    const shouldUseLocalGallery = (existingCount + index) % LOCAL_GALLERY_INSERT_EVERY === 0;
    const shouldUseTumblr = (existingCount + index) % TUMBLR_INSERT_EVERY === 0;

    if (shouldUseLocalGallery && localGalleryPool.length) {
      arranged.push(localGalleryPool.shift());
      continue;
    }

    if (shouldUseTumblr && tumblrPool.length) {
      arranged.push(tumblrPool.shift());
      continue;
    }

    if (nonTumblrPool.length) {
      arranged.push(nonTumblrPool.shift());
      continue;
    }

    if (tumblrPool.length) {
      arranged.push(tumblrPool.shift());
      continue;
    }

    if (localGalleryPool.length) {
      arranged.push(localGalleryPool.shift());
    }
  }

  return arranged;
}

function getVoiceColor(voiceIndex, totalVoices) {
  if (voiceIndex < 0 || totalVoices <= 0) {
    return 'currentColor';
  }

  const hue = Math.round((voiceIndex / Math.max(1, totalVoices)) * 360);
  return `hsl(${hue} 78% 56%)`;
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
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLargeText, setIsLargeText] = useState(false);
  const [speakingItemId, setSpeakingItemId] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState(null);
  const [showBottomBar, setShowBottomBar] = useState(false);
  const [isAmbientPlaying, setIsAmbientPlaying] = useState(false);
  const [mindfulScore, setMindfulScore] = useState(0);
  const [openMenuSlot, setOpenMenuSlot] = useState(null);
  const [showReadingGuide, setShowReadingGuide] = useState(false);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(false);
  const [showBreathOverlay, setShowBreathOverlay] = useState(false);
  const [isBreathSoundReady, setIsBreathSoundReady] = useState(false);
  const [showScoreInfo, setShowScoreInfo] = useState(false);

  const inFlightRef = useRef({});
  const seenIdsRef = useRef(new Set());
  const seenItemsRef = useRef([]);
  const favoriteIdsRef = useRef(new Set());
  const favoriteItemsRef = useRef([]);
  const viewedIdsRef = useRef(new Set());
  const speakingItemIdRef = useRef(null);
  const utteranceRef = useRef(null);
  const ambientAudioRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const bootstrappedFeedRef = useRef(false);
  const cardRefs = useRef({});
  const readContentRefs = useRef({});
  const loadMoreSentinelRef = useRef(null);
  const feedSourceOrderRef = useRef(shuffleArray(FEED_SOURCES));
  const feedSourceIndexRef = useRef(0);
  const lastScrollYRef = useRef(0);
  const lastScrollAtRef = useRef(0);
  const lastPenaltyAtRef = useRef(0);
  const upScrollAccumRef = useRef(0);
  const downScrollAccumRef = useRef(0);
  const mindfulScoreRef = useRef(0);
  const activeVisibleMsRef = useRef(0);
  const activeVisibleTickRef = useRef(0);
  const lastRapidDownScrollAtRef = useRef(0);
  const wakeLockRef = useRef(null);
  const breathAudioRef = useRef(null);
  const breathCircleRef = useRef(null);
  const topMenuRef = useRef(null);
  const bottomMenuRef = useRef(null);

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

  const adjustMindfulScore = useCallback((delta) => {
    if (!Number.isFinite(delta) || delta === 0) {
      return;
    }

    setMindfulScore((prev) => {
      const next = Math.max(MINDFUL_SCORE_MIN, Math.min(MINDFUL_SCORE_MAX, prev + delta));
      mindfulScoreRef.current = next;
      return next;
    });
  }, []);

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

      const estimatedLines = estimateReadingLines(item);
      const readGain = Math.min(10, 1 + Math.round(estimatedLines * 0.35));
      adjustMindfulScore(readGain);
    },
    [addSeenItems, adjustMindfulScore, queueSeenSave],
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

    setSeenItems((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        if (item.id !== id) {
          return item;
        }
        changed = true;
        return { ...item, ...updates };
      });

      if (changed) {
        seenItemsRef.current = next;
      }

      return changed ? next : prev;
    });

    setFavoriteItems((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        if (item.id !== id) {
          return item;
        }
        changed = true;
        return { ...item, ...updates };
      });

      if (changed) {
        favoriteItemsRef.current = next;
      }

      return changed ? next : prev;
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
        const fetchMetIds = async () => {
          const idSet = new Set();

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

          return Array.from(idSet);
        };

        const fetchMetItems = async (metCursor) => {
          let artIds = Array.isArray(metCursor?.ids) ? metCursor.ids : [];
          let artIndex = Number.isFinite(metCursor?.index) ? metCursor.index : 0;

          if (!artIds.length) {
            artIds = await fetchMetIds();
          }

          if (artIndex >= artIds.length || !artIds.length) {
            artIds = await fetchMetIds();
            artIndex = 0;
          }

          const maxScans = 4;
          let scans = 0;

          while (scans < maxScans) {
            if (artIndex >= artIds.length) {
              artIds = await fetchMetIds();
              artIndex = 0;
              if (!artIds.length) {
                break;
              }
            }

            const slice = artIds.slice(artIndex, artIndex + PAGE_SIZE_ART);
            if (!slice.length) {
              break;
            }

            const detailRequests = slice.map((id) =>
              fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`),
            );
            const detailResponses = await Promise.all(detailRequests);
            const detailJson = await Promise.all(
              detailResponses.map((response) => response.json()),
            );

            const categoryItems = detailJson
              .map((item) => ({
                id: `art-${item.objectID}`,
                source: targetCategory,
                title: item.title || 'Untitled work',
                detail: [
                  item.artistDisplayName && `Artist: ${item.artistDisplayName}`,
                  item.objectDate && `Date: ${item.objectDate}`,
                  item.medium && `Medium: ${item.medium}`,
                ]
                  .filter(Boolean)
                  .join(' - '),
                tag: `${item.department || 'Met Museum'} - ${CATEGORY_LABELS.art}`,
                imageUrl: item.primaryImageSmall || item.primaryImage || null,
                webUrl: item.objectURL || null,
                highlight: Boolean(item.isHighlight),
              }))
              .filter((item) => item.imageUrl)
              .sort((a, b) => Number(b.highlight) - Number(a.highlight));

            const nextIndex = artIndex + PAGE_SIZE_ART;
            if (categoryItems.length) {
              return {
                items: categoryItems,
                cursor: {
                  ids: artIds,
                  index: nextIndex,
                },
              };
            }

            artIndex = nextIndex;
            scans += 1;
          }

          return {
            items: [],
            cursor: {
              ids: artIds,
              index: artIndex,
            },
          };
        };

        const fetchAicItems = async (aicPage) => {
          const page = Number.isFinite(aicPage) && aicPage > 0 ? aicPage : 1;
          const response = await fetch(
            `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(
              ART_QUERY,
            )}&query[term][is_public_domain]=true&page=${page}&limit=${PAGE_SIZE_ART}&fields=id,title,artist_display,date_display,medium_display,image_id`,
          );

          const json = await response.json();
          const iiifBase = json?.config?.iiif_url || 'https://www.artic.edu/iiif/2';
          const currentPage = Number.isFinite(json?.pagination?.current_page)
            ? json.pagination.current_page
            : page;
          const totalPages = Number.isFinite(json?.pagination?.total_pages)
            ? json.pagination.total_pages
            : currentPage;
          const nextPage = currentPage >= totalPages ? 1 : currentPage + 1;

          const items = (Array.isArray(json?.data) ? json.data : [])
            .filter((item) => item?.image_id)
            .map((item) => ({
              id: `art-aic-${item.id}`,
              source: targetCategory,
              title: item.title || 'Untitled work',
              detail: [
                item.artist_display && `Artist: ${item.artist_display}`,
                item.date_display && `Date: ${item.date_display}`,
                item.medium_display && `Medium: ${item.medium_display}`,
              ]
                .filter(Boolean)
                .join(' - '),
              tag: `Art Institute of Chicago - ${CATEGORY_LABELS.art}`,
              imageUrl: `${iiifBase}/${item.image_id}/full/843,/0/default.jpg`,
              webUrl: `https://www.artic.edu/artworks/${item.id}`,
              highlight: false,
            }));

          return {
            items,
            nextPage,
          };
        };

        const storedArtCursor = cursorByCategory[targetCategory] || {};
        const metCursor = storedArtCursor.met || storedArtCursor;
        const aicPage = storedArtCursor.aic?.page || 1;

        const [metBatch, aicBatch] = await Promise.allSettled([
          fetchMetItems(metCursor),
          fetchAicItems(aicPage),
        ]);

        const metItems = metBatch.status === 'fulfilled' ? metBatch.value.items : [];
        const aicItems = aicBatch.status === 'fulfilled' ? aicBatch.value.items : [];

        if (!metItems.length && !aicItems.length) {
          if (metBatch.status === 'rejected') {
            throw metBatch.reason || new Error('Could not fetch art items.');
          }
          if (aicBatch.status === 'rejected') {
            throw aicBatch.reason || new Error('Could not fetch art items.');
          }
        }

        const mixedItems = shuffleArray(interleave([metItems, aicItems]));

        return {
          items: mixedItems,
          cursor: {
            met:
              metBatch.status === 'fulfilled'
                ? metBatch.value.cursor
                : {
                    ids: Array.isArray(metCursor?.ids) ? metCursor.ids : [],
                    index: Number.isFinite(metCursor?.index) ? metCursor.index : 0,
                  },
            aic: {
              page: aicBatch.status === 'fulfilled' ? aicBatch.value.nextPage : aicPage,
            },
          },
        };
      }

      if (targetCategory === 'tumblr-gallery') {
        const tumblrCursor = cursorByCategory[targetCategory] || { offset: 0 };
        const offset =
          Number.isFinite(tumblrCursor?.offset) && tumblrCursor.offset >= 0
            ? tumblrCursor.offset
            : 0;

        const response = await fetch(
          `/api/tumblr-shared-gallery?offset=${offset}&limit=${PAGE_SIZE_ART}`,
          { cache: 'no-store' },
        );
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error || 'Could not fetch Tumblr gallery.');
        }

        const items = (Array.isArray(payload?.items) ? payload.items : []).map((item, index) => ({
          ...item,
          id: item?.id || `tumblr-gallery-${offset + index}`,
          source: targetCategory,
          tag: item?.tag || `- - ${CATEGORY_LABELS[targetCategory]}`,
        }));

        const nextOffset =
          Number.isFinite(payload?.nextOffset) && payload.nextOffset >= 0
            ? payload.nextOffset
            : offset + PAGE_SIZE_ART;

        return {
          items,
          cursor: {
            offset: nextOffset,
          },
        };
      }

      if (targetCategory === 'local-gallery') {
        const localCursor = cursorByCategory[targetCategory] || { offset: 0 };
        const offset =
          Number.isFinite(localCursor?.offset) && localCursor.offset >= 0 ? localCursor.offset : 0;

        const response = await fetch('/assets/local-gallery/manifest.json', { cache: 'no-store' });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error || 'Could not fetch local gallery.');
        }

        const fileNames = Array.isArray(payload?.files) ? payload.files : [];

        const slice = fileNames.slice(offset, offset + PAGE_SIZE_ART);
        const items = slice.map((fileName, index) => ({
          id: `local-gallery-${offset + index}-${fileName}`,
          source: targetCategory,
          title: '_',
          detail: '',
          tag: `- - ${CATEGORY_LABELS[targetCategory]}`,
          imageUrl: `/assets/local-gallery/${encodeURIComponent(fileName)}`,
          webUrl: null,
        }));

        const nextOffset = offset + slice.length >= fileNames.length ? 0 : offset + slice.length;

        return {
          items,
          cursor: {
            offset: nextOffset,
          },
        };
      }

      if (targetCategory === 'philosophy') {
        const baseOrder = PHILOSOPHER_NAMES;
        const previousCursor = cursorByCategory[targetCategory] || {};
        const initialIndex = Number.isFinite(previousCursor.index)
          ? previousCursor.index
          : Math.floor(Math.random() * baseOrder.length);

        const selectedNames = [];
        for (
          let index = 0;
          index < Math.min(PHILOSOPHER_BATCH_SIZE, baseOrder.length);
          index += 1
        ) {
          selectedNames.push(baseOrder[(initialIndex + index) % baseOrder.length]);
        }

        const summaryRequests = selectedNames.map((name) =>
          fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`),
        );
        const summaryResponses = await Promise.all(summaryRequests);
        const summaries = await Promise.all(summaryResponses.map((response) => response.json()));

        const items = summaries
          .filter(
            (item) => item?.type !== 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found',
          )
          .map((item, index) => ({
            id: `${targetCategory}-${item.pageid || selectedNames[index].toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            source: targetCategory,
            title: item.title || selectedNames[index],
            detail: sanitizeWikiText(item.extract),
            detailFull: null,
            wikiTitle: item.title || selectedNames[index],
            tag: CATEGORY_LABELS[targetCategory],
            webUrl: item.content_urls?.desktop?.page || null,
            imageUrl: item.originalimage?.source || item.thumbnail?.source || null,
          }))
          .filter((item) => item.detail);

        return {
          items,
          cursor: { index: (initialIndex + PHILOSOPHER_BATCH_SIZE) % baseOrder.length },
        };
      }

      if (WIKI_SEARCH[targetCategory]) {
        const fetchWikiSummaries = async (topic, offset) => {
          const searchResponse = await fetch(
            `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
              topic,
            )}&format=json&srlimit=${WIKI_PAGE_SIZE}&sroffset=${offset}&origin=*`,
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
              source: targetCategory,
              title: item.title,
              detail: sanitizeWikiText(item.extract),
              detailFull: null,
              wikiTitle: item.title,
              tag: CATEGORY_LABELS[targetCategory],
              webUrl: item.content_urls?.desktop?.page || null,
              imageUrl: item.originalimage?.source || item.thumbnail?.source || null,
            })),
            count: titles.length,
          };
        };

        const searchTopic = WIKI_SEARCH[targetCategory];
        const wikiCursor = cursorByCategory[targetCategory] || {
          offset: Math.floor(Math.random() * (WIKI_RANDOM_START_MAX + 1)),
        };
        const initialOffset = Number.isFinite(wikiCursor.offset) ? wikiCursor.offset : 0;
        let { items, count } = await fetchWikiSummaries(searchTopic, initialOffset);
        let nextOffset = initialOffset + count;

        if (!count && initialOffset !== 0) {
          const retry = await fetchWikiSummaries(searchTopic, 0);
          items = retry.items;
          count = retry.count;
          nextOffset = count;
        }

        if (!count) {
          const fallbackTopic = `${CATEGORY_LABELS[targetCategory]} history`;
          const retryFallback = await fetchWikiSummaries(fallbackTopic, 0);
          items = retryFallback.items;
          count = retryFallback.count;
          nextOffset = count;
        }

        return {
          items,
          cursor: { offset: nextOffset },
        };
      }

      return { items: [], cursor: cursorByCategory[targetCategory] };
    },
    [cursorByCategory],
  );

  const getNextFeedSources = useCallback(() => {
    if (!feedSourceOrderRef.current.length) {
      feedSourceOrderRef.current = shuffleArray(FEED_SOURCES);
    }

    const order = feedSourceOrderRef.current;
    const start = feedSourceIndexRef.current;
    const batch = [];

    for (let index = 0; index < FEED_SOURCE_BATCH; index += 1) {
      batch.push(order[(start + index) % order.length]);
    }

    feedSourceIndexRef.current = (start + FEED_SOURCE_BATCH) % order.length;

    // When a full cycle completes, reshuffle to avoid repeating the same order.
    if (feedSourceIndexRef.current === 0) {
      feedSourceOrderRef.current = shuffleArray(FEED_SOURCES);
    }

    return batch;
  }, []);

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
          const collectedBatches = [];
          const cursorUpdates = [];
          let attempts = 0;

          // Pull multiple batches until we have variety and a reasonable number of items.
          while (
            (collectedBatches.length < 2 || nextItems.length < PAGE_SIZE) &&
            attempts < FEED_SOURCES.length * 2
          ) {
            const sourceBatch = getNextFeedSources();
            const settled = await Promise.allSettled(
              sourceBatch.map((source) => fetchBatch(source)),
            );
            const successful = settled
              .map((result, index) => ({ result, source: sourceBatch[index] }))
              .filter(
                (entry) =>
                  entry.result.status === 'fulfilled' &&
                  Array.isArray(entry.result.value.items) &&
                  entry.result.value.items.length,
              );

            if (!successful.length) {
              const rejected = settled.find((entry) => entry.status === 'rejected');
              if (rejected) {
                throw rejected.reason || new Error('Could not fetch feed sources.');
              }
            }

            successful.forEach((entry) => {
              const batch = entry.result.value;
              collectedBatches.push(batch.items);
              if (batch.cursor) {
                cursorUpdates.push({ source: entry.source, cursor: batch.cursor });
              }
            });

            nextItems = shuffleArray(interleave(collectedBatches));
            attempts += 1;
          }

          if (!collectedBatches.length || !nextItems.length) {
            throw new Error('Could not fetch feed sources.');
          }

          if (cursorUpdates.length) {
            setCursorByCategory((prev) => {
              const updates = { ...prev };
              cursorUpdates.forEach((entry) => {
                updates[entry.source] = entry.cursor;
              });
              return updates;
            });
          }
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
        const candidateItems = unseenItems.length ? unseenItems : nextItems;
        let itemsToAdd = candidateItems.slice(0, LOAD_MORE_BATCH_MAX);

        if (targetCategory === 'feed') {
          const existingFeedCount = (itemsByCategory.feed || []).filter(
            (item) => !seenIdsRef.current.has(item.id),
          ).length;
          let selectedFeedItems = pickBalancedFeedItems(candidateItems, LOAD_MORE_BATCH_MAX);

          const requiredTumblrSlots = countCadenceSlots(
            existingFeedCount,
            selectedFeedItems.length,
            TUMBLR_INSERT_EVERY,
          );
          const selectedTumblrCount = selectedFeedItems.filter(
            (item) => getItemSource(item) === TUMBLR_SOURCE_KEY,
          ).length;

          if (requiredTumblrSlots > selectedTumblrCount) {
            try {
              const tumblrBatch = await fetchBatch(TUMBLR_SOURCE_KEY);
              if (tumblrBatch?.cursor) {
                setCursorByCategory((prev) => ({
                  ...prev,
                  [TUMBLR_SOURCE_KEY]: tumblrBatch.cursor,
                }));
              }

              const existingIds = new Set(selectedFeedItems.map((item) => item.id));
              const shortage = requiredTumblrSlots - selectedTumblrCount;
              const extraTumblrItems = (Array.isArray(tumblrBatch?.items) ? tumblrBatch.items : [])
                .filter((item) => item?.id && !existingIds.has(item.id))
                .slice(0, shortage);

              if (extraTumblrItems.length) {
                const tumblrItems = selectedFeedItems.filter(
                  (item) => getItemSource(item) === TUMBLR_SOURCE_KEY,
                );
                const nonTumblrItems = selectedFeedItems.filter(
                  (item) => getItemSource(item) !== TUMBLR_SOURCE_KEY,
                );
                const nonTumblrKeepCount = Math.max(
                  0,
                  nonTumblrItems.length - extraTumblrItems.length,
                );

                selectedFeedItems = [
                  ...tumblrItems,
                  ...extraTumblrItems,
                  ...nonTumblrItems.slice(0, nonTumblrKeepCount),
                ].slice(0, selectedFeedItems.length);
              }
            } catch {
              // Ignore supplemental Tumblr fetch failures; feed still loads.
            }
          }

          const requiredLocalSlots = countCadenceSlots(
            existingFeedCount,
            selectedFeedItems.length,
            LOCAL_GALLERY_INSERT_EVERY,
          );
          const selectedLocalCount = selectedFeedItems.filter(
            (item) => getItemSource(item) === LOCAL_GALLERY_SOURCE_KEY,
          ).length;

          if (requiredLocalSlots > selectedLocalCount) {
            try {
              const localBatch = await fetchBatch(LOCAL_GALLERY_SOURCE_KEY);
              if (localBatch?.cursor) {
                setCursorByCategory((prev) => ({
                  ...prev,
                  [LOCAL_GALLERY_SOURCE_KEY]: localBatch.cursor,
                }));
              }

              const existingIds = new Set(selectedFeedItems.map((item) => item.id));
              const shortage = requiredLocalSlots - selectedLocalCount;
              const extraLocalItems = (Array.isArray(localBatch?.items) ? localBatch.items : [])
                .filter((item) => item?.id && !existingIds.has(item.id))
                .slice(0, shortage);

              if (extraLocalItems.length) {
                const localItems = selectedFeedItems.filter(
                  (item) => getItemSource(item) === LOCAL_GALLERY_SOURCE_KEY,
                );
                const nonLocalItems = selectedFeedItems.filter(
                  (item) => getItemSource(item) !== LOCAL_GALLERY_SOURCE_KEY,
                );
                const nonLocalKeepCount = Math.max(
                  0,
                  nonLocalItems.length - extraLocalItems.length,
                );

                selectedFeedItems = [
                  ...localItems,
                  ...extraLocalItems,
                  ...nonLocalItems.slice(0, nonLocalKeepCount),
                ].slice(0, selectedFeedItems.length);
              }
            } catch {
              // Ignore supplemental local gallery fetch failures; feed still loads.
            }
          }

          itemsToAdd = arrangeFeedWithCadence(selectedFeedItems, existingFeedCount);
        }

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
    [fetchBatch, getNextFeedSources, itemsByCategory.feed],
  );

  useEffect(() => {
    if (category !== 'feed' || bootstrappedFeedRef.current) {
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
      return;
    }

    try {
      const rawValue = window.localStorage.getItem(MINDFUL_SCORE_STORAGE_KEY);
      const parsedValue = Number.parseInt(rawValue || '', 10);
      if (Number.isFinite(parsedValue)) {
        const normalized = Math.max(MINDFUL_SCORE_MIN, Math.min(MINDFUL_SCORE_MAX, parsedValue));
        mindfulScoreRef.current = normalized;
        setMindfulScore(normalized);
      }
    } catch {
      // Ignore score restoration failures.
    }
  }, []);

  useEffect(() => {
    mindfulScoreRef.current = mindfulScore;
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(MINDFUL_SCORE_STORAGE_KEY, String(mindfulScore));
    } catch {
      // Ignore score persistence failures.
    }
  }, [mindfulScore]);
  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    if ('serviceWorker' in window.navigator) {
      window.navigator.serviceWorker.register('/sw.js').catch(() => {
        // Ignore SW registration failures.
      });
    }

    return undefined;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    lastScrollAtRef.current = Date.now();

    const onScroll = () => {
      const now = Date.now();
      const elapsed = Math.max(16, now - lastScrollAtRef.current);
      const currentY = window.scrollY;
      const delta = currentY - lastScrollYRef.current;
      const beyondHeader = currentY > 120;
      const speed = Math.abs(delta) * (1000 / elapsed);

      if (isAutoScrollEnabled) {
        lastScrollAtRef.current = now;
        lastScrollYRef.current = currentY;
        return;
      }

      if (category === 'feed') {
        const sinceLastPenalty = now - lastPenaltyAtRef.current;
        if (sinceLastPenalty >= MINDFUL_SCROLL_PENALTY_COOLDOWN_MS) {
          if (delta > 0) {
            if (speed >= MINDFUL_SCROLL_SPEED_FAST) {
              adjustMindfulScore(MINDFUL_SCORE_PENALTY_FAST_DOWN);
              lastPenaltyAtRef.current = now;
              lastRapidDownScrollAtRef.current = now;
            } else if (speed >= MINDFUL_SCROLL_SPEED_MEDIUM) {
              adjustMindfulScore(MINDFUL_SCORE_PENALTY_MEDIUM_DOWN);
              lastPenaltyAtRef.current = now;
              lastRapidDownScrollAtRef.current = now;
            }
          } else if (speed >= MINDFUL_SCROLL_SPEED_FAST) {
            adjustMindfulScore(MINDFUL_SCORE_PENALTY_FAST);
            lastPenaltyAtRef.current = now;
          } else if (speed >= MINDFUL_SCROLL_SPEED_MEDIUM) {
            adjustMindfulScore(MINDFUL_SCORE_PENALTY_MEDIUM);
            lastPenaltyAtRef.current = now;
          }
        }
      }

      if (!beyondHeader) {
        upScrollAccumRef.current = 0;
        downScrollAccumRef.current = 0;
        setShowBottomBar(false);
      } else {
        if (delta <= -BOTTOM_BAR_SCROLL_DELTA_MIN) {
          upScrollAccumRef.current += Math.abs(delta);
          downScrollAccumRef.current = 0;
        } else if (delta >= BOTTOM_BAR_SCROLL_DELTA_MIN) {
          downScrollAccumRef.current += delta;
          upScrollAccumRef.current = 0;
        }

        setShowBottomBar((prev) => {
          let next = prev;

          if (!prev && upScrollAccumRef.current >= BOTTOM_BAR_SHOW_SCROLL_PX) {
            next = true;
          } else if (prev && downScrollAccumRef.current >= BOTTOM_BAR_HIDE_SCROLL_PX) {
            next = false;
          }

          if (next !== prev) {
            upScrollAccumRef.current = 0;
            downScrollAccumRef.current = 0;
          }

          return next;
        });
      }

      lastScrollAtRef.current = now;
      lastScrollYRef.current = currentY;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, [adjustMindfulScore, category, isAutoScrollEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined' || category !== 'feed') {
      return;
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      const sinceRapidDownScroll = Date.now() - lastRapidDownScrollAtRef.current;
      if (sinceRapidDownScroll < MINDFUL_PASSIVE_BLOCK_AFTER_FAST_SCROLL_MS) {
        return;
      }

      adjustMindfulScore(MINDFUL_SCORE_PASSIVE_GAIN);
    }, MINDFUL_SCORE_PASSIVE_INTERVAL);

    return () => {
      window.clearInterval(timer);
    };
  }, [adjustMindfulScore, category]);

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
      // Ignore storage read failures.
    }

    const prefersDark =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;

    setIsDarkMode(storedTheme ? storedTheme === 'dark' : prefersDark);
    setIsLargeText(storedTextSize === 'large');

    const mediaQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;

    const onThemeChange = (event) => {
      if (!storedTheme) {
        setIsDarkMode(event.matches);
      }
    };

    mediaQuery?.addEventListener('change', onThemeChange);

    return () => {
      mediaQuery?.removeEventListener('change', onThemeChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return undefined;
    }

    const restoreVoice = () => {
      const voices = window.speechSynthesis.getVoices() || [];
      setAvailableVoices(voices);

      if (!voices.length) {
        return;
      }

      let storedVoice = null;
      try {
        storedVoice = window.localStorage.getItem(VOICE_STORAGE_KEY);
      } catch {
        // Ignore storage read failures.
      }

      const preferred = voices.find((voice) => voice.voiceURI === storedVoice) || voices[0];
      if (!selectedVoiceUri) {
        setSelectedVoiceUri(preferred?.voiceURI || null);
      }
    };

    restoreVoice();
    window.speechSynthesis.addEventListener('voiceschanged', restoreVoice);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', restoreVoice);
    };
  }, [selectedVoiceUri]);

  const hasHiddenOnlyFeed =
    category === 'feed' && (itemsByCategory.feed?.length || 0) > 0 && filteredItems.length === 0;

  const selectedVoice = useMemo(
    () => availableVoices.find((voice) => voice.voiceURI === selectedVoiceUri) || null,
    [availableVoices, selectedVoiceUri],
  );
  const selectedVoiceIndex = useMemo(
    () => availableVoices.findIndex((voice) => voice.voiceURI === selectedVoiceUri),
    [availableVoices, selectedVoiceUri],
  );
  const voiceIconColor = useMemo(
    () => getVoiceColor(selectedVoiceIndex, availableVoices.length),
    [availableVoices.length, selectedVoiceIndex],
  );

  const releaseWakeLock = useCallback(async () => {
    const wakeLock = wakeLockRef.current;
    if (!wakeLock) {
      return;
    }

    wakeLockRef.current = null;
    try {
      await wakeLock.release();
    } catch {
      // Ignore wake lock release failures.
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return;
    }

    if (
      !('wakeLock' in navigator) ||
      wakeLockRef.current ||
      document.visibilityState !== 'visible'
    ) {
      return;
    }

    try {
      const wakeLock = await navigator.wakeLock.request('screen');
      wakeLockRef.current = wakeLock;
      wakeLock.addEventListener?.('release', () => {
        if (wakeLockRef.current === wakeLock) {
          wakeLockRef.current = null;
        }
      });
    } catch {
      // Ignore wake lock request failures.
    }
  }, []);

  const stopReadAloud = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      speakingItemIdRef.current = null;
      setSpeakingItemId(null);
      void releaseWakeLock();
      return;
    }

    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    speakingItemIdRef.current = null;
    setSpeakingItemId(null);
    void releaseWakeLock();
  }, [releaseWakeLock]);

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

  const selectVoice = useCallback(
    (voiceUri) => {
      if (!voiceUri) {
        return;
      }

      setSelectedVoiceUri(voiceUri);

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(VOICE_STORAGE_KEY, voiceUri);
        } catch {
          // Ignore storage write failures.
        }
      }

      if (speakingItemIdRef.current) {
        stopReadAloud();
      }
    },
    [stopReadAloud],
  );

  const toggleSettingsMenu = useCallback((slot) => {
    setOpenMenuSlot((prev) => (prev === slot ? null : slot));
  }, []);

  const toggleReadingGuide = useCallback(() => {
    setShowReadingGuide((prev) => !prev);
  }, []);

  const toggleAutoScroll = useCallback(() => {
    setIsAutoScrollEnabled((prev) => !prev);
  }, []);

  const openScoreInfo = useCallback(() => {
    setShowScoreInfo(true);
    setOpenMenuSlot(null);
  }, []);

  const closeScoreInfo = useCallback(() => {
    setShowScoreInfo(false);
  }, []);

  const dismissBreathOverlay = useCallback(() => {
    setShowBreathOverlay(false);
    setIsBreathSoundReady(false);
    activeVisibleTickRef.current = Date.now();
  }, []);

  const stopBreathSound = useCallback(() => {
    const audio = breathAudioRef.current;
    if (!audio) {
      return;
    }

    audio.pause();
    audio.currentTime = 0;
    setIsBreathSoundReady(false);
  }, []);

  const startBreathSound = useCallback(async () => {
    if (typeof window === 'undefined') {
      return false;
    }

    if (breathAudioRef.current) {
      const existingAudio = breathAudioRef.current;
      existingAudio.currentTime = 0;

      try {
        await existingAudio.play();
        setIsBreathSoundReady(true);
        return true;
      } catch {
        setIsBreathSoundReady(false);
        return false;
      }
    }

    const audio = new Audio('/assets/sound2.mp3');
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 1;
    audio.addEventListener('play', () => {
      setIsBreathSoundReady(true);
    });
    audio.addEventListener('pause', () => {
      setIsBreathSoundReady(false);
    });
    breathAudioRef.current = audio;

    try {
      audio.currentTime = 0;
      await audio.play();
      setIsBreathSoundReady(true);
      return true;
    } catch {
      setIsBreathSoundReady(false);
      return false;
    }
  }, []);

  const openBreathOverlay = useCallback(() => {
    setShowBreathOverlay(true);
    setOpenMenuSlot(null);
    void startBreathSound();
  }, [startBreathSound]);

  const enableBreathSound = useCallback(() => {
    void startBreathSound();
  }, [startBreathSound]);

  useEffect(() => {
    if (typeof window === 'undefined' || !openMenuSlot) {
      return;
    }

    const onPointerDown = (event) => {
      const target = event.target;
      if (
        (topMenuRef.current && topMenuRef.current.contains(target)) ||
        (bottomMenuRef.current && bottomMenuRef.current.contains(target))
      ) {
        return;
      }

      setOpenMenuSlot(null);
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpenMenuSlot(null);
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenuSlot]);

  useEffect(() => {
    if (typeof window === 'undefined' || !showScoreInfo) {
      return;
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeScoreInfo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [closeScoreInfo, showScoreInfo]);

  useEffect(() => {
    if (showBreathOverlay) {
      void startBreathSound();
      return;
    }

    setIsBreathSoundReady(false);
    stopBreathSound();
  }, [showBreathOverlay, startBreathSound, stopBreathSound]);

  useEffect(() => {
    if (typeof window === 'undefined' || !showBreathOverlay || isBreathSoundReady) {
      return;
    }

    let detached = false;

    const detach = () => {
      if (detached) {
        return;
      }

      detached = true;
      window.removeEventListener('touchstart', onUnlockGesture);
      window.removeEventListener('pointerdown', onUnlockGesture);
      window.removeEventListener('click', onUnlockGesture);
    };

    const onUnlockGesture = () => {
      void startBreathSound().then((started) => {
        if (started) {
          detach();
        }
      });
    };

    window.addEventListener('touchstart', onUnlockGesture, { passive: true });
    window.addEventListener('pointerdown', onUnlockGesture);
    window.addEventListener('click', onUnlockGesture);

    return detach;
  }, [showBreathOverlay, isBreathSoundReady, startBreathSound]);

  useEffect(() => {
    if (!showBreathOverlay) {
      return;
    }

    const circle = breathCircleRef.current;
    if (!circle) {
      return;
    }

    const syncAudioToCycle = () => {
      const audio = breathAudioRef.current;
      if (!audio || audio.paused) {
        return;
      }

      try {
        audio.currentTime = 0;
      } catch {
        // Ignore time reset failures.
      }
    };

    circle.addEventListener('animationiteration', syncAudioToCycle);
    return () => {
      circle.removeEventListener('animationiteration', syncAudioToCycle);
    };
  }, [showBreathOverlay]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') {
        void releaseWakeLock();
        return;
      }

      if (speakingItemIdRef.current) {
        void requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [releaseWakeLock, requestWakeLock]);

  useEffect(() => {
    if (speakingItemId) {
      void requestWakeLock();
      return;
    }

    void releaseWakeLock();
  }, [releaseWakeLock, requestWakeLock, speakingItemId]);

  const toggleAmbientSound = useCallback(async () => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!ambientAudioRef.current) {
      const audio = new Audio('/assets/sound.mp3');
      audio.loop = true;
      audio.preload = 'auto';
      audio.addEventListener('ended', () => {
        audio.currentTime = 0;
        audio
          .play()
          .then(() => {
            setIsAmbientPlaying(true);
          })
          .catch(() => {
            setIsAmbientPlaying(false);
          });
      });
      audio.addEventListener('play', () => {
        setIsAmbientPlaying(true);
      });
      audio.addEventListener('pause', () => {
        setIsAmbientPlaying(false);
      });
      ambientAudioRef.current = audio;
    }

    const audio = ambientAudioRef.current;
    if (!audio) {
      return;
    }

    if (!audio.paused) {
      audio.pause();
      return;
    }

    try {
      await audio.play();
    } catch {
      setIsAmbientPlaying(false);
    }
  }, []);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, []);

  const toggleTextSize = useCallback(() => {
    setIsLargeText((prev) => !prev);
  }, []);

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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const storedValue = window.localStorage.getItem(READING_GUIDE_STORAGE_KEY);
      setShowReadingGuide(storedValue === '1');
    } catch {
      // Ignore storage read failures.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(READING_GUIDE_STORAGE_KEY, showReadingGuide ? '1' : '0');
    } catch {
      // Ignore storage write failures.
    }
  }, [showReadingGuide]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    activeVisibleTickRef.current = Date.now();

    const tick = () => {
      const now = Date.now();
      const previous = activeVisibleTickRef.current || now;
      activeVisibleTickRef.current = now;

      if (document.visibilityState !== 'visible' || showBreathOverlay) {
        return;
      }

      const elapsed = Math.min(5000, Math.max(0, now - previous));
      activeVisibleMsRef.current += elapsed;

      if (activeVisibleMsRef.current >= BREATH_BREAK_INTERVAL_MS) {
        activeVisibleMsRef.current = 0;
        setShowBreathOverlay(true);
      }
    };

    const intervalId = window.setInterval(tick, 1000);
    const handleVisibility = () => {
      activeVisibleTickRef.current = Date.now();
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [showBreathOverlay]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const storedValue = window.localStorage.getItem(AUTO_SCROLL_STORAGE_KEY);
      setIsAutoScrollEnabled(storedValue === '1');
    } catch {
      // Ignore storage read failures.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(AUTO_SCROLL_STORAGE_KEY, isAutoScrollEnabled ? '1' : '0');
    } catch {
      // Ignore storage write failures.
    }
  }, [isAutoScrollEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined' || !isAutoScrollEnabled) {
      return;
    }

    const startedAt = performance.now();
    const intervalId = window.setInterval(() => {
      const root = document.documentElement;
      const maxScroll = Math.max(0, root.scrollHeight - window.innerHeight);

      if (window.scrollY >= maxScroll - 1) {
        setIsAutoScrollEnabled(false);
        return;
      }

      window.scrollBy({
        top: AUTO_SCROLL_STEP_PX,
        left: 0,
        behavior: 'smooth',
      });
    }, AUTO_SCROLL_STEP_MS);

    setShowBottomBar(false);

    const stopAutoScroll = () => {
      if (performance.now() - startedAt < 500) {
        return;
      }
      setIsAutoScrollEnabled(false);
    };

    window.addEventListener('wheel', stopAutoScroll, { passive: true });
    window.addEventListener('touchstart', stopAutoScroll, { passive: true });

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('wheel', stopAutoScroll);
      window.removeEventListener('touchstart', stopAutoScroll);
    };
  }, [isAutoScrollEnabled]);

  useEffect(() => () => stopReadAloud(), [stopReadAloud]);

  useEffect(
    () => () => {
      void stopBreathSound();
    },
    [stopBreathSound],
  );

  useEffect(
    () => () => {
      void releaseWakeLock();
    },
    [releaseWakeLock],
  );

  useEffect(
    () => () => {
      if (ambientAudioRef.current) {
        ambientAudioRef.current.pause();
        ambientAudioRef.current.currentTime = 0;
      }
    },
    [],
  );

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

  const handleImageLoadError = useCallback((event) => {
    const image = event.currentTarget;
    if (!image) {
      return;
    }

    if (image.dataset.fallbackApplied === 'true') {
      return;
    }

    image.dataset.fallbackApplied = 'true';
    image.src = FALLBACK_IMAGE_URL;
  }, []);

  useEffect(() => {
    if (
      category !== 'feed' ||
      isAutoScrollEnabled ||
      typeof window === 'undefined' ||
      !window.IntersectionObserver
    ) {
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
  }, [category, filteredItems, isAutoScrollEnabled, trackSeenByViewing]);

  useEffect(() => {
    if (category !== 'feed' || typeof window === 'undefined' || !window.IntersectionObserver) {
      return;
    }

    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        if (loadingByCategory.feed || errorByCategory.feed) {
          return;
        }

        loadMore('feed');
      },
      {
        rootMargin: '500px 0px',
        threshold: 0.01,
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [category, errorByCategory.feed, loadMore, loadingByCategory.feed]);

  return (
    <main className={`page${isDarkMode ? ' pageDark' : ''}${isLargeText ? ' pageLargeText' : ''}`}>
      <header className="headerWrap">
        <p className="kicker">
          the more u scroll, <br /> the higher ur score{' '}
        </p>
        <h1 className="title">_</h1>
        <p className="subtitle"></p>

        <div className="topActions">
          <div className="mindfulScoreGroup">
            <div className="mindfulScoreChip" aria-live="polite">
              <span className="mindfulScoreLabel">*</span>
              <span className="mindfulScoreValue">{mindfulScore}</span>
            </div>
            <button
              className="scoreInfoButton"
              type="button"
              onClick={openScoreInfo}
              aria-label="How score and icons work"
              title="How score and icons work">
              <Info size={14} aria-hidden="true" />
            </button>
          </div>

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
              <div className="menuWrap" ref={topMenuRef}>
                <button
                  className="installButton menuTrigger"
                  type="button"
                  onClick={() => toggleSettingsMenu('top')}
                  aria-haspopup="menu"
                  aria-expanded={openMenuSlot === 'top'}
                  aria-label={
                    selectedVoice
                      ? `Voice settings. Current: ${selectedVoice.name}`
                      : 'Voice settings'
                  }
                  title={selectedVoice ? `Voice: ${selectedVoice.name}` : 'Voice settings'}>
                  <Settings2 size={CONTROL_ICON_SIZE} aria-hidden="true" />
                  <ChevronDown size={12} aria-hidden="true" className="menuChevron" />
                </button>

                {openMenuSlot === 'top' ? (
                  <div className="dropdownMenu" role="menu" aria-label="Voice and settings">
                    <label className="dropdownLabel" htmlFor="voice-select-top">
                      Voice
                    </label>
                    <select
                      id="voice-select-top"
                      className="dropdownSelect"
                      value={selectedVoiceUri || ''}
                      onChange={(event) => {
                        selectVoice(event.target.value);
                        setOpenMenuSlot(null);
                      }}
                      disabled={!availableVoices.length}>
                      {!availableVoices.length ? (
                        <option value="">No voices available</option>
                      ) : (
                        availableVoices.map((voice) => (
                          <option key={voice.voiceURI} value={voice.voiceURI}>
                            {voice.name}
                          </option>
                        ))
                      )}
                    </select>
                    <div className="menuIconRow" aria-label="Upcoming tools">
                      <button
                        className={`menuIconButton${showReadingGuide ? ' menuIconButtonActive' : ''}`}
                        type="button"
                        onClick={toggleReadingGuide}
                        aria-pressed={showReadingGuide}
                        aria-label={
                          showReadingGuide ? 'Disable reading line' : 'Enable reading line'
                        }
                        title={showReadingGuide ? 'Disable reading line' : 'Enable reading line'}>
                        <Minus size={14} aria-hidden="true" />
                      </button>
                      <button
                        className={`menuIconButton${isAutoScrollEnabled ? ' menuIconButtonActive' : ''}`}
                        type="button"
                        onClick={toggleAutoScroll}
                        aria-pressed={isAutoScrollEnabled}
                        aria-label={isAutoScrollEnabled ? 'Stop auto scroll' : 'Start auto scroll'}
                        title={isAutoScrollEnabled ? 'Stop auto scroll' : 'Start auto scroll'}>
                        <ChevronsDown size={14} aria-hidden="true" />
                      </button>
                      <button
                        className={`menuIconButton${showBreathOverlay ? ' menuIconButtonActive' : ''}`}
                        type="button"
                        onClick={openBreathOverlay}
                        aria-pressed={showBreathOverlay}
                        aria-label="Start breathing exercise"
                        title="Start breathing exercise">
                        <Leaf size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <button
                className="installButton"
                type="button"
                onClick={toggleAmbientSound}
                aria-label={isAmbientPlaying ? 'Pause ambient sound' : 'Play ambient sound'}
                title={isAmbientPlaying ? 'Pause ambient sound' : 'Play ambient sound'}>
                {isAmbientPlaying ? (
                  <Square size={CONTROL_ICON_SIZE} aria-hidden="true" />
                ) : (
                  <Play size={CONTROL_ICON_SIZE} aria-hidden="true" />
                )}
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
          const showReadMinutes = shouldShowReadMinutes(item, isExpanded, isLoadingFull);
          const readMinutes = showReadMinutes ? estimateReadMinutes(item) : null;
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
                  <img
                    src={item.imageUrl}
                    className="cardImage"
                    alt={item.title}
                    loading="lazy"
                    onError={handleImageLoadError}
                  />
                </button>
              ) : null}

              <div className="cardMeta">
                <div className="cardMetaLead">
                  <p className="cardTag">{item.tag}</p>
                  {showReadMinutes ? <p className="cardReadTime">{readMinutes} min read</p> : null}
                </div>
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
            <div className="stateLoadingRow" role="status" aria-live="polite">
              <span className="loadingBookSpinner" aria-hidden="true">
                <BookText size={18} />
              </span>
              <div>
                <p className="stateTitle">Loading more...</p>
                <p className="stateDetail">We are grabbing another batch.</p>
              </div>
            </div>
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
        {category === 'feed' ? <div ref={loadMoreSentinelRef} aria-hidden="true" /> : null}
      </footer>

      {activeImage ? (
        <div className="modalBackdrop" role="presentation" onClick={() => setActiveImage(null)}>
          <img
            src={activeImage}
            className="modalImage"
            alt="Expanded artwork"
            onError={handleImageLoadError}
          />
        </div>
      ) : null}

      {showScoreInfo ? (
        <div className="dialogBackdrop" role="presentation" onClick={closeScoreInfo}>
          <div
            className="dialogCard scoreInfoCard"
            role="dialog"
            aria-modal="true"
            aria-labelledby="score-info-title"
            onClick={(event) => event.stopPropagation()}>
            <h3 id="score-info-title">Score and icon guide</h3>
            <p>
              Your score rises slowly when you stay with the feed and read, and drops when you
              scroll too fast.
            </p>
            <ul className="scoreInfoList">
              <li>+1 every 15 seconds while the feed stays visible.</li>
              <li>Fast down scrolling gives stronger penalties than up scrolling.</li>
              <li>Passive score gain pauses for 20 seconds after rapid down scrolling.</li>
              <li>Reading/seeing an article adds points based on estimated read time.</li>
            </ul>
            <p className="scoreInfoSection">Icons</p>
            <ul className="scoreIconList" aria-label="Icon meanings">
              <li>
                <InfinityIcon size={14} aria-hidden="true" /> Feed
              </li>
              <li>
                <Heart size={14} aria-hidden="true" /> Saved
              </li>
              <li>
                <Eye size={14} aria-hidden="true" /> Seen
              </li>
              <li>
                <Settings2 size={14} aria-hidden="true" /> Voice and tools
              </li>
              <li>
                <Play size={14} aria-hidden="true" /> / <Square size={14} aria-hidden="true" />{' '}
                Ambient sound
              </li>
              <li>
                <Sun size={14} aria-hidden="true" /> / <Moon size={14} aria-hidden="true" /> Theme
              </li>
              <li>
                <Type size={14} aria-hidden="true" /> Text size
              </li>
              <li>
                <Minus size={14} aria-hidden="true" /> Reading line
              </li>
              <li>
                <ChevronsDown size={14} aria-hidden="true" /> Auto scroll
              </li>
              <li>
                <Leaf size={14} aria-hidden="true" /> Breathing break
              </li>
              <li>
                <Volume2 size={14} aria-hidden="true" /> Read aloud
              </li>
              <li>
                <Highlighter size={14} aria-hidden="true" /> Select text
              </li>
            </ul>
            <button className="retryButton" type="button" onClick={closeScoreInfo}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {showBreathOverlay ? (
        <div
          className="breathOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="breath-title">
          <div className="breathCard">
            <h3 id="breath-title">Mindful breathing break</h3>
            <p>Pause for a moment and follow the circle.</p>
            <div className="breathCircleWrap" aria-hidden="true">
              <div className="breathCircle" ref={breathCircleRef} />
            </div>
            <p className="breathHint">Inhale 5s · exhale 5s</p>
            {!isBreathSoundReady ? (
              <button className="retryButton" type="button" onClick={enableBreathSound}>
                Tap to enable sound
              </button>
            ) : null}
            <button className="retryButton" type="button" onClick={dismissBreathOverlay}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {showReadingGuide ? <div className="readingGuide" aria-hidden="true" /> : null}

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
              <div className="menuWrap" ref={bottomMenuRef}>
                <button
                  className="installButton menuTrigger"
                  type="button"
                  onClick={() => toggleSettingsMenu('bottom')}
                  aria-haspopup="menu"
                  aria-expanded={openMenuSlot === 'bottom'}
                  aria-label={
                    selectedVoice
                      ? `Voice settings. Current: ${selectedVoice.name}`
                      : 'Voice settings'
                  }
                  title={selectedVoice ? `Voice: ${selectedVoice.name}` : 'Voice settings'}>
                  <Settings2 size={CONTROL_ICON_SIZE} aria-hidden="true" />
                  <ChevronDown size={12} aria-hidden="true" className="menuChevron" />
                </button>

                {openMenuSlot === 'bottom' ? (
                  <div
                    className="dropdownMenu dropdownMenuUp"
                    role="menu"
                    aria-label="Voice and settings">
                    <label className="dropdownLabel" htmlFor="voice-select-bottom">
                      Voice
                    </label>
                    <select
                      id="voice-select-bottom"
                      className="dropdownSelect"
                      value={selectedVoiceUri || ''}
                      onChange={(event) => {
                        selectVoice(event.target.value);
                        setOpenMenuSlot(null);
                      }}
                      disabled={!availableVoices.length}>
                      {!availableVoices.length ? (
                        <option value="">No voices available</option>
                      ) : (
                        availableVoices.map((voice) => (
                          <option key={voice.voiceURI} value={voice.voiceURI}>
                            {voice.name}
                          </option>
                        ))
                      )}
                    </select>
                    <div className="menuIconRow" aria-label="Upcoming tools">
                      <button
                        className={`menuIconButton${showReadingGuide ? ' menuIconButtonActive' : ''}`}
                        type="button"
                        onClick={toggleReadingGuide}
                        aria-pressed={showReadingGuide}
                        aria-label={
                          showReadingGuide ? 'Disable reading line' : 'Enable reading line'
                        }
                        title={showReadingGuide ? 'Disable reading line' : 'Enable reading line'}>
                        <Minus size={14} aria-hidden="true" />
                      </button>
                      <button
                        className={`menuIconButton${isAutoScrollEnabled ? ' menuIconButtonActive' : ''}`}
                        type="button"
                        onClick={toggleAutoScroll}
                        aria-pressed={isAutoScrollEnabled}
                        aria-label={isAutoScrollEnabled ? 'Stop auto scroll' : 'Start auto scroll'}
                        title={isAutoScrollEnabled ? 'Stop auto scroll' : 'Start auto scroll'}>
                        <ChevronsDown size={14} aria-hidden="true" />
                      </button>
                      <button
                        className={`menuIconButton${showBreathOverlay ? ' menuIconButtonActive' : ''}`}
                        type="button"
                        onClick={openBreathOverlay}
                        aria-pressed={showBreathOverlay}
                        aria-label="Start breathing exercise"
                        title="Start breathing exercise">
                        <Leaf size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <button
                className="installButton"
                type="button"
                onClick={toggleAmbientSound}
                aria-label={isAmbientPlaying ? 'Pause ambient sound' : 'Play ambient sound'}
                title={isAmbientPlaying ? 'Pause ambient sound' : 'Play ambient sound'}>
                {isAmbientPlaying ? (
                  <Square size={CONTROL_ICON_SIZE} aria-hidden="true" />
                ) : (
                  <Play size={CONTROL_ICON_SIZE} aria-hidden="true" />
                )}
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

              <div
                className="mindfulScoreChip mindfulScoreChipNumber"
                aria-live="polite"
                aria-label={`Mindful score ${mindfulScore}`}>
                <span className="mindfulScoreValue">{mindfulScore}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
