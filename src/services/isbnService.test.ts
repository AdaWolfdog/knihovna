import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeIsbn,
  toIsbn13,
  cleanCatalogPunctuation,
  cleanAuthorName,
  extractYear,
  mapKnihovnyRecordToBookMetadata,
  fetchFromKnihovnyCz,
  fetchBookByIsbn,
  searchKnihovnyCz,
} from './isbnService';

describe('normalizeIsbn', () => {
  it('removes hyphens and spaces from ISBN-13', () => {
    expect(normalizeIsbn('978-80-204-1234-5')).toBe('9788020412345');
    expect(normalizeIsbn('978 80 204 1234 5')).toBe('9788020412345');
    expect(normalizeIsbn(' 978-80-204 1234-5 ')).toBe('9788020412345');
  });

  it('removes hyphens and spaces from ISBN-10', () => {
    expect(normalizeIsbn('80-204-1234-X')).toBe('802041234X');
  });

  it('strips parenthesized annotations like (brož.)', () => {
    expect(normalizeIsbn('80-202-0468-7 (brož.)')).toBe('8020204687');
  });

  it('handles empty strings', () => {
    expect(normalizeIsbn('')).toBe('');
  });
});

describe('toIsbn13', () => {
  it('converts 10-digit ISBN to 13-digit ISBN with calculated checksum', () => {
    // 80-257-0367-X -> 9788025703670
    expect(toIsbn13('80-257-0367-X')).toBe('9788025703670');
    expect(toIsbn13('8025703670')).toBe('9788025703670');
  });

  it('preserves valid 13-digit ISBNs', () => {
    expect(toIsbn13('978-80-257-0367-0')).toBe('9788025703670');
  });
});

describe('Text cleaning utilities', () => {
  it('cleanCatalogPunctuation strips catalog punctuation', () => {
    expect(cleanCatalogPunctuation('Argo,')).toBe('Argo');
    expect(cleanCatalogPunctuation('Praha :')).toBe('Praha');
    expect(cleanCatalogPunctuation('[Praha] :')).toBe('Praha');
    expect(cleanCatalogPunctuation('Praha /')).toBe('Praha');
    expect(cleanCatalogPunctuation('Praha.')).toBe('Praha');
  });

  it('cleanAuthorName removes birth and death dates', () => {
    expect(cleanAuthorName('Jean de Nostredame, asi 1507-1577')).toBe('Jean de Nostredame');
    expect(cleanAuthorName('Josef Prokop, 1971-')).toBe('Josef Prokop');
    expect(cleanAuthorName('Vojtěch Domlátil, 1979-')).toBe('Vojtěch Domlátil');
    expect(cleanAuthorName('Karel Čapek, 1890-1938')).toBe('Karel Čapek');
  });

  it('extractYear pulls 4 digits from date string', () => {
    expect(extractYear('2011')).toBe('2011');
    expect(extractYear('c2010')).toBe('2010');
    expect(extractYear('[2025]')).toBe('2025');
    expect(extractYear('')).toBe('');
  });
});

describe('mapKnihovnyRecordToBookMetadata', () => {
  const sampleRecord = {
    id: 'mkp.3521868',
    title: 'Životy slavných a starých provensálských básníků, kteří žili v dobách hrabat z kraje Provença',
    authors: {
      primary: { 'Jean de Nostredame, asi 1507-1577': [] },
      secondary: { 'Josef Prokop, 1971-': [], 'Vojtěch Domlátil, 1979-': [] },
      corporate: [],
    },
    publishers: ['Argo,'],
    placesOfPublication: ['Praha :'],
    publicationDates: ['2011'],
    physicalDescriptions: ['218 s. : il. ; 22 cm'],
    isbns: ['978-80-257-0367-0'],
    issns: [],
    cnb: 'cnb002163342',
    formats: ['0/BOOKS/'],
  };

  it('correctly maps all fields from real sample record', () => {
    const meta = mapKnihovnyRecordToBookMetadata(sampleRecord);
    expect(meta.title).toBe('Životy slavných a starých provensálských básníků, kteří žili v dobách hrabat z kraje Provença');
    expect(meta.author).toBe('Jean de Nostredame');
    expect(meta.translator).toBe('Josef Prokop, Vojtěch Domlátil');
    expect(meta.publisher).toBe('Argo');
    expect(meta.placeOfPublication).toBe('Praha');
    expect(meta.publishedYear).toBe('2011');
    expect(meta.physicalDescription).toBe('218 s. : il. ; 22 cm');
    expect(meta.cnb).toBe('cnb002163342');
    expect(meta.isbn).toBe('9788025703670');
    expect(meta.source).toBe('Knihovny.cz');
  });
});

