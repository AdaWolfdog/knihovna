// @vitest-environment jsdom
// @ts-nocheck
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LibraryManager } from './LibraryManager';
import { db, type Book, type Library, type Room, type Shelf } from '../db/db';

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (querier: any) => querier(),
}));

describe('LibraryManager shelf books section', () => {
  let container: HTMLDivElement;
  let root: any;

  let librariesStore: Library[] = [];
  let roomsStore: Room[] = [];
  let shelvesStore: Shelf[] = [];
  let booksStore: Book[] = [];

  beforeEach(() => {
    librariesStore = [
      { id: 1, name: 'Hlavní knihovna', color: '#6366f1', createdAt: new Date() },
    ];
    roomsStore = [
      { id: 10, libraryId: 1, name: 'Obývák', createdAt: new Date() },
    ];
    shelvesStore = [
      { id: 100, libraryId: 1, roomId: 10, name: 'Police A1', createdAt: new Date() },
      { id: 101, libraryId: 1, roomId: 10, name: 'Police B2', createdAt: new Date() },
    ];
    booksStore = [
      {
        id: 1,
        libraryId: 1,
        roomId: 10,
        shelfId: 100,
        isbn: '9788025703670',
        title: 'Životy slavných',
        author: 'Jean de Nostredame',
        genre: 'Biografie',
        publishedYear: '2011',
        quantity: 2,
        scannedAt: new Date(),
      },
      {
        id: 2,
        libraryId: 1,
        roomId: 10,
        shelfId: 101,
        isbn: '9788000000002',
        title: 'Kniha na jiné polici',
        author: 'Jiný Autor',
        quantity: 1,
        scannedAt: new Date(),
      },
    ];

    vi.spyOn(db.libraries, 'toArray').mockImplementation(() => [...librariesStore] as any);
    vi.spyOn(db.rooms, 'toArray').mockImplementation(() => [...roomsStore] as any);
    vi.spyOn(db.shelves, 'toArray').mockImplementation(() => [...shelvesStore] as any);
    vi.spyOn(db.books, 'toArray').mockImplementation(() => [...booksStore] as any);

    vi.spyOn(db.books, 'update').mockImplementation(async (id: any, changes: any) => {
      const idx = booksStore.findIndex((b) => b.id === id);
      if (idx !== -1) {
        booksStore[idx] = { ...booksStore[idx], ...changes };
      }
      return 1;
    });

    vi.spyOn(db.books, 'delete').mockImplementation(async (id: any) => {
      const idx = booksStore.findIndex((b) => b.id === id);
      if (idx !== -1) {
        booksStore.splice(idx, 1);
      }
      return undefined;
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders books from the active shelf in dedicated bottom section', async () => {
    await act(async () => {
      root.render(
        <LibraryManager
          activeShelfId={100}
          setActiveShelfId={vi.fn()}
          onSelectShelfForScanning={vi.fn()}
        />
      );
    });

    const shelfSection = container.querySelector('[data-testid="shelf-books-section"]');
    expect(shelfSection).not.toBeNull();
    expect(shelfSection?.textContent).toContain('Knihy v polici: Police A1');
    expect(shelfSection?.textContent).toContain('Životy slavných');
    expect(shelfSection?.textContent).toContain('Jean de Nostredame');
    expect(shelfSection?.textContent).toContain('2 ks');

    // Should NOT contain the book from shelf 101
    expect(shelfSection?.textContent).not.toContain('Kniha na jiné polici');
  });

  it('allows changing quantity (+ / -) in shelf books section', async () => {
    await act(async () => {
      root.render(
        <LibraryManager
          activeShelfId={100}
          setActiveShelfId={vi.fn()}
          onSelectShelfForScanning={vi.fn()}
        />
      );
    });

    const shelfSection = container.querySelector('[data-testid="shelf-books-section"]');
    const plusBtn = shelfSection?.querySelector('button[title="Přidat 1 kus"]') as HTMLButtonElement;
    expect(plusBtn).not.toBeNull();

    await act(async () => {
      plusBtn.click();
    });

    expect(db.books.update).toHaveBeenCalledWith(1, { quantity: 3 });
  });

  it('allows deleting a book from the shelf section with confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await act(async () => {
      root.render(
        <LibraryManager
          activeShelfId={100}
          setActiveShelfId={vi.fn()}
          onSelectShelfForScanning={vi.fn()}
        />
      );
    });

    const shelfSection = container.querySelector('[data-testid="shelf-books-section"]');
    const deleteBtn = shelfSection?.querySelector('button[title="Smazat knihu"]') as HTMLButtonElement;
    expect(deleteBtn).not.toBeNull();

    await act(async () => {
      deleteBtn.click();
    });

    expect(window.confirm).toHaveBeenCalled();
    expect(db.books.delete).toHaveBeenCalledWith(1);
  });

  it('clicking another shelf or eye icon switches the active shelf', async () => {
    const setActiveShelfId = vi.fn();

    await act(async () => {
      root.render(
        <LibraryManager
          activeShelfId={100}
          setActiveShelfId={setActiveShelfId}
          onSelectShelfForScanning={vi.fn()}
        />
      );
    });

    const shelfB2Btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Police B2')
    );
    expect(shelfB2Btn).toBeDefined();

    await act(async () => {
      shelfB2Btn?.click();
    });

    expect(setActiveShelfId).toHaveBeenCalledWith(101);
  });

  it('automatically selects the only shelf when switching to another library with 1 shelf', async () => {
    // Library 2 has 1 room (20) and 1 shelf (200)
    librariesStore.push({ id: 2, name: 'Druhá knihovna', color: '#10b981', createdAt: new Date() });
    roomsStore.push({ id: 20, libraryId: 2, name: 'Kabinet', createdAt: new Date() });
    shelvesStore.push({ id: 200, libraryId: 2, roomId: 20, name: 'Jediná police v kabinetu', createdAt: new Date() });

    const setActiveShelfId = vi.fn();

    await act(async () => {
      root.render(
        <LibraryManager
          activeShelfId={100}
          setActiveShelfId={setActiveShelfId}
          onSelectShelfForScanning={vi.fn()}
        />
      );
    });

    // Click on "Druhá knihovna"
    const lib2NameSpan = Array.from(container.querySelectorAll('span')).find((el) =>
      el.textContent === 'Druhá knihovna'
    );
    expect(lib2NameSpan).toBeDefined();
    const lib2Row = lib2NameSpan?.closest('div[class*="cursor-pointer"]');
    expect(lib2Row).not.toBeNull();

    await act(async () => {
      (lib2Row as HTMLElement)?.click();
    });

    // Should automatically set active shelf to 200
    expect(setActiveShelfId).toHaveBeenCalledWith(200);
  });

  it('automatically selects the only shelf when switching to another room with 1 shelf', async () => {
    // Add another room to library 1 with 1 shelf
    roomsStore.push({ id: 11, libraryId: 1, name: 'Ložnice', createdAt: new Date() });
    shelvesStore.push({ id: 102, libraryId: 1, roomId: 11, name: 'Police v ložnici', createdAt: new Date() });

    const setActiveShelfId = vi.fn();

    await act(async () => {
      root.render(
        <LibraryManager
          activeShelfId={100}
          setActiveShelfId={setActiveShelfId}
          onSelectShelfForScanning={vi.fn()}
        />
      );
    });

    // Click on "Ložnice" room
    const lozniceSpan = Array.from(container.querySelectorAll('span')).find((el) =>
      el.textContent === 'Ložnice'
    );
    expect(lozniceSpan).toBeDefined();
    const lozniceRow = lozniceSpan?.closest('div[class*="cursor-pointer"]');
    expect(lozniceRow).not.toBeNull();

    await act(async () => {
      (lozniceRow as HTMLElement)?.click();
    });

    expect(setActiveShelfId).toHaveBeenCalledWith(102);
  });
});
