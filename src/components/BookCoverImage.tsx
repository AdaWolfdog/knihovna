import { useEffect, useState, type ReactNode } from 'react';
import { db } from '../db/db';
import { toIsbn13 } from '../services/isbnService';
import { getCoverSourcePage, hasCoverDimensions, resolveBackgroundBookCover } from '../services/bookCoverService';

interface BookCoverImageProps {
  src?: string;
  isbn?: string;
  bookId?: number;
  alt: string;
  className: string;
  fallback: ReactNode;
}

export function BookCoverImage({ src, isbn, bookId, alt, className, fallback }: BookCoverImageProps) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const [found, setFound] = useState<{ key: string; url?: string }>();
  const savedUrl = src?.trim() || undefined;
  const needsCover = !savedUrl || failedSrc === savedUrl;
  const lookupKey = JSON.stringify([bookId, isbn, savedUrl]);

  useEffect(() => {
    if (!needsCover || !isbn) return;
    let mounted = true;

    void resolveBackgroundBookCover(isbn, savedUrl).then((url) => {
      if (!url) return;
      if (mounted) setFound({ key: lookupKey, url });
      if (bookId === undefined) return;

      // A user may edit the book or add a cover while the image is loading.
      return db.transaction('rw', db.books, async () => {
        const current = await db.books.get(bookId);
        if (!current || toIsbn13(current.isbn) !== toIsbn13(isbn)) return;
        if ((current.coverUrl?.trim() || undefined) !== savedUrl) return;
        await db.books.update(bookId, { coverUrl: url });
      });
    }).catch((error: unknown) => console.warn('Could not save the background book cover', error));

    return () => { mounted = false; };
  }, [bookId, isbn, lookupKey, needsCover, savedUrl]);

  const displayUrl = needsCover ? (found?.key === lookupKey ? found.url : undefined) : savedUrl;
  if (!displayUrl) return fallback;

  const markFailed = () => {
    if (needsCover) setFound({ key: lookupKey });
    else setFailedSrc(displayUrl);
  };
  const sourcePage = getCoverSourcePage(displayUrl);
  const image = (
    <img
      key={displayUrl}
      src={displayUrl}
      alt={alt}
      className={className}
      onError={markFailed}
      onLoad={({ currentTarget }) => {
        if (!hasCoverDimensions(currentTarget)) markFailed();
      }}
    />
  );
  return sourcePage ? (
    <a href={sourcePage} target="_blank" rel="noreferrer" className="contents">
      {image}
    </a>
  ) : image;
}
