import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/db';
import { Header } from './components/Header';
import { ScannerTab } from './components/ScannerTab';
import { LibraryManager } from './components/LibraryManager';
import { BookListTab } from './components/BookListTab';

export function App() {
  const [activeTab, setActiveTab] = useState<'scan' | 'structure' | 'books'>('scan');
  const [activeShelfId, setActiveShelfId] = useState<number | null>(null);

  const shelves = useLiveQuery(() => db.shelves.toArray(), []) || [];

  // Seed default library structure if empty
  useEffect(() => {
    const initDefaultDb = async () => {
      const libCount = await db.libraries.count();
      if (libCount === 0) {
        const libId = await db.libraries.add({
          name: 'Hlavní knihovna',
          createdAt: new Date(),
        });
        const roomId = await db.rooms.add({
          libraryId: libId,
          name: 'Hlavní místnost',
          createdAt: new Date(),
        });
        const shelfId = await db.shelves.add({
          libraryId: libId,
          roomId: roomId,
          name: 'Police A1',
          createdAt: new Date(),
        });
        setActiveShelfId(shelfId);
      }
    };
    initDefaultDb();
  }, []);

  // Set active shelf if not set
  useEffect(() => {
    if (shelves.length > 0 && activeShelfId === null) {
      setActiveShelfId(shelves[0].id!);
    }
  }, [shelves, activeShelfId]);

  const activeShelf = shelves.find((s) => s.id === activeShelfId);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeShelfName={activeShelf?.name}
      />

      <main className="flex-1 pb-12">
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

      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <p>Knihovník Mobile &copy; {new Date().getFullYear()} – Aplikace pro evidenci a skenování knih</p>
      </footer>
    </div>
  );
}

export default App;
