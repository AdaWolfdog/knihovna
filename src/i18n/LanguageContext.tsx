import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Language } from './types';
import { textToEmoji } from './types';
import { cs, type TranslationKey } from './locales/cs';
import { en } from './locales/en';
import { de } from './locales/de';
import { es } from './locales/es';

const DICTIONARIES: Record<'cs' | 'en' | 'de' | 'es', Record<TranslationKey, string>> = {
  cs,
  en,
  de,
  es,
};

// Form label keys that MUST remain in clear Czech even in emoji mode, as requested by user:
// "chci, aby názvy políček (název, autor...) zůstaly čitelně v češtině, i pokud uživatel změní jazyk na tento emoji jazyk"
const FORM_LABEL_KEYS: Set<TranslationKey> = new Set([
  'formLabelBookTitle',
  'formLabelAuthor',
  'formLabelIsbn',
  'formLabelIsbnOptional',
  'formLabelPublishedYear',
  'formLabelEditionNumber',
  'formLabelEdition',
  'formLabelQuantity',
  'formLabelPublisher',
  'formLabelPlaceOfPublication',
  'formLabelGenre',
  'formLabelKeywords',
  'formLabelTranslator',
  'formLabelTranslatorOptional',
  'formLabelCnb',
  'formLabelPhysicalDesc',
  'formLabelCoverImage',
  'formLabelCoverUrlOrPhoto',
  'formLabelNotes',
  'formLabelNotesBook',
]);

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  translateDynamic: (text: string) => string;
}

const STORAGE_KEY = 'knihovnik_preferred_language';

const defaultContextValue: LanguageContextType = {
  language: 'cs',
  setLanguage: () => {},
  t: (key: TranslationKey, params?: Record<string, string | number>): string => {
    let text = cs[key] || '';
    if (params) {
      Object.entries(params).forEach(([paramKey, paramVal]) => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
      });
    }
    return text;
  },
  translateDynamic: (text: string) => text,
};

const LanguageContext = createContext<LanguageContextType>(defaultContextValue);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Language;
      if (saved && ['cs', 'en', 'de', 'es', 'emoji'].includes(saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'cs';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    document.documentElement.lang = language === 'emoji' ? 'mul' : language;
  }, [language]);

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    if (language === 'emoji') {
      if (FORM_LABEL_KEYS.has(key)) {
        return cs[key];
      }
      let baseText = cs[key] || '';
      if (params) {
        Object.entries(params).forEach(([paramKey, paramVal]) => {
          baseText = baseText.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
        });
      }
      return textToEmoji(baseText);
    }

    const dict = DICTIONARIES[language] || DICTIONARIES.cs;
    let text = dict[key] || cs[key] || '';
    if (params) {
      Object.entries(params).forEach(([paramKey, paramVal]) => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
      });
    }
    return text;
  };

  const translateDynamic = (text: string): string => {
    if (language === 'emoji') {
      return textToEmoji(text);
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, translateDynamic }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  return useContext(LanguageContext);
};
