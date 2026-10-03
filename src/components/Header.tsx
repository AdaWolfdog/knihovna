import React from 'react';
import { QrCode, Library as LibraryIcon, BookOpen, Download } from 'lucide-react';

interface HeaderProps {
  activeTab: 'scan' | 'structure' | 'books';
  setActiveTab: (tab: 'scan' | 'structure' | 'books') => void;
  activeShelfName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activeShelfName,
}) => {
  return (
    <header className="bg-slate-900 text-white shadow-md sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white my-0 leading-tight">
                Knihovník Mobile
              </h1>
              <p className="text-xs text-slate-400">
                {activeShelfName ? (
                  <span className="text-indigo-300 font-medium">
                    Aktivní police: {activeShelfName}
                  </span>
                ) : (
                  'Skenování & Správa fondů'
                )}
              </p>
            </div>
          </div>

          {/* Navigation tabs */}
          <nav className="flex bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('scan')}
              className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'scan'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>Skenovat</span>
            </button>

            <button
              onClick={() => setActiveTab('structure')}
              className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'structure'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <LibraryIcon className="w-4 h-4" />
              <span>Knihovna & Police</span>
            </button>

            <button
              onClick={() => setActiveTab('books')}
              className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'books'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Knihy & Export</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
