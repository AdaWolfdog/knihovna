import { useState } from 'react';
import { Edit3, RefreshCw, Trash2 } from 'lucide-react';
import { db, type Book } from '../db/db';
import { useLanguage } from '../i18n';
import { getMissingBookDetails, lookupBookByIsbnDetailed, normalizeIsbn, toIsbn13 } from '../services/isbnService';

interface BookActionsProps {
  book: Book;
  onEdit: () => void;
  onDelete: () => void;
}

const editClassName = 'rounded-lg p-1.5 text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer';

export function BookActions({ book, onEdit, onDelete }: BookActionsProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<'refreshBookSuccess' | 'refreshBookNoChanges' | 'refreshBookError'>();
  const isbn = normalizeIsbn(book.isbn);
  const canRefresh = book.id !== undefined && /^(?:97[89]\d{10}|\d{9}[\dXx])$/.test(isbn);

  const refreshDetails = async () => {
    const id = book.id;
    if (!canRefresh || id === undefined || loading) return;

    setLoading(true);
    setFeedback(undefined);
    try {
      const result = await lookupBookByIsbnDetailed(isbn);
      if (!result.metadata) {
        setFeedback(result.isNetworkError ? 'refreshBookError' : 'refreshBookNoChanges');
        return;
      }

      const metadata = result.metadata;
      const updated = await db.transaction('rw', db.books, async () => {
        const current = await db.books.get(id);
        // The book may have been edited or deleted while the catalogs were loading.
        if (!current || toIsbn13(current.isbn) !== toIsbn13(isbn)) return false;
        const changes = getMissingBookDetails(current, metadata);
        if (Object.keys(changes).length === 0) return false;
        return (await db.books.update(id, changes)) > 0;
      });
      setFeedback(updated ? 'refreshBookSuccess' : 'refreshBookNoChanges');
    } catch {
      setFeedback('refreshBookError');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-1">
        {canRefresh && (
          <button
            type="button"
            onClick={refreshDetails}
            disabled={loading}
            title={t('refreshBookDetails')}
            aria-label={t('refreshBookDetails')}
            className={`${editClassName} disabled:cursor-wait disabled:opacity-60`}
          >
            <RefreshCw className={`size-4 ${loading ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
          </button>
        )}
        <button type="button" onClick={onEdit} className={editClassName} title={t('editBookTooltip')}>
          <Edit3 className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
          title={t('deleteBookTooltip')}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>
      <span role="status" className={`max-w-32 text-xs empty:sr-only ${feedback === 'refreshBookError' ? 'text-red-700' : 'text-slate-600'}`}>
        {loading ? t('searchingInCatalogs') : feedback ? t(feedback) : ''}
      </span>
    </div>
  );
}
