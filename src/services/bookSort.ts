import type { Book } from '../db/db';
import { extractYear } from './isbnService';

export type BookSortCriterion = 'title' | 'author' | 'published' | 'added' | 'quantity';
export type BookSortDirection = 'asc' | 'desc';

function authorSortKey(author: string) {
  const name = author?.split(';', 1)[0]?.trim() ?? '';
  if (!name) return undefined;
  const comma = name.indexOf(',');
  // Catalogs can supply “Surname, Given name”. Manual entries often use the reverse order.
  return comma > 0 ? name.slice(0, comma) : name.split(/\s+/).at(-1);
}

const getSortValue: Record<BookSortCriterion, (book: Book) => string | number | undefined> = {
  title: (book) => book.title?.trim() || undefined,
  author: (book) => authorSortKey(book.author),
  published: (book) => Number(extractYear(book.publishedYear)) || undefined,
  added: (book) => {
    if (!book.scannedAt) return undefined;
    const timestamp = new Date(book.scannedAt).getTime();
    return Number.isFinite(timestamp) ? timestamp : undefined;
  },
  quantity: (book) => book.quantity || 1,
};

export function sortBooks(
  books: readonly Book[],
  criterion: BookSortCriterion,
  direction: BookSortDirection,
  collator: Intl.Collator,
): Book[] {
  const factor = direction === 'asc' ? 1 : -1;
  return books.map((book) => ({ book, value: getSortValue[criterion](book) }))
    .sort((a, b) => {
      if (a.value === undefined) return b.value === undefined ? 0 : 1;
      if (b.value === undefined) return -1;
      const order = typeof a.value === 'number' && typeof b.value === 'number'
        ? a.value - b.value
        : collator.compare(String(a.value), String(b.value));
      return factor * order;
    })
    .map(({ book }) => book);
}
