import { useState, type ReactNode } from 'react';
import { getCoverSourcePage, hasCoverDimensions } from '../services/bookCoverService';

interface BookCoverImageProps {
  src?: string;
  alt: string;
  className: string;
  fallback: ReactNode;
}

export function BookCoverImage({ src, alt, className, fallback }: BookCoverImageProps) {
  const [failedSrc, setFailedSrc] = useState<string>();

  if (!src?.trim() || failedSrc === src) return fallback;
  const sourcePage = getCoverSourcePage(src);
  const image = (
    <img
      key={src}
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailedSrc(src)}
      onLoad={({ currentTarget }) => {
        if (!hasCoverDimensions(currentTarget)) setFailedSrc(src);
      }}
    />
  );
  return sourcePage ? (
    <a href={sourcePage} target="_blank" rel="noreferrer" className="contents">
      {image}
    </a>
  ) : image;
}
