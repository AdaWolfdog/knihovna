import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchWithRetry,
  lookupBookByIsbnDetailed,
} from './isbnService';

describe('Catalog lookup resilience and retry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches successfully on the first attempt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ records: [{ title: 'Test Book' }] }),
    }));

    const result = await fetchWithRetry('https://example.com/api', { retries: 1 });
    expect(result.ok).toBe(true);
    expect(result.data.records[0].title).toBe('Test Book');
  });

  it('retries on network exception and succeeds on retry', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error('Network disconnected'));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ records: [{ title: 'Recovered Book' }] }),
      });
    }));

    const result = await fetchWithRetry('https://example.com/api', { retries: 1, baseDelayMs: 10 });
    expect(callCount).toBe(2);
    expect(result.ok).toBe(true);
    expect(result.data.records[0].title).toBe('Recovered Book');
  });

  it('retries on 503 or 429 status and succeeds on retry', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({ error: 'Service Unavailable' }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ records: [{ title: 'After 503' }] }),
      });
    }));

    const result = await fetchWithRetry('https://example.com/api', { retries: 1, baseDelayMs: 10 });
    expect(callCount).toBe(2);
    expect(result.ok).toBe(true);
    expect(result.data.records[0].title).toBe('After 503');
  });

  it('distinguishes genuine unknown ISBN (HTTP 200 with empty list) from network failure', async () => {
    // All catalogs return 200 OK with empty records
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('knihovny.cz')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ records: [], resultCount: 0 }),
        });
      }
      if (url.includes('googleapis.com')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ totalItems: 0 }),
        });
      }
      if (url.includes('openlibrary.org')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
        });
      }
      return Promise.reject(new Error('Unknown service'));
    }));

    const result = await lookupBookByIsbnDetailed('9788000000000');
    expect(result.metadata).toBeNull();
    expect(result.isNetworkError).toBe(false); // Genuinely not found!
  });

  it('flags isNetworkError: true when one catalog returns empty but another catalog fails with network error', async () => {
    // Knihovny.cz returns 200 empty, but Google Books fails with 500/timeout
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('knihovny.cz')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ records: [], resultCount: 0 }),
        });
      }
      if (url.includes('googleapis.com')) {
        return Promise.reject(new Error('Connection timed out'));
      }
      if (url.includes('openlibrary.org')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
        });
      }
      return Promise.reject(new Error('Unknown service'));
    }));

    const result = await lookupBookByIsbnDetailed('9788000000000');
    expect(result.metadata).toBeNull();
    expect(result.isNetworkError).toBe(true); // Incomplete result due to catalog failure!
    expect(result.errorMessage).toContain('Katalogy jsou dočasně nedostupné');
  });

  it('flags isNetworkError: true when all catalogs fail with network disconnection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')));

    const result = await lookupBookByIsbnDetailed('9788025703670');
    expect(result.metadata).toBeNull();
    expect(result.isNetworkError).toBe(true);
    expect(result.errorMessage).toContain('Katalogy jsou dočasně nedostupné');
  });

  it('flags isNetworkError: true when catalogs time out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Timeout', 'TimeoutError')));

    const result = await lookupBookByIsbnDetailed('9788025703670');
    expect(result.metadata).toBeNull();
    expect(result.isNetworkError).toBe(true);
  });
});
