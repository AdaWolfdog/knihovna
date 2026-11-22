// @vitest-environment jsdom
// @ts-nocheck
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScannerTab } from './ScannerTab';
import * as isbnService from '../services/isbnService';
import * as isbnOcrService from '../services/isbnOcrService';
import { db, type Book } from '../db/db';

let scanCallback: ((result: any) => Promise<void>) | null = null;
let decodeReject: ((err: any) => void) | null = null;

vi.mock('@zxing/library', () => {
  return {
    BarcodeFormat: {
      EAN_13: 1,
      EAN_8: 2,
      UPC_A: 3,
      UPC_E: 4,
      CODE_128: 5,
      QR_CODE: 6,
    },
    DecodeHintType: {
      POSSIBLE_FORMATS: 2,
    },
    BrowserMultiFormatReader: class MockBrowserMultiFormatReader {
      listVideoInputDevices = vi.fn().mockResolvedValue([
        { deviceId: 'cam-main', label: 'Back Camera 1x' },
        { deviceId: 'cam-wide', label: 'Back Camera Ultra Wide' },
      ]);
      decodeFromVideoDevice = vi.fn().mockImplementation((deviceId, videoEl, cb) => {
        scanCallback = cb;
        return new Promise((_, reject) => {
          decodeReject = reject;
        });
      });
      decodeFromConstraints = vi.fn().mockImplementation((constraints, videoEl, cb) => {
        scanCallback = cb;
        return new Promise((_, reject) => {
          decodeReject = reject;
        });
      });
      reset = vi.fn().mockImplementation(() => {
        // do not null scanCallback if test needs it after reset, or allow re-assigning
      });
    },
  };
});

function markCameraReady(container: HTMLElement) {
  const video = container.querySelector('video')!;
  Object.defineProperties(video, {
    readyState: { value: HTMLMediaElement.HAVE_CURRENT_DATA },
    videoWidth: { value: 1280 },
    videoHeight: { value: 720 },
  });
  video.dispatchEvent(new Event('playing'));
}

