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
    expect(actions).toEqual(['Odebrat 1 kus', 'Přidat 1 kus', 'Načíst údaje znovu podle ISBN', 'Přesunout knihu', 'Upravit knihu', 'Smazat knihu']);

    await act(async () => list.click());
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(search.value).toBe('Čaj');
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  }
});

it('sorts the list and gallery using both groups in the sort menu', async () => {
  const fixture = (id: number, title: string, author: string, publishedYear: string, scannedAt: string, quantity: number): Book => ({
    id, title, author, publishedYear, scannedAt: new Date(scannedAt), quantity,
    isbn: '', libraryId: 1, roomId: 1, shelfId: 1,
  });
  const books = [
    fixture(1, 'Kosení', 'Shusterman, Neal', '2023', '2026-11-16', 4),
    fixture(2, 'Bílá Voda', 'Kateřina Tučková', '[2022]', '2026-11-20', 1),
    fixture(3, 'Čaj s kapkou jedu', 'Robin Stevensová', '2018', '2026-11-22', 2),
    fixture(4, 'Tajemná zahrada', 'Burnettová, Frances Hodgson', '', '2026-11-18', 3),
  ];
  vi.spyOn(db.books, 'toArray').mockReturnValue(books as unknown as ReturnType<typeof db.books.toArray>);
  vi.spyOn(db.libraries, 'toArray').mockReturnValue([] as unknown as ReturnType<typeof db.libraries.toArray>);
  vi.spyOn(db.rooms, 'toArray').mockReturnValue([] as unknown as ReturnType<typeof db.rooms.toArray>);
  vi.spyOn(db.shelves, 'toArray').mockReturnValue([] as unknown as ReturnType<typeof db.shelves.toArray>);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

  const container = document.createElement('div');
  const root = createRoot(container);
  try {
    await act(async () => root.render(<BookListTab />));
    const sort = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Řazení')!;
    const menu = container.querySelector('fieldset')!.parentElement!;
    const choose = async (label: string) => {
      const option = [...menu.querySelectorAll('label')].find((item) => item.textContent === label)!;
      await act(async () => option.querySelector('input')!.click());
    };
    const firstTitle = () => container.querySelector('tbody tr td:nth-child(2) .font-bold, ul li h3')?.textContent;

    expect(menu.hidden).toBe(true);
    expect(firstTitle()).toBe('Bílá Voda');
    await act(async () => sort.click());
    expect(sort.getAttribute('aria-expanded')).toBe('true');
    expect(menu.hidden).toBe(false);

    for (const [criterion, firstAsc, firstDesc] of [
      ['Název', 'Bílá Voda', 'Tajemná zahrada'],
      ['Autor', 'Tajemná zahrada', 'Bílá Voda'],
      ['Datum vydání', 'Čaj s kapkou jedu', 'Kosení'],
      ['Datum přidání', 'Kosení', 'Čaj s kapkou jedu'],
      ['Počet kusů', 'Bílá Voda', 'Kosení'],
    ]) {
      await choose(criterion);
      await choose('Vzestupně');
      expect(firstTitle()).toBe(firstAsc);
      await choose('Sestupně');
      expect(firstTitle()).toBe(firstDesc);
    }

    await choose('Datum vydání');
    const gallery = container.querySelector<HTMLButtonElement>('[aria-label="Dlaždice"]')!;
    await act(async () => gallery.click());
    expect(firstTitle()).toBe('Kosení');
    expect(container.querySelector('ul li:last-child h3')?.textContent).toBe('Tajemná zahrada');

    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(sort.getAttribute('aria-expanded')).toBe('false');
    expect(menu.hidden).toBe(true);
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  }
});
