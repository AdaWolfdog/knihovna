import { moveBookToShelf, type Book, type Library, type Room, type Shelf } from '../db/db';
import { useLanguage } from '../i18n';
import { MoveLocationDialog, type MoveDestinationLibrary } from './MoveLocationDialog';

interface MoveBookDialogProps {
  book: Book;
  libraries: readonly Library[];
  rooms: readonly Room[];
  shelves: readonly Shelf[];
  onClose: () => void;
}

export function MoveBookDialog({ book, libraries, rooms, shelves, onClose }: MoveBookDialogProps) {
  const { language, t } = useLanguage();
  const collator = new Intl.Collator(language === 'emoji' ? 'cs' : language, { numeric: true });
  const byName = (left: { name: string }, right: { name: string }) => collator.compare(left.name, right.name);
  const shelvesByRoom = new Map<number, { id: number; libraryId: number; name: string }[]>();
  for (const { id, libraryId, roomId, name } of shelves) {
    if (id === undefined || id === book.shelfId) continue;
    const item = { id, libraryId, name };
    const options = shelvesByRoom.get(roomId);
    if (options) options.push(item);
    else shelvesByRoom.set(roomId, [item]);
  }

  const roomsByLibrary = new Map<number, MoveDestinationLibrary['rooms'][number][]>();
  for (const { id, libraryId, name } of rooms) {
    if (id === undefined) continue;
    const options = shelvesByRoom.get(id)?.filter((shelf) => shelf.libraryId === libraryId);
    if (!options?.length) continue;
    const item = { id, name, shelves: options.sort(byName) };
    const group = roomsByLibrary.get(libraryId);
    if (group) group.push(item);
    else roomsByLibrary.set(libraryId, [item]);
  }

  const destinations = libraries.flatMap(({ id, name }): MoveDestinationLibrary[] => {
    if (id === undefined) return [];
    const options = roomsByLibrary.get(id);
    return options ? [{ id, name, rooms: options.sort(byName) }] : [];
  }).sort(byName);

  return (
    <MoveLocationDialog
      kind="book"
      name={book.title || t('unknownTitle')}
      destinations={destinations}
      availableCopies={book.quantity || 1}
      onMove={async (libraryId, roomId, shelfId, quantity) => {
        if (book.id === undefined || roomId === undefined || shelfId === undefined) {
          throw new Error('A destination shelf is required');
        }
        await moveBookToShelf(book.id, book.shelfId, { libraryId, roomId, shelfId }, quantity);
      }}
      onClose={onClose}
    />
  );
}
