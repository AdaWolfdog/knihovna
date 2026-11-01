export interface BookMetadata {
  isbn: string;
  title: string;
  author: string;
  publishedYear: string;
  translator?: string;
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

export interface CatalogLookupResult {
  metadata: BookMetadata | null;
  /**
   * True if metadata was not found solely because all contacted catalogs had transient network errors,
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
export async function fetchWithRetry(
  url: string,
  options: {
    timeoutMs?: number;
    retries?: number;
    baseDelayMs?: number;
  } = {}
): Promise<{ ok: boolean; status: number; data?: any; error?: any }> {
  const timeoutMs = options.timeoutMs ?? 4500;
  const maxRetries = options.retries ?? 1;
  const baseDelayMs = options.baseDelayMs ?? 400;

  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { signal, cleanup } = createTimeoutSignal(timeoutMs);

    try {
      const response = await fetch(url, { signal });
      cleanup();

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
      cleanup();
      lastError = err;
      if (attempt < maxRetries) {
        await delay(baseDelayMs * (attempt + 1));
        continue;
      }
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

  // Extract secondary authors (translators / illustrators)
  let secondaryAuthors: string[] = [];
  if (record.authors?.secondary) {
    if (typeof record.authors.secondary === 'object') {
      secondaryAuthors = Object.keys(record.authors.secondary).map(cleanAuthorName).filter(Boolean);
    }
  }

  let author = primaryAuthors.join(', ');
  let translator = secondaryAuthors.join(', ');

  // Fallback if no primary author but secondary exists
  if (!author && secondaryAuthors.length > 0) {
    author = secondaryAuthors.join(', ');
    translator = '';
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
    translator: translator || undefined,
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

  return { metadata: mapKnihovnyRecordToBookMetadata(matchingRecord, target13), isNetworkError: false };
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

  let anyCatalogHadNetworkError = false;
  let allCatalogsCompletedSuccessfully = true;

  // 1. Try Knihovny.cz API
  try {
    const cpkResult = await fetchFromKnihovnyCzDetailed(isbn);
    if (cpkResult.metadata) {
      return { metadata: cpkResult.metadata, isNetworkError: false };
    }
    if (cpkResult.isNetworkError) {
      anyCatalogHadNetworkError = true;
      allCatalogsCompletedSuccessfully = false;
    }
  } catch (err) {
    console.warn('Knihovny.cz lookup failed or offline:', err);
    anyCatalogHadNetworkError = true;
    allCatalogsCompletedSuccessfully = false;
  }

  // 2. Try Google Books API
  try {
    const googleResult = await fetchFromGoogleBooksDetailed(isbn);
    if (googleResult.metadata) {
      return { metadata: googleResult.metadata, isNetworkError: false };
    }
    if (googleResult.isNetworkError) {
      anyCatalogHadNetworkError = true;
      allCatalogsCompletedSuccessfully = false;
    }
  } catch (err) {
    console.warn('Google Books lookup failed or offline:', err);
    anyCatalogHadNetworkError = true;
    allCatalogsCompletedSuccessfully = false;
  }

  // 3. Try Open Library API
  try {
    const openLibraryResult = await fetchFromOpenLibraryDetailed(isbn);
    if (openLibraryResult.metadata) {
      return { metadata: openLibraryResult.metadata, isNetworkError: false };
    }
    if (openLibraryResult.isNetworkError) {
      anyCatalogHadNetworkError = true;
      allCatalogsCompletedSuccessfully = false;
    }
  } catch (err) {
    console.warn('Open Library lookup failed or offline:', err);
    anyCatalogHadNetworkError = true;
    allCatalogsCompletedSuccessfully = false;
  }

  // Only consider the book genuinely unknown if all contacted catalogs answered definitively (e.g. 200 OK with no records)
  // without any network errors, timeouts, or 5xx/429 failures.
  // If any catalog failed due to network problems and no metadata was found elsewhere,
  // classify as an incomplete result due to temporary catalog failure.
  if (allCatalogsCompletedSuccessfully && !anyCatalogHadNetworkError) {
    return { metadata: null, isNetworkError: false };
  }

  return {
    metadata: null,
    isNetworkError: true,
    errorMessage: 'Katalogy jsou dočasně nedostupné (chyba sítě nebo vypršení limitu).',
  };
}

export async function fetchFromGoogleBooks(isbn: string): Promise<BookMetadata | null> {
  const res = await fetchFromGoogleBooksDetailed(isbn);
  return res.metadata;
}

export async function fetchFromGoogleBooksDetailed(isbn: string): Promise<{ metadata: BookMetadata | null; isNetworkError: boolean }> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`;
  const response = await fetchWithRetry(url, { timeoutMs: 4000, retries: 1, baseDelayMs: 400 });

  if (!response.ok) {
    const isNetwork = !response.status || response.status === 429 || response.status >= 500;
    return { metadata: null, isNetworkError: isNetwork };
  }

  const data = response.data;
  if (data?.totalItems > 0 && data.items && data.items.length > 0) {
    const info = data.items[0].volumeInfo;
    const title = info.title + (info.subtitle ? `: ${info.subtitle}` : '');
    const author = info.authors ? info.authors.join(', ') : '';
    const publishedYear = info.publishedDate ? info.publishedDate.substring(0, 4) : '';

    const categories = info.categories ? info.categories.join(', ') : '';
    const coverUrl = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || undefined;

    return {
      metadata: {
        isbn,
        title,
        author,
        publishedYear,
        genre: categories || undefined,
        keywords: categories || undefined,
        coverUrl: coverUrl ? coverUrl.replace('http://', 'https://') : undefined,
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

export async function fetchFromOpenLibraryDetailed(isbn: string): Promise<{ metadata: BookMetadata | null; isNetworkError: boolean }> {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`;
  const response = await fetchWithRetry(url, { timeoutMs: 4000, retries: 1, baseDelayMs: 400 });

  if (!response.ok) {
    const isNetwork = !response.status || response.status === 429 || response.status >= 500;
    return { metadata: null, isNetworkError: isNetwork };
  }

  const data = response.data;
  const key = `ISBN:${isbn}`;
  if (data && data[key]) {
    const book = data[key];
    const title = book.title || '';
    const author = book.authors ? book.authors.map((a: { name: string }) => a.name).join(', ') : '';
    const publishedYear = book.publish_date ? book.publish_date.match(/\d{4}/)?.[0] || book.publish_date : '';

    const subjects = book.subjects ? book.subjects.map((s: { name: string }) => s.name).join(', ') : '';
    const coverUrl = book.cover?.medium || book.cover?.small || undefined;

    return {
      metadata: {
        isbn,
        title,
        author,
        publishedYear,
        genre: subjects ? subjects.split(',')[0] : undefined,
        keywords: subjects || undefined,
        coverUrl,
        source: 'Open Library',
      },
      isNetworkError: false,
    };
  }

  return { metadata: null, isNetworkError: false };
}
