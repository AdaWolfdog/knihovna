import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCoverSourcePage, resolveBackgroundBookCover, resolveBookCover, resolveBookCoverForRefresh } from './bookCoverService';
import { lookupBookByIsbnDetailed } from './isbnService';

function mockImages(results: Record<string, [number, number] | 'error' | 'slow'>) {
  const requests = vi.fn();
  vi.stubGlobal('Image', class {
    naturalWidth = 0;
    naturalHeight = 0;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    removeAttribute() {}
    set src(url: string) {
      requests(url);
      queueMicrotask(() => {
        const image = results[url];
        if (image === 'slow') return;
        if (!image || image === 'error') {
          this.onerror?.();
          return;
        }
        [this.naturalWidth, this.naturalHeight] = image;
        this.onload?.();
      });
    }
  });
  return requests;
}

const obalkyCover = (isbn: string) =>
  `https://cache.obalkyknih.cz/api/cover?isbn=${isbn}&type=medium&keywords=`;

const directCover = (isbn: string) => `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('ISBN cover resolution', () => {
  it('uses the next catalog after a broken Czech cover, with no extra request', async () => {
    const bad = 'https://books.example/czech-large.jpg';
    const good = 'https://covers.example/czech-medium.jpg';
    const requests = mockImages({ [bad]: 'error', [good]: [240, 360] });

    await expect(resolveBookCover('9788025703670', [[bad], [good]])).resolves.toBe(good);
    expect(requests.mock.calls).toEqual([[bad], [good]]);
  });

  it('tries a direct Slovak ISBN cover after a blank image', async () => {
    const blank = 'https://books.example/slovak-blank.jpg';
    const good = directCover('9788055600017');
    const requests = mockImages({ [blank]: [1, 1], [good]: [220, 320] });

    await expect(resolveBookCover('9788055600017', [[blank]])).resolves.toBe(good);
    expect(requests.mock.calls).toEqual([[blank], [good]]);
  });

  it('tries equivalent ISBN forms and shares concurrent and repeated lookups', async () => {
    const good = directCover('0140328726');
    const requests = mockImages({ [good]: [180, 280] });

    const first = resolveBookCover('0140328726', []);
    const second = resolveBookCover('9780140328721', []);
    await expect(Promise.all([first, second])).resolves.toEqual([good, good]);
    await expect(resolveBookCover('9780140328721', [])).resolves.toBe(good);
    expect(requests.mock.calls).toEqual([[directCover('9780140328721')], [good]]);
  });

  it('moves on after a timeout and caches misses briefly', async () => {
    vi.useFakeTimers();
    const slow = 'https://books.example/timed-out.jpg';
    const corrupt = 'https://covers.example/corrupt.jpg';
    const requests = mockImages({ [slow]: 'slow', [corrupt]: 'error' });

    const lookup = resolveBookCover('9780439708180', [[slow], [corrupt]]);
    await vi.advanceTimersByTimeAsync(2400);
    await expect(lookup).resolves.toBeUndefined();
    const attempts = requests.mock.calls.length;
    expect(attempts).toBeGreaterThan(2);
    await expect(resolveBookCover('9780439708180', [[slow], [corrupt]])).resolves.toBeUndefined();
    expect(requests).toHaveBeenCalledTimes(attempts);
  });

  it('deduplicates repeated links and avoids direct requests for invalid ISBNs', async () => {
    const broken = 'https://books.example/not-an-image';
    const requests = mockImages({ [broken]: 'error' });
    await expect(resolveBookCover('9780000000000', [[broken, broken], [broken]])).resolves.toBeUndefined();
    expect(requests.mock.calls).toEqual([[broken]]);
  });
});

it('returns a verified ISBN cover independently of failed or empty metadata sources', async () => {
  const isbn = '9780553382563';
  const cover = directCover(isbn);
  const requests = mockImages({ [cover]: [180, 280] });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
    ok: !url.includes('googleapis.com'),
    status: url.includes('googleapis.com') ? 503 : 200,
    json: async () => ({}),
  })));

  await expect(lookupBookByIsbnDetailed(isbn)).resolves.toEqual({
    metadata: null, coverUrl: cover, isNetworkError: true,
  });
  expect(requests.mock.calls).toEqual([[cover]]);
});


it.each(['9788025338742', '9788024292519'])(
  'tries Obálky knih for exact ISBN %s even when all catalogs return no metadata',
  async (isbn) => {
    const cover = obalkyCover(isbn);
    const requests = mockImages({ [cover]: [170, 240] });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })));

    await expect(lookupBookByIsbnDetailed(isbn)).resolves.toEqual({
      metadata: null, coverUrl: cover, isNetworkError: false,
    });
    expect(requests).toHaveBeenLastCalledWith(cover);
    expect(getCoverSourcePage(cover)).toBe(`https://www.obalkyknih.cz/view?isbn=${isbn}`);
  },
);

