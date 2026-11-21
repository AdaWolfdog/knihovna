import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/db';
import { Header } from './components/Header';
import { ScannerTab } from './components/ScannerTab';
import { LibraryManager } from './components/LibraryManager';
import { BookListTab } from './components/BookListTab';
import { LanguageProvider, useLanguage } from './i18n';

type Tab = 'scan' | 'structure' | 'books';
const ACTIVE_TAB_KEY = 'knihovnik_active_tab';

function readActiveTab(): Tab {
  try {
    const saved = sessionStorage.getItem(ACTIVE_TAB_KEY);
    return saved === 'structure' || saved === 'books' ? saved : 'scan';
  } catch {
    return 'scan';
  }
}

function AppContent() {
  const [activeTab, setActiveTabState] = useState(readActiveTab);
  const [selectedShelfId, setActiveShelfId] = useState<number | null>(null);
  const { t } = useLanguage();

  const shelves = useLiveQuery(() => db.shelves.toArray(), []) || [];

  useEffect(() => {
    void db.transaction('rw', [db.libraries, db.rooms, db.shelves], async () => {
      if (await db.libraries.count()) return;

      const createdAt = new Date();
      const libraryId = await db.libraries.add({ name: 'Hlavní knihovna', createdAt });
      const roomId = await db.rooms.add({ libraryId, name: 'Hlavní místnost', createdAt });
      await db.shelves.add({ libraryId, roomId, name: 'Police A1', createdAt });
    }).catch((error: unknown) => {
      console.error('Failed to initialize the library:', error);
    });
  }, []);

  const setActiveTab = (tab: Tab) => {
    setActiveTabState(tab);
    try {
      sessionStorage.setItem(ACTIVE_TAB_KEY, tab);
    } catch {
      // Navigation still works when browser storage is unavailable.
    }
  };

  const activeShelf = shelves.find((shelf) => shelf.id === selectedShelfId) ?? shelves[0];
  const activeShelfId = activeShelf?.id ?? null;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className={activeTab === 'scan' ? 'sm:flex-1 sm:pb-12' : 'flex-1 pb-12'}>
        {activeTab === 'scan' && (
          <ScannerTab
            activeShelfId={activeShelfId}
            onNavigateToStructure={() => setActiveTab('structure')}
          />
        )}

        {activeTab === 'structure' && (
          <LibraryManager
            activeShelfId={activeShelfId}
            setActiveShelfId={setActiveShelfId}
            onSelectShelfForScanning={(shelfId) => {
              setActiveShelfId(shelfId);
              setActiveTab('scan');
            }}
          />
        )}

        {activeTab === 'books' && <BookListTab />}
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 px-4 text-center text-xs text-slate-500">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2">
          <span className="font-semibold text-slate-700">
            {t('appTitle')} &copy; {new Date().getFullYear()}
          </span>
          <span className="hidden sm:inline text-slate-400">–</span>
          <span className="text-slate-500">
            {t('footerText')}
          </span>
        </div>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;
