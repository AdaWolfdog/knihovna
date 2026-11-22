// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { db, type Book } from '../db/db';
import { BookListTab } from './BookListTab';

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (query: () => unknown) => query(),
}));

it('switches between the table and the gallery while preserving the active filter and book actions', async () => {
  const firstBook: Book = {
    id: 1,
    isbn: '9788025338742',
    title: 'Čaj s kapkou jedu',
    author: 'Robin Stevensová',
    coverUrl: 'https://covers.example/caj.jpg',
    publishedYear: '2018',
    quantity: 2,
    libraryId: 1,
    roomId: 1,
    shelfId: 1,
    scannedAt: new Date(),
  };
  vi.spyOn(db.books, 'toArray').mockReturnValue([
    firstBook,
    { ...firstBook, id: 2, title: 'Kosení' },
  ] as unknown as ReturnType<typeof db.books.toArray>);
  vi.spyOn(db.libraries, 'toArray').mockReturnValue([] as unknown as ReturnType<typeof db.libraries.toArray>);
  vi.spyOn(db.rooms, 'toArray').mockReturnValue([] as unknown as ReturnType<typeof db.rooms.toArray>);
  vi.spyOn(db.shelves, 'toArray').mockReturnValue([] as unknown as ReturnType<typeof db.shelves.toArray>);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

  const container = document.createElement('div');
  const root = createRoot(container);
  try {
    await act(async () => root.render(<BookListTab />));
    const list = container.querySelector<HTMLButtonElement>('[aria-label="Seznam"]')!;
    const gallery = container.querySelector<HTMLButtonElement>('[aria-label="Dlaždice"]')!;
    expect(list.getAttribute('aria-pressed')).toBe('true');
    expect(list.textContent).toBe('');
    expect(gallery.textContent).toBe('');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);

    const search = container.querySelector<HTMLInputElement>('input[type="text"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(search, 'Čaj');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => gallery.click());
    expect(gallery.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelectorAll('ul li')).toHaveLength(1);
    const tile = container.querySelector('ul li')!;
    expect(tile.querySelector('img')?.getAttribute('loading')).toBe('lazy');
    expect(tile.textContent).toContain('Robin Stevensová');
    expect(tile.textContent).toContain('2 ks');
    const actions = [...tile.querySelectorAll('button')].map(button => button.title);
    expect(actions).toEqual(['Odebrat 1 kus', 'Přidat 1 kus', 'Načíst údaje znovu podle ISBN', 'Upravit knihu', 'Smazat knihu']);

    await act(async () => list.click());
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(search.value).toBe('Čaj');
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  }
});
