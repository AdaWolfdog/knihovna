import { BookCoverImage } from './BookCoverImage';
import { BookActions } from './BookActions';
import { MoveBookDialog } from './MoveBookDialog';
import { SortMenu } from './BookSortMenu';
import { MoveLocationDialog, type MoveDestinationLibrary } from './MoveLocationDialog';
import type { BookSortDirection } from '../services/bookSort';
import { BookGallery } from './BookGallery';
import { BookViewToolbar } from './BookViewToolbar';
import { useBookView } from './useBookView';
import { useMobileLandscapeTable } from './useMobileLandscapeTable';
import { DEFAULT_LIBRARY_COLOR, LIBRARY_COLORS } from './libraryColors';
import { BookQuantityControl } from './BookQuantityControl';
import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, moveRoomToLibrary, moveShelfToRoom, type Book, type Library, type Room, type Shelf } from '../db/db';
import { Plus, Trash2, Edit3, Check, X, FolderInput, Library as LibraryIcon, Folder, BookmarkCheck, ChevronRight, Eye, BookOpen, Image as ImageIcon, Smartphone } from 'lucide-react';
import { ManualBookModal } from './ManualBookModal';
import { useLanguage } from '../i18n';

type LocationGroup = 'libraries' | 'rooms' | 'shelves';
type LocationSort = { criterion: 'name' | 'quantity'; direction: BookSortDirection };
type MoveLocation = { kind: 'room'; item: Room } | { kind: 'shelf'; item: Shelf };

const locationCriteria = [
  ['name', 'bookSortTitle'],
  ['quantity', 'locationSortQuantity'],
] as const;
const defaultLocationSort: LocationSort = { criterion: 'name', direction: 'asc' };
const moveButtonClass = 'text-slate-400 hover:text-indigo-600 p-1 rounded cursor-pointer';

interface LibraryManagerProps {
  activeShelfId: number | null;
  setActiveShelfId: (id: number | null) => void;
  onSelectShelfForScanning: (shelfId: number) => void;
}