it('rejects a transparent fallback image after a timed-out direct Open Library lookup', async () => {
  vi.useFakeTimers();
  const isbn = '9788055600024';
  const cover = obalkyCover(isbn);
  const requests = mockImages({ [directCover(isbn)]: 'slow', [cover]: [1, 1] });

  const lookup = resolveBookCover(isbn, []);
  await vi.advanceTimersByTimeAsync(850);
  await expect(lookup).resolves.toBeUndefined();
  expect(requests).toHaveBeenLastCalledWith(cover);
});


describe('replacement of a saved cover', () => {
  const saved = 'https://books.example/saved.jpg';
  const replacement = 'https://books.example/replacement.jpg';

  it.each<{ oldImage: 'error' | [number, number] }>([{ oldImage: 'error' }, { oldImage: [1, 1] }])(
    'accepts a verified replacement when the saved image is $oldImage', async ({ oldImage }) => {
      const requests = mockImages({ [saved]: oldImage, [replacement]: [170, 240] });

      await expect(resolveBookCoverForRefresh('invalid', saved, replacement)).resolves.toBe(replacement);
      expect(requests.mock.calls).toEqual([[saved], [replacement]]);
    },
  );

  it('preserves a working saved image without checking a replacement', async () => {
    const requests = mockImages({ [saved]: [170, 240] });

    await expect(resolveBookCoverForRefresh('invalid', saved, replacement)).resolves.toBeUndefined();
    expect(requests.mock.calls).toEqual([[saved]]);
  });

  it('preserves the saved link when the replacement is also broken', async () => {
    mockImages({ [saved]: 'error', [replacement]: 'error' });

    await expect(resolveBookCoverForRefresh('invalid', saved, replacement)).resolves.toBeUndefined();
  });

  it('uses a direct ISBN source when refreshing a book with no catalog cover', async () => {
    const isbn = '9780140328721';
    const cover = directCover(isbn);
    const requests = mockImages({ [cover]: [170, 240] });

    await expect(resolveBookCoverForRefresh(isbn)).resolves.toBe(cover);
    expect(requests.mock.calls).toEqual([[cover]]);
  });

  it('falls through to a direct ISBN source after a broken saved link and catalog cover', async () => {
    const isbn = '9780553382563';
    const cover = directCover(isbn);
    const requests = mockImages({ [saved]: 'error', [replacement]: 'error', [cover]: [170, 240] });

    await expect(resolveBookCoverForRefresh(isbn, saved, replacement)).resolves.toBe(cover);
    expect(requests.mock.calls).toEqual([[saved], [replacement], [cover]]);
  });

  it('preserves the saved link if checking it times out', async () => {
    vi.useFakeTimers();
    const requests = mockImages({ [saved]: 'slow' });
    const check = resolveBookCoverForRefresh('invalid', saved, replacement);

    await vi.advanceTimersByTimeAsync(2400);
    await expect(check).resolves.toBeUndefined();
    expect(requests.mock.calls).toEqual([[saved]]);
  });
});


describe('background ISBN cover resolution', () => {
  const directObalkyCover = (isbn: string) => `https://www.obalkyknih.cz/api/cover?isbn=${isbn}`;

  it.each(['9788025338742', '9788024292519'])(
    'tries the direct Czech source for %s after a short lookup missed',
    async (isbn) => {
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 16 * 60_000);
      const cover = directObalkyCover(isbn);
      const requests = mockImages({});
      await expect(resolveBookCover(isbn, [])).resolves.toBeUndefined();

      vi.stubGlobal('Image', class {
        naturalWidth = 180;
        naturalHeight = 280;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        removeAttribute() {}
        set src(url: string) {
          requests(url);
          setTimeout(() => this.onload?.(), 2000);
        }
      });

      const lookup = resolveBackgroundBookCover(isbn);
      expect(resolveBackgroundBookCover(isbn)).toBe(lookup);
      await vi.advanceTimersByTimeAsync(2000);
      await expect(lookup).resolves.toBe(cover);
      expect(requests).toHaveBeenLastCalledWith(cover);
      expect(getCoverSourcePage(cover)).toBe(`https://www.obalkyknih.cz/view?isbn=${isbn}`);
    },
  );

  it('skips a failed saved link and rejects a blank image before trying the equivalent ISBN', async () => {
    const isbn = '9788025338742';
    const equivalentCover = directCover('8025338746');
    const requests = mockImages({ [obalkyCover(isbn)]: [1, 1], [equivalentCover]: [180, 280] });

    await expect(resolveBackgroundBookCover('978-80-253-3874-2', directObalkyCover(isbn)))
      .resolves.toBe(equivalentCover);
    expect(requests.mock.calls).toEqual([[obalkyCover(isbn)], [directCover(isbn)], [equivalentCover]]);
  });

  it('makes no requests for an invalid ISBN', async () => {
    const requests = mockImages({});
    await expect(resolveBackgroundBookCover('978-80-253-3874-1')).resolves.toBeUndefined();
    expect(requests).not.toHaveBeenCalled();
  });
});
