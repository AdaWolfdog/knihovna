import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { fetchBookByIsbn, normalizeIsbn } from '../services/isbnService';
import { db, type Book } from '../db/db';
import { Camera, Search, CheckCircle, AlertCircle, RefreshCw, BookPlus } from 'lucide-react';
import { DuplicateModal } from './DuplicateModal';
import { ManualBookModal } from './ManualBookModal';

interface ScannerTabProps {
  activeShelfId: number | null;
  onNavigateToStructure: () => void;
}

export const ScannerTab: React.FC<ScannerTabProps> = ({
  activeShelfId,
  onNavigateToStructure,
}) => {
  const [shelfDetails, setShelfDetails] = useState<{
    shelfName: string;
    roomName: string;
    libraryName: string;
    libraryId: number;
    roomId: number;
  } | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [manualIsbn, setManualIsbn] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Recent scans in current session
  const [recentScans, setRecentScans] = useState<Book[]>([]);

  // Duplicate modal state
  const [duplicateBook, setDuplicateBook] = useState<Book | null>(null);
  const [pendingBookData, setPendingBookData] = useState<Partial<Book> | null>(null);

  // Manual modal state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualModalIsbn, setManualModalIsbn] = useState('');

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const lastScanTimeRef = useRef<number>(0);
  const lastScannedIsbnRef = useRef<string>('');
  const scannerContainerId = 'reader';

  // Load target shelf info
  useEffect(() => {
    if (!activeShelfId) {
      setShelfDetails(null);
      return;
    }

    const loadShelf = async () => {
      const shelf = await db.shelves.get(activeShelfId);
      if (shelf) {
        const room = await db.rooms.get(shelf.roomId);
        const library = await db.libraries.get(shelf.libraryId);
        if (room && library) {
          setShelfDetails({
            shelfName: shelf.name,
            roomName: room.name,
            libraryName: library.name,
            libraryId: library.id!,
            roomId: room.id!,
          });
        }
      }
    };
    loadShelf();
  }, [activeShelfId]);

  // Clean up html5Qrcode on unmount
  useEffect(() => {
    return () => {
      if (html5QrcodeRef.current) {
        if (html5QrcodeRef.current.isScanning) {
          html5QrcodeRef.current.stop().catch(() => {});
        }
      }
    };
  }, []);

  // Toggle Camera Scanning
  const startCamera = async () => {
    if (!activeShelfId) return;

    try {
      if (!html5QrcodeRef.current) {
        html5QrcodeRef.current = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        });
      }

      setIsScanning(true);
      setStatusMessage({ type: 'info', text: 'Spouštím fotoaparát...' });

      const cameraConfig = {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      };

      const scanConfig = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const width = Math.min(Math.floor(viewfinderWidth * 0.85), 320);
          const height = Math.min(Math.floor(viewfinderHeight * 0.5), 180);
          return { width: Math.max(width, 150), height: Math.max(height, 80) };
        },
        aspectRatio: 1.777778,
      };

      await html5QrcodeRef.current.start(
        cameraConfig,
        scanConfig,
        async (decodedText) => {
          const now = Date.now();
          const cleanIsbn = normalizeIsbn(decodedText);

          // Prevent double scans during processing or cooldown (2.5 seconds per same barcode)
          if (isProcessingRef.current) return;
          if (
            cleanIsbn === lastScannedIsbnRef.current &&
            now - lastScanTimeRef.current < 2500
          ) {
            return;
          }

          isProcessingRef.current = true;
          lastScanTimeRef.current = now;
          lastScannedIsbnRef.current = cleanIsbn;

          try {
            await handleProcessIsbn(decodedText);
          } finally {
            // Re-enable scanning after 1.5 seconds delay
            setTimeout(() => {
              isProcessingRef.current = false;
            }, 1500);
          }
        },
        () => {
          // Ignore scanning frames without barcode
        }
      );

      setStatusMessage({ type: 'info', text: 'Fotoaparát aktivní. Namiřte na čárový kód.' });
    } catch (err: any) {
      console.error('Error starting camera:', err);
      setIsScanning(false);
      setStatusMessage({
        type: 'error',
        text: 'Kamera nemohla být spuštěna (zkontrolujte oprávnění v prohlížeči).',
      });
    }
  };

  const stopCamera = async () => {
    if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
      try {
        await html5QrcodeRef.current.stop();
      } catch (err) {
        console.error('Error stopping camera:', err);
      }
    }
    setIsScanning(false);
  };

  // Main logic for processing ISBN code
  const handleProcessIsbn = async (rawIsbn: string) => {
    const cleanIsbn = normalizeIsbn(rawIsbn);
    if (!cleanIsbn) return;

    if (!activeShelfId || !shelfDetails) {
      setStatusMessage({ type: 'error', text: 'Nejprve prosím vyberte cílovou polici v záložce "Knihovna & Police"!' });
      return;
    }

    setLoading(true);
    setStatusMessage({ type: 'info', text: `Vyhledávám v katalozích (Knihovny.cz, Open Library...): ${cleanIsbn}` });

    try {
      // 1. Check if ISBN already exists on SAME shelf vs elsewhere in Library
      const existingOnSameShelf = await db.books
        .where('shelfId')
        .equals(activeShelfId)
        .and((b) => normalizeIsbn(b.isbn) === cleanIsbn)
        .first();

      const existingInLibrary = await db.books
        .where('libraryId')
        .equals(shelfDetails.libraryId)
        .and((b) => normalizeIsbn(b.isbn) === cleanIsbn)
        .first();

      // 2. Lookup online catalog metadata
      const metadata = await fetchBookByIsbn(cleanIsbn);

      const existingRef = existingOnSameShelf || existingInLibrary;

      const candidateBook: Partial<Book> = {
        libraryId: shelfDetails.libraryId,
        roomId: shelfDetails.roomId,
        shelfId: activeShelfId,
        isbn: cleanIsbn,
        title: metadata?.title || existingRef?.title || '',
        author: metadata?.author || existingRef?.author || '',
        publishedYear: metadata?.publishedYear || existingRef?.publishedYear || '',
        translator: metadata?.translator || existingRef?.translator || '',
        editionNumber: metadata?.editionNumber || existingRef?.editionNumber || '',
        quantity: 1,
        scannedAt: new Date(),
      };

      if (existingOnSameShelf) {
        // Book exists on SAME shelf -> ask or automatically increment
        setDuplicateBook(existingOnSameShelf);
        setPendingBookData(candidateBook);
        setLoading(false);
        return;
      }

      if (existingInLibrary) {
        // Book exists in library on ANOTHER shelf -> save as a new record on THIS shelf
        await saveBookToDb(candidateBook as Book, metadata?.source || 'Import z databáze knihovny');
        setLoading(false);
        return;
      }

      if (!metadata) {
        // Not found in catalogs -> open manual modal
        setStatusMessage({
          type: 'info',
          text: `Kniha s ISBN ${cleanIsbn} nebyla v katalozích nalezena. Vyplňte údaje ručně.`,
        });
        setManualModalIsbn(cleanIsbn);
        setShowManualModal(true);
        setLoading(false);
        return;
      }

      // Save book automatically if metadata was found
      await saveBookToDb(candidateBook as Book, metadata.source);
    } catch (err) {
      console.error('Processing ISBN error:', err);
      setStatusMessage({ type: 'error', text: 'Chyba při zpracování ISBN.' });
    } finally {
      setLoading(false);
    }
  };

  const saveBookToDb = async (bookData: Partial<Book>, sourceName?: string) => {
    if (!shelfDetails || !activeShelfId) return;

    const cleanIsbn = normalizeIsbn(bookData.isbn || '');

    // Check if book already exists on THIS SAME shelf
    const existingOnSameShelf = await db.books
      .where('shelfId')
      .equals(activeShelfId)
      .and((b) => normalizeIsbn(b.isbn) === cleanIsbn && cleanIsbn !== '')
      .first();

    if (existingOnSameShelf && existingOnSameShelf.id) {
      // Increment quantity on existing record
      const updatedQuantity = (existingOnSameShelf.quantity || 1) + (bookData.quantity || 1);
      await db.books.update(existingOnSameShelf.id, {
        quantity: updatedQuantity,
        scannedAt: new Date(),
      });

      const updatedBook: Book = {
        ...existingOnSameShelf,
        quantity: updatedQuantity,
        scannedAt: new Date(),
      };

      setRecentScans((prev) => [updatedBook, ...prev.filter((b) => b.id !== existingOnSameShelf.id)]);
      setStatusMessage({
        type: 'success',
        text: `Navýšen počet kusů na ${updatedQuantity} ks v polici "${shelfDetails.shelfName}".`,
      });
      return;
    }

    // New entry on this shelf
    const newBook: Book = {
      libraryId: shelfDetails.libraryId,
      roomId: shelfDetails.roomId,
      shelfId: activeShelfId,
      isbn: bookData.isbn || '',
      title: bookData.title || 'Bez názvu',
      author: bookData.author || 'Neznámý autor',
      publishedYear: bookData.publishedYear || '',
      translator: bookData.translator || '',
      editionNumber: bookData.editionNumber || '',
      quantity: bookData.quantity || 1,
      notes: bookData.notes || '',
      scannedAt: new Date(),
    };

    const id = await db.books.add(newBook);
    newBook.id = id;

    setRecentScans((prev) => [newBook, ...prev]);
    setStatusMessage({
      type: 'success',
      text: `Uloženo do "${shelfDetails.shelfName}" (${sourceName ? `zdroj: ${sourceName}` : 'ruční zápis'}). Počet: ${newBook.quantity} ks`,
    });
  };

  const handleManualSubmitIsbn = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualIsbn.trim()) {
      handleProcessIsbn(manualIsbn);
      setManualIsbn('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Target Shelf Banner */}
      {shelfDetails ? (
        <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-md flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
              Cílové umístění skenování:
            </span>
            <div className="text-lg font-bold">
              {shelfDetails.libraryName} &rarr; {shelfDetails.roomName} &rarr;{' '}
              <span className="underline decoration-2">{shelfDetails.shelfName}</span>
            </div>
          </div>
          <button
            onClick={onNavigateToStructure}
            className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-medium px-3 py-1.5 rounded-lg transition cursor-pointer"
          >
            Změnit
          </button>
        </div>
      ) : (
        <div className="bg-amber-50 border-2 border-amber-400 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
            <div>
              <h3 className="font-bold text-amber-900 text-sm">
                Není vybrána cílová police!
              </h3>
              <p className="text-xs text-amber-700">
                Před skenováním knih musíte zvolit, do jaké police se mají ukládat.
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateToStructure}
            className="bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-amber-700 transition cursor-pointer"
          >
            Vybrat polici
          </button>
        </div>
      )}

      {/* Main Scanner Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Camera Scanner Box */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col items-center text-center">
          <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-600" />
            Skenování fotoaparátem
          </h3>

          <div className="w-full relative bg-slate-900 rounded-xl overflow-hidden min-h-[220px] flex items-center justify-center mb-4">
            <div id={scannerContainerId} className="w-full h-full" />
            {!isScanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-slate-900/90 text-slate-300 space-y-3">
                <Camera className="w-12 h-12 text-slate-500 stroke-1" />
                <p className="text-xs max-w-xs">
                  Pro automatické načítání čárových kódů spusťte fotoaparát na telefonu nebo PC.
                </p>
              </div>
            )}
          </div>

          <div className="w-full flex gap-2">
            {!isScanning ? (
              <button
                onClick={startCamera}
                disabled={!activeShelfId}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Spustit skenování</span>
              </button>
            ) : (
              <button
                onClick={stopCamera}
                className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-xl transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Zastavit fotoaparát</span>
              </button>
            )}
          </div>
        </div>

        {/* Right: Manual ISBN / Ruční vložení */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Search className="w-5 h-5 text-indigo-600" />
              Zadání ISBN nebo ruční zápis
            </h3>

            <p className="text-xs text-slate-500 mb-4">
              Můžete ručně napsat/připojit USB čtečku pro zadání ISBN, nebo celkově zadat
              údaje staré knihy bez čárového kódu.
            </p>

            <form onSubmit={handleManualSubmitIsbn} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ISBN kód (10 nebo 13 číslic)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualIsbn}
                    onChange={(e) => setManualIsbn(e.target.value)}
                    placeholder="978-80-..."
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!activeShelfId || !manualIsbn.trim() || loading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50 cursor-pointer"
                  >
                    Vyhledat
                  </button>
                </div>
              </div>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-2">
              Kniha nemá ISBN ani čárový kód?
            </p>
            <button
              onClick={() => {
                setManualModalIsbn('');
                setShowManualModal(true);
              }}
              disabled={!activeShelfId}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <BookPlus className="w-4 h-4 text-indigo-600" />
              <span>Kompletně ruční zadání knihy</span>
            </button>
          </div>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          {statusMessage.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />}
          {statusMessage.type === 'error' && <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />}
          {statusMessage.type === 'info' && <RefreshCw className={`w-5 h-5 text-blue-600 shrink-0 ${loading ? 'animate-spin' : ''}`} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Recent Session Scans List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-3">
          Právě naskenované knihy v této relaci ({recentScans.length})
        </h3>

        {recentScans.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">
            Zatím jste nenaskenovali žádnou knihu.
          </p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {recentScans.map((book) => (
              <div
                key={book.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs border border-slate-100"
              >
                <div>
                  <div className="font-bold text-slate-900">{book.title}</div>
                  <div className="text-slate-500">
                    {book.author} {book.publishedYear ? `(${book.publishedYear})` : ''} | ISBN:{' '}
                    {book.isbn || 'Bez ISBN'}
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-semibold">
                    Počet: {book.quantity || 1} ks
                  </span>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {new Date(book.scannedAt).toLocaleTimeString('cs-CZ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DUPLICATE MODAL */}
      {duplicateBook && pendingBookData && shelfDetails && (
        <DuplicateModal
          existingBook={duplicateBook}
          shelfName={shelfDetails.shelfName}
          onAddExemplar={async () => {
            const dataToSave = pendingBookData;
            setDuplicateBook(null);
            setPendingBookData(null);
            await saveBookToDb(dataToSave, 'Další exemplář');
          }}
          onCancel={() => {
            setDuplicateBook(null);
            setPendingBookData(null);
            setStatusMessage({ type: 'info', text: 'Skenování zrušeno (označeno jako chyba/duplicita).' });
          }}
        />
      )}

      {/* MANUAL BOOK MODAL */}
      {showManualModal && shelfDetails && (
        <ManualBookModal
          initialIsbn={manualModalIsbn}
          shelfName={shelfDetails.shelfName}
          onSave={async (bookData) => {
            setShowManualModal(false);
            await saveBookToDb(bookData, 'Ruční zadání');
          }}
          onClose={() => setShowManualModal(false)}
        />
      )}
    </div>
  );
};
