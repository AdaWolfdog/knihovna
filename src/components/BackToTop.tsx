import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { useLanguage } from '../i18n';

export function BackToTop() {
  const { t } = useLanguage();
  const marker = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    let wasVisible = false;
    const checkVisibility = () => {
      frame = 0;
      const next = (marker.current?.getBoundingClientRect().bottom ?? 0) < -280;
      if (next === wasVisible) return;
      wasVisible = next;
      setVisible(next);
    };
    const scheduleCheck = () => {
      if (!frame) frame = window.requestAnimationFrame(checkVisibility);
    };

    checkVisibility();
    window.addEventListener('scroll', scheduleCheck, { passive: true });
    window.addEventListener('resize', scheduleCheck);
    return () => {
      window.removeEventListener('scroll', scheduleCheck);
      window.removeEventListener('resize', scheduleCheck);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const backToTop = () => {
    marker.current?.closest('main')?.focus({ preventScroll: true });
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' });
  };

  return (
    <>
      <span ref={marker} aria-hidden="true" className="pointer-events-none absolute top-0 size-px" />
      {visible && (
        <button
          type="button"
          aria-label={t('backToTop')}
          title={t('backToTop')}
          onClick={backToTop}
          className="book-back-to-top fixed z-20 flex size-11 cursor-pointer items-center justify-center rounded-full bg-indigo-600 text-on-accent shadow-md hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <ArrowUp className="size-5" aria-hidden="true" />
        </button>
      )}
    </>
  );
}
