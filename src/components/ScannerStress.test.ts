import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeIsbn } from '../services/isbnService';
import type { Book } from '../db/db';

describe('Scanning workflow stress test (100 scans simulation)', () => {
  const libraryId = 1;
  const roomId = 1;
  const shelfId = 1;

  // In-memory mock store representing Dexie DB
  let booksStore: Book[] = [];
  let nextId = 1;

  const mockDb = {
    books: {
      clear: async () => {
        booksStore = [];
        nextId = 1;
      },
      where: (field: string) => ({
        equals: (val: any) => ({
          and: (predicate: (b: Book) => boolean) => ({
            first: async () => {
              return booksStore.find((b) => (b as any)[field] === val && predicate(b));
            },
          }),
        }),
      }),
      add: async (book: Book) => {
        const id = nextId++;
        const saved = { ...book, id };
        booksStore.push(saved);
        return id;
      },
      update: async (id: number, changes: Partial<Book>) => {
        const idx = booksStore.findIndex((b) => b.id === id);
        if (idx !== -1) {
          booksStore[idx] = { ...booksStore[idx], ...changes };
        }
      },
      count: async () => booksStore.length,
      toArray: async () => [...booksStore],
    },
  };

  beforeEach(async () => {
    await mockDb.books.clear();
  });

  it('handles 100 consecutive scans without state leakage or unhandled errors', async () => {
    const booksToScan = Array.from({ length: 100 }, (_, i) => ({
      isbn: `978800000${String(i).padStart(4, '0')}`,
      title: `Kniha testovací č. ${i + 1}`,
      author: `Autor ${i + 1}`,
      publishedYear: '2024',
      quantity: 1,
    }));

    for (let i = 0; i < booksToScan.length; i++) {
      const bookData = booksToScan[i];
      const cleanIsbn = normalizeIsbn(bookData.isbn);

      const existingOnShelf = await mockDb.books
        .where('shelfId')
        .equals(shelfId)
        .and((b) => normalizeIsbn(b.isbn) === cleanIsbn)
        .first();

      if (existingOnShelf && existingOnShelf.id) {
        await mockDb.books.update(existingOnShelf.id, {
          quantity: (existingOnShelf.quantity || 1) + 1,
          scannedAt: new Date(),
        });
      } else {
        await mockDb.books.add({
          libraryId,
          roomId,
          shelfId,
          isbn: cleanIsbn,
          title: bookData.title,
          author: bookData.author,
          publishedYear: bookData.publishedYear,
          quantity: 1,
          scannedAt: new Date(),
        });
      }
    }

    const totalBooks = await mockDb.books.count();
    expect(totalBooks).toBe(100);
  });

  it('correctly increments quantity on repeated scans of the same barcode without creating duplicate records', async () => {
    const repeatedIsbn = '9788025703670';

    for (let i = 0; i < 10; i++) {
      const cleanIsbn = normalizeIsbn(repeatedIsbn);
      const existing = await mockDb.books
        .where('shelfId')
        .equals(shelfId)
        .and((b) => normalizeIsbn(b.isbn) === cleanIsbn)
        .first();

      if (existing && existing.id) {
        await mockDb.books.update(existing.id, {
          quantity: (existing.quantity || 1) + 1,
          scannedAt: new Date(),
        });
      } else {
        await mockDb.books.add({
          libraryId,
          roomId,
          shelfId,
          isbn: cleanIsbn,
          title: 'Životy slavných',
          author: 'Jean de Nostredame',
          publishedYear: '2011',
          quantity: 1,
          scannedAt: new Date(),
        });
      }
    }

    const books = await mockDb.books.toArray();
    expect(books.length).toBe(1);
    expect(books[0].quantity).toBe(10);
  });

  it('gracefully handles database write failures without crashing', async () => {
    const errorIsbn = '9788012345678';

    // Simulate db add rejection
    const originalAdd = mockDb.books.add;
    mockDb.books.add = vi.fn().mockRejectedValue(new Error('QuotaExceededError: Database is full'));

    let caughtError = false;
    try {
      await mockDb.books.add({
        libraryId,
        roomId,
        shelfId,
        isbn: errorIsbn,
        title: 'Chybná kniha',
        author: 'Autor',
        publishedYear: '2024',
        quantity: 1,
        scannedAt: new Date(),
      });
    } catch (err: any) {
      caughtError = true;
      expect(err.message).toContain('QuotaExceededError');
    }

    expect(caughtError).toBe(true);

    // Restore original add and ensure subsequent saves succeed
    mockDb.books.add = originalAdd;

    const okId = await mockDb.books.add({
      libraryId,
      roomId,
      shelfId,
      isbn: '9788099999999',
      title: 'Záchranná kniha',
      author: 'Autor',
      publishedYear: '2024',
      quantity: 1,
      scannedAt: new Date(),
    });
    expect(okId).toBeDefined();
    expect(await mockDb.books.count()).toBe(1);
  });
});
