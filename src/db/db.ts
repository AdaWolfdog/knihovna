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
  illustrator?: string;
  editionNumber?: string;
  copyNumber?: number; // Kept for backwards compatibility if needed
  quantity: number; // Number of physical copies on this shelf
  scannedAt: Date;
  notes?: string;
  genre?: string;
  keywords?: string;
  coverUrl?: string;
  // Background catalog metadata fields
  publisher?: string;
  placeOfPublication?: string;
  cnb?: string;
  physicalDescription?: string;
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

export async function changeBookQuantity(
  id: number,
  delta: -1 | 1,
  confirmDeletion: () => boolean,
) {
  const changeQuantity = (allowDeletion: boolean) => db.transaction('rw', db.books, async () => {
    const book = await db.books.get(id);
    if (!book) return;

    const quantity = (book.quantity || 1) + delta;
    if (quantity > 0) {
      await db.books.update(id, { quantity });
    } else if (allowDeletion) {
      await db.books.delete(id);
    } else {
      return 'confirmDeletion';
    }
  });

  if (await changeQuantity(false) === 'confirmDeletion' && confirmDeletion()) {
    // Re-read the book after the prompt in case another tab changed the quantity.
    await changeQuantity(true);
  }
}

export async function moveRoomToLibrary(roomId: number, libraryId: number) {
  return db.transaction('rw', [db.libraries, db.rooms, db.shelves, db.books], async () => {
    const room = await db.rooms.get(roomId);
    if (!room || !await db.libraries.get(libraryId)) throw new Error('The room or target library no longer exists');
    if (room.libraryId === libraryId) return;

    await db.rooms.update(roomId, { libraryId });
    await db.shelves.where('roomId').equals(roomId).modify({ libraryId });
    await db.books.where('roomId').equals(roomId).modify({ libraryId });
  });
}

export async function moveShelfToRoom(shelfId: number, roomId: number, libraryId: number) {
  return db.transaction('rw', [db.libraries, db.rooms, db.shelves, db.books], async () => {
    const shelf = await db.shelves.get(shelfId);
    const room = await db.rooms.get(roomId);
    if (!shelf || room?.libraryId !== libraryId || !await db.libraries.get(libraryId)) {
      throw new Error('The shelf or target room no longer exists');
    }
    const location = { roomId, libraryId };
    if (shelf.roomId !== roomId || shelf.libraryId !== libraryId) {
      await db.shelves.update(shelfId, location);
      await db.books.where('shelfId').equals(shelfId).modify(location);
    }
  });
}
