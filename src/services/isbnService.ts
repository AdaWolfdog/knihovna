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
}

/**
 * Normalizes ISBN by removing hyphens and spaces.
 */
export function normalizeIsbn(isbn: string): string {
  return isbn.replace(/[-_ \s]/g, '').trim();
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

  // 1. Try Knihovny.cz API (CPK VuFind API)
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

async function fetchFromKnihovnyCz(isbn: string): Promise<BookMetadata | null> {
  // Knihovny.cz VuFind API endpoint
  const url = `https://www.knihovny.cz/api/v1/search?lookfor=${encodeURIComponent(isbn)}&type=Isbn&limit=1`;
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) return null;

  const data = await response.json();
  if (data.resultCount > 0 && data.records && data.records.length > 0) {
    const record = data.records[0];
    const title = record.title || record.shortTitle || '';

    // Parse authors
    let author = '';
    if (record.authors) {
      if (typeof record.authors === 'string') {
        author = record.authors;
      } else if (record.authors.primary) {
        author = Object.keys(record.authors.primary).join(', ');
      } else if (record.authors.secondary) {
        author = Object.keys(record.authors.secondary).join(', ');
      }
    }

    // Parse year
    const publishedYear = record.publicationDates?.[0] || record.publishDate || '';

    // Parse subjects/keywords/genre if available
    const keywordsList: string[] = [];
    if (Array.isArray(record.subjects)) {
      record.subjects.forEach((s: any) => {
        if (typeof s === 'string') keywordsList.push(s);
        else if (s?.heading) keywordsList.push(s.heading);
      });
    } else if (typeof record.subjects === 'string') {
      keywordsList.push(record.subjects);
    }

    const genre = record.genres?.[0] || record.format || '';
    const keywords = keywordsList.join(', ');
    const coverUrl = record.images?.[0] || record.coverUrl || undefined;

    return {
      isbn,
      title: title.trim(),
      author: author.trim(),
      publishedYear: publishedYear.toString().trim(),
      genre: genre ? String(genre).trim() : undefined,
      keywords: keywords ? keywords.trim() : undefined,
      coverUrl: coverUrl ? String(coverUrl) : undefined,
      source: 'Knihovny.cz',
    };
  }

  return null;
}

async function fetchFromGoogleBooks(isbn: string): Promise<BookMetadata | null> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
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
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
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
