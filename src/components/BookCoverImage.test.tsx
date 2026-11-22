// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/db';
import { resolveBackgroundBookCover } from '../services/bookCoverService';
import { BookCoverImage } from './BookCoverImage';

vi.mock('../db/db', () => ({
  db: {
    books: { get: vi.fn(), update: vi.fn() },
    transaction: (_mode: string, _table: unknown, callback: () => Promise<void>) => callback(),
  },
}));
vi.mock('../services/bookCoverService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../services/bookCoverService')>(),
  resolveBackgroundBookCover: vi.fn(),
}));

const isbn = '9788025338742';
const replacement = 'https://www.obalkyknih.cz/api/cover?isbn=9788025338742';
const original = 'https://books.example/old.jpg';

describe('automatic covers for recent scans', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.clearAllMocks();
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  });

  const renderCover = (root: Root, src?: string) => act(async () => {
    root.render(<BookCoverImage src={src} isbn={isbn} bookId={1} alt="Cover" className="" fallback="No cover" />);
  });

  it('shows the placeholder without a search in a book list', async () => {
    await act(async () => {
      root.render(<BookCoverImage src={original} alt="Cover" className="" fallback="No cover" />);
    });
    await act(async () => {
      container.querySelector('img')?.dispatchEvent(new Event('error'));
    });

    expect(container.textContent).toBe('No cover');
    expect(resolveBackgroundBookCover).not.toHaveBeenCalled();
    expect(db.books.update).not.toHaveBeenCalled();
  });

  it('loads and persists an exact-ISBN cover without any user action', async () => {
    vi.mocked(resolveBackgroundBookCover).mockResolvedValue(replacement);
    vi.mocked(db.books.get).mockResolvedValueOnce({ isbn } as Awaited<ReturnType<typeof db.books.get>>);

    await renderCover(root);

    expect(resolveBackgroundBookCover).toHaveBeenCalledWith(isbn, undefined);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(replacement);
    expect(db.books.update).toHaveBeenCalledWith(1, { coverUrl: replacement });
  });

  it('tries another link after a saved image fails and preserves a concurrent manual change', async () => {
    vi.mocked(resolveBackgroundBookCover).mockResolvedValue(replacement);
    vi.mocked(db.books.get).mockResolvedValueOnce({
      isbn, coverUrl: 'https://books.example/manual.jpg',
    } as Awaited<ReturnType<typeof db.books.get>>);

    await renderCover(root, original);
    expect(resolveBackgroundBookCover).not.toHaveBeenCalled();
    await act(async () => {
      container.querySelector('img')?.dispatchEvent(new Event('error'));
    });

    expect(resolveBackgroundBookCover).toHaveBeenCalledWith(isbn, original);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(replacement);
    expect(db.books.update).not.toHaveBeenCalled();
  });
});
