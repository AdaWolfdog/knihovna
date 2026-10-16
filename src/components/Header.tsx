import React, { useState } from 'react';
import { QrCode, Library as LibraryIcon, BookOpen, Download, Menu, ChevronUp } from 'lucide-react';

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
    <>
      {/* Floating Hamburger button on mobile when collapsed */}
      {!isMobileMenuOpen && (
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          aria-label="Otevřít menu"
          className="fixed top-3 right-3 z-40 sm:hidden bg-slate-900 text-white p-2.5 rounded-full shadow-lg hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
        >
          <Menu className="w-6 h-6" />
        </button>
      )}

      {/* Main Header Header */}
      <header
        className={`bg-slate-900 text-white shadow-md sticky top-0 z-30 transition-all ${
          !isMobileMenuOpen ? 'hidden sm:block' : 'block'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 py-3 relative">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-3 pr-8 sm:pr-0">
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
                onClick={() => {
                  setActiveTab('scan');
                  setIsMobileMenuOpen(false);
                }}
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
                onClick={() => {
                  setActiveTab('structure');
                  setIsMobileMenuOpen(false);
                }}
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
                onClick={() => {
                  setActiveTab('books');
                  setIsMobileMenuOpen(false);
                }}
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

            {/* Bottom right arrow button on mobile to collapse header */}
            <div className="flex justify-end sm:hidden pt-1">
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Schovat menu"
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white bg-slate-800 px-3 py-1 rounded-md transition-colors cursor-pointer"
              >
                <span>Schovat</span>
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>
    </>
  );
};
