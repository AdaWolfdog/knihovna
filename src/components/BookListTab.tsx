import { BookCoverImage } from './BookCoverImage';
import { BookActions } from './BookActions';
import { useMobileLandscapeTable } from './useMobileLandscapeTable';
import { DEFAULT_LIBRARY_COLOR } from './libraryColors';
import { BookQuantityControl } from './BookQuantityControl';
import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Book } from '../db/db';
import { exportToXLSX, exportToCSV, prepareExportData } from '../services/exportService';
import { Search, BookOpen, FileSpreadsheet, FileText, Filter, Image as ImageIcon, Smartphone } from 'lucide-react';
import { ManualBookModal } from './ManualBookModal';
import { useLanguage } from '../i18n';

export const BookListTab: React.FC = () => {
  const { t, translateDynamic } = useLanguage();
  const isMobileLandscapeTable = useMobileLandscapeTable();
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
        const matchGenre = book.genre?.toLowerCase().includes(q);
        const matchKeywords = book.keywords?.toLowerCase().includes(q);
        return matchTitle || matchAuthor || matchIsbn || matchTranslator || matchGenre || matchKeywords;
      }

      return true;
    });
  }, [books, selectedLibraryFilter, selectedRoomFilter, selectedShelfFilter, searchQuery]);

  // Export handlers
  const handleExportXLSX = () => {
    if (filteredBooks.length === 0) return alert(t('noBooksToExport'));
    const exportRows = prepareExportData(filteredBooks, librariesMap, roomsMap, shelvesMap);
    exportToXLSX(exportRows, `export_knih_${new Date().toISOString().substring(0, 10)}.xlsx`);
  };

  const handleExportCSV = () => {
    if (filteredBooks.length === 0) return alert(t('noBooksToExport'));
    const exportRows = prepareExportData(filteredBooks, librariesMap, roomsMap, shelvesMap);
    exportToCSV(exportRows, `export_knih_${new Date().toISOString().substring(0, 10)}.csv`);
  };

  // Delete book
  const handleDeleteBook = async (id: number) => {
    if (confirm(t('confirmDeleteBook'))) {
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

  const actionsHeader = <th key="actions" className="p-3 text-right">{t('thActions')}</th>;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Header & Export Buttons */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            {t('bookListTitle')} ({filteredBooks.length} / {books.length})
          </h2>
          <p className="text-xs text-slate-500">
            {t('bookListSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportXLSX}
            disabled={filteredBooks.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-on-accent font-medium text-xs rounded-xl transition shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{t('exportXlsxBtn')}</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredBooks.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-on-accent font-medium text-xs rounded-xl transition shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>{t('exportCsvBtn')}</span>
          </button>
        </div>
      </div>

      {/* Prominently Highlighted Filters Bar */}
      <div className="bg-gradient-to-r from-indigo-50 via-white to-indigo-50/50 rounded-2xl shadow-md border-2 border-indigo-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-indigo-900">
            <div className="p-1.5 bg-indigo-600 text-on-accent rounded-lg">
              <Filter className="w-4 h-4" />
            </div>
            <span className="text-base">{t('filterSearchHeading')}</span>
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
              className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-semibold px-3 py-1 rounded-lg transition cursor-pointer"
            >
              {t('resetFiltersBtn')}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 items-end sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Search Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('searchQueryLabel')}
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-indigo-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="h-10 w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
              />
            </div>
          </div>

          {/* Library Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('col1Title')}
            </label>
            <select
              value={selectedLibraryFilter}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                setSelectedLibraryFilter(val);
                setSelectedRoomFilter('all');
                setSelectedShelfFilter('all');
              }}
              className="h-10 w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium shadow-sm"
            >
              <option value="all">{t('allLibraries')}</option>
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
              {t('col2Title')}
            </label>
            <select
              value={selectedRoomFilter}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                setSelectedRoomFilter(val);
                setSelectedShelfFilter('all');
              }}
              className="h-10 w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium shadow-sm"
            >
              <option value="all">{t('allRooms')}</option>
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
              {t('col3Title')}
            </label>
            <select
              value={selectedShelfFilter}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                setSelectedShelfFilter(val);
              }}
              className="h-10 w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium shadow-sm"
            >
              <option value="all">{t('allShelves')}</option>
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
            {t('noBooksFound')}
          </div>
        ) : (
          <div>
            {/* Decent mobile orientation banner */}
            <div className="mobile-portrait-info-banner hidden items-center gap-2 bg-slate-50 border-b border-slate-200 px-4 py-2 text-xs text-slate-600">
              <Smartphone className="w-4 h-4 text-indigo-500 rotate-90 shrink-0" />
              <span>{t('orientationHint')}</span>
            </div>

            <div className="relative overflow-x-auto">
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
                    <th className="p-3 mobile-portrait-hidden">
                      <span className="mobile-landscape-hidden">{t('thLocation')}</span>
                      <span className="hidden mobile-landscape-only">{t('thLocationLandscape')}</span>
                    </th>
                    <th className="p-3 text-center mobile-portrait-hidden mobile-landscape-hidden">{t('thQuantity')}</th>
                    <th className="p-3 mobile-portrait-hidden">
                      <span className="mobile-landscape-hidden">{t('thYearEdition')}</span>
                      <span className="hidden mobile-landscape-only">{t('thEditionIsbnLandscape')}</span>
                    </th>
                    {!isMobileLandscapeTable && actionsHeader}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBooks.map((book) => {
                    const lib = librariesMap.get(book.libraryId);
                    const room = roomsMap.get(book.roomId);
                    const shelf = shelvesMap.get(book.shelfId);
                    const libColor = lib?.color || DEFAULT_LIBRARY_COLOR;

                    const actionsCell = (
                      <td key="actions" className="p-3 text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          <BookQuantityControl book={book} compact="portrait" />

                          <BookActions
                            book={book}
                            onEdit={() => setEditingBook(book)}
                            onDelete={() => handleDeleteBook(book.id!)}
                          />
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
                            <BookOpen className="mt-0.5 size-4 shrink-0" style={{ color: libColor }} aria-hidden="true" />
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
                        <td className="p-3 mobile-portrait-hidden">
                          <div className="flex items-center gap-1.5 mobile-landscape-location">
                            <span className="contents mobile-landscape-location-line">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0 inline-block"
                                style={{ backgroundColor: libColor }}
                              />
                              <span className="font-medium text-slate-800">{lib?.name || '?'}</span>
                            </span>
                            <span className="contents mobile-landscape-location-line">
                              <span><span className="mobile-landscape-hidden">&rarr; </span>{room?.name || '?'} &rarr;</span>
                              <span className="font-semibold text-indigo-600">{shelf?.name || '?'}</span>
                            </span>
                          </div>
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
