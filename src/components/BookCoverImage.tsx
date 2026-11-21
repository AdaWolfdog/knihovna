import { useState, type ReactNode } from 'react';
import { hasCoverDimensions } from '../services/bookCoverService';

interface BookCoverImageProps {
  src?: string;
  alt: string;
  className: string;
  fallback: ReactNode;
}

export function BookCoverImage({ src, alt, className, fallback }: BookCoverImageProps) {
  const [failedSrc, setFailedSrc] = useState<string>();

  if (!src?.trim() || failedSrc === src) return fallback;
  return (
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
}
