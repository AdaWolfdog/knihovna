// Image probes are bounded independently of the bibliographic lookup.
const IMAGE_TIMEOUT_MS = 850;
const OBALKY_IMAGE_TIMEOUT_MS = 1400;
const LOOKUP_TIMEOUT_MS = 2400;
const COVER_TTL_MS = 15 * 60_000;
const MISS_TTL_MS = 30_000;
const coverCache = new Map<string, { result: Promise<string | undefined>; expires: number }>();
const isbnRequests: number[] = [];

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

export async function canReplaceBookCover(current: string, replacement: string): Promise<boolean> {
  if (current === replacement || typeof Image === 'undefined') return false;

  // A slow connection alone is insufficient evidence that a saved cover is broken.
  if (await loadCover(current, LOOKUP_TIMEOUT_MS) !== 'broken') return false;
  return await loadCover(replacement, LOOKUP_TIMEOUT_MS) === 'valid';
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
  const isbn = /^https:\/\/cache\.obalkyknih\.cz\/api\/cover\?isbn=(97880\d{8})&/.exec(url)?.[1];
  return isbn ? `https://www.obalkyknih.cz/view?isbn=${isbn}` : undefined;
}

async function findCover(groups: readonly (readonly string[])[], isbns: string[]): Promise<string | undefined> {
  const deadline = Date.now() + LOOKUP_TIMEOUT_MS;
  const direct = isbns.map((isbn) => `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`);
  const queue = new Set([
    ...groups.map((group) => group[0]).filter(Boolean),
    ...direct,
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
