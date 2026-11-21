export interface BookMetadata {
  isbn: string;
  title: string;
  author: string;
  publishedYear: string;
  translator?: string;
  illustrator?: string;
  editionNumber?: string;
  genre?: string;
  keywords?: string;
  coverUrl?: string;
  source?: string;
  // Extra background metadata fields
  publisher?: string;
  placeOfPublication?: string;
  cnb?: string;
  physicalDescription?: string;
}

type BookDetails = Partial<Omit<BookMetadata, 'isbn' | 'source'>>;

const supplementalFields = ['title', 'author', 'publishedYear', 'coverUrl', 'genre', 'keywords'] as const;
const catalogFields = [
  ...supplementalFields, 'translator', 'illustrator', 'editionNumber',
  'publisher', 'placeOfPublication', 'cnb', 'physicalDescription',
] as const;

export function getMissingBookDetails(
  current: BookDetails,
  found: BookDetails,
  fields: readonly (keyof BookDetails)[] = catalogFields,
): BookDetails {
  const changes: BookDetails = {};
  for (const field of fields) {
    if (!current[field]?.trim() && found[field]?.trim()) changes[field] = found[field];
  }
  return changes;
}

export interface CatalogLookupResult {
  metadata: BookMetadata | null;
  /**
   * True if metadata was not found and at least one contacted catalog had a transient network error,
   * timeouts, or 5xx/429 status codes, rather than a definitive "not found" response.
   */
  isNetworkError: boolean;
  errorMessage?: string;
}

/**
 * Helper to delay execution for a given number of milliseconds.
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Creates an AbortSignal that times out after `ms` milliseconds, with fallback for environments lacking AbortSignal.timeout.
 */
function createTimeoutSignal(ms: number): { signal: AbortSignal; cleanup: () => void } {
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    return {
      signal: AbortSignal.timeout(ms),
      cleanup: () => {},
    };
  }
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(id),
  };
}

/**
 * Normalizes ISBN by stripping parenthesized notes (e.g. "(brož.)", "(váz.)"), hyphens, underscores, and spaces.
 */
export function normalizeIsbn(isbn: string): string {
  if (!isbn) return '';
  const withoutNotes = isbn.replace(/\(.*?\)/g, '');
  return withoutNotes.replace(/[-_ \s]/g, '').trim();
}

/**
 * Converts a 10-digit ISBN to a 13-digit ISBN (with '978' prefix and recalculated checksum).
 * If the input is already 13 digits or not a valid 10-digit ISBN, returns normalized clean ISBN.
 */
export function toIsbn13(isbnInput: string): string {
  const clean = normalizeIsbn(isbnInput);
  if (clean.length === 13) {
    return clean;
  }

  if (clean.length === 10) {
    const core = clean.substring(0, 9);
    if (/^\d{9}$/.test(core)) {
      const prefix = '978' + core;
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        const digit = parseInt(prefix[i], 10);
        sum += i % 2 === 0 ? digit : digit * 3;
      }
      const checkDigit = (10 - (sum % 10)) % 10;
      return prefix + checkDigit.toString();
    }
  }

  return clean;
}

/**
 * Strips catalog punctuation (trailing ':', ',', ';', '/', '.', whitespace or outer brackets).
 */
export function cleanCatalogPunctuation(str?: string): string {
  if (!str) return '';
  let cleaned = str.trim();
  cleaned = cleaned.replace(/[\s:;,./]+$/, '').trim();
  if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

/**
 * Strips trailing author birth/death years or date information (e.g. ", asi 1507-1577", ", 1971-").
 */
export function cleanAuthorName(name?: string): string {
  if (!name) return '';
  let cleaned = name.trim();
  cleaned = cleaned.replace(/,\s*(?:asi\s+|nar\.\s+|ca\.\s*|b\.\s*)?\d{3,4}(?:\s*-\s*\d{0,4})?\s*$/i, '');
  return cleanCatalogPunctuation(cleaned);
}

/**
 * Extracts a 4-digit year from publication dates string.
 */
export function extractYear(dateStr?: string): string {
  if (!dateStr) return '';
  const match = dateStr.match(/\d{4}/);
  return match ? match[0] : '';
}

export const KNIHOVNY_CZ_FIELDS = [
  'id',
  'title',
  'authors',
  'publishers',
  'placesOfPublication',
  'publicationDates',
  'physicalDescriptions',
  'isbns',
  'issns',
  'cnb',
  'formats',
] as const;

export type KnihovnyCzSearchType = 'ISN' | 'Title' | 'Author' | 'AllFields' | 'adv_search_nbn';

/**
 * Performs a fetch with timeout and automatic retry on network errors or 5xx/429 status codes.
 */
interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  baseDelayMs?: number;
}

