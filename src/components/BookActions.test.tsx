// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { db, type Book } from '../db/db';
import { resolveBookCoverForRefresh } from '../services/bookCoverService';
import { lookupBookByIsbnDetailed } from '../services/isbnService';
import { BookActions } from './BookActions';

vi.mock('../db/db', () => ({
  db: {
    books: { get: vi.fn(), update: vi.fn() },
    transaction: (_mode: string, _table: unknown, callback: () => Promise<void>) => callback(),
  },
}));
vi.mock('../i18n', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock('../services/bookCoverService', () => ({ resolveBookCoverForRefresh: vi.fn() }));
vi.mock('../services/isbnService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../services/isbnService')>(),
  lookupBookByIsbnDetailed: vi.fn(),
}));

it('finds and saves a missing cover on click even when the catalogs return no book details', async () => {
  const book: Book = {
    id: 1, isbn: '9788025338742', title: 'Čaj s kapkou jedu', author: '', publishedYear: '',
    libraryId: 1, roomId: 1, shelfId: 1, quantity: 1, scannedAt: new Date(),
  };
  const cover = 'https://www.obalkyknih.cz/api/cover?isbn=9788025338742';
  vi.mocked(lookupBookByIsbnDetailed).mockResolvedValue({ metadata: null, isNetworkError: true });
  vi.mocked(resolveBookCoverForRefresh).mockResolvedValue(cover);
  vi.mocked(db.books.get).mockResolvedValue(book);
  vi.mocked(db.books.update).mockResolvedValue(1);

  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div');
  const root = createRoot(container);

  try {
    await act(async () => root.render(<BookActions book={book} onEdit={() => {}} onDelete={() => {}} />));
    expect(resolveBookCoverForRefresh).not.toHaveBeenCalled();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="refreshBookDetails"]')?.click());
    expect(resolveBookCoverForRefresh).toHaveBeenCalledWith(book.isbn, undefined, undefined);
    expect(db.books.update).toHaveBeenCalledWith(book.id, { coverUrl: cover });
    expect(container.querySelector('[role="status"]')?.textContent).toBe('refreshBookSuccess');
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
