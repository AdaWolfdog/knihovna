import { useMemo, useState } from 'react';
import type { Book } from '../db/db';
import { useLanguage } from '../i18n';
import { sortBooks, type BookSortCriterion, type BookSortDirection } from '../services/bookSort';

export function useBookView(books: readonly Book[]) {
  const { language } = useLanguage();
  const [view, setView] = useState<'list' | 'gallery'>('list');
  const [sortCriterion, setSortCriterion] = useState<BookSortCriterion>('title');
  const [sortDirection, setSortDirection] = useState<BookSortDirection>('asc');
  const collator = useMemo(() => new Intl.Collator(language === 'emoji' ? 'cs' : language, { numeric: true }), [language]);
  const sortedBooks = useMemo(
    () => sortBooks(books, sortCriterion, sortDirection, collator),
    [books, sortCriterion, sortDirection, collator],
  );

  return { view, setView, sortCriterion, setSortCriterion, sortDirection, setSortDirection, sortedBooks };
}