export async function fetchWithRetry(url: string, options: FetchOptions = {}): Promise<{ ok: boolean; status: number; data?: any; error?: any }> {
  const timeoutMs = options.timeoutMs ?? 4500;
  const maxRetries = options.retries ?? 1;
  const baseDelayMs = options.baseDelayMs ?? 400;

  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { signal, cleanup } = createTimeoutSignal(timeoutMs);

    try {
      const response = await fetch(url, { signal });

      // Check for transient server-side error or rate-limiting
      if (response.status === 429 || (response.status >= 500 && response.status <= 599)) {
        if (attempt < maxRetries) {
          await delay(baseDelayMs * (attempt + 1));
          continue;
        }
        return { ok: false, status: response.status, error: new Error(`Server returned status ${response.status}`) };
      }

      if (!response.ok) {
        return { ok: false, status: response.status };
      }

      const data = await response.json();
      return { ok: true, status: response.status, data };
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        await delay(baseDelayMs * (attempt + 1));
        continue;
      }
    } finally {
      cleanup();
    }
  }

  return { ok: false, status: 0, error: lastError };
}

/**
 * Raw search endpoint against Knihovny.cz API.
 */
export async function searchKnihovnyCzRaw(
  lookfor: string,
  type: KnihovnyCzSearchType = 'ISN',
  limit: number = 10
): Promise<any[]> {
  const result = await searchKnihovnyCzRawDetailed(lookfor, type, limit);
  return result.records;
}

export async function searchKnihovnyCzRawDetailed(
  lookfor: string,
  type: KnihovnyCzSearchType = 'ISN',
  limit: number = 10
): Promise<{ records: any[]; isNetworkError: boolean }> {
  const params = new URLSearchParams({
    lookfor,
    type,
    limit: String(Math.min(Math.max(0, limit), 100)),
  });

  for (const field of KNIHOVNY_CZ_FIELDS) {
    params.append('field[]', field);
  }

  const url = `https://www.knihovny.cz/api/v1/search?${params.toString()}`;
  const response = await fetchWithRetry(url, { timeoutMs: 5000, retries: 1, baseDelayMs: 400 });

  if (!response.ok) {
    const isNetwork = !response.status || response.status === 429 || response.status >= 500;
    return { records: [], isNetworkError: isNetwork };
  }

  const records = response.data?.records ?? [];
  return { records, isNetworkError: false };
}

/**
 * Maps a record from Knihovny.cz API to BookMetadata.
 */