export const LibraryManager: React.FC<LibraryManagerProps> = ({
  activeShelfId,
  setActiveShelfId,
  onSelectShelfForScanning,
}) => {
  const { language, t, translateDynamic } = useLanguage();
  const isMobileLandscapeTable = useMobileLandscapeTable();
  const libraries = useLiveQuery(() => db.libraries.toArray(), []) || [];
  const rooms = useLiveQuery(() => db.rooms.toArray(), []) || [];
  const shelves = useLiveQuery(() => db.shelves.toArray(), []) || [];
  const books = useLiveQuery(() => db.books.toArray(), []) || [];

  const [requestedLibraryId, setSelectedLibraryId] = useState<number | null>(null);
  const [requestedRoomId, setSelectedRoomId] = useState<number | null>(null);

  // Form states
  const [newLibraryName, setNewLibraryName] = useState('');
  const [newLibraryColor, setNewLibraryColor] = useState<string>(DEFAULT_LIBRARY_COLOR);
  const [newRoomName, setNewRoomName] = useState('');
  const [newShelfName, setNewShelfName] = useState('');

  const [showAddLibrary, setShowAddLibrary] = useState(false);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showAddShelf, setShowAddShelf] = useState(false);

  // Edit states
  const [editingLibrary, setEditingLibrary] = useState<{ id: number; mode: 'color' | 'name' } | null>(null);
  const [editingLibraryName, setEditingLibraryName] = useState('');

  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [editingRoomName, setEditingRoomName] = useState('');

  const [editingShelfId, setEditingShelfId] = useState<number | null>(null);
  const [editingShelfName, setEditingShelfName] = useState('');

  // Book edit state
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [movingBook, setMovingBook] = useState<Book | null>(null);
  const [movingLocation, setMovingLocation] = useState<MoveLocation | null>(null);
  const [locationSort, setLocationSort] = useState<Partial<Record<LocationGroup, LocationSort>>>({});
  const locationCollator = useMemo(() => new Intl.Collator(language === 'emoji' ? 'cs' : language, { numeric: true }), [language]);
  const bookCountRules = useMemo(() => new Intl.PluralRules(language === 'emoji' ? 'cs' : language), [language]);
  const formatBookCount = (count: number) => {
    const plural = bookCountRules.select(count);
    const suffix = plural === 'one' ? 'booksCountOne' : plural === 'few' ? 'booksCountFew' : 'booksCountSuffix';
    return `${count} ${t(suffix)}`;
  };
  const copyCounts = useMemo(() => {
    const counts = { libraries: new Map<number, number>(), rooms: new Map<number, number>(), shelves: new Map<number, number>() };
    for (const book of books) {
      const quantity = book.quantity || 1;
      counts.libraries.set(book.libraryId, (counts.libraries.get(book.libraryId) ?? 0) + quantity);
      counts.rooms.set(book.roomId, (counts.rooms.get(book.roomId) ?? 0) + quantity);
      counts.shelves.set(book.shelfId, (counts.shelves.get(book.shelfId) ?? 0) + quantity);
    }
    return counts;
  }, [books]);

  const copyCount = (group: LocationGroup, id: number | undefined) => id === undefined ? 0 : copyCounts[group].get(id) ?? 0;

  const sortLocations = <Item extends { id?: number; name: string }>(group: LocationGroup, items: Item[]) => {
    const sort = locationSort[group] ?? defaultLocationSort;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...items].sort((left, right) => {
      const byName = locationCollator.compare(left.name, right.name);
      if (sort.criterion === 'name') return factor * byName;
      return factor * (copyCount(group, left.id) - copyCount(group, right.id)) || byName;
    });
  };

  const renderLocationSort = (group: LocationGroup) => {
    const sort = locationSort[group] ?? defaultLocationSort;
    const updateSort = (change: Partial<LocationSort>) => setLocationSort((current) => ({
      ...current,
      [group]: { ...(current[group] ?? defaultLocationSort), ...change },
    }));
    return (
      <SortMenu
        compact
        criteria={locationCriteria}
        criterion={sort.criterion}
        direction={sort.direction}
        onCriterionChange={(criterion) => updateSort({ criterion })}
        onDirectionChange={(direction) => updateSort({ direction })}
      />
    );
  };


  const selectedLibraryId = (libraries.find((library) => library.id === requestedLibraryId) ?? libraries[0])?.id ?? null;
  const selectedLibraryColor = libraries.find((library) => library.id === selectedLibraryId)?.color || DEFAULT_LIBRARY_COLOR;
  const filteredRooms = rooms.filter((room) => room.libraryId === selectedLibraryId);
  const selectedRoomId = (filteredRooms.find((room) => room.id === requestedRoomId) ?? filteredRooms[0])?.id ?? null;
  const filteredShelves = shelves.filter((shelf) =>
    shelf.roomId === selectedRoomId && shelf.libraryId === selectedLibraryId
  );

  // When library or room changes, if the selected context contains only 1 shelf, automatically set it as active
  React.useEffect(() => {
    if (!selectedLibraryId) return;

    if (selectedRoomId) {
      const roomShelves = shelves.filter((s) => s.roomId === selectedRoomId && s.libraryId === selectedLibraryId);
      if (roomShelves.length === 1 && activeShelfId !== roomShelves[0].id) {
        setActiveShelfId(roomShelves[0].id!);
        return;
      }
    }

    const libraryShelves = shelves.filter((s) => s.libraryId === selectedLibraryId);
    if (libraryShelves.length === 1 && activeShelfId !== libraryShelves[0].id) {
      setActiveShelfId(libraryShelves[0].id!);
    }
  }, [selectedLibraryId, selectedRoomId, shelves, activeShelfId, setActiveShelfId]);

  // Add Library
  const handleAddLibrary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLibraryName.trim()) return;
    const id = await db.libraries.add({
      name: newLibraryName.trim(),
      color: newLibraryColor,
      createdAt: new Date(),
    });
    setNewLibraryName('');
    setNewLibraryColor(DEFAULT_LIBRARY_COLOR);
    setShowAddLibrary(false);
    setSelectedLibraryId(id);
  };

  const startLibraryEdit = (library: Library, mode: 'color' | 'name') => {
    if (library.id === undefined) return;
    setEditingLibrary({ id: library.id, mode });
    if (mode === 'name') setEditingLibraryName(library.name);
  };

  const saveLibraryEdit = async (changes: Pick<Library, 'name'> | Pick<Library, 'color'>) => {
    if (!editingLibrary) return;

    await db.libraries.update(editingLibrary.id, changes);
    setEditingLibrary((current) => current === editingLibrary ? null : current);
  };

  const handleSaveLibraryName = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = editingLibraryName.trim();
    if (name) void saveLibraryEdit({ name });
  };

  // Save Room Edit
  const handleSaveRoomEdit = async (id: number) => {
    if (!editingRoomName.trim()) return;
    await db.rooms.update(id, {
      name: editingRoomName.trim(),
    });
    setEditingRoomId(null);
  };

  // Save Shelf Edit
  const handleSaveShelfEdit = async (id: number) => {
    if (!editingShelfName.trim()) return;
    await db.shelves.update(id, {
      name: editingShelfName.trim(),
    });
    setEditingShelfId(null);
  };

  // Add Room
  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim() || !selectedLibraryId) return;
    const id = await db.rooms.add({
      libraryId: selectedLibraryId,
      name: newRoomName.trim(),
      createdAt: new Date(),
    });
    setNewRoomName('');
    setShowAddRoom(false);
    setSelectedRoomId(id);
  };

  // Add Shelf
  const handleAddShelf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShelfName.trim() || !selectedRoomId || !selectedLibraryId) return;
    const shelfId = await db.transaction('rw', [db.rooms, db.shelves], async () => {
      const room = await db.rooms.get(selectedRoomId);
      if (!room) return undefined;
      return db.shelves.add({
        libraryId: room.libraryId,
        roomId: selectedRoomId,
        name: newShelfName.trim(),
        createdAt: new Date(),
      });
    });
    if (shelfId === undefined) return;
    setNewShelfName('');
    setShowAddShelf(false);
    setActiveShelfId(shelfId);
  };

  const getMoveDestinations = (location: MoveLocation): MoveDestinationLibrary[] => {
    const roomsByLibrary = new Map<number, { id: number; name: string }[]>();
    if (location.kind === 'shelf') {
      for (const room of rooms) {
        if (room.id === undefined || room.id === location.item.roomId) continue;
        const option = { id: room.id, name: room.name };
        const options = roomsByLibrary.get(room.libraryId);
        if (options) options.push(option);
        else roomsByLibrary.set(room.libraryId, [option]);
      }
    }

    const byName = (left: { name: string }, right: { name: string }) => locationCollator.compare(left.name, right.name);
    return libraries.flatMap((library) => {
      if (library.id === undefined) return [];
      const roomOptions = roomsByLibrary.get(library.id) ?? [];
      const canMoveHere = location.kind === 'room' ? library.id !== location.item.libraryId : roomOptions.length > 0;
      return canMoveHere ? [{ id: library.id, name: library.name, rooms: roomOptions.sort(byName) }] : [];
    }).sort(byName);
  };

  const moveLocation = async (location: MoveLocation, libraryId: number, roomId?: number) => {
    const id = location.item.id;
    if (id === undefined) return;
    if (location.kind === 'room') {
      await moveRoomToLibrary(id, libraryId);
      setSelectedLibraryId(libraryId);
      setSelectedRoomId(id);
    } else if (roomId !== undefined) {
      await moveShelfToRoom(id, roomId, libraryId);
      setSelectedLibraryId(libraryId);
      setSelectedRoomId(roomId);
      setActiveShelfId(id);
    }
  };

  // Delete handlers
  const handleDeleteLibrary = async (id: number) => {
    if (confirm(t('confirmDeleteLibrary'))) {
      await db.transaction('rw', [db.libraries, db.rooms, db.shelves, db.books], async () => {
        await db.libraries.delete(id);
        await db.rooms.where('libraryId').equals(id).delete();
        await db.shelves.where('libraryId').equals(id).delete();
        await db.books.where('libraryId').equals(id).delete();
      });
    }
  };

  const handleDeleteRoom = async (id: number) => {
    if (confirm(t('confirmDeleteRoom'))) {
      await db.transaction('rw', [db.rooms, db.shelves, db.books], async () => {
        await db.rooms.delete(id);
        await db.shelves.where('roomId').equals(id).delete();
        await db.books.where('roomId').equals(id).delete();
      });
    }
  };

  const handleDeleteShelf = async (id: number) => {
    if (confirm(t('confirmDeleteShelf'))) {
      await db.transaction('rw', [db.shelves, db.books], async () => {
        await db.shelves.delete(id);
        await db.books.where('shelfId').equals(id).delete();
      });
    }
  };

  // Book actions in shelf
  const handleDeleteBook = async (id: number) => {
    if (confirm(t('confirmDeleteBook'))) {
      await db.books.delete(id);
    }
  };

  const handleSaveEditedBook = async (updatedFields: {
    isbn: string;
    title: string;
    author: string;
    publishedYear: string;
    translator?: string;
    illustrator?: string;
    editionNumber?: string;
    quantity: number;
    notes?: string;
    genre?: string;
    keywords?: string;
    coverUrl?: string;
  }) => {
    if (editingBook && editingBook.id) {
      await db.books.update(editingBook.id, updatedFields);
      setEditingBook(null);
    }
  };

  // Books in active shelf
  const activeShelf = shelves.find((s) => s.id === activeShelfId);
  const activeShelfBooks = useMemo(
    () => activeShelf ? books.filter((book) => book.shelfId === activeShelf.id) : [],
    [books, activeShelf],
  );
  const bookView = useBookView(activeShelfBooks);
  const { view, sortedBooks } = bookView;
  const activeShelfRoom = activeShelf ? rooms.find((r) => r.id === activeShelf.roomId) : null;
  const activeShelfLibrary = activeShelf ? libraries.find((l) => l.id === activeShelf.libraryId) : null;

  const renderBookActions = (book: Book) => (
    <BookActions
      book={book}
      onMove={book.id === undefined ? undefined : () => setMovingBook(book)}
      onEdit={() => setEditingBook(book)}
      onDelete={() => handleDeleteBook(book.id!)}
    />
  );

  const actionsHeader = <th key="actions" className="p-3 text-right">{t('thActions')}</th>;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Step Info Banner */}
      <div className="bg-indigo-50 border-l-4 border-indigo-600 p-4 rounded-r-lg">
        <h2 className="text-lg font-bold text-indigo-900 mb-1">
          {t('libraryManagerBannerTitle')}
        </h2>
        <p className="text-sm text-indigo-700">
          {t('libraryManagerBannerDesc')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* COLUMN 1: Virtuální knihovny */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col">
          <div className="relative mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <h3 className="flex min-w-0 items-center gap-2 font-semibold text-slate-800">
              <LibraryIcon className="size-5 shrink-0 text-indigo-600" />
              <span className="min-w-0 [overflow-wrap:anywhere]">{t('col1Title')}</span>
            </h3>
            <div className="flex shrink-0 items-center gap-1.5">
              {renderLocationSort('libraries')}
              <button
                onClick={() => setShowAddLibrary(!showAddLibrary)}
                className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition cursor-pointer"
                title={t('addLibraryTitle')}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {showAddLibrary && (
            <form onSubmit={handleAddLibrary} className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <input
                type="text"
                placeholder={t('libraryNamePlaceholder')}
                value={newLibraryName}
                onChange={(e) => setNewLibraryName(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                autoFocus
              />
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  {t('libraryColorLabel')}
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {LIBRARY_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setNewLibraryColor(c.value)}
                      aria-pressed={newLibraryColor === c.value}
                      className={`w-6 h-6 rounded-full border-2 transition cursor-pointer ${
                        newLibraryColor === c.value ? 'border-slate-800 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 py-1 px-3 bg-indigo-600 text-on-accent text-xs font-medium rounded-lg hover:bg-indigo-700 cursor-pointer"
                >
                  {t('saveBtn')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddLibrary(false)}
                  className="py-1 px-3 bg-slate-100 text-slate-600 text-xs rounded-lg hover:bg-slate-200 cursor-pointer"
                >
                  {t('cancelBtn')}
                </button>
              </div>
            </form>
          )}

          <div className="space-y-1.5 overflow-y-auto max-h-80 flex-1">
            {libraries.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                {t('noLibrariesYet')}
              </p>
            ) : (
              sortLocations('libraries', libraries).map((lib) => {
                const count = copyCount('libraries', lib.id);
                const isSelected = selectedLibraryId === lib.id;
                const isEditing = editingLibrary && editingLibrary.id === lib.id;
                const libColor = lib.color || DEFAULT_LIBRARY_COLOR;

                if (isEditing && editingLibrary.mode === 'color') {
                  return (
                    <div key={lib.id} className="p-2 bg-indigo-50 border border-indigo-300 rounded-lg space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold">{lib.name}</span>
                        <button
                          type="button"
                          onClick={() => setEditingLibrary(null)}
                          className="p-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 cursor-pointer"
                          title={t('cancelBtn')}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {LIBRARY_COLORS.map((c, index) => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => void saveLibraryEdit({ color: c.value })}
                            aria-pressed={libColor === c.value}
                            title={c.name}
                            autoFocus={index === 0}
                            className={`w-5 h-5 rounded-full border-2 transition cursor-pointer ${
                              libColor === c.value ? 'border-slate-800 scale-110' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: c.value }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                }

                if (isEditing) {
                  return (
                    <form key={lib.id} onSubmit={handleSaveLibraryName} className="flex items-center gap-2 p-2 bg-indigo-50 border border-indigo-300 rounded-lg">
                      <input
                        type="text"
                        value={editingLibraryName}
                        onChange={(e) => setEditingLibraryName(e.target.value)}
                        aria-label={t('libraryNamePlaceholder')}
                        className="min-w-0 flex-1 px-2 py-1 text-xs border border-slate-300 rounded outline-none"
                        autoFocus
                        required
                      />
                      <button
                        type="submit"
                        className="p-1 bg-emerald-600 text-on-accent rounded hover:bg-emerald-700 cursor-pointer"
                        title={t('saveBtn')}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingLibrary(null)}
                        className="p-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 cursor-pointer"
                        title={t('cancelBtn')}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  );
                }

                return (
                  <div
                    key={lib.id}
                    onClick={() => setSelectedLibraryId(lib.id!)}
                    className={`flex items-center justify-between p-2.5 rounded-lg text-sm cursor-pointer transition ${
                      isSelected
                        ? 'bg-indigo-50 border border-indigo-300 text-indigo-900 font-medium'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          startLibraryEdit(lib, 'color');
                        }}
                        title={t('changeLibraryColor')}
                        aria-label={`${t('changeLibraryColor')} · ${lib.name}`}
                        className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
                      >
                        <span
                          className="size-3.5 rounded-full border border-black/10"
                          style={{ backgroundColor: libColor }}
                        />
                      </button>
                      <span className="truncate">{lib.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {formatBookCount(count)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startLibraryEdit(lib, 'name');
                        }}
                        className="text-slate-400 hover:text-indigo-600 p-1 rounded cursor-pointer"
                        title={t('editLibraryTooltip')}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLibrary(lib.id!);
                        }}
                        className="text-slate-400 hover:text-red-600 p-1 rounded cursor-pointer"
                        title={t('deleteLibraryTooltip')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUMN 2: Místnosti */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col">
          <div className="relative mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <h3 className="flex min-w-0 items-center gap-2 font-semibold text-slate-800">
              <Folder className="size-5 shrink-0 text-indigo-600" />
              <span className="min-w-0 [overflow-wrap:anywhere]">{t('col2Title')}</span>
            </h3>
            <div className="flex shrink-0 items-center gap-1.5">
              {selectedLibraryId && renderLocationSort('rooms')}
              {selectedLibraryId && (
                <button
                  onClick={() => setShowAddRoom(!showAddRoom)}
                  className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition cursor-pointer"
                  title={t('addRoomTitle')}
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {showAddRoom && selectedLibraryId && (
            <form onSubmit={handleAddRoom} className="mb-3 space-y-2">
              <input
                type="text"
                placeholder={t('roomNamePlaceholder')}
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-1 px-3 bg-indigo-600 text-on-accent text-xs font-medium rounded-lg hover:bg-indigo-700 cursor-pointer"
                >
                  {t('saveBtn')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddRoom(false)}
                  className="py-1 px-3 bg-slate-100 text-slate-600 text-xs rounded-lg hover:bg-slate-200 cursor-pointer"
                >
                  {t('cancelBtn')}
                </button>
              </div>
            </form>
          )}

          <div className="space-y-1.5 overflow-y-auto max-h-80 flex-1">
            {!selectedLibraryId ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                {t('selectLibraryFirst')}
              </p>
            ) : filteredRooms.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                {t('noRoomsYet')}
              </p>
            ) : (
              sortLocations('rooms', filteredRooms).map((room) => {
                const count = copyCount('rooms', room.id);
                const isSelected = selectedRoomId === room.id;
                const isEditing = editingRoomId === room.id;

                if (isEditing) {
                  return (
                    <div key={room.id} className="p-2 bg-indigo-50 border border-indigo-300 rounded-lg flex items-center gap-2">
                      <input
                        type="text"
                        value={editingRoomName}
                        onChange={(e) => setEditingRoomName(e.target.value)}
                        className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveRoomEdit(room.id!)}
                        className="p-1 bg-emerald-600 text-on-accent rounded hover:bg-emerald-700 cursor-pointer"
                        title={t('saveBtn')}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingRoomId(null)}
                        className="p-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 cursor-pointer"
                        title={t('cancelBtn')}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id!)}
                    className={`flex items-center justify-between p-2.5 rounded-lg text-sm cursor-pointer transition ${
                      isSelected
                        ? 'bg-indigo-50 border border-indigo-300 text-indigo-900 font-medium'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Folder className="size-4 shrink-0" style={{ color: selectedLibraryColor }} aria-hidden="true" />
                      <span className="truncate">{room.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {formatBookCount(count)}
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setMovingLocation({ kind: 'room', item: room });
                        }}
                        className={moveButtonClass}
                        title={t('moveRoomTooltip')}
                        aria-label={t('moveRoomTooltip')}
                      >
                        <FolderInput className="size-3.5" aria-hidden="true" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingRoomId(room.id!);
                          setEditingRoomName(room.name);
                        }}
                        className="text-slate-400 hover:text-indigo-600 p-1 rounded cursor-pointer"
                        title={t('editRoomTooltip')}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRoom(room.id!);
                        }}
                        className="text-slate-400 hover:text-red-600 p-1 rounded cursor-pointer"
                        title={t('deleteRoomTooltip')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUMN 3: Police */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col">
          <div className="relative mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <h3 className="flex min-w-0 items-center gap-2 font-semibold text-slate-800">
              <BookmarkCheck className="size-5 shrink-0 text-indigo-600" />
              <span className="min-w-0 [overflow-wrap:anywhere]">{t('col3Title')}</span>
            </h3>
            <div className="flex shrink-0 items-center gap-1.5">
              {selectedRoomId && renderLocationSort('shelves')}
              {selectedRoomId && (
                <button
                  onClick={() => setShowAddShelf(!showAddShelf)}
                  className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition cursor-pointer"
                  title={t('addShelfTitle')}
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {showAddShelf && selectedRoomId && (
            <form onSubmit={handleAddShelf} className="mb-3 space-y-2">
              <input
                type="text"
                placeholder={t('shelfNamePlaceholder')}
                value={newShelfName}
                onChange={(e) => setNewShelfName(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-1 px-3 bg-indigo-600 text-on-accent text-xs font-medium rounded-lg hover:bg-indigo-700 cursor-pointer"
                >
                  {t('saveBtn')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddShelf(false)}
                  className="py-1 px-3 bg-slate-100 text-slate-600 text-xs rounded-lg hover:bg-slate-200 cursor-pointer"
                >
                  {t('cancelBtn')}
                </button>
              </div>
            </form>
          )}

          <div className="space-y-1.5 overflow-y-auto max-h-80 flex-1">
            {!selectedRoomId ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                {t('selectRoomFirst')}
              </p>
            ) : filteredShelves.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                {t('noShelvesYet')}
              </p>
            ) : (
              sortLocations('shelves', filteredShelves).map((shelf) => {
                const count = copyCount('shelves', shelf.id);
                const isActive = activeShelfId === shelf.id;
                const isEditing = editingShelfId === shelf.id;

                if (isEditing) {
                  return (
                    <div key={shelf.id} className="p-2 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center gap-2">
                      <input
                        type="text"
                        value={editingShelfName}
                        onChange={(e) => setEditingShelfName(e.target.value)}
                        className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveShelfEdit(shelf.id!)}
                        className="p-1 bg-emerald-600 text-on-accent rounded hover:bg-emerald-700 cursor-pointer"
                        title={t('saveBtn')}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingShelfId(null)}
                        className="p-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 cursor-pointer"
                        title={t('cancelBtn')}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={shelf.id}
                    className={`flex flex-wrap items-center justify-between gap-1 p-2.5 rounded-lg text-sm transition ${
                      isActive
                        ? 'bg-emerald-50 border-2 border-emerald-500 text-emerald-900 font-semibold'
                        : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <BookmarkCheck className="size-4 shrink-0" style={{ color: selectedLibraryColor }} aria-hidden="true" />
                      <button
                        type="button"
                        onClick={() => setActiveShelfId(shelf.id!)}
                        className="text-left truncate font-inherit hover:underline cursor-pointer"
                        title={t('clickToViewBooksTooltip')}
                      >
                        {shelf.name}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveShelfId(shelf.id!)}
                        className={`text-xs px-2 py-0.5 rounded-full border transition cursor-pointer flex items-center gap-1 ${
                          isActive
                            ? 'bg-emerald-600 text-on-accent border-emerald-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'
                        }`}
                        title={t('clickToViewBooksTooltip')}
                      >
                        <Eye className="w-3 h-3" />
                        <span>{formatBookCount(count)}</span>
                      </button>

                      {isActive ? (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                          {t('activeBadge')}
                        </span>
                      ) : (
                        <button
                          onClick={() => onSelectShelfForScanning(shelf.id!)}
                          className="flex items-center gap-1 text-xs bg-indigo-600 text-on-accent px-2 py-1 rounded hover:bg-indigo-700 font-medium transition cursor-pointer"
                          title={t('setTargetAndScanTooltip')}
                        >
                          {t('selectShelfForScanBtn')} <ChevronRight className="w-3 h-3" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setMovingLocation({ kind: 'shelf', item: shelf });
                        }}
                        className={moveButtonClass}
                        title={t('moveShelfTooltip')}
                        aria-label={t('moveShelfTooltip')}
                      >
                        <FolderInput className="size-3.5" aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingShelfId(shelf.id!);
                          setEditingShelfName(shelf.name);
                        }}
                        className="text-slate-400 hover:text-indigo-600 p-1 rounded cursor-pointer"
                        title={t('editShelfTooltip')}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteShelf(shelf.id!)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded cursor-pointer"
                        title={t('deleteShelfTooltip')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* DEDICATED SECTION: Knihy v aktivní polici */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200" data-testid="shelf-books-section">
        <div className="rounded-t-2xl p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">
                {activeShelf ? (
                  <>{t('shelfBooksSectionTitle')} <span className="text-indigo-600">{activeShelf.name}</span></>
                ) : (
                  t('shelfBooksSectionDefaultTitle')
                )}
              </h3>
            </div>
            {activeShelf && (
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: activeShelfLibrary?.color || DEFAULT_LIBRARY_COLOR }}
                />
                <span>{activeShelfLibrary?.name || '?'}</span>
                <span>&rarr;</span>
                <span>{activeShelfRoom?.name || '?'}</span>
                <span>&rarr;</span>
                <span className="font-medium text-slate-700">{activeShelf.name}</span>
                <span className="text-slate-400">({activeShelfBooks.length} {t('titlesCountSuffix')} / {activeShelfBooks.reduce((sum, b) => sum + (b.quantity || 1), 0)} {t('piecesSuffix')})</span>
              </p>
            )}
          </div>

          {activeShelf && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onSelectShelfForScanning(activeShelf.id!)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-on-accent rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <span>{t('scanToThisShelfBtn')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {activeShelf && (
          <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
            <BookViewToolbar {...bookView} />
          </div>
        )}

        {!activeShelf ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            {t('noShelfSelectedTableNotice')}
          </div>
        ) : activeShelfBooks.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            {t('noBooksInShelfTableNotice')}
          </div>
        ) : view === 'gallery' ? (
          <div className="p-4 sm:p-5">
            <BookGallery
              sortedBooks={sortedBooks}
              isMobileLandscapeTable={isMobileLandscapeTable}
              getLibraryColor={() => activeShelfLibrary?.color}
              renderBookActions={renderBookActions}
            />
          </div>
        ) : (
          <div>
            {/* Decent mobile orientation banner */}
            <div className="mobile-portrait-info-banner hidden items-center gap-2 bg-slate-50 border-b border-slate-200 px-4 py-2 text-xs text-slate-600">
              <Smartphone className="w-4 h-4 text-indigo-500 rotate-90 shrink-0" />
              <span>{t('orientationHint')}</span>
            </div>

            <div className="relative overflow-x-auto rounded-b-2xl">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold">
                  <tr>
                    <th className="p-3 w-14 text-center mobile-portrait-hidden">{t('thCover')}</th>
                    <th className="p-3">{t('thTitleAuthor')}</th>
                    <th className="p-3 mobile-portrait-hidden">
                      <span className="mobile-landscape-hidden">{t('thGenreKeywords')}</span>
                      <span className="hidden mobile-landscape-only">
                        {translateDynamic(t('formLabelGenre'))}<br />
                        {translateDynamic(t('formLabelKeywords'))}
                      </span>
                    </th>
                    {isMobileLandscapeTable && actionsHeader}
                    <th className="p-3 mobile-portrait-hidden mobile-landscape-hidden">{t('thIsbn')}</th>
                    <th className="p-3 text-center mobile-portrait-hidden mobile-landscape-hidden">{t('thQuantity')}</th>
                    <th className="p-3 mobile-portrait-hidden">
                      <span className="mobile-landscape-hidden">{t('thYearEdition')}</span>
                      <span className="hidden mobile-landscape-only">{t('thEditionIsbnLandscape')}</span>
                    </th>
                    {!isMobileLandscapeTable && actionsHeader}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedBooks.map((book) => {
                    const actionsCell = (
                      <td key="actions" className="p-3 text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          <BookQuantityControl book={book} compact="portrait" />

                          {renderBookActions(book)}
                          <BookQuantityControl book={book} compact="landscape" />
                        </div>
                      </td>
                    );

                    return (
                      <tr key={book.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 text-center mobile-portrait-hidden">
                          <BookCoverImage
                            src={book.coverUrl}
                            alt={book.title}
                            className="w-10 h-14 object-cover rounded-md border border-slate-200 shadow-xs mx-auto bg-slate-200"
                            fallback={
                              <div className="w-10 h-14 bg-slate-100 border border-slate-200 rounded-md flex items-center justify-center text-slate-400 mx-auto">
                                <ImageIcon className="w-5 h-5 stroke-1" />
                              </div>
                            }
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-start gap-1.5 font-bold text-slate-900 text-sm">
                            <BookOpen className="mt-0.5 size-4 shrink-0" style={{ color: activeShelfLibrary?.color || DEFAULT_LIBRARY_COLOR }} aria-hidden="true" />
                            <span>{book.title || t('unknownTitle')}</span>
                          </div>
                          <div className="text-slate-500">{book.author || t('unknownAuthor')}</div>
                          {book.translator && (
                            <div className="text-[11px] text-slate-400 mobile-landscape-hidden">
                              {t('translationPrefix')}
                              {book.illustrator && (
                                <div>{t('illustrationPrefix')} {book.illustrator}</div>
                              )}{' '}{book.translator}
                            </div>
                          )}
                        </td>
                        <td className="p-3 max-w-[180px] mobile-portrait-hidden">
                          {book.genre ? (
                            <span className="inline-block bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded text-[11px] mb-1">
                              {book.genre}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic block mb-1">{t('noGenre')}</span>
                          )}
                          {book.keywords && (
                            <div className="text-[11px] text-slate-500 truncate" title={book.keywords}>
                              {book.keywords}
                            </div>
                          )}
                        </td>
                        {isMobileLandscapeTable && actionsCell}
                        <td className="p-3 font-mono text-slate-600 mobile-portrait-hidden mobile-landscape-hidden">
                          {book.isbn || <span className="text-slate-400 italic">{t('noIsbnText')}</span>}
                        </td>
                        <td className="p-3 text-center mobile-portrait-hidden mobile-landscape-hidden">
                          <BookQuantityControl book={book} />
                        </td>
                        <td className="p-3 mobile-portrait-hidden">
                          <div>{book.publishedYear || '-'}</div>
                          {book.editionNumber && (
                            <div className="text-[10px] text-slate-400">{book.editionNumber}</div>
                          )}
                          <div className="hidden mobile-landscape-only font-mono text-slate-600">
                            {book.isbn || <span className="text-slate-400 italic">{t('noIsbnText')}</span>}
                          </div>
                        </td>
                        {!isMobileLandscapeTable && actionsCell}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {movingLocation && (
        <MoveLocationDialog
          kind={movingLocation.kind}
          name={movingLocation.item.name}
          destinations={getMoveDestinations(movingLocation)}
          onMove={(libraryId, roomId) => moveLocation(movingLocation, libraryId, roomId)}
          onClose={() => setMovingLocation(null)}
        />
      )}

      {movingBook && (
        <MoveBookDialog
          book={movingBook}
          libraries={libraries}
          rooms={rooms}
          shelves={shelves}
          onClose={() => setMovingBook(null)}
        />
      )}

      {/* EDIT BOOK MODAL */}
      {editingBook && (
        <ManualBookModal
          initialData={editingBook}
          shelfName={activeShelf?.name || ''}
          onSave={handleSaveEditedBook}
          onClose={() => setEditingBook(null)}
        />
      )}
    </div>
  );
};
