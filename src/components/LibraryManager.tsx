import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Plus, Trash2, Edit3, Check, X, Library as LibraryIcon, Folder, BookmarkCheck, ChevronRight, Eye, BookOpen, Image as ImageIcon } from 'lucide-react';
import { type Book } from '../db/db';
import { ManualBookModal } from './ManualBookModal';

interface LibraryManagerProps {
  activeShelfId: number | null;
  setActiveShelfId: (id: number | null) => void;
  onSelectShelfForScanning: (shelfId: number) => void;
}

const PRESET_COLORS = [
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Smaragdová', value: '#10b981' },
  { name: 'Jantarová', value: '#f59e0b' },
  { name: 'Červená', value: '#f43f5e' },
  { name: 'Fialová', value: '#a855f7' },
  { name: 'Modrá', value: '#0284c7' },
  { name: 'Tyrkysová', value: '#14b8a6' },
  { name: 'Šedá', value: '#64748b' },
];

export const LibraryManager: React.FC<LibraryManagerProps> = ({
  activeShelfId,
  setActiveShelfId,
  onSelectShelfForScanning,
}) => {
  const libraries = useLiveQuery(() => db.libraries.toArray(), []) || [];
  const rooms = useLiveQuery(() => db.rooms.toArray(), []) || [];
  const shelves = useLiveQuery(() => db.shelves.toArray(), []) || [];
  const books = useLiveQuery(() => db.books.toArray(), []) || [];

  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);

  // Form states
  const [newLibraryName, setNewLibraryName] = useState('');
  const [newLibraryColor, setNewLibraryColor] = useState('#6366f1');
  const [newRoomName, setNewRoomName] = useState('');
  const [newShelfName, setNewShelfName] = useState('');

  const [showAddLibrary, setShowAddLibrary] = useState(false);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showAddShelf, setShowAddShelf] = useState(false);

  // Edit states
  const [editingLibraryId, setEditingLibraryId] = useState<number | null>(null);
  const [editingLibraryName, setEditingLibraryName] = useState('');
  const [editingLibraryColor, setEditingLibraryColor] = useState('#6366f1');

  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [editingRoomName, setEditingRoomName] = useState('');

  const [editingShelfId, setEditingShelfId] = useState<number | null>(null);
  const [editingShelfName, setEditingShelfName] = useState('');

  // Book edit state
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  // Auto-select first library if none selected
  React.useEffect(() => {
    if (libraries.length > 0 && !selectedLibraryId) {
      setSelectedLibraryId(libraries[0].id!);
    }
  }, [libraries, selectedLibraryId]);

  // Auto-select first room if library changed or room not selected
  React.useEffect(() => {
    if (selectedLibraryId) {
      const roomList = rooms.filter((r) => r.libraryId === selectedLibraryId);
      if (roomList.length > 0 && (!selectedRoomId || !roomList.some((r) => r.id === selectedRoomId))) {
        setSelectedRoomId(roomList[0].id!);
      }
    }
  }, [selectedLibraryId, rooms, selectedRoomId]);

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
    setNewLibraryColor('#6366f1');
    setShowAddLibrary(false);
    setSelectedLibraryId(id);
  };

  // Save Library Edit
  const handleSaveLibraryEdit = async (id: number) => {
    if (!editingLibraryName.trim()) return;
    await db.libraries.update(id, {
      name: editingLibraryName.trim(),
      color: editingLibraryColor,
    });
    setEditingLibraryId(null);
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
    const shelfId = await db.shelves.add({
      libraryId: selectedLibraryId,
      roomId: selectedRoomId,
      name: newShelfName.trim(),
      createdAt: new Date(),
    });
    setNewShelfName('');
    setShowAddShelf(false);
    setActiveShelfId(shelfId);
  };

  // Delete handlers
  const handleDeleteLibrary = async (id: number) => {
    if (confirm('Opravdu chcete smazat tuto virtuální knihovnu včetně všech místností, polic a knih?')) {
      await db.transaction('rw', [db.libraries, db.rooms, db.shelves, db.books], async () => {
        await db.libraries.delete(id);
        await db.rooms.where('libraryId').equals(id).delete();
        await db.shelves.where('libraryId').equals(id).delete();
        await db.books.where('libraryId').equals(id).delete();
      });
      if (selectedLibraryId === id) setSelectedLibraryId(null);
    }
  };

  const handleDeleteRoom = async (id: number) => {
    if (confirm('Opravdu chcete smazat tuto místnost a všechny její police a knihy?')) {
      await db.transaction('rw', [db.rooms, db.shelves, db.books], async () => {
        await db.rooms.delete(id);
        await db.shelves.where('roomId').equals(id).delete();
        await db.books.where('roomId').equals(id).delete();
      });
      if (selectedRoomId === id) setSelectedRoomId(null);
    }
  };

  const handleDeleteShelf = async (id: number) => {
    if (confirm('Opravdu chcete smazat tuto polici a všechny knihy v ní?')) {
      await db.transaction('rw', [db.shelves, db.books], async () => {
        await db.shelves.delete(id);
        await db.books.where('shelfId').equals(id).delete();
      });
      if (activeShelfId === id) setActiveShelfId(null);
    }
  };

  // Book actions in shelf
  const handleDeleteBook = async (id: number) => {
    if (confirm('Opravdu chcete smazat tento záznam o knize z police?')) {
      await db.books.delete(id);
    }
  };

  const handleUpdateQuantity = async (bookId: number, delta: number) => {
    const book = books.find((b) => b.id === bookId);
    if (!book) return;
    const newQty = (book.quantity || 1) + delta;
    if (newQty <= 0) {
      if (confirm('Chcete tuto knihu zcela odstranit ze seznamu?')) {
        await db.books.delete(bookId);
      }
    } else {
      await db.books.update(bookId, { quantity: newQty });
    }
  };

  const handleSaveEditedBook = async (updatedFields: {
    isbn: string;
    title: string;
    author: string;
    publishedYear: string;
    translator?: string;
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

  const filteredRooms = rooms.filter((r) => r.libraryId === selectedLibraryId);
  const filteredShelves = shelves.filter((s) => s.roomId === selectedRoomId);

  // Books in active shelf
  const activeShelf = shelves.find((s) => s.id === activeShelfId);
  const activeShelfBooks = activeShelfId
    ? books.filter((b) => b.shelfId === activeShelfId)
    : [];
  const activeShelfRoom = activeShelf ? rooms.find((r) => r.id === activeShelf.roomId) : null;
  const activeShelfLibrary = activeShelf ? libraries.find((l) => l.id === activeShelf.libraryId) : null;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Step Info Banner */}
      <div className="bg-indigo-50 border-l-4 border-indigo-600 p-4 rounded-r-lg">
        <h2 className="text-lg font-bold text-indigo-900 mb-1">
          Správa knihoven, místností a polic
        </h2>
        <p className="text-sm text-indigo-700">
          Zde si můžete uspořádat vaši virtuální knihovnu. Před zahájením skenování si vyberte
          <strong> cíl (polici)</strong>, na kterou se naskenované knihy automaticky uloží.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* COLUMN 1: Virtuální knihovny */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <LibraryIcon className="w-5 h-5 text-indigo-600" />
              1. Virtuální knihovny
            </h3>
            <button
              onClick={() => setShowAddLibrary(!showAddLibrary)}
              className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition"
              title="Přidat knihovnu"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {showAddLibrary && (
            <form onSubmit={handleAddLibrary} className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <input
                type="text"
                placeholder="Název knihovny (např. Hlavní)"
                value={newLibraryName}
                onChange={(e) => setNewLibraryName(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                autoFocus
              />
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Barva knihovny:
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setNewLibraryColor(c.value)}
                      className={`w-6 h-6 rounded-full border-2 transition ${
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
                  className="flex-1 py-1 px-3 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700"
                >
                  Uložit
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddLibrary(false)}
                  className="py-1 px-3 bg-slate-100 text-slate-600 text-xs rounded-lg hover:bg-slate-200"
                >
                  Zrušit
                </button>
              </div>
            </form>
          )}

          <div className="space-y-1.5 overflow-y-auto max-h-80 flex-1">
            {libraries.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                Zatím nemáte vytvořenou žádnou knihovnu.
              </p>
            ) : (
              libraries.map((lib) => {
                const count = books.filter((b) => b.libraryId === lib.id).length;
                const isSelected = selectedLibraryId === lib.id;
                const isEditing = editingLibraryId === lib.id;
                const libColor = lib.color || '#6366f1';

                if (isEditing) {
                  return (
                    <div key={lib.id} className="p-2 bg-indigo-50 border border-indigo-300 rounded-lg space-y-2">
                      <input
                        type="text"
                        value={editingLibraryName}
                        onChange={(e) => setEditingLibraryName(e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded outline-none"
                        autoFocus
                      />
                      <div className="flex items-center gap-1 flex-wrap">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => setEditingLibraryColor(c.value)}
                            className={`w-5 h-5 rounded-full border-2 transition ${
                              editingLibraryColor === c.value ? 'border-slate-800 scale-110' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: c.value }}
                          />
                        ))}
                      </div>
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleSaveLibraryEdit(lib.id!)}
                          className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                          title="Uložit"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingLibraryId(null)}
                          className="p-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                          title="Zrušit"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
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
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 inline-block border border-black/10"
                        style={{ backgroundColor: libColor }}
                      />
                      <span className="truncate">{lib.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {count} knih
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingLibraryId(lib.id!);
                          setEditingLibraryName(lib.name);
                          setEditingLibraryColor(libColor);
                        }}
                        className="text-slate-400 hover:text-indigo-600 p-1 rounded cursor-pointer"
                        title="Upravit knihovnu"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLibrary(lib.id!);
                        }}
                        className="text-slate-400 hover:text-red-600 p-1 rounded cursor-pointer"
                        title="Smazat knihovnu"
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
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Folder className="w-5 h-5 text-indigo-600" />
              2. Místnosti
            </h3>
            {selectedLibraryId && (
              <button
                onClick={() => setShowAddRoom(!showAddRoom)}
                className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition"
                title="Přidat místnost"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          {showAddRoom && selectedLibraryId && (
            <form onSubmit={handleAddRoom} className="mb-3 space-y-2">
              <input
                type="text"
                placeholder="Název místnosti (např. Studovna)"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-1 px-3 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700"
                >
                  Uložit
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddRoom(false)}
                  className="py-1 px-3 bg-slate-100 text-slate-600 text-xs rounded-lg hover:bg-slate-200"
                >
                  Zrušit
                </button>
              </div>
            </form>
          )}

          <div className="space-y-1.5 overflow-y-auto max-h-80 flex-1">
            {!selectedLibraryId ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                Nejprve vyberte nebo vytvořte knihovnu.
              </p>
            ) : filteredRooms.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                V této knihovně zatím nemáte žádnou místnost.
              </p>
            ) : (
              filteredRooms.map((room) => {
                const count = books.filter((b) => b.roomId === room.id).length;
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
                        className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                        title="Uložit"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingRoomId(null)}
                        className="p-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                        title="Zrušit"
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
                      <Folder className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span className="truncate">{room.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {count} knih
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingRoomId(room.id!);
                          setEditingRoomName(room.name);
                        }}
                        className="text-slate-400 hover:text-indigo-600 p-1 rounded cursor-pointer"
                        title="Upravit místnost"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRoom(room.id!);
                        }}
                        className="text-slate-400 hover:text-red-600 p-1 rounded cursor-pointer"
                        title="Smazat místnost"
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
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <BookmarkCheck className="w-5 h-5 text-indigo-600" />
              3. Cílová police
            </h3>
            {selectedRoomId && (
              <button
                onClick={() => setShowAddShelf(!showAddShelf)}
                className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition"
                title="Přidat polici"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          {showAddShelf && selectedRoomId && (
            <form onSubmit={handleAddShelf} className="mb-3 space-y-2">
              <input
                type="text"
                placeholder="Název police (např. A1 - Historie)"
                value={newShelfName}
                onChange={(e) => setNewShelfName(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-1 px-3 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700"
                >
                  Uložit
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddShelf(false)}
                  className="py-1 px-3 bg-slate-100 text-slate-600 text-xs rounded-lg hover:bg-slate-200"
                >
                  Zrušit
                </button>
              </div>
            </form>
          )}

          <div className="space-y-1.5 overflow-y-auto max-h-80 flex-1">
            {!selectedRoomId ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                Nejprve vyberte nebo vytvořte místnost.
              </p>
            ) : filteredShelves.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                V této místnosti zatím nemáte žádnou polici.
              </p>
            ) : (
              filteredShelves.map((shelf) => {
                const count = books.filter((b) => b.shelfId === shelf.id).length;
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
                        className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                        title="Uložit"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingShelfId(null)}
                        className="p-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                        title="Zrušit"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={shelf.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg text-sm transition ${
                      isActive
                        ? 'bg-emerald-50 border-2 border-emerald-500 text-emerald-900 font-semibold'
                        : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <BookmarkCheck
                        className={`w-4 h-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setActiveShelfId(shelf.id!)}
                        className="text-left truncate font-inherit hover:underline cursor-pointer"
                        title="Kliknutím zobrazíte knihy v polici"
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
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'
                        }`}
                        title="Kliknutím zobrazíte knihy v polici"
                      >
                        <Eye className="w-3 h-3" />
                        <span>{count} knih</span>
                      </button>

                      {isActive ? (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                          Aktivní
                        </span>
                      ) : (
                        <button
                          onClick={() => onSelectShelfForScanning(shelf.id!)}
                          className="flex items-center gap-1 text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 font-medium transition cursor-pointer"
                          title="Nastavit jako aktivní cíl a přejít ke skenování"
                        >
                          Vybrat <ChevronRight className="w-3 h-3" />
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setEditingShelfId(shelf.id!);
                          setEditingShelfName(shelf.name);
                        }}
                        className="text-slate-400 hover:text-indigo-600 p-1 rounded cursor-pointer"
                        title="Upravit polici"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteShelf(shelf.id!)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded cursor-pointer"
                        title="Smazat polici"
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
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" data-testid="shelf-books-section">
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">
                {activeShelf ? (
                  <>Knihy v polici: <span className="text-indigo-600">{activeShelf.name}</span></>
                ) : (
                  'Knihy ve vybrané polici'
                )}
              </h3>
            </div>
            {activeShelf && (
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: activeShelfLibrary?.color || '#6366f1' }}
                />
                <span>{activeShelfLibrary?.name || 'Neznámá knihovna'}</span>
                <span>&rarr;</span>
                <span>{activeShelfRoom?.name || 'Neznámá místnost'}</span>
                <span>&rarr;</span>
                <span className="font-medium text-slate-700">{activeShelf.name}</span>
                <span className="text-slate-400">({activeShelfBooks.length} titulů / {activeShelfBooks.reduce((sum, b) => sum + (b.quantity || 1), 0)} ks)</span>
              </p>
            )}
          </div>

          {activeShelf && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onSelectShelfForScanning(activeShelf.id!)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <span>Skenovat do této police</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {!activeShelf ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            Není vybrána žádná police. Vyberte polici ze seznamu výše pro zobrazení jejích knih.
          </div>
        ) : activeShelfBooks.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            V této polici zatím nejsou žádné knihy. Knihy můžete přidat naskenováním čárového kódu v záložce Skenovat.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold">
                <tr>
                  <th className="p-3 w-14 text-center">Obálka</th>
                  <th className="p-3">Název a Autor</th>
                  <th className="p-3">Žánr a Klíčová slova</th>
                  <th className="p-3">ISBN</th>
                  <th className="p-3 text-center">Počet kusů</th>
                  <th className="p-3">Rok / Vydání</th>
                  <th className="p-3 text-right">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeShelfBooks.map((book) => {
                  const qty = book.quantity || 1;
                  return (
                    <tr key={book.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 text-center">
                        {book.coverUrl ? (
                          <img
                            src={book.coverUrl}
                            alt={book.title}
                            className="w-10 h-14 object-cover rounded-md border border-slate-200 shadow-xs mx-auto bg-slate-200"
                          />
                        ) : (
                          <div className="w-10 h-14 bg-slate-100 border border-slate-200 rounded-md flex items-center justify-center text-slate-400 mx-auto">
                            <ImageIcon className="w-5 h-5 stroke-1" />
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900 text-sm">
                          {book.title || 'Bez názvu'}
                        </div>
                        <div className="text-slate-500">{book.author || 'Neznámý autor'}</div>
                        {book.translator && (
                          <div className="text-[11px] text-slate-400">Překlad: {book.translator}</div>
                        )}
                      </td>
                      <td className="p-3 max-w-[180px]">
                        {book.genre ? (
                          <span className="inline-block bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded text-[11px] mb-1">
                            {book.genre}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic block mb-1">Bez žánru</span>
                        )}
                        {book.keywords && (
                          <div className="text-[11px] text-slate-500 truncate" title={book.keywords}>
                            {book.keywords}
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-mono text-slate-600">
                        {book.isbn || <span className="text-slate-400 italic">Bez ISBN</span>}
                      </td>
                      <td className="p-3 text-center">
                        <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 rounded-lg p-1">
                          <button
                            onClick={() => handleUpdateQuantity(book.id!, -1)}
                            className="w-5 h-5 flex items-center justify-center bg-white hover:bg-indigo-100 text-indigo-700 font-bold rounded text-xs shadow-xs transition cursor-pointer"
                            title="Odebrat 1 kus"
                          >
                            -
                          </button>
                          <span className="font-extrabold text-indigo-900 px-1 text-sm">
                            {qty} ks
                          </span>
                          <button
                            onClick={() => handleUpdateQuantity(book.id!, 1)}
                            className="w-5 h-5 flex items-center justify-center bg-white hover:bg-indigo-100 text-indigo-700 font-bold rounded text-xs shadow-xs transition cursor-pointer"
                            title="Přidat 1 kus"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="p-3">
                        <div>{book.publishedYear || '-'}</div>
                        {book.editionNumber && (
                          <div className="text-[10px] text-slate-400">{book.editionNumber}</div>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingBook(book)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                            title="Upravit knihu"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteBook(book.id!)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="Smazat knihu"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