export function mapKnihovnyRecordToBookMetadata(record: any, fallbackIsbn?: string): BookMetadata {
  const title = cleanCatalogPunctuation(record.title || record.shortTitle || '');

  // Extract primary authors
  let primaryAuthors: string[] = [];
  if (record.authors?.primary) {
    if (typeof record.authors.primary === 'object') {
      primaryAuthors = Object.keys(record.authors.primary).map(cleanAuthorName).filter(Boolean);
    }
  }

  const author = primaryAuthors.join(', ');
  const translators: string[] = [];
  const illustrators: string[] = [];
  const secondary = record.authors?.secondary;
  if (secondary && typeof secondary === 'object' && !Array.isArray(secondary)) {
    for (const [name, roles] of Object.entries(secondary)) {
      const cleanedName = cleanAuthorName(name);
      if (!cleanedName) continue;
      const roleList = Array.isArray(roles) ? roles : [roles];
      const labels = roleList
        .filter((role): role is string => typeof role === 'string')
        .map((role) => role.trim().toLowerCase().replace(/[.]$/, ''));
      if (labels.some((role) => ['trl', 'translator', 'překladatel', 'překladatelka', 'přeložil', 'přeložila'].includes(role))) {
        translators.push(cleanedName);
      }
      if (labels.some((role) => ['ill', 'illustrator', 'ilustrátor', 'ilustrátorka', 'ilustroval', 'ilustrovala'].includes(role))) {
        illustrators.push(cleanedName);
      }
    }
  }

  // Extract year
  const rawDate = record.publicationDates?.[0] || record.publishDate || '';
  const publishedYear = extractYear(String(rawDate));

  // Extract publisher & place of publication
  const publisher = cleanCatalogPunctuation(record.publishers?.[0]);
  const placeOfPublication = cleanCatalogPunctuation(record.placesOfPublication?.[0]);

  // Extract physical description
  const physicalDescription = record.physicalDescriptions?.[0]?.trim() || undefined;

  // Extract ČNB
  const cnb = record.cnb ? String(record.cnb).trim() : undefined;

  // Determine ISBN to store
  let matchedIsbn = fallbackIsbn || '';
  if (Array.isArray(record.isbns) && record.isbns.length > 0) {
    const cleanRecordIsbn = toIsbn13(record.isbns[0]);
    if (cleanRecordIsbn) {
      matchedIsbn = cleanRecordIsbn;
    }
  }

  return {
    isbn: matchedIsbn,
    title,
    author,
    publishedYear,
    translator: [...new Set(translators)].join(', ') || undefined,
    illustrator: [...new Set(illustrators)].join(', ') || undefined,
    publisher: publisher || undefined,
    placeOfPublication: placeOfPublication || undefined,
    cnb: cnb || undefined,
    physicalDescription: physicalDescription || undefined,
    source: 'Knihovny.cz',
  };
}

/**
 * Searches Knihovny.cz by ISBN.
 */
export async function fetchFromKnihovnyCz(isbnInput: string): Promise<BookMetadata | null> {
  const result = await fetchFromKnihovnyCzDetailed(isbnInput);
  return result.metadata;
}

export async function fetchFromKnihovnyCzDetailed(isbnInput: string): Promise<{ metadata: BookMetadata | null; isNetworkError: boolean }> {
  const target13 = toIsbn13(isbnInput);
  if (!target13) return { metadata: null, isNetworkError: false };

  const { records, isNetworkError } = await searchKnihovnyCzRawDetailed(target13, 'ISN', 10);
  if (isNetworkError) {
    return { metadata: null, isNetworkError: true };
  }

  if (!records || records.length === 0) return { metadata: null, isNetworkError: false };

  // Find record whose isbns array actually contains target13
  const matchingRecord = records.find((rec) => {
    if (!Array.isArray(rec.isbns)) return false;
    return rec.isbns.some((isbnEntry: string) => {
      const entry13 = toIsbn13(isbnEntry);
      return entry13 === target13;
    });
  });

  if (!matchingRecord) {
    return { metadata: null, isNetworkError: false };
  }

  return { metadata: { ...mapKnihovnyRecordToBookMetadata(matchingRecord, target13), isbn: target13 }, isNetworkError: false };
}

/**
 * Generic search against Knihovny.cz supporting Title, Author, AllFields, adv_search_nbn.
 * Filters results to books containing "0/BOOKS/" in formats (if formats present).
 */
export async function searchKnihovnyCz(
  lookfor: string,
  type: KnihovnyCzSearchType = 'AllFields',
  limit: number = 10
): Promise<BookMetadata[]> {
  const query = type === 'ISN' ? toIsbn13(lookfor) : lookfor.trim();
  if (!query) return [];

  const records = await searchKnihovnyCzRaw(query, type, limit);
  if (!records || records.length === 0) return [];

  // For non-ISN searches, filter by format "0/BOOKS/" if formats field is available
  let filtered = records;
  if (type !== 'ISN') {
    const bookRecords = records.filter(
      (r) => Array.isArray(r.formats) && r.formats.includes('0/BOOKS/')
    );
    if (bookRecords.length > 0) {
      filtered = bookRecords;
    }
  }

  return filtered.map((r) => mapKnihovnyRecordToBookMetadata(r));
}

