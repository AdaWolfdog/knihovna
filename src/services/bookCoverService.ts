// Image probes are bounded independently of the bibliographic lookup.
const IMAGE_TIMEOUT_MS = 850;
const OBALKY_IMAGE_TIMEOUT_MS = 1400;
const LOOKUP_TIMEOUT_MS = 2400;
const COVER_TTL_MS = 15 * 60_000;
const MISS_TTL_MS = 30_000;
const coverCache = new Map<string, { result: Promise<string | undefined>; expires: number }>();
const isbnRequests: number[] = [];
const BACKGROUND_IMAGE_TIMEOUT_MS = 6000;
const MAX_BACKGROUND_LOOKUPS = 3;
const backgroundCache = new Map<string, { result: Promise<string | undefined>; expires: number }>();
const backgroundQueue: Array<() => Promise<void>> = [];
let activeBackgroundLookups = 0;

function equivalentIsbns(isbn: string): string[] {
  const isbn13CheckDigit = (prefix: string) =>
    (10 - [...prefix].reduce((sum, digit, i) => sum + Number(digit) * (i % 2 ? 3 : 1), 0) % 10) % 10;
  const isbn10CheckDigit = (prefix: string) => {
    const sum = [...prefix].reduce((total, digit, i) => total + Number(digit) * (10 - i), 0);
    const digit = (11 - sum % 11) % 11;
    return digit === 10 ? 'X' : String(digit);
  };

  if (/^\d{9}[0-9Xx]$/.test(isbn)) {
    const prefix = isbn.slice(0, 9);
    if (isbn[9].toUpperCase() !== isbn10CheckDigit(prefix)) return [];
    const prefix13 = '978' + prefix;
    return [prefix13 + isbn13CheckDigit(prefix13), isbn.toUpperCase()];
  }

  if (!/^97[89]\d{10}$/.test(isbn) || Number(isbn[12]) !== isbn13CheckDigit(isbn.slice(0, 12))) return [];
  if (!isbn.startsWith('978')) return [isbn];
  const prefix10 = isbn.slice(3, 12);
  return [isbn, prefix10 + isbn10CheckDigit(prefix10)];
}

export function hasCoverDimensions(image: Pick<HTMLImageElement, 'naturalWidth' | 'naturalHeight'>): boolean {
  return image.naturalWidth >= 32 && image.naturalHeight >= 32;
}

type CoverLoadResult = 'valid' | 'broken' | 'timeout';

function loadCover(url: string, timeout: number): Promise<CoverLoadResult> {
  return new Promise((resolve) => {
    const image = new Image();
    const finish = (result: CoverLoadResult) => {
      clearTimeout(timer);
      image.onload = image.onerror = null;
      if (result !== 'valid') image.removeAttribute('src');
      resolve(result);
    };
    const timer = setTimeout(() => finish('timeout'), timeout);
    image.onload = () => finish(hasCoverDimensions(image) ? 'valid' : 'broken');
    image.onerror = () => finish('broken');
    image.src = url;
  });
}

// The Covers API limits ISBN-based requests. Leave headroom for other clients on the same IP.
function allowIsbnRequest(now: number): boolean {
  while (isbnRequests.length && isbnRequests[0] <= now - 5 * 60_000) isbnRequests.shift();
  if (isbnRequests.length >= 80) return false;
  isbnRequests.push(now);
  return true;
}

function obalkyKnihCoverUrl(isbn: string | undefined): string | undefined {
  if (!isbn?.startsWith('97880')) return undefined;
  return `https://cache.obalkyknih.cz/api/cover?isbn=${isbn}&type=medium&keywords=`;
}

export function getCoverSourcePage(url: string): string | undefined {
  const isbn = /^https:\/\/(?:www|cache)\.obalkyknih\.cz\/api\/cover\?isbn=(97880\d{8})(?:&|$)/.exec(url)?.[1];
  return isbn ? `https://www.obalkyknih.cz/view?isbn=${isbn}` : undefined;
}

function openLibraryCoverUrls(isbns: string[]) {
  return isbns.map((isbn) => `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`);
}

