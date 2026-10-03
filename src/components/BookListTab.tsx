import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Book } from '../db/db';
import { exportToXLSX, exportToCSV, prepareExportData } from '../services/exportService';
import { Search, Trash2, Edit3, BookOpen, FileSpreadsheet, FileText, Filter } from 'lucide-react';
import { ManualBookModal } from './ManualBookModal';

export const BookListTab: React.FC = () => {
  const books = useLiveQuery(() => db.books.toArray(), []) || [];
  const libraries = useLiveQuery(() => db.libraries.toArray(), []) || [];
  const rooms = useLiveQuery(() => db.rooms.toArray(), []) || [];
  const shelves = useLiveQuery(() => db.shelves.toArray(), []) || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLibraryFilter, setSelectedLibraryFilter] = useState<number | 'all'>('all');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<number | 'all'>('all');
  const [selectedShelfFilter, setSelectedShelfFilter] = useState<number | 'all'>('all');

  // Edit modal state
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  // Maps for fast lookups
  const librariesMap = useMemo(() => new Map(libraries.map((l) => [l.id!, l])), [libraries]);
  const roomsMap = useMemo(() => new Map(rooms.map((r) => [r.id!, r])), [rooms]);
  const shelvesMap = useMemo(() => new Map(shelves.map((s) => [s.id!, s])), [shelves]);

  // Filter logic
  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      // Library filter
      if (selectedLibraryFilter !== 'all' && book.libraryId !== selectedLibraryFilter) return false;
      // Room filter
      if (selectedRoomFilter !== 'all' && book.roomId !== selectedRoomFilter) return false;
      // Shelf filter
      if (selectedShelfFilter !== 'all' && book.shelfId !== selectedShelfFilter) return false;

      // Text search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = book.title?.toLowerCase().includes(q);
        const matchAuthor = book.author?.toLowerCase().includes(q);
        const matchIsbn = book.isbn?.toLowerCase().includes(q);
        const matchTranslator = book.translator?.toLowerCase().includes(q);
        return matchTitle || matchAuthor || matchIsbn || matchTranslator;
      }

      return true;
    });
  }, [books, selectedLibraryFilter, selectedRoomFilter, selectedShelfFilter, searchQuery]);

  // Export handlers
  const handleExportXLSX = () => {
    if (filteredBooks.length === 0) return alert('Žádné knihy k exportu.');
    const exportRows = prepareExportData(filteredBooks, librariesMap, roomsMap, shelvesMap);
    exportToXLSX(exportRows, `export_knih_${new Date().toISOString().substring(0, 10)}.xlsx`);
  };

  const handleExportCSV = () => {
    if (filteredBooks.length === 0) return alert('Žádné knihy k exportu.');
    const exportRows = prepareExportData(filteredBooks, librariesMap, roomsMap, shelvesMap);
    exportToCSV(exportRows, `export_knih_${new Date().toISOString().substring(0, 10)}.csv`);
  };

  // Delete book
  const handleDeleteBook = async (id: number) => {
    if (confirm('Opravdu chcete smazat tento záznam o knize?')) {
      await db.books.delete(id);
    }
  };

  // Update book
  const handleSaveEditedBook = async (updatedFields: {
    isbn: string;
    title: string;
    author: string;
    publishedYear: string;
    translator?: string;
    editionNumber?: string;
    quantity: number;
    notes?: string;
  }) => {
    if (editingBook && editingBook.id) {
      await db.books.update(editingBook.id, updatedFields);
      setEditingBook(null);
    }
  };

  // Change quantity inline
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

  const availableRooms = useMemo(() => {
    if (selectedLibraryFilter === 'all') return rooms;
    return rooms.filter((r) => r.libraryId === selectedLibraryFilter);
  }, [rooms, selectedLibraryFilter]);

  const availableShelves = useMemo(() => {
    if (selectedRoomFilter !== 'all') {
      return shelves.filter((s) => s.roomId === selectedRoomFilter);
    }
    if (selectedLibraryFilter !== 'all') {
      return shelves.filter((s) => s.libraryId === selectedLibraryFilter);
    }
    return shelves;
  }, [shelves, selectedLibraryFilter, selectedRoomFilter]);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Header & Export Buttons */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            Seznam naskenovaných knih ({filteredBooks.length} z {books.length})
          </h2>
          <p className="text-xs text-slate-500">
            Prohlížejte, vyhledávejte a exportujte kompletní fond do tabulek Excel nebo CSV.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportXLSX}
            disabled={filteredBooks.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl transition shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportovat do Excel (.xlsx)</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredBooks.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl transition shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Exportovat do CSV</span>
          </button>
        </div>
      </div>

      {/* Prominently Highlighted Filters Bar */}
      <div className="bg-gradient-to-r from-indigo-50 via-white to-indigo-50/50 rounded-2xl shadow-md border-2 border-indigo-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-indigo-900">
            <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
              <Filter className="w-4 h-4" />
            </div>
            <span className="text-base">Filtrování a vyhledávání knih</span>
          </div>

          {(selectedLibraryFilter !== 'all' ||
            selectedRoomFilter !== 'all' ||
            selectedShelfFilter !== 'all' ||
            searchQuery !== '') && (
            <button
              onClick={() => {
                setSelectedLibraryFilter('all');
                setSelectedRoomFilter('all');
                setSelectedShelfFilter('all');
                setSearchQuery('');
              }}
              className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-semibold px-3 py-1 rounded-lg transition"
            >
              Vynulovat filtry
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Search Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Vyhledat text (Název, autor, ISBN)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-indigo-500 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Hledat..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
              />
            </div>
          </div>

          {/* Library Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              1. Virtuální knihovna
            </label>
            <select
              value={selectedLibraryFilter}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                setSelectedLibraryFilter(val);
                setSelectedRoomFilter('all');
                setSelectedShelfFilter('all');
              }}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium shadow-sm"
            >
              <option value="all">Všechny knihovny</option>
              {libraries.map((lib) => (
                <option key={lib.id} value={lib.id}>
                  {lib.name}
                </option>
              ))}
            </select>
          </div>

          {/* Room Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              2. Místnost
            </label>
            <select
              value={selectedRoomFilter}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                setSelectedRoomFilter(val);
                setSelectedShelfFilter('all');
              }}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium shadow-sm"
            >
              <option value="all">Všechny místnosti</option>
              {availableRooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>

          {/* Shelf Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              3. Police
            </label>
            <select
              value={selectedShelfFilter}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                setSelectedShelfFilter(val);
              }}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium shadow-sm"
            >
              <option value="all">Všechny police</option>
              {availableShelves.map((shelf) => (
                <option key={shelf.id} value={shelf.id}>
                  {shelf.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Books Table View */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {filteredBooks.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Nebyly nalezeny žádné odpovídající knihy.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold">
                <tr>
                  <th className="p-3">Název a Autor</th>
                  <th className="p-3">ISBN</th>
                  <th className="p-3">Umístění (Knihovna / Místnost / Police)</th>
                  <th className="p-3 text-center">Počet kusů</th>
                  <th className="p-3">Rok / Vydání</th>
                  <th className="p-3 text-right">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBooks.map((book) => {
                  const lib = librariesMap.get(book.libraryId);
                  const room = roomsMap.get(book.roomId);
                  const shelf = shelvesMap.get(book.shelfId);
                  const libColor = lib?.color || '#6366f1';
                  const qty = book.quantity || 1;

                  return (
                    <tr key={book.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3">
                        <div className="font-bold text-slate-900 text-sm">
                          {book.title || 'Bez názvu'}
                        </div>
                        <div className="text-slate-500">{book.author || 'Neznámý autor'}</div>
                        {book.translator && (
                          <div className="text-[11px] text-slate-400">Překlad: {book.translator}</div>
                        )}
                      </td>
                      <td className="p-3 font-mono text-slate-600">
                        {book.isbn || <span className="text-slate-400 italic">Bez ISBN</span>}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 inline-block"
                            style={{ backgroundColor: libColor }}
                          />
                          <span className="font-medium text-slate-800">
                            {lib?.name || '?'}
                          </span>{' '}
                          &rarr; {room?.name || '?'} &rarr;{' '}
                          <span className="font-semibold text-indigo-600">{shelf?.name || '?'}</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 rounded-lg p-1">
                          <button
                            onClick={() => handleUpdateQuantity(book.id!, -1)}
                            className="w-5 h-5 flex items-center justify-center bg-white hover:bg-indigo-100 text-indigo-700 font-bold rounded text-xs shadow-xs transition"
                            title="Odebrat 1 kus"
                          >
                            -
                          </button>
                          <span className="font-extrabold text-indigo-900 px-1 text-sm">
                            {qty} {qty === 1 ? 'ks' : qty >= 2 && qty <= 4 ? 'ks' : 'ks'}
                          </span>
                          <button
                            onClick={() => handleUpdateQuantity(book.id!, 1)}
                            className="w-5 h-5 flex items-center justify-center bg-white hover:bg-indigo-100 text-indigo-700 font-bold rounded text-xs shadow-xs transition"
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
          shelfName={shelvesMap.get(editingBook.shelfId)?.name || ''}
          onSave={handleSaveEditedBook}
          onClose={() => setEditingBook(null)}
        />
      )}
    </div>
  );
};
