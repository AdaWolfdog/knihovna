import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Plus, Trash2, Library as LibraryIcon, Folder, BookmarkCheck, ChevronRight } from 'lucide-react';

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
  const libraries = useLiveQuery(() => db.libraries.toArray(), []) || [];
  const rooms = useLiveQuery(() => db.rooms.toArray(), []) || [];
  const shelves = useLiveQuery(() => db.shelves.toArray(), []) || [];
  const books = useLiveQuery(() => db.books.toArray(), []) || [];

  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);

  // Form states
  const [newLibraryName, setNewLibraryName] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [newShelfName, setNewShelfName] = useState('');

  const [showAddLibrary, setShowAddLibrary] = useState(false);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showAddShelf, setShowAddShelf] = useState(false);

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
      createdAt: new Date(),
    });
    setNewLibraryName('');
    setShowAddLibrary(false);
    setSelectedLibraryId(id);
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

  const filteredRooms = rooms.filter((r) => r.libraryId === selectedLibraryId);
  const filteredShelves = shelves.filter((s) => s.roomId === selectedRoomId);

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
            <form onSubmit={handleAddLibrary} className="mb-3 space-y-2">
              <input
                type="text"
                placeholder="Název knihovny (např. Hlavní)"
                value={newLibraryName}
                onChange={(e) => setNewLibraryName(e.target.value)}
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
                      <LibraryIcon className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span className="truncate">{lib.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {count} knih
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLibrary(lib.id!);
                        }}
                        className="text-slate-400 hover:text-red-600 p-1 rounded cursor-pointer"
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
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {count} knih
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRoom(room.id!);
                        }}
                        className="text-slate-400 hover:text-red-600 p-1 rounded cursor-pointer"
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
                      <span className="truncate">{shelf.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200">
                        {count} knih
                      </span>

                      {isActive ? (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                          Aktivní
                        </span>
                      ) : (
                        <button
                          onClick={() => onSelectShelfForScanning(shelf.id!)}
                          className="flex items-center gap-1 text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 font-medium transition cursor-pointer"
                        >
                          Vybrat <ChevronRight className="w-3 h-3" />
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteShelf(shelf.id!)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded cursor-pointer"
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
    </div>
  );
};