async function findCover(groups: readonly (readonly string[])[], isbns: string[]): Promise<string | undefined> {
  const deadline = Date.now() + LOOKUP_TIMEOUT_MS;
  const queue = new Set([
    ...groups.map((group) => group[0]).filter(Boolean),
    ...openLibraryCoverUrls(isbns),
    ...groups.flatMap((group) => group.slice(1)),
  ]);
  for (const url of queue) {
    const now = Date.now();
    const timeLeft = deadline - now;
    if (timeLeft <= 0) break;
    if (/^https:\/\/covers\.openlibrary\.org\/b\/isbn\//.test(url) && !allowIsbnRequest(now)) continue;
    if (await loadCover(url, Math.min(timeLeft, IMAGE_TIMEOUT_MS)) === 'valid') return url;
  }

  const fallback = obalkyKnihCoverUrl(isbns[0]);
  if (fallback && !queue.has(fallback) && await loadCover(fallback, OBALKY_IMAGE_TIMEOUT_MS) === 'valid') {
    return fallback;
  }
}

export async function resolveBookCover(isbn: string, groups: readonly (readonly string[])[]): Promise<string | undefined> {
  // Outside a browser there is no image decoder. Keep the best catalog link available.
  if (typeof Image === 'undefined') return groups.find((group) => group.length)?.[0];

  const isbns = equivalentIsbns(isbn);
  const key = isbns[0] ?? isbn;
  const cached = coverCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.result;

  if (coverCache.size >= 256) coverCache.delete(coverCache.keys().next().value!);
  const entry = { result: findCover(groups, isbns), expires: Infinity };
  coverCache.set(key, entry);
  const cover = await entry.result;
  entry.expires = Date.now() + (cover ? COVER_TTL_MS : MISS_TTL_MS);
  return cover;
}


function startBackgroundLookup() {
  if (activeBackgroundLookups >= MAX_BACKGROUND_LOOKUPS) return;
  const next = backgroundQueue.shift();
  if (!next) return;

  activeBackgroundLookups++;
  void next().finally(() => {
    activeBackgroundLookups--;
    startBackgroundLookup();
  });
}

async function findBackgroundCover(isbns: string[], failedUrl?: string): Promise<string | undefined> {
  const czechCover = obalkyKnihCoverUrl(isbns[0]);
  const candidates = [
    czechCover && `https://www.obalkyknih.cz/api/cover?isbn=${isbns[0]}`,
    czechCover,
    ...openLibraryCoverUrls(isbns),
  ];

  for (const url of candidates) {
    if (!url || url === failedUrl) continue;
    if (url.startsWith('https://covers.openlibrary.org/b/isbn/') && !allowIsbnRequest(Date.now())) continue;
    if (await loadCover(url, BACKGROUND_IMAGE_TIMEOUT_MS) === 'valid') return url;
  }
}

export function resolveBackgroundBookCover(isbn: string, failedUrl?: string): Promise<string | undefined> {
  const isbns = equivalentIsbns(isbn.replace(/[\s-]/g, ''));
  if (!isbns.length || typeof Image === 'undefined') return Promise.resolve(undefined);

  // A short scan-time miss must not prevent a longer background attempt.
  const key = JSON.stringify([isbns[0], failedUrl]);
  const cached = backgroundCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.result;

  if (backgroundCache.size >= 256) {
    for (const [cacheKey, entry] of backgroundCache) {
      if (entry.expires === Infinity) continue;
      backgroundCache.delete(cacheKey);
      break;
    }
  }

  const result = new Promise<string | undefined>((resolve) => {
    backgroundQueue.push(async () => {
      const cover = await findBackgroundCover(isbns, failedUrl).catch(() => undefined);
      backgroundCache.set(key, { result, expires: Date.now() + (cover ? COVER_TTL_MS : MISS_TTL_MS) });
      resolve(cover);
    });
  });
  backgroundCache.set(key, { result, expires: Infinity });
  startBackgroundLookup();
  return result;
}


export async function resolveBookCoverForRefresh(
  isbn: string,
  savedCover?: string,
  catalogCover?: string,
): Promise<string | undefined> {
  if (!savedCover) return catalogCover ?? resolveBackgroundBookCover(isbn);
  if (typeof Image === 'undefined') return undefined;

  // A slow connection alone is insufficient evidence that a saved cover is broken.
  if (await loadCover(savedCover, LOOKUP_TIMEOUT_MS) !== 'broken') return undefined;
  if (catalogCover && catalogCover !== savedCover && await loadCover(catalogCover, LOOKUP_TIMEOUT_MS) === 'valid') {
    return catalogCover;
  }
  return resolveBackgroundBookCover(isbn, savedCover);
}