describe('fetchFromKnihovnyCz API integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('constructs correct API URL and returns metadata for matched ISBN', async () => {
    const sampleResponse = {
      resultCount: 1,
      records: [
        {
          id: 'mkp.3521868',
          title: 'Životy slavných a starých provensálských básníků',
          authors: {
            primary: { 'Jean de Nostredame, asi 1507-1577': [] },
          },
          publishers: ['Argo,'],
          placesOfPublication: ['Praha :'],
          publicationDates: ['2011'],
          physicalDescriptions: ['218 s.'],
          isbns: ['978-80-257-0367-0'],
          issns: [],
          cnb: 'cnb002163342',
          formats: ['0/BOOKS/'],
        },
      ],
      status: 'OK',
    };

    let requestedUrl = '';
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      requestedUrl = url;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(sampleResponse),
      });
    }));

    const result = await fetchFromKnihovnyCz('978-80-257-0367-0');

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Životy slavných a starých provensálských básníků');
    expect(result?.author).toBe('Jean de Nostredame');
    expect(result?.publisher).toBe('Argo');

    // Check request URL
    const urlObj = new URL(requestedUrl);
    expect(urlObj.searchParams.get('lookfor')).toBe('9788025703670');
    expect(urlObj.searchParams.get('type')).toBe('ISN');
    expect(urlObj.searchParams.get('limit')).toBe('10');
    expect(urlObj.searchParams.getAll('field[]')).toEqual([
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
    ]);
  });

  it('selects correct record when limit=10 returns multiple editions', async () => {
    const multiRecordResponse = {
      resultCount: 2,
      records: [
        {
          id: 'edition.1',
          title: 'Inspirace (Inne vydani)',
          isbns: ['978-80-00-00000-0'],
        },
        {
          id: 'edition.2',
          title: 'Životy slavných a starých provensálských básníků',
          authors: { primary: { 'Jean de Nostredame, asi 1507-1577': [] } },
          isbns: ['978-80-257-0367-0'],
        },
      ],
      status: 'OK',
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(multiRecordResponse),
    }));

    const result = await fetchFromKnihovnyCz('80-257-0367-X'); // 10-digit ISBN
    expect(result).not.toBeNull();
    expect(result?.isbn).toBe('9788025703670');
    expect(result?.title).toBe('Životy slavných a starých provensálských básníků');
  });

  it('returns null if no record in the response contains the target ISBN', async () => {
    const responseNoMatch = {
      resultCount: 1,
      records: [
        {
          id: 'unrelated',
          title: 'Jiná kniha',
          isbns: ['978-80-99-99999-9'],
        },
      ],
      status: 'OK',
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(responseNoMatch),
    }));

    const result = await fetchFromKnihovnyCz('978-80-257-0367-0');
    expect(result).toBeNull();
  });

  it('handles response with resultCount: 0 and missing records key', async () => {
    const emptyResponse = {
      resultCount: 0,
      status: 'OK',
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(emptyResponse),
    }));

    const result = await fetchFromKnihovnyCz('9788025703670');
    expect(result).toBeNull();
  });
});

describe('fetchBookByIsbn with fallbacks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to Google Books if Knihovny.cz returns no results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('knihovny.cz')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ resultCount: 0, status: 'OK' }),
        });
      }
      if (url.includes('googleapis.com')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            totalItems: 1,
            items: [
              {
                volumeInfo: {
                  title: 'Google Book Title',
                  authors: ['Google Author'],
                  publishedDate: '2020-05-01',
                },
              },
            ],
          }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    }));

    const result = await fetchBookByIsbn('9788025703670');
    expect(result).not.toBeNull();
    expect(result?.title).toBe('Google Book Title');
    expect(result?.source).toBe('Google Books');
  });
});

describe('searchKnihovnyCz generic search and format filtering', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('filters non-ISN search results to records with 0/BOOKS/ format', async () => {
    const searchResponse = {
      resultCount: 2,
      records: [
        {
          id: 'cd.1',
          title: 'Saturnin (Audio CD)',
          formats: ['0/AUDIO/'],
        },
        {
          id: 'book.1',
          title: 'Saturnin',
          authors: { primary: { 'Zdeněk Jirotka, 1911-2003': [] } },
          formats: ['0/BOOKS/'],
        },
      ],
      status: 'OK',
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(searchResponse),
    }));

    const results = await searchKnihovnyCz('Saturnin Jirotka', 'AllFields');
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Saturnin');
    expect(results[0].author).toBe('Zdeněk Jirotka');
  });
});
