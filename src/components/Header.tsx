import React, { useState } from 'react';
import { QrCode, Library as LibraryIcon, BookOpen, Download, ChevronUp, ChevronDown } from 'lucide-react';

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="bg-slate-900 text-white shadow-md sticky top-0 z-30 transition-all">
      <div className="max-w-6xl mx-auto px-4 py-3 relative">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Top row: Brand + Active shelf + mobile toggle in bottom-right */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-600 rounded-lg shrink-0">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight text-white my-0 leading-tight">
                  Knihovník Mobile
                </h1>
                <p className="text-xs text-slate-400 truncate">
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

            {/* Mobile collapse / expand toggle icon in bottom right of the collapsed header */}
            {!isMobileMenuOpen && (
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Rozbalit menu"
                className="sm:hidden self-end p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                title="Rozbalit menu"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Navigation tabs: hidden on mobile when collapsed, visible on sm+ or when mobile menu is open */}
          <div className={`${!isMobileMenuOpen ? 'hidden sm:block' : 'block'} w-full sm:w-auto`}>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <nav className="flex bg-slate-800 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('scan');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === 'scan'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>Skenovat</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('structure');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === 'structure'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <LibraryIcon className="w-4 h-4" />
                  <span>Knihovna & Police</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('books');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === 'books'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  <span>Knihy & Export</span>
                </button>
              </nav>

              {/* Bottom right arrow button on mobile to collapse header when open */}
              <div className="flex justify-end sm:hidden">
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label="Sbalit menu"
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <span>Sbalit</span>
                  <ChevronUp className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
