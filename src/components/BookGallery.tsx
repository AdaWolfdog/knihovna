import type { ReactNode } from 'react';
import { BookOpen, Image as ImageIcon } from 'lucide-react';
import type { Book } from '../db/db';
import { useLanguage } from '../i18n';
import { BookCoverImage } from './BookCoverImage';
import { BookQuantityControl } from './BookQuantityControl';
import { DEFAULT_LIBRARY_COLOR } from './libraryColors';

interface BookGalleryProps {
  sortedBooks: readonly Book[];
  isMobileLandscapeTable: boolean;
  getLibraryColor: (book: Book) => string | undefined;
  renderBookActions: (book: Book) => ReactNode;
}

export function BookGallery({ sortedBooks, isMobileLandscapeTable, getLibraryColor, renderBookActions }: BookGalleryProps) {
  const { t } = useLanguage();

  return (
    <ul className={`grid gap-3 sm:gap-4 ${isMobileLandscapeTable ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
      {sortedBooks.map((book) => {
        const title = book.title || t('unknownTitle');
        const color = getLibraryColor(book) || DEFAULT_LIBRARY_COLOR;

        return (
          <li key={book.id} className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-center bg-indigo-50 px-2 py-3 sm:py-4">
              <BookCoverImage
                src={book.coverUrl}
                alt={title}
                loading="lazy"
                className="h-32 w-auto max-w-full rounded-sm object-contain shadow-sm sm:h-48"
                fallback={
                  <div className="flex h-32 aspect-[2/3] max-w-full items-center justify-center rounded-md border border-slate-200 bg-slate-100 text-slate-400 sm:h-48">
                    <ImageIcon className="size-7" aria-hidden="true" />
                  </div>
                }
              />
            </div>
            <div className="flex grow flex-col gap-2 p-2.5 sm:p-3">
              <div>
                <h3 className="flex items-start gap-1.5 text-sm font-bold text-slate-900">
                  <BookOpen className="mt-0.5 size-4 shrink-0" style={{ color }} aria-hidden="true" />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{title}</span>
                </h3>
                <p className="text-xs text-slate-500 [overflow-wrap:anywhere]">{book.author || t('unknownAuthor')}</p>
              </div>
              <div className="mt-auto flex flex-wrap items-start justify-between gap-x-1 gap-y-1.5 border-t border-slate-100 pt-2">
                <BookQuantityControl book={book} />
                {renderBookActions(book)}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
