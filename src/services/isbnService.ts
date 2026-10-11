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
 * Raw search endpoint against Knihovny.cz API.
 */
export async function searchKnihovnyCzRaw(
  lookfor: string,
  type: KnihovnyCzSearchType = 'ISN',
  limit: number = 10
): Promise<any[]> {
  const params = new URLSearchParams({
    lookfor,
    type,
    limit: String(Math.min(Math.max(0, limit), 100)),
  });

  for (const field of KNIHOVNY_CZ_FIELDS) {
    params.append('field[]', field);
  }

  const url = `https://www.knihovny.cz/api/v1/search?${params.toString()}`;

  let timeoutId: any;
  let signal: AbortSignal;

  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    signal = AbortSignal.timeout(8000);
  } else {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 8000);
    signal = controller.signal;
  }

  try {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return data.records ?? [];
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
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
  const target13 = toIsbn13(isbnInput);
  if (!target13) return null;

  const records = await searchKnihovnyCzRaw(target13, 'ISN', 10);
  if (!records || records.length === 0) return null;

  // Find record whose isbns array actually contains target13
  const matchingRecord = records.find((rec) => {
    if (!Array.isArray(rec.isbns)) return false;
    return rec.isbns.some((isbnEntry: string) => {
      const entry13 = toIsbn13(isbnEntry);
      return entry13 === target13;
    });
  });

  if (!matchingRecord) {
    return null;
  }

  return mapKnihovnyRecordToBookMetadata(matchingRecord, target13);
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
 */
export async function fetchBookByIsbn(isbnInput: string): Promise<BookMetadata | null> {
  const isbn = normalizeIsbn(isbnInput);
  if (!isbn) return null;

  // 1. Try Knihovny.cz API
  try {
    const cpkResult = await fetchFromKnihovnyCz(isbn);
    if (cpkResult) return cpkResult;
  } catch (err) {
    console.warn('Knihovny.cz lookup failed or offline:', err);
  }

  // 2. Try Google Books API
  try {
    const googleResult = await fetchFromGoogleBooks(isbn);
    if (googleResult) return googleResult;
  } catch (err) {
    console.warn('Google Books lookup failed or offline:', err);
  }

  // 3. Try Open Library API
  try {
    const openLibraryResult = await fetchFromOpenLibrary(isbn);
    if (openLibraryResult) return openLibraryResult;
  } catch (err) {
    console.warn('Open Library lookup failed or offline:', err);
  }

  return null;
}

async function fetchFromGoogleBooks(isbn: string): Promise<BookMetadata | null> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`;
  let signal: AbortSignal | undefined;
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    signal = AbortSignal.timeout(8000);
  }

  const response = await fetch(url, { signal });
  if (!response.ok) return null;

  const data = await response.json();
  if (data.totalItems > 0 && data.items && data.items.length > 0) {
    const info = data.items[0].volumeInfo;
    const title = info.title + (info.subtitle ? `: ${info.subtitle}` : '');
    const author = info.authors ? info.authors.join(', ') : '';
    const publishedYear = info.publishedDate ? info.publishedDate.substring(0, 4) : '';

    const categories = info.categories ? info.categories.join(', ') : '';
    const coverUrl = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || undefined;

    return {
      isbn,
      title,
      author,
      publishedYear,
      genre: categories || undefined,
      keywords: categories || undefined,
      coverUrl: coverUrl ? coverUrl.replace('http://', 'https://') : undefined,
      source: 'Google Books',
    };
  }

  return null;
}

async function fetchFromOpenLibrary(isbn: string): Promise<BookMetadata | null> {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`;
  let signal: AbortSignal | undefined;
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    signal = AbortSignal.timeout(8000);
  }

  const response = await fetch(url, { signal });
  if (!response.ok) return null;

  const data = await response.json();
  const key = `ISBN:${isbn}`;
  if (data[key]) {
    const book = data[key];
    const title = book.title || '';
    const author = book.authors ? book.authors.map((a: { name: string }) => a.name).join(', ') : '';
    const publishedYear = book.publish_date ? book.publish_date.match(/\d{4}/)?.[0] || book.publish_date : '';

    const subjects = book.subjects ? book.subjects.map((s: { name: string }) => s.name).join(', ') : '';
    const coverUrl = book.cover?.medium || book.cover?.small || undefined;

    return {
      isbn,
      title,
      author,
      publishedYear,
      genre: subjects ? subjects.split(',')[0] : undefined,
      keywords: subjects || undefined,
      coverUrl,
      source: 'Open Library',
    };
  }

  return null;
}