/**
 * Fetches book details by ISBN from multiple catalogs:
 * 1. Knihovny.cz / NKP API (via searching bibliographical records or search APIs)
 * 2. Google Books API
 * 3. Open Library API
 * Returns BookMetadata or null.
 */
export async function fetchBookByIsbn(isbnInput: string): Promise<BookMetadata | null> {
  const res = await lookupBookByIsbnDetailed(isbnInput);
  return res.metadata;
}

/**
 * Detailed lookup distinguishing between:
 * - Found metadata
 * - Genuinely not found in any catalog
 * - Network/catalog failure (where all tried catalogs had transient network errors)
 */
export async function lookupBookByIsbnDetailed(isbnInput: string): Promise<CatalogLookupResult> {
  const isbn = normalizeIsbn(isbnInput);
  if (!isbn) {
    return { metadata: null, isNetworkError: false };
  }

  const catalogs = [
    fetchFromKnihovnyCzDetailed,
    fetchFromGoogleBooksDetailed,
    fetchFromOpenLibraryDetailed,
  ];
  const extraOptions = { timeoutMs: 1800, retries: 0 };
  let isNetworkError = false;

  for (const [index, lookup] of catalogs.entries()) {
    const result = await lookup(isbn).catch(() => ({ metadata: null, isNetworkError: true }));
    if (!result.metadata) {
      isNetworkError ||= result.isNetworkError;
      continue;
    }

    const metadata = result.metadata;
    if (supplementalFields.some((field) => !metadata[field]?.trim())) {
      // Once a book is found, only look for missing details in the remaining catalogs.
      const extraResults = await Promise.allSettled(
        catalogs.slice(index + 1).map((lookupExtra) => lookupExtra(isbn, extraOptions)),
      );
      for (const extra of extraResults) {
        if (extra.status !== 'fulfilled' || !extra.value.metadata) continue;
        Object.assign(metadata, getMissingBookDetails(metadata, extra.value.metadata));
      }
    }
    return { metadata, isNetworkError: false };
  }

  return isNetworkError
    ? {
        metadata: null,
        isNetworkError: true,
        errorMessage: 'Katalogy jsou dočasně nedostupné (chyba sítě nebo vypršení limitu).',
      }
    : { metadata: null, isNetworkError: false };
}

// Match explicit genre labels. Broad subjects and place names stay in keywords.
const genreLabels = new Map<string, string>([
  ['detective fiction', 'Detektivka'],
  ['mystery fiction', 'Detektivka'],
  ['mystery & detective', 'Detektivka'],
  ['detektivní romány', 'Detektivka'],
  ['detektivky', 'Detektivka'],
  ['fantasy', 'Fantasy'],
  ['fantasy fiction', 'Fantasy'],
  ['science fiction', 'Sci-fi'],
  ['sci-fi', 'Sci-fi'],
  ['horror', 'Horor'],
  ['horror fiction', 'Horor'],
  ['thriller', 'Thriller'],
  ['thrillers', 'Thriller'],
  ['historical fiction', 'Historická beletrie'],
  ['historické romány', 'Historická beletrie'],
  ['romance', 'Romance'],
  ['romance fiction', 'Romance'],
  ['adventure fiction', 'Dobrodružná literatura'],
  ['action & adventure', 'Dobrodružná literatura'],
  ['biography', 'Životopis'],
  ['biographies', 'Životopis'],
  ['biography & autobiography', 'Životopis'],
  ['poetry', 'Poezie'],
  ['poezie', 'Poezie'],
  ['short stories', 'Povídky'],
  ['povídky', 'Povídky'],
  ['comics & graphic novels', 'Komiks'],
  ['graphic novels', 'Komiks'],
  ['komiksy', 'Komiks'],
]);

function findGenre(labels: string[]): string | undefined {
  for (const label of labels) {
    for (const part of label.split('/').reverse()) {
      const match = genreLabels.get(part.trim().toLowerCase());
      if (match) return match;
    }
  }
}

function secureCoverUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  try {
    const url = new URL(value);
    if (url.protocol === 'http:') url.protocol = 'https:';
    if (url.protocol === 'https:') return url.href;
  } catch {
    // Ignore malformed image links.
  }
}