describe('ScannerTab component real workflow', () => {
  let container: HTMLDivElement;
  let root: any;

  // Mock DB tables in-memory
  let booksStore: Book[] = [];
  let nextBookId = 1;

  beforeEach(() => {
    booksStore = [];
    nextBookId = 1;
    scanCallback = null;
    decodeReject = null;

    vi.spyOn(db, 'transaction').mockImplementation(async (_mode, _tables, callback) => callback());

    vi.spyOn(db.shelves, 'get').mockImplementation(async (id: any) => {
      if (id === 10) {
        return { id: 10, name: 'Police A1', roomId: 20, libraryId: 30, createdAt: new Date() };
      }
      return undefined;
    });

    vi.spyOn(db.rooms, 'get').mockImplementation(async (id: any) => {
      if (id === 20) {
        return { id: 20, name: 'Čítárna', libraryId: 30, createdAt: new Date() };
      }
      return undefined;
    });

    vi.spyOn(db.libraries, 'get').mockImplementation(async (id: any) => {
      if (id === 30) {
        return { id: 30, name: 'Městská knihovna', createdAt: new Date() };
      }
      return undefined;
    });

    vi.spyOn(db.books, 'where').mockImplementation((field: string) => {
      return {
        equals: (val: any) => ({
          and: (predicate: (b: Book) => boolean) => ({
            first: async () => {
              return booksStore.find((b) => (b as any)[field] === val && predicate(b));
            },
          }),
        }),
      } as any;
    });

    vi.spyOn(db.books, 'add').mockImplementation(async (book: any) => {
      const id = nextBookId++;
      const saved = { ...book, id };
      booksStore.push(saved);
      return id;
    });

    vi.spyOn(db.books, 'update').mockImplementation(async (id: any, changes: any) => {
      const idx = booksStore.findIndex((b) => b.id === id);
      if (idx !== -1) {
        booksStore[idx] = { ...booksStore[idx], ...changes };
      }
      return 1;
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders shelf information and starts camera scanning', async () => {
    await act(async () => {
      root.render(<ScannerTab activeShelfId={10} onNavigateToStructure={() => {}} />);
    });

    expect(container.textContent).toContain('Městská knihovna');
    expect(container.textContent).toContain('Police A1');

    // Click "Spustit skenování"
    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Spustit skenování')
    );
    expect(startBtn).toBeDefined();

    await act(async () => {
      startBtn?.click();
    });

    expect(scanCallback).not.toBeNull();
    expect(container.textContent).toContain('Zastavit fotoaparát');
  });

  it('keeps a completed scan form open when saving fails and allows a retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(isbnService, 'lookupBookByIsbnDetailed').mockResolvedValue({
      metadata: { isbn: '9788025703670', title: 'Životy slavných' },
      isNetworkError: false,
    });
    vi.mocked(db.books.add).mockRejectedValueOnce(new Error('Write failed'));

    await act(async () => {
      root.render(<ScannerTab activeShelfId={10} onNavigateToStructure={() => {}} />);
    });
    const startBtn = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Spustit skenování')
    );
    await act(async () => startBtn.click());
    await act(async () => scanCallback({ getText: () => '9788025703670' }));

    const form = container.querySelector('.fixed form');
    expect(form).not.toBeNull();
    const submit = () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await act(async () => submit());

    expect(container.querySelector('.fixed form')).toBe(form);
    expect(form.querySelector('input[required]').value).toBe('Životy slavných');
    expect(form.querySelector('[role="alert"]').textContent).toContain('Kniha nebyla uložena');
    expect(booksStore).toHaveLength(0);

    await act(async () => submit());

    expect(container.querySelector('.fixed form')).toBeNull();
    expect(booksStore).toHaveLength(1);
  });

  it('debounces repeated scans of the exact same barcode within cooldown window', async () => {
    vi.spyOn(isbnService, 'lookupBookByIsbnDetailed').mockResolvedValue({
      metadata: {
        isbn: '9788025703670',
        title: 'Životy slavných',
        author: 'Jean de Nostredame',
        publishedYear: '2011',
      },
      isNetworkError: false,
    });

    await act(async () => {
      root.render(<ScannerTab activeShelfId={10} onNavigateToStructure={() => {}} />);
    });

    // Start fast scan mode to auto-save and test repeated barcode handling
    const fastModeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Zapnout rychlé skenování') || b.textContent?.includes('Režim rychlého skenování')
    );
    await act(async () => {
      fastModeBtn?.click();
    });

    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Spustit skenování')
    );
    await act(async () => {
      startBtn?.click();
    });

    expect(scanCallback).not.toBeNull();

    // Trigger first scan
    await act(async () => {
      await scanCallback!({ getText: () => '978-80-257-0367-0' });
    });

    expect(booksStore.length).toBe(1);
    expect(booksStore[0].quantity).toBe(1);

    // Immediate second scan of the identical barcode should be debounced / ignored by cooldown
    await act(async () => {
      await scanCallback!({ getText: () => '978-80-257-0367-0' });
    });

    // Still only 1 book and lookupBookByIsbnDetailed only called once
    expect(booksStore.length).toBe(1);
    expect(isbnService.lookupBookByIsbnDetailed).toHaveBeenCalledTimes(1);
  });

  it('prevents overlapping operations when handleRetryNetworkIsbn is triggered while processing', async () => {
    let callCount = 0;
    let resolveRetryPromise: any;

    vi.spyOn(isbnService, 'lookupBookByIsbnDetailed').mockImplementation(async (_isbn: string) => {
      callCount++;
      if (callCount === 1) {
        // First scan results in network failure
        return {
          metadata: null,
          isNetworkError: true,
          errorMessage: 'Katalogy jsou dočasně nedostupné',
        };
      }
      // Second scan (retry) is slow
      return new Promise((resolve) => {
        resolveRetryPromise = resolve;
      });
    });

    await act(async () => {
      root.render(<ScannerTab activeShelfId={10} onNavigateToStructure={() => {}} />);
    });

    // Switch to fast scan mode
    const fastModeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Zapnout rychlé skenování') || b.textContent?.includes('Režim rychlého skenování')
    );
    await act(async () => {
      fastModeBtn?.click();
    });

    // Start camera
    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Spustit skenování')
    );
    await act(async () => {
      startBtn?.click();
    });

    // First scan triggers network error lookup
    await act(async () => {
      await scanCallback!({ getText: () => '9788000000001' });
    });

    // Should display network error banner with "Zkusit znovu"
    expect(container.textContent).toContain('Výpadek sítě / katalogu pro ISBN 9788000000001');

    const retryBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Zkusit znovu')
    );
    expect(retryBtn).toBeDefined();

    // Click retry (starts async lookup for 9788000000001 and sets isProcessingRef.current = true)
    await act(async () => {
      retryBtn?.click();
    });

    expect(callCount).toBe(2);

    // While retry lookup is pending in background, camera captures another code
    await act(async () => {
      await scanCallback!({ getText: () => '9788000000002' });
    });

    // The camera scan must have been rejected because isProcessingRef was locked!
    expect(callCount).toBe(2);
    expect(isbnService.lookupBookByIsbnDetailed).not.toHaveBeenCalledWith('9788000000002');

    // Resolve the retry promise
    await act(async () => {
      resolveRetryPromise({
        metadata: {
          isbn: '9788000000001',
          title: 'Obnovená kniha',
          author: 'Autor',
          publishedYear: '2024',
        },
        isNetworkError: false,
      });
    });

    expect(booksStore.length).toBe(1);
    expect(booksStore[0].title).toBe('Obnovená kniha');
  });

  it('recovers scanner state using the reset button when an error occurs', async () => {
    await act(async () => {
      root.render(<ScannerTab activeShelfId={10} onNavigateToStructure={() => {}} />);
    });

    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Spustit skenování')
    );
    await act(async () => {
      startBtn?.click();
    });

    // Simulate an unexpected error in scan callback
    vi.spyOn(isbnService, 'lookupBookByIsbnDetailed').mockRejectedValue(
      new Error('Critical DB/Catalog crash')
    );

    await act(async () => {
      await scanCallback!({ getText: () => '9788099999999' });
    });

    // Error banner should appear with "Resetovat čtečku"
    expect(container.textContent).toContain('Došlo k potížím se čtením nebo spojením');
    const resetBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Resetovat čtečku')
    );
    expect(resetBtn).toBeDefined();

    await act(async () => {
      resetBtn?.click();
    });

    expect(container.textContent).toContain('Čtečka byla restartována a je připravena.');
  });

  it('handles asynchronous camera startup failure and sets error message', async () => {
    await act(async () => {
      root.render(<ScannerTab activeShelfId={10} onNavigateToStructure={() => {}} />);
    });

    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Spustit skenování')
    );
    await act(async () => {
      startBtn?.click();
    });

    // Trigger async rejection from decode promise (e.g. NotAllowedError)
    await act(async () => {
      if (decodeReject) {
        decodeReject(new Error('NotAllowedError: Permission denied by user'));
      }
    });

    expect(container.textContent).toContain('Kamera nemohla být spuštěna (zkontrolujte oprávnění v prohlížeči).');
    // Camera is stopped and reset banner is available
    expect(container.textContent).toContain('Resetovat čtečku');
  });

  it('shows duplicate modal in fast scan mode and displays thumbs-up cat overlay upon confirmation', async () => {
    // Pre-populate DB with existing book on shelf 10
    booksStore.push({
      id: 1,
      libraryId: 30,
      roomId: 20,
      shelfId: 10,
      isbn: '9788025703670',
      title: 'Životy slavných',
      author: 'Jean de Nostredame',
      publishedYear: '2011',
      quantity: 1,
      scannedAt: new Date(),
    });

    vi.spyOn(isbnService, 'lookupBookByIsbnDetailed').mockResolvedValue({
      metadata: {
        isbn: '9788025703670',
        title: 'Životy slavných',
        author: 'Jean de Nostredame',
        publishedYear: '2011',
      },
      isNetworkError: false,
    });

    await act(async () => {
      root.render(<ScannerTab activeShelfId={10} onNavigateToStructure={() => {}} />);
    });

    // Turn on fast scan mode
    const fastModeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Zapnout rychlé skenování') || b.textContent?.includes('Režim rychlého skenování')
    );
    await act(async () => {
      fastModeBtn?.click();
    });

    // Start camera
    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Spustit skenování')
    );
    await act(async () => {
      startBtn?.click();
    });

    // Scan the same ISBN
    await act(async () => {
      await scanCallback!({ getText: () => '978-80-257-0367-0' });
    });

    // Duplicate modal must appear even in fast mode!
    expect(container.textContent).toContain('Kniha již existuje v databázi!');
    expect(container.textContent).toContain('Stávající počet na polici:');

    // Confirm duplicate (+1 piece)
    const addExemplarBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Přidat kus (+1 ks)')
    );
    expect(addExemplarBtn).toBeDefined();

    await act(async () => {
      addExemplarBtn?.click();
    });

    // Quantity should be updated to 2
    expect(booksStore[0].quantity).toBe(2);

    // Thumbs-up cat overlay should be displayed
    const thumbsUpImg = container.querySelector('img[alt="Kniha naskenována!"]');
    expect(thumbsUpImg).not.toBeNull();
    expect(container.textContent).toContain('Kniha uložena!');
  });

  it('waits for a camera frame and four seconds before recognizing printed digits', async () => {
    vi.useFakeTimers();
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    vi.spyOn(isbnOcrService, 'recognizeIsbnFromSource').mockResolvedValue('9788073352677');
    vi.spyOn(isbnService, 'lookupBookByIsbnDetailed').mockResolvedValue({
      metadata: {
        isbn: '9788073352677',
        title: 'Kniha z číslic bez čárového kódu',
        author: 'Autor Číslic',
        publishedYear: '2023',
      },
      isNetworkError: false,
    });

    await act(async () => {
      root.render(<ScannerTab activeShelfId={10} onNavigateToStructure={() => {}} />);
    });

    // Enable fast scan mode
    const fastModeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Zapnout rychlé skenování') || b.textContent?.includes('Režim rychlého skenování')
    );
    await act(async () => {
      fastModeBtn?.click();
    });

    // Start camera
    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Spustit skenování')
    );
    await act(async () => {
      startBtn?.click();
    });

    now += 6000;
    await act(async () => vi.advanceTimersByTimeAsync(1200));
    expect(isbnOcrService.recognizeIsbnFromSource).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('Skener nenalezl kód');

    await act(async () => markCameraReady(container));
    now += 3999;
    await act(async () => vi.advanceTimersByTimeAsync(1200));
    expect(isbnOcrService.recognizeIsbnFromSource).not.toHaveBeenCalled();

    now += 1;
    await act(async () => vi.advanceTimersByTimeAsync(1200));

    // OCR should have been called and the book automatically saved
    expect(isbnOcrService.recognizeIsbnFromSource).toHaveBeenCalled();
    expect(booksStore.length).toBe(1);
    expect(booksStore[0].isbn).toBe('9788073352677');
    expect(booksStore[0].title).toBe('Kniha z číslic bez čárového kódu');

    // After the fast scan finishes, OCR must get a new four-second window.
    vi.mocked(isbnOcrService.recognizeIsbnFromSource).mockResolvedValue(null);
    now += 5000;
    await act(async () => vi.advanceTimersByTimeAsync(3600));
    now += 3999;
    await act(async () => vi.advanceTimersByTimeAsync(1200));
    expect(isbnOcrService.recognizeIsbnFromSource).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain('Skener nenalezl kód');
  });

  it('restarts the wait after reading a barcode on an already running camera', async () => {
    vi.useFakeTimers();
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    vi.spyOn(isbnOcrService, 'recognizeIsbnFromSource').mockResolvedValue(null);
    vi.spyOn(isbnService, 'lookupBookByIsbnDetailed').mockResolvedValue({ metadata: null, isNetworkError: true });
    await act(async () => root.render(<ScannerTab activeShelfId={10} onNavigateToStructure={() => {}} />));

    const start = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Spustit skenování'),
    );
    await act(async () => start?.click());
    await act(async () => markCameraReady(container));

    now += 5000;
    await act(async () => scanCallback!({ getText: () => '9788025703670' }));
    now += 3999;
    await act(async () => vi.advanceTimersByTimeAsync(1200));
    expect(isbnOcrService.recognizeIsbnFromSource).not.toHaveBeenCalled();

    now += 1;
    await act(async () => vi.advanceTimersByTimeAsync(1200));
    expect(isbnOcrService.recognizeIsbnFromSource).toHaveBeenCalledTimes(1);
  });

  it('tries printed ISBN after four seconds but warns after thirty seconds in fast mode', async () => {
    vi.useFakeTimers();
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const recognize = vi.spyOn(isbnOcrService, 'recognizeIsbnFromSource').mockResolvedValue(null);

    await act(async () => root.render(<ScannerTab activeShelfId={10} onNavigateToStructure={() => {}} />));
    const fastMode = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Zapnout rychlé skenování'),
    );
    const start = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Spustit skenování'),
    );
    await act(async () => fastMode?.click());
    await act(async () => start?.click());

    now += 35000;
    await act(async () => vi.advanceTimersByTimeAsync(1200));
    expect(recognize).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Zastavit fotoaparát');

    await act(async () => markCameraReady(container));
    now += 4000;
    await act(async () => vi.advanceTimersByTimeAsync(1200));
    expect(recognize).toHaveBeenCalledTimes(1);

    now += 25999;
    await act(async () => vi.advanceTimersByTimeAsync(1200));
    expect(container.textContent).not.toContain('Skener nenalezl kód');
    expect(container.textContent).toContain('Zastavit fotoaparát');

    now += 1;
    await act(async () => vi.advanceTimersByTimeAsync(1200));
    expect(container.textContent).toContain('Skener nenalezl kód');
    expect(container.textContent).toContain('Spustit skenování');
  });

  it('shows lighting warning, stops camera and offers retry on first OCR failure', async () => {
    vi.useFakeTimers();
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    vi.spyOn(isbnOcrService, 'recognizeIsbnFromSource').mockResolvedValue(null);

    await act(async () => {
      root.render(<ScannerTab activeShelfId={10} onNavigateToStructure={() => {}} />);
    });

    const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Spustit skenování')
    );
    await act(async () => {
      startBtn?.click();
    });

    await act(async () => markCameraReady(container));

    // Advance time beyond 4500ms threshold
    now += 5000;

    // Wait for OCR interval to fire
    await act(async () => vi.advanceTimersByTimeAsync(1200));

    // Warning banner must be displayed
    expect(container.textContent).toContain('Skener nenalezl kód. Zkuste zlepšit osvětlení nebo lépe zaostřit na text.');

    // Camera is automatically turned off
    expect(container.textContent).toContain('Spustit skenování');

    // "Zkusit znovu" button is visible
    const retryOcrBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Zkusit znovu')
    );
    expect(retryOcrBtn).toBeDefined();

    // Click "Zkusit znovu" - restarts camera
    await act(async () => {
      retryOcrBtn?.click();
    });

    expect(container.textContent).toContain('Zastavit fotoaparát');

    await act(async () => markCameraReady(container));

    // Advance time again past 4500ms -> persistent failure!
    now += 5000;

    await act(async () => vi.advanceTimersByTimeAsync(1200));

    // Now persistent failure banner appears
    expect(container.textContent).toContain('ISBN kód nebyl naskenován');
    const manualBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Ruční zadání ISBN kódu')
    );
    expect(manualBtn).toBeDefined();

    // Clicking manual button opens the manual entry modal
    await act(async () => {
      manualBtn?.click();
    });

    expect(container.textContent).toContain('Ruční zadání údajů o knize');
  });
});
