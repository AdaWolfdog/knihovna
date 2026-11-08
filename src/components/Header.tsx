import React, { useState } from 'react';
import { QrCode, Library as LibraryIcon, BookOpen, Download, ChevronUp, ChevronDown, Globe } from 'lucide-react';
import { useLanguage, LANGUAGES, type Language } from '../i18n';

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
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="bg-slate-900 text-white shadow-md sticky top-0 z-30 transition-all">
      <div className="max-w-6xl mx-auto px-4 py-3 relative">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Top row: Brand + Language selector + mobile toggle in bottom-right */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              <div className="p-2 bg-indigo-600 rounded-lg shrink-0">
                <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white my-0 leading-tight truncate">
                  {t('appTitle')}
                </h1>
                <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                  {activeShelfName ? (
                    <span className="text-indigo-300 font-medium">
                      {t('activeShelf')} {activeShelfName}
                    </span>
                  ) : (
                    t('appSubtitle')
                  )}
                </p>
              </div>

              {/* Language Selector to the right of logo and title */}
              <div className="relative inline-flex items-center ml-1 sm:ml-2 shrink-0">
                <div className="flex items-center gap-1 bg-slate-800/90 hover:bg-slate-750 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 transition shadow-inner">
                  <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0 hidden sm:inline" />
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as Language)}
                    aria-label="Výběr jazyka"
                    className="bg-transparent text-xs text-slate-200 focus:outline-hidden cursor-pointer py-0.5 pr-1 font-medium"
                    data-testid="language-select"
                  >
                    {LANGUAGES.map((lang) => (
                      <option
                        key={lang.code}
                        value={lang.code}
                        className="bg-slate-900 text-white py-1"
                      >
                        {lang.flag ? `${lang.flag} ${lang.label}` : lang.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Mobile collapse / expand toggle icon in bottom right of the collapsed header */}
            {!isMobileMenuOpen && (
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Rozbalit menu"
                className="sm:hidden self-center p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer shrink-0"
                title={t('expandMenu')}
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
                  <span>{t('navScan')}</span>
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
                  <span>{t('navStructure')}</span>
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
                  <span>{t('navBooks')}</span>
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
                  <span>{t('collapseMenu')}</span>
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