export async function fetchFromGoogleBooks(isbn: string): Promise<BookMetadata | null> {
  const res = await fetchFromGoogleBooksDetailed(isbn);
  return res.metadata;
}

export async function fetchFromGoogleBooksDetailed(isbn: string, options: FetchOptions = {}): Promise<{ metadata: BookMetadata | null; isNetworkError: boolean }> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`;
  const response = await fetchWithRetry(url, { timeoutMs: 4000, retries: 1, baseDelayMs: 400, ...options });

  if (!response.ok) {
    const isNetwork = !response.status || response.status === 429 || response.status >= 500;
    return { metadata: null, isNetworkError: isNetwork };
  }

  const target = toIsbn13(isbn);
  const items = response.data?.items;
  const info = Array.isArray(items) ? items.find((item) =>
    Array.isArray(item?.volumeInfo?.industryIdentifiers) &&
    item.volumeInfo.industryIdentifiers.some((entry: { type?: string; identifier?: string } | null) =>
      (entry?.type === 'ISBN_10' || entry?.type === 'ISBN_13') &&
      typeof entry.identifier === 'string' && toIsbn13(entry.identifier) === target
    )
  )?.volumeInfo : undefined;

  if (info?.title) {
    const title = info.title + (info.subtitle ? `: ${info.subtitle}` : '');
    const author = info.authors ? info.authors.join(', ') : '';
    const publishedYear = info.publishedDate ? info.publishedDate.substring(0, 4) : '';

    const categories: string[] = Array.isArray(info.categories) ? info.categories.filter((value: unknown) => typeof value === 'string') : [];
    const coverUrl = secureCoverUrl(info.imageLinks?.thumbnail) || secureCoverUrl(info.imageLinks?.smallThumbnail);

    return {
      metadata: {
        isbn,
        title,
        author,
        publishedYear,
        genre: findGenre(categories),
        keywords: categories.join(', ') || undefined,
        coverUrl,
        source: 'Google Books',
      },
      isNetworkError: false,
    };
  }

  return { metadata: null, isNetworkError: false };
}

export async function fetchFromOpenLibrary(isbn: string): Promise<BookMetadata | null> {
  const res = await fetchFromOpenLibraryDetailed(isbn);
  return res.metadata;
}

export async function fetchFromOpenLibraryDetailed(isbn: string, options: FetchOptions = {}): Promise<{ metadata: BookMetadata | null; isNetworkError: boolean }> {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`;
  const response = await fetchWithRetry(url, { timeoutMs: 4000, retries: 1, baseDelayMs: 400, ...options });

  if (!response.ok) {
    const isNetwork = !response.status || response.status === 429 || response.status >= 500;
    return { metadata: null, isNetworkError: isNetwork };
  }

  const data = response.data;
  const key = `ISBN:${isbn}`;
  if (data && data[key]) {
    const book = data[key];
    const identifiers = [book.identifiers?.isbn_13, book.identifiers?.isbn_10].flatMap((values) => Array.isArray(values) ? values : []);
    const target = toIsbn13(isbn);
    if (identifiers.length && !identifiers.some((value: unknown) => typeof value === 'string' && toIsbn13(value) === target)) {
      return { metadata: null, isNetworkError: false };
    }
    const title = book.title || '';
    const author = book.authors ? book.authors.map((a: { name: string }) => a.name).join(', ') : '';
    const publishedYear = book.publish_date ? book.publish_date.match(/\d{4}/)?.[0] || book.publish_date : '';

    const subjects: string[] = Array.isArray(book.subjects)
      ? book.subjects.map((subject: { name?: unknown } | null) => subject?.name).filter((name: unknown) => typeof name === 'string')
      : [];
    const coverUrl = secureCoverUrl(book.cover?.medium) || secureCoverUrl(book.cover?.large) || secureCoverUrl(book.cover?.small);

    return {
      metadata: {
        isbn,
        title,
        author,
        publishedYear,
        genre: findGenre(subjects),
        keywords: subjects.join(', ') || undefined,
        coverUrl,
        source: 'Open Library',
      },
      isNetworkError: false,
    };
  }

  return { metadata: null, isNetworkError: false };
}
