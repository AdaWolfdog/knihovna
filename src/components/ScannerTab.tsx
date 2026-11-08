import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { lookupBookByIsbnDetailed, normalizeIsbn } from '../services/isbnService';
import { recognizeIsbnFromSource } from '../services/isbnOcrService';
import { db, type Book } from '../db/db';
import { Camera, Search, CheckCircle, AlertCircle, RefreshCw, BookPlus, Zap, SkipForward, ArrowRight, Image as ImageIcon, RotateCcw, Edit3 } from 'lucide-react';
import { DuplicateModal } from './DuplicateModal';
import { ManualBookModal } from './ManualBookModal';
import { BookConfirmModal } from './BookConfirmModal';
import catLoadingImg from '../assets/cat-loading.png';
import catThumbsupImg from '../assets/cat-thumbsup.png';
import { useLanguage } from '../i18n';

interface ScannerTabProps {
  activeShelfId: number | null;
  onNavigateToStructure: () => void;
}

export const ScannerTab: React.FC<ScannerTabProps> = ({
  activeShelfId,
  onNavigateToStructure,
}) => {
  const { t } = useLanguage();
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

  // Standard mode book confirmation modal state
  const [scannedMetadataToConfirm, setScannedMetadataToConfirm] = useState<{
    bookData: Partial<Book>;
    sourceName?: string;
  } | null>(null);

  // Fast scanning mode state
  const [isFastScanMode, setIsFastScanMode] = useState(false);
  const [showThumbsUpOverlay, setShowThumbsUpOverlay] = useState(false);
  const [skippedIsbns, setSkippedIsbns] = useState<string[]>([]);
  const [unrecognizedIsbnBanner, setUnrecognizedIsbnBanner] = useState<string | null>(null);
  const [networkErrorIsbnBanner, setNetworkErrorIsbnBanner] = useState<string | null>(null);
  const [isProcessingSkippedList, setIsProcessingSkippedList] = useState(false);

  // Manual modal state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualModalIsbn, setManualModalIsbn] = useState('');

  // Error recovery / Reset state
  const [hasScannerError, setHasScannerError] = useState(false);

  // OCR recognition fallback states
  const [ocrErrorState, setOcrErrorState] = useState<'initial_failure' | 'persistent_failure' | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const isModalOpenRef = useRef<boolean>(false);
  const lastScanTimeRef = useRef<number>(0);
  const lastScannedIsbnRef = useRef<string>('');
  const activeShelfIdRef = useRef<number | null>(activeShelfId);
  const shelfDetailsRef = useRef(shelfDetails);
  const isFastScanModeRef = useRef<boolean>(isFastScanMode);
  const isProcessingSkippedListRef = useRef<boolean>(isProcessingSkippedList);
  const skippedIsbnsRef = useRef<string[]>(skippedIsbns);

  // OCR fallback timers and attempt tracking
  const lastBarcodeDetectedTimeRef = useRef<number>(Date.now());
  const ocrAttemptCountRef = useRef<number>(0);
  const ocrIntervalRef = useRef<any>(null);
  const isScanningRef = useRef<boolean>(isScanning);

  // Keep refs up-to-date with states to avoid stale closures in camera callbacks
  useEffect(() => {
    activeShelfIdRef.current = activeShelfId;
  }, [activeShelfId]);

  useEffect(() => {
    shelfDetailsRef.current = shelfDetails;
  }, [shelfDetails]);

  useEffect(() => {
    isFastScanModeRef.current = isFastScanMode;
  }, [isFastScanMode]);

  useEffect(() => {
    isProcessingSkippedListRef.current = isProcessingSkippedList;
  }, [isProcessingSkippedList]);

  useEffect(() => {
    skippedIsbnsRef.current = skippedIsbns;
  }, [skippedIsbns]);

  useEffect(() => {
    isScanningRef.current = isScanning;
  }, [isScanning]);

  // Track modal open status to pause scanning while modal is active
  useEffect(() => {
    const isAnyModalOpen = Boolean(
      scannedMetadataToConfirm || duplicateBook || showManualModal
    );
    isModalOpenRef.current = isAnyModalOpen;
    if (isAnyModalOpen) {
      isProcessingRef.current = true;
    }
  }, [scannedMetadataToConfirm, duplicateBook, showManualModal]);

  // Release processing lock when all modals close
  const releaseModalLock = () => {
    isModalOpenRef.current = false;
    setTimeout(() => {
      isProcessingRef.current = false;
    }, 400);
  };

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

  const stopCamera = () => {
    if (ocrIntervalRef.current) {
      clearInterval(ocrIntervalRef.current);
      ocrIntervalRef.current = null;
    }
    if (zxingReaderRef.current) {
      try {
        zxingReaderRef.current.reset();
      } catch (err) {
        console.error('Error stopping camera:', err);
      }
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  // Clean up ZXing on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Safe manual reset for user if camera or lock ever gets stuck
  const handleResetScanner = async () => {
    isProcessingRef.current = false;
    isModalOpenRef.current = false;
    lastScannedIsbnRef.current = '';
    lastScanTimeRef.current = 0;
    ocrAttemptCountRef.current = 0;
    setLoading(false);
    setHasScannerError(false);
    setOcrErrorState(null);
    setNetworkErrorIsbnBanner(null);
    setUnrecognizedIsbnBanner(null);

    if (isScanning) {
      stopCamera();
      setTimeout(() => {
        startCamera();
      }, 300);
    }

    setStatusMessage({
      type: 'info',
      text: t('scannerResetReady'),
    });
  };

  // Automated OCR fallback loop checking for written ISBN when no barcode is seen
  const runOcrCheck = async () => {
    if (!isScanningRef.current || isProcessingRef.current || isModalOpenRef.current) {
      return;
    }

    const now = Date.now();
    // Only attempt OCR if camera has been running for >= 2.5s without finding a barcode
    if (now - lastBarcodeDetectedTimeRef.current < 2500) {
      return;
    }

    // Try recognizing text from video frame
    try {
      const recognizedIsbn = videoRef.current ? await recognizeIsbnFromSource(videoRef.current) : null;
      if (recognizedIsbn) {
        const clean = normalizeIsbn(recognizedIsbn);
        if (
          clean === lastScannedIsbnRef.current &&
          now - lastScanTimeRef.current < 2500
        ) {
          return;
        }

        // Successfully found text ISBN!
        isProcessingRef.current = true;
        lastScanTimeRef.current = now;
        lastScannedIsbnRef.current = clean;
        ocrAttemptCountRef.current = 0;
        setOcrErrorState(null);

        await handleProcessIsbn(clean);
        return;
      }
    } catch (ocrErr) {
      console.warn('OCR scan attempt warning:', ocrErr);
    }

    // If 4.5s elapsed without finding barcode or valid text digits
    if (now - lastBarcodeDetectedTimeRef.current > 4500) {
      ocrAttemptCountRef.current += 1;
      stopCamera();

      if (ocrAttemptCountRef.current === 1) {
        setOcrErrorState('initial_failure');
        setStatusMessage({
          type: 'error',
          text: t('ocrInitialFailureTitle'),
        });
      } else {
        setOcrErrorState('persistent_failure');
        setStatusMessage({
          type: 'error',
          text: t('ocrPersistentFailureTitle'),
        });
      }
    }
  };

  // Toggle Camera Scanning using high-performance ZXing
  const startCamera = async () => {
    if (!activeShelfIdRef.current) return;

    try {
      if (!zxingReaderRef.current) {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.QR_CODE,
        ]);

        zxingReaderRef.current = new BrowserMultiFormatReader(hints, 100);
      }

      setIsScanning(true);
      setHasScannerError(false);
      lastBarcodeDetectedTimeRef.current = Date.now();
      setStatusMessage({ type: 'info', text: t('cameraStarting') });

      if (ocrIntervalRef.current) {
        clearInterval(ocrIntervalRef.current);
      }
      ocrIntervalRef.current = setInterval(() => {
        runOcrCheck();
      }, 1200);

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      let selectedDeviceId: string | null = null;
      try {
        const videoInputDevices = await zxingReaderRef.current.listVideoInputDevices();
        if (videoInputDevices && videoInputDevices.length > 0) {
          const rearCameras = videoInputDevices.filter((d) =>
            /back|rear|environment/i.test(d.label)
          );
          if (rearCameras.length > 0) {
            const mainRear = rearCameras.find((d) => !/wide|ultra|telephoto|macro/i.test(d.label)) || rearCameras[0];
            selectedDeviceId = mainRear.deviceId;
          }
        }
      } catch {
        selectedDeviceId = null;
      }

      const onResultCallback = async (result: any) => {
        if (result) {
          lastBarcodeDetectedTimeRef.current = Date.now();
          const decodedText = result.getText();
          const now = Date.now();
          const cleanIsbn = normalizeIsbn(decodedText);

          if (isProcessingRef.current || isModalOpenRef.current) return;
          if (
            cleanIsbn === lastScannedIsbnRef.current &&
            now - lastScanTimeRef.current < 2500
          ) {
            return;
          }

          isProcessingRef.current = true;
          lastScanTimeRef.current = now;
          lastScannedIsbnRef.current = cleanIsbn;
          ocrAttemptCountRef.current = 0;
          setOcrErrorState(null);

          try {
            await handleProcessIsbn(decodedText);
          } catch (err) {
            console.error('Unhandled scan callback error:', err);
            setHasScannerError(true);
            isProcessingRef.current = false;
          }
        }
      };

      if (videoRef.current) {
        const decodePromise = selectedDeviceId
          ? zxingReaderRef.current.decodeFromVideoDevice(
              selectedDeviceId,
              videoRef.current,
              onResultCallback
            )
          : zxingReaderRef.current.decodeFromConstraints(
              constraints,
              videoRef.current,
              onResultCallback
            );

        if (decodePromise && typeof decodePromise.catch === 'function') {
          decodePromise.catch((err: any) => {
            console.error('Async camera startup failure:', err);
            setIsScanning(false);
            setHasScannerError(true);
            const errorMessage = typeof err === 'string' ? err : err?.message || '';
            if (errorMessage.toLowerCase().includes('notallowed') || errorMessage.toLowerCase().includes('permission')) {
              setStatusMessage({
                type: 'error',
                text: t('cameraErrorPermission'),
              });
            } else {
              setStatusMessage({
                type: 'error',
                text: t('cameraErrorGeneral', { err: errorMessage || 'error' }),
              });
            }
          });
        }
      }

      setStatusMessage({ type: 'info', text: t('cameraActiveTip') });
    } catch (err: any) {
      console.error('Error starting camera:', err);
      setIsScanning(false);
      setHasScannerError(true);
      const errorMessage = typeof err === 'string' ? err : err?.message || '';
      if (errorMessage.toLowerCase().includes('notallowed') || errorMessage.toLowerCase().includes('permission')) {
        setStatusMessage({
          type: 'error',
          text: t('cameraErrorPermission'),
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: t('cameraErrorGeneral', { err: errorMessage || 'error' }),
        });
      }
    }
  };

  // Main logic for processing ISBN code
  const handleProcessIsbn = async (rawIsbn: string) => {
    const cleanIsbn = normalizeIsbn(rawIsbn);
    if (!cleanIsbn) {
      isProcessingRef.current = false;
      return;
    }

    const currentShelfId = activeShelfIdRef.current;
    const currentShelfDetails = shelfDetailsRef.current;

    if (!currentShelfId || !currentShelfDetails) {
      setStatusMessage({ type: 'error', text: t('pleaseSelectTargetShelfFirst') });
      isProcessingRef.current = false;
      return;
    }

    setLoading(true);
    setStatusMessage({ type: 'info', text: t('searchingCatalogFor', { isbn: cleanIsbn }) });

    try {
      // 1. If we are currently in "isProcessingSkippedList" mode
      if (isProcessingSkippedListRef.current && skippedIsbnsRef.current.length > 0) {
        if (skippedIsbnsRef.current.includes(cleanIsbn)) {
          setUnrecognizedIsbnBanner(null);
          setNetworkErrorIsbnBanner(null);
          setManualModalIsbn(cleanIsbn);
          setShowManualModal(true);
          setLoading(false);
          return;
        } else {
          setStatusMessage({
            type: 'info',
            text: t('scannedCodeNotInSkipped', { isbn: cleanIsbn }),
          });
          setLoading(false);
          isProcessingRef.current = false;
          return;
        }
      }

      // 2. Check if ISBN already exists on SAME shelf vs elsewhere in Library
      let existingOnSameShelf: Book | undefined;
      let existingInLibrary: Book | undefined;

      try {
        existingOnSameShelf = await db.books
          .where('shelfId')
          .equals(currentShelfId)
          .and((b) => normalizeIsbn(b.isbn) === cleanIsbn)
          .first();

        existingInLibrary = await db.books
          .where('libraryId')
          .equals(currentShelfDetails.libraryId)
          .and((b) => normalizeIsbn(b.isbn) === cleanIsbn)
          .first();
      } catch (dbErr) {
        console.error('Database query error during scan check:', dbErr);
      }

      // 3. Lookup online catalog metadata with detailed network vs not-found distinction
      const lookupResult = await lookupBookByIsbnDetailed(cleanIsbn);
      const metadata = lookupResult.metadata;

      const existingRef = existingOnSameShelf || existingInLibrary;

      const candidateBook: Partial<Book> = {
        libraryId: currentShelfDetails.libraryId,
        roomId: currentShelfDetails.roomId,
        shelfId: currentShelfId,
        isbn: cleanIsbn,
        title: metadata?.title || existingRef?.title || '',
        author: metadata?.author || existingRef?.author || '',
        publishedYear: metadata?.publishedYear || existingRef?.publishedYear || '',
        translator: metadata?.translator || existingRef?.translator || '',
        editionNumber: metadata?.editionNumber || existingRef?.editionNumber || '',
        genre: metadata?.genre || existingRef?.genre || '',
        keywords: metadata?.keywords || existingRef?.keywords || '',
        coverUrl: metadata?.coverUrl || existingRef?.coverUrl || '',
        publisher: metadata?.publisher || existingRef?.publisher || '',
        placeOfPublication: metadata?.placeOfPublication || existingRef?.placeOfPublication || '',
        cnb: metadata?.cnb || existingRef?.cnb || '',
        physicalDescription: metadata?.physicalDescription || existingRef?.physicalDescription || '',
        quantity: 1,
        scannedAt: new Date(),
      };

      // Case A: Duplicate on same shelf
      if (existingOnSameShelf) {
        setDuplicateBook(existingOnSameShelf);
        setPendingBookData(candidateBook);
        setLoading(false);
        return;
      }

      // Case B: Network/catalog temporary failure (and not found in local library)
      if (!metadata && !existingInLibrary && lookupResult.isNetworkError) {
        setLoading(false);
        isProcessingRef.current = false;
        if (isFastScanModeRef.current) {
          setNetworkErrorIsbnBanner(cleanIsbn);
          setStatusMessage({
            type: 'error',
            text: t('catalogsUnavailableFastMode', { isbn: cleanIsbn }),
          });
        } else {
          setHasScannerError(true);
          setStatusMessage({
            type: 'error',
            text: t('catalogsUnavailableNetworkError', { isbn: cleanIsbn }),
          });
        }
        return;
      }

      // Case C: Genuinely not found in catalogs or existing DB
      if (!metadata && !existingInLibrary) {
        if (isFastScanModeRef.current) {
          setUnrecognizedIsbnBanner(cleanIsbn);
          setStatusMessage({
            type: 'info',
            text: t('bookNotFoundFastMode', { isbn: cleanIsbn }),
          });
          isProcessingRef.current = false;
        } else {
          setStatusMessage({
            type: 'info',
            text: t('bookNotFoundStandardMode', { isbn: cleanIsbn }),
          });
          setManualModalIsbn(cleanIsbn);
          setShowManualModal(true);
        }
        setLoading(false);
        return;
      }

      // Case D: Found metadata or existing library book
      if (isFastScanModeRef.current) {
        const saved = await saveBookToDb(
          candidateBook,
          metadata?.source || (existingInLibrary ? 'Import' : undefined)
        );
        if (saved) {
          setShowThumbsUpOverlay(true);
          setTimeout(() => {
            setShowThumbsUpOverlay(false);
            isProcessingRef.current = false;
          }, 3000);
        } else {
          isProcessingRef.current = false;
        }
      } else {
        setScannedMetadataToConfirm({
          bookData: candidateBook,
          sourceName: metadata?.source || (existingInLibrary ? 'Import' : undefined),
        });
      }
    } catch (err) {
      console.error('Processing ISBN error:', err);
      setStatusMessage({ type: 'error', text: t('errorProcessingIsbn') });
      setHasScannerError(true);
      isProcessingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  const handleSkipIsbn = (isbnToSkip: string) => {
    if (!skippedIsbns.includes(isbnToSkip)) {
      setSkippedIsbns((prev) => [...prev, isbnToSkip]);
    }
    setUnrecognizedIsbnBanner(null);
    setNetworkErrorIsbnBanner(null);
    isProcessingRef.current = false;
    setStatusMessage({
      type: 'info',
      text: t('bookSkippedMsg', { isbn: isbnToSkip }),
    });
  };

  const handleRetryNetworkIsbn = (isbnToRetry: string) => {
    if (isProcessingRef.current || isModalOpenRef.current) return;
    isProcessingRef.current = true;
    setNetworkErrorIsbnBanner(null);
    handleProcessIsbn(isbnToRetry);
  };

  const handleFinishFastScanning = () => {
    if (skippedIsbns.length === 0) {
      setIsFastScanMode(false);
      setIsProcessingSkippedList(false);
      setStatusMessage({
        type: 'success',
        text: t('fastScanCompletedMsg'),
      });
      return;
    }

    if (skippedIsbns.length === 1) {
      const targetIsbn = skippedIsbns[0];
      setManualModalIsbn(targetIsbn);
      setShowManualModal(true);
    } else {
      setIsProcessingSkippedList(true);
      setStatusMessage({
        type: 'info',
        text: t('rescanSkippedInstructions', { count: skippedIsbns.length }),
      });
    }
  };

  const saveBookToDb = async (bookData: Partial<Book>, sourceName?: string): Promise<boolean> => {
    const currentShelfId = activeShelfIdRef.current;
    const currentShelfDetails = shelfDetailsRef.current;
    if (!currentShelfDetails || !currentShelfId) return false;

    const cleanIsbn = normalizeIsbn(bookData.isbn || '');

    try {
      const existingOnSameShelf = await db.books
        .where('shelfId')
        .equals(currentShelfId)
        .and((b) => normalizeIsbn(b.isbn) === cleanIsbn && cleanIsbn !== '')
        .first();

      if (existingOnSameShelf && existingOnSameShelf.id) {
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
          text: t('quantityIncreasedMsg', { qty: updatedQuantity, shelf: currentShelfDetails.shelfName }),
        });
        return true;
      }

      const newBook: Book = {
        libraryId: currentShelfDetails.libraryId,
        roomId: currentShelfDetails.roomId,
        shelfId: currentShelfId,
        isbn: bookData.isbn || '',
        title: bookData.title || t('unknownTitle'),
        author: bookData.author || t('unknownAuthor'),
        publishedYear: bookData.publishedYear || '',
        translator: bookData.translator || '',
        editionNumber: bookData.editionNumber || '',
        quantity: bookData.quantity || 1,
        genre: bookData.genre || '',
        keywords: bookData.keywords || '',
        coverUrl: bookData.coverUrl || '',
        notes: bookData.notes || '',
        publisher: bookData.publisher || '',
        placeOfPublication: bookData.placeOfPublication || '',
        cnb: bookData.cnb || '',
        physicalDescription: bookData.physicalDescription || '',
        scannedAt: new Date(),
      };

      const id = await db.books.add(newBook);
      newBook.id = id;

      setRecentScans((prev) => [newBook, ...prev]);

      const cleanIsbnForCheck = normalizeIsbn(bookData.isbn || '');
      if (cleanIsbnForCheck && skippedIsbnsRef.current.includes(cleanIsbnForCheck)) {
        const remaining = skippedIsbnsRef.current.filter((i) => i !== cleanIsbnForCheck);
        setSkippedIsbns(remaining);

        if (remaining.length === 0) {
          setIsProcessingSkippedList(false);
          setIsFastScanMode(false);
          setStatusMessage({
            type: 'success',
            text: t('allSkippedSavedSuccess'),
          });
          return true;
        } else {
          setStatusMessage({
            type: 'info',
            text: t('bookSavedRemainingSkipped', { count: remaining.length }),
          });
          return true;
        }
      }

      const formattedSource = sourceName ? `${t('sourceLabelPrefix')} ${sourceName}` : t('manualSource');
      setStatusMessage({
        type: 'success',
        text: t('bookSavedSuccess', {
          shelf: currentShelfDetails.shelfName,
          source: formattedSource,
          qty: newBook.quantity,
        }),
      });
      return true;
    } catch (dbError) {
      console.error('Failed to save book to database:', dbError);
      setHasScannerError(true);
      setStatusMessage({
        type: 'error',
        text: t('dbSaveError'),
      });
      return false;
    }
  };

  const handleManualSubmitIsbn = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualIsbn.trim()) {
      if (isProcessingRef.current || isModalOpenRef.current) return;
      isProcessingRef.current = true;
      const isbnToLookup = manualIsbn;
      setManualIsbn('');
      handleProcessIsbn(isbnToLookup);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Target Shelf Banner */}
      {shelfDetails ? (
        <div className="bg-emerald-600 text-white p-2.5 sm:p-4 pr-12 sm:pr-4 rounded-xl sm:rounded-2xl shadow-md flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-200 block">
              {t('targetScanLocation')}
            </span>
            <div className="text-xs sm:text-lg font-bold">
              {shelfDetails.libraryName} &rarr; {shelfDetails.roomName} &rarr;{' '}
              <span className="underline decoration-2">{shelfDetails.shelfName}</span>
            </div>
          </div>
          <button
            onClick={onNavigateToStructure}
            className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-medium px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg transition cursor-pointer shrink-0 ml-2"
          >
            {t('changeShelf')}
          </button>
        </div>
      ) : (
        <div className="bg-amber-50 border-2 border-amber-400 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
            <div>
              <h3 className="font-bold text-amber-900 text-sm">
                {t('noShelfSelectedTitle')}
              </h3>
              <p className="text-xs text-amber-700">
                {t('noShelfSelectedDesc')}
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateToStructure}
            className="bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-amber-700 transition cursor-pointer"
          >
            {t('selectShelfBtn')}
          </button>
        </div>
      )}

      {/* Fast Scan Mode Toggle Banner */}
      <div className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition shadow-sm ${
        isFastScanMode
          ? 'bg-amber-50 border-amber-300 text-amber-900'
          : 'bg-white border-slate-200 text-slate-800'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
          {!isFastScanMode ? (
            <>
              {/* Desktop view header & description */}
              <div className="hidden sm:flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">
                    {t('fastScanModeTitle')}
                  </h3>
                </div>
              </div>

              {/* Mobile button */}
              <button
                onClick={() => {
                  setIsFastScanMode(true);
                  setStatusMessage({
                    type: 'info',
                    text: t('fastScanModeActivated'),
                  });
                }}
                className="w-full sm:hidden py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>{t('fastScanModeTitle')}</span>
              </button>

              {/* Desktop toggle button */}
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    setIsFastScanMode(true);
                    setStatusMessage({
                      type: 'info',
                      text: t('fastScanModeActivated'),
                    });
                  }}
                  className="py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>{t('turnOnFastScan')}</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-xl bg-amber-500 text-white shrink-0">
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-xs sm:text-base">
                      {t('fastScanModeTitle')}
                    </h3>
                    <span className="bg-amber-600 text-white text-[9px] sm:text-[10px] uppercase font-bold px-1.5 sm:px-2 py-0.5 rounded-full">
                      {t('fastScanModeActive')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleFinishFastScanning}
                  className="flex-1 sm:flex-initial py-2 sm:py-2.5 px-3 sm:px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg sm:rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>
                    {t('finishFastScan')} ({skippedIsbns.length})
                  </span>
                </button>
                <button
                  onClick={() => {
                    setIsFastScanMode(false);
                    setSkippedIsbns([]);
                    setUnrecognizedIsbnBanner(null);
                    setNetworkErrorIsbnBanner(null);
                    setIsProcessingSkippedList(false);
                  }}
                  className="py-2 sm:py-2.5 px-2.5 sm:px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-lg sm:rounded-xl transition cursor-pointer"
                >
                  {t('turnOffFastScan')}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Skipped ISBNs badge bar */}
        {skippedIsbns.length > 0 && (
          <div className="mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-amber-200 flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
            <span className="font-semibold text-amber-900 text-[11px] sm:text-xs">
              {t('skippedIsbnsTitle')} ({skippedIsbns.length}):
            </span>
            {skippedIsbns.map((isbn) => (
              <span
                key={isbn}
                className="bg-amber-200/80 text-amber-900 font-mono px-1.5 py-0.5 rounded font-semibold text-[10px] sm:text-[11px]"
              >
                {isbn}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* OCR Error Notification Banner: Initial failure */}
      {ocrErrorState === 'initial_failure' && (
        <div className="bg-amber-50 border-2 border-amber-400 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
            <div>
              <div className="font-bold text-amber-900 text-sm">
                {t('ocrInitialFailureTitle')}
              </div>
              <p className="text-xs text-amber-700">
                {t('ocrInitialFailureDesc')}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setOcrErrorState(null);
              startCamera();
            }}
            className="py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{t('retryBtn')}</span>
          </button>
        </div>
      )}

      {/* OCR Error Notification Banner: Persistent failure */}
      {ocrErrorState === 'persistent_failure' && (
        <div className="bg-red-50 border-2 border-red-400 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
            <div>
              <div className="font-bold text-red-900 text-sm">
                {t('ocrPersistentFailureTitle')}
              </div>
              <p className="text-xs text-red-700">
                {t('ocrPersistentFailureDesc')}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setOcrErrorState(null);
              setManualModalIsbn('');
              setShowManualModal(true);
            }}
            className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer shrink-0"
          >
            <Edit3 className="w-4 h-4" />
            <span>{t('manualIsbnEntryBtn')}</span>
          </button>
        </div>
      )}

      {/* Network Error banner in Fast Mode */}
      {networkErrorIsbnBanner && isFastScanMode && (
        <div className="bg-red-50 border-2 border-red-400 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
            <div>
              <div className="font-bold text-red-900 text-sm">
                {t('networkErrorBannerTitle', { isbn: networkErrorIsbnBanner })}
              </div>
              <p className="text-xs text-red-700">
                {t('networkErrorBannerDesc')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRetryNetworkIsbn(networkErrorIsbnBanner)}
              className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{t('retryBtn')}</span>
            </button>
            <button
              onClick={() => handleSkipIsbn(networkErrorIsbnBanner)}
              className="py-2 px-3 bg-red-100 hover:bg-red-200 text-red-900 font-semibold text-xs border border-red-300 rounded-xl transition cursor-pointer"
            >
              {t('skipBookBtn')}
            </button>
          </div>
        </div>
      )}

      {/* Unrecognized ISBN banner in Fast Mode */}
      {unrecognizedIsbnBanner && isFastScanMode && (
        <div className="bg-amber-100 border-2 border-amber-400 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-amber-700 shrink-0" />
            <div>
              <div className="font-bold text-amber-900 text-sm">
                {t('unrecognizedBannerTitle', { isbn: unrecognizedIsbnBanner })}
              </div>
              <p className="text-xs text-amber-800">
                {t('unrecognizedBannerDesc')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSkipIsbn(unrecognizedIsbnBanner)}
              className="py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <SkipForward className="w-4 h-4" />
              <span>{t('skipBookBtn')}</span>
            </button>
            <button
              onClick={() => {
                const targetIsbn = unrecognizedIsbnBanner;
                setUnrecognizedIsbnBanner(null);
                setManualModalIsbn(targetIsbn);
                setShowManualModal(true);
              }}
              className="py-2 px-3 bg-white hover:bg-amber-50 text-amber-900 font-semibold text-xs border border-amber-300 rounded-xl transition cursor-pointer"
            >
              {t('fillNowBtn')}
            </button>
          </div>
        </div>
      )}

      {/* Recovery / Reset Button Banner (Appears only when an error occurs) */}
      {hasScannerError && (
        <div className="bg-slate-800 text-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-md flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <RotateCcw className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="font-bold text-xs sm:text-sm">
                {t('readingTroubleTitle')}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300">
                {t('readingTroubleDesc')}
              </p>
            </div>
          </div>
          <button
            onClick={handleResetScanner}
            className="py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs rounded-lg transition shrink-0 ml-3 cursor-pointer"
          >
            {t('resetScannerBtn')}
          </button>
        </div>
      )}

      {/* Re-scan prompt mode for multiple skipped books */}
      {isProcessingSkippedList && (
        <div className="bg-indigo-600 text-white p-4 rounded-2xl shadow-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-6 h-6 text-indigo-200 animate-spin" />
            <div>
              <div className="font-bold text-sm">
                {t('rescanSkippedHeading', { count: skippedIsbns.length })}
              </div>
              <p className="text-xs text-indigo-100">
                {t('rescanSkippedSubheading')}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (skippedIsbns.length > 0) {
                setManualModalIsbn(skippedIsbns[0]);
                setShowManualModal(true);
              }
            }}
            className="py-1.5 px-3 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold rounded-lg transition"
          >
            {t('selectFromListBtn')}
          </button>
        </div>
      )}

      {/* Main Scanner Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Camera Scanner Box */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col items-center text-center">
          <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-600" />
            {t('cameraScannerHeading')}
          </h3>

          <div className="w-full relative bg-slate-900 rounded-xl overflow-hidden h-[180px] sm:h-auto min-h-[180px] sm:min-h-[220px] flex items-center justify-center mb-3">
            <video
              ref={videoRef}
              className="w-full h-full object-cover max-h-[180px] sm:max-h-[300px]"
              playsInline
              muted
            />

            {/* Thumbs-Up Overlay (Fast mode success cat display) */}
            {showThumbsUpOverlay && (
              <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-xs flex flex-col items-center justify-center p-2 z-20 animate-fade-in">
                <img
                  src={catThumbsupImg}
                  onError={(e) => {
                    e.currentTarget.src = './assets/cat-thumbsup.png';
                  }}
                  alt="Kniha naskenována!"
                  className="w-20 h-20 sm:w-28 sm:h-28 object-contain animate-bounce"
                />
                <span className="text-white font-bold text-xs sm:text-sm mt-1 bg-emerald-600 px-3 py-1 rounded-full shadow-md">
                  {t('bookSavedOverlay')}
                </span>
              </div>
            )}

            {isScanning && !showThumbsUpOverlay && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-2 sm:p-4">
                <div className="w-full max-w-[320px] h-20 sm:h-32 border-2 border-dashed border-emerald-400/80 rounded-xl sm:rounded-2xl bg-emerald-500/10 shadow-lg animate-pulse" />
              </div>
            )}

            {!isScanning && !showThumbsUpOverlay && (
              <div className="absolute inset-0 flex flex-col sm:flex-col items-center justify-center p-2 sm:p-4 bg-slate-900/90 text-slate-300 space-y-1 sm:space-y-3">
                <Camera className="w-8 h-8 sm:w-12 sm:h-12 text-slate-500 stroke-1" />
              </div>
            )}
          </div>

          {/* Progress Bar with Loading Cat below scanner camera */}
          {loading && (
            <div className="w-full mb-3 p-3 bg-slate-900/5 rounded-xl border border-slate-200 flex flex-col items-center animate-fade-in">
              <img
                src={catLoadingImg}
                onError={(e) => {
                  e.currentTarget.src = './assets/cat-loading.png';
                }}
                alt={t('searchingInCatalogs')}
                className="w-10 h-10 object-contain mb-1.5 animate-bounce"
              />
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden border border-slate-300 relative shadow-inner">
                <div className="bg-black h-full rounded-full w-full animate-pulse relative overflow-hidden" />
              </div>
              <span className="text-[11px] font-semibold text-slate-700 mt-1.5">
                {t('searchingInCatalogs')}
              </span>
            </div>
          )}

          <div className="w-full flex gap-2">
            {!isScanning ? (
              <button
                onClick={() => {
                  setOcrErrorState(null);
                  startCamera();
                }}
                disabled={!activeShelfId}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>{t('startScanningBtn')}</span>
              </button>
            ) : (
              <button
                onClick={stopCamera}
                className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-xl transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{t('stopCameraBtn')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Right: Manual ISBN / Ruční vložení */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Search className="w-5 h-5 text-indigo-600" />
              {t('manualIsbnHeading')}
            </h3>

            <form onSubmit={handleManualSubmitIsbn} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('manualIsbnLabel')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualIsbn}
                    onChange={(e) => setManualIsbn(e.target.value)}
                    placeholder="978-80-..."
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                  />
                  <button
                    type="submit"
                    disabled={!activeShelfId || !manualIsbn.trim() || loading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50 cursor-pointer"
                  >
                    {t('searchBtn')}
                  </button>
                </div>
              </div>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-2">
              {t('noIsbnQuestion')}
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
              <span>{t('fullManualEntryBtn')}</span>
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
          {t('recentScansHeading')} ({recentScans.length})
        </h3>

        {recentScans.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">
            {t('noRecentScans')}
          </p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {recentScans.map((book) => (
              <div
                key={book.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs border border-slate-100 gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {book.coverUrl ? (
                    <img
                      src={book.coverUrl}
                      alt={book.title}
                      className="w-9 h-12 object-cover rounded-md border border-slate-200 shrink-0 bg-slate-200"
                    />
                  ) : (
                    <div className="w-9 h-12 bg-slate-200 border border-slate-300 rounded-md flex items-center justify-center text-slate-400 shrink-0">
                      <ImageIcon className="w-5 h-5 stroke-1" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">{book.title}</div>
                    <div className="text-slate-500 truncate">
                      {book.author} {book.publishedYear ? `(${book.publishedYear})` : ''} | ISBN:{' '}
                      {book.isbn || t('noIsbnText')}
                    </div>
                    {(book.genre || book.keywords) && (
                      <div className="text-[10px] text-indigo-600 truncate mt-0.5">
                        {book.genre && <span className="font-semibold">{book.genre}</span>}
                        {book.genre && book.keywords && ' • '}
                        {book.keywords && <span>{book.keywords}</span>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-semibold">
                    {t('quantityLabel')} {book.quantity || 1} {t('piecesSuffix')}
                  </span>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {new Date(book.scannedAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* STANDARD MODE BOOK CONFIRMATION MODAL */}
      {!isFastScanMode && scannedMetadataToConfirm && shelfDetails && (
        <BookConfirmModal
          initialData={scannedMetadataToConfirm.bookData}
          shelfName={shelfDetails.shelfName}
          sourceName={scannedMetadataToConfirm.sourceName}
          onConfirm={async (confirmedData) => {
            const source = scannedMetadataToConfirm.sourceName;
            setScannedMetadataToConfirm(null);
            await saveBookToDb(confirmedData, source);
            releaseModalLock();
          }}
          onCancel={() => {
            setScannedMetadataToConfirm(null);
            releaseModalLock();
            setStatusMessage({ type: 'info', text: t('confirmCancelMsg') });
          }}
        />
      )}

      {/* DUPLICATE MODAL */}
      {duplicateBook && pendingBookData && shelfDetails && (
        <DuplicateModal
          existingBook={duplicateBook}
          shelfName={shelfDetails.shelfName}
          onAddExemplar={async () => {
            const dataToSave = pendingBookData;
            const inFastMode = isFastScanModeRef.current;
            setDuplicateBook(null);
            setPendingBookData(null);
            const saved = await saveBookToDb(dataToSave, t('duplicateSourceAnotherCopy'));
            if (inFastMode && saved) {
              setShowThumbsUpOverlay(true);
              setTimeout(() => {
                setShowThumbsUpOverlay(false);
                releaseModalLock();
              }, 3000);
            } else {
              releaseModalLock();
            }
          }}
          onCancel={() => {
            setDuplicateBook(null);
            setPendingBookData(null);
            releaseModalLock();
            setStatusMessage({ type: 'info', text: t('duplicateCancelledMsg') });
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
            await saveBookToDb(bookData, t('manualSourceLabel'));
            releaseModalLock();
          }}
          onClose={() => {
            setShowManualModal(false);
            releaseModalLock();
          }}
        />
      )}
    </div>
  );
};
