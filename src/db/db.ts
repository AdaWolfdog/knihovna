import Dexie, { type Table } from 'dexie';

export interface Library {
  id?: number;
  name: string;
  color?: string; // Hex or CSS color string (e.g., '#4f46e5')
  createdAt: Date;
}

export interface Room {
  id?: number;
  libraryId: number;
  name: string;
  createdAt: Date;
}

export interface Shelf {
  id?: number;
  roomId: number;
  libraryId: number;
  name: string;
  createdAt: Date;
}

export interface Book {
  id?: number;
  libraryId: number;
  roomId: number;
  shelfId: number;
  isbn: string;
  title: string;
  author: string;
  publishedYear: string;
  translator?: string;
  editionNumber?: string;
  copyNumber?: number; // Kept for backwards compatibility if needed
  quantity: number; // Number of physical copies on this shelf
  scannedAt: Date;
  notes?: string;
}

export class LibraryDatabase extends Dexie {
  libraries!: Table<Library>;
  rooms!: Table<Room>;
  shelves!: Table<Shelf>;
  books!: Table<Book>;

  constructor() {
    super('LibraryManagerDB');
    this.version(1).stores({
      libraries: '++id, name, createdAt',
      rooms: '++id, libraryId, name',
      shelves: '++id, roomId, libraryId, name',
      books: '++id, libraryId, roomId, shelfId, isbn, title, author, scannedAt',
    });
  }
}

export const db = new LibraryDatabase();
