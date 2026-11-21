import React, { useState } from 'react';
import { QrCode, Library as LibraryIcon, BookOpen, Download, ChevronUp, Globe } from 'lucide-react';
import { useLanguage, LANGUAGES, type Language } from '../i18n';
import { ThemeSelect } from './ThemeSelect';

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
  const selectedLanguage = LANGUAGES.find((option) => option.code === language) ?? LANGUAGES[0];

  return (
    <header className="bg-chrome text-chrome-text shadow-md sticky top-0 z-30 transition-all">
      <div className="max-w-6xl mx-auto px-4 py-3 relative">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Top row: Brand + Language selector + mobile toggle in bottom-right */}
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="p-2 bg-indigo-600 rounded-lg shrink-0">
                <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-on-accent" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-chrome-text my-0 leading-tight truncate">
                  {t('appTitle')}
                </h1>
                <p className="text-[11px] sm:text-xs text-chrome-muted truncate">
                  {activeShelfName ? (
                    <span className="text-chrome-muted font-medium">
                      {t('activeShelf')} {activeShelfName}
                    </span>
                  ) : (
                    t('appSubtitle')
                  )}
                </p>
              </div>

              {/* Appearance controls stay available while mobile navigation is collapsed. */}
              <div className="flex items-center gap-1 shrink-0">
                <div className="relative inline-flex items-center shrink-0">
                  <div className="flex h-8 min-w-8 items-center justify-center gap-1 bg-chrome-panel/90 hover:bg-chrome-hover border border-chrome-line rounded-lg px-2 py-1 text-xs text-chrome-text transition shadow-inner focus-within:ring-2 focus-within:ring-chrome-muted">
                    <Globe className="w-3.5 h-3.5 text-chrome-muted shrink-0 hidden sm:inline" />
                    <span className="text-sm sm:hidden" aria-hidden="true">
                      {selectedLanguage.flag ?? selectedLanguage.label}
                    </span>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as Language)}
                      aria-label="Výběr jazyka"
                      className="absolute inset-0 size-full cursor-pointer bg-transparent text-xs font-medium text-chrome-text opacity-0 focus:outline-hidden sm:static sm:size-auto sm:py-0.5 sm:pr-1 sm:opacity-100"
                      data-testid="language-select"
                    >
                      {LANGUAGES.map((lang) => (
                        <option
                          key={lang.code}
                          value={lang.code}
                          className="bg-chrome text-chrome-text py-1"
                        >
                          {lang.flag ? `${lang.flag} ${lang.label}` : lang.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <ThemeSelect />
              </div>
            </div>

            {!isMobileMenuOpen && (
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Rozbalit menu"
                className="sm:hidden self-center px-2 py-1.5 text-xs font-semibold text-chrome-muted hover:text-chrome-text bg-chrome-panel hover:bg-chrome-hover rounded-lg transition-colors cursor-pointer shrink-0"
                title={t('expandMenu')}
              >
                MENU
              </button>
            )}
          </div>

          {/* Navigation tabs: hidden on mobile when collapsed, visible on sm+ or when mobile menu is open */}
          <div className={`${!isMobileMenuOpen ? 'hidden sm:block' : 'block'} w-full lg:w-auto`}>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <nav className="flex bg-chrome-panel p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('scan');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === 'scan'
                      ? 'bg-indigo-600 text-on-accent shadow'
                      : 'text-chrome-muted hover:text-chrome-text hover:bg-chrome-hover'
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
                      ? 'bg-indigo-600 text-on-accent shadow'
                      : 'text-chrome-muted hover:text-chrome-text hover:bg-chrome-hover'
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
                      ? 'bg-indigo-600 text-on-accent shadow'
                      : 'text-chrome-muted hover:text-chrome-text hover:bg-chrome-hover'
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
                  className="flex items-center gap-1 text-xs text-chrome-muted hover:text-chrome-text bg-chrome-panel px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
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
