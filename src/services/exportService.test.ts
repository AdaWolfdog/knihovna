import { describe, it, expect } from 'vitest';
import { prepareExportData } from './exportService';
import type { Book, Library, Room, Shelf } from '../db/db';

describe('prepareExportData', () => {
  it('correctly maps books and hierarchy into Czech export structure', () => {
    const library: Library = { id: 1, name: 'Ústřední knihovna', createdAt: new Date() };
    const room: Room = { id: 10, libraryId: 1, name: 'Studovna 1', createdAt: new Date() };
    const shelf: Shelf = { id: 100, libraryId: 1, roomId: 10, name: 'Police B2', createdAt: new Date() };

    const book: Book = {
      id: 1000,
      libraryId: 1,
      roomId: 10,
      shelfId: 100,
      isbn: '9788020412345',
      title: 'Babička',
      author: 'Božena Němcová',
      publishedYear: '1952',
      translator: 'Josef Novák',
      editionNumber: '3. vydání',
      quantity: 2,
      scannedAt: new Date('2026-10-03T10:00:00Z'),
      notes: 'Zachovalý stav',
    };

    const librariesMap = new Map([[1, library]]);
    const roomsMap = new Map([[10, room]]);
    const shelvesMap = new Map([[100, shelf]]);

    const rows = prepareExportData([book], librariesMap, roomsMap, shelvesMap);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      Knihovna: 'Ústřední knihovna',
      Místnost: 'Studovna 1',
      Police: 'Police B2',
      ISBN: '9788020412345',
      Název: 'Babička',
      Autor: 'Božena Němcová',
      'Rok vydání': '1952',
      Překladatel: 'Josef Novák',
      'Číslo vydání': '3. vydání',
      'Počet kusů': 2,
      'Datum a čas naskenování': expect.any(String),
      Poznámka: 'Zachovalý stav',
    });
  });
});
