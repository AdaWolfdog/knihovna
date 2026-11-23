import { useEffect, useId, useRef, useState } from 'react';
import { ArrowDownUp, ChevronDown } from 'lucide-react';
import { useLanguage, type TranslationKey } from '../i18n';
import type { BookSortCriterion, BookSortDirection } from '../services/bookSort';

const bookCriteria = [
  ['title', 'bookSortTitle'],
  ['author', 'bookSortAuthor'],
  ['published', 'bookSortPublished'],
  ['added', 'bookSortAdded'],
  ['quantity', 'bookSortQuantity'],
] as const;

const directions = [
  ['asc', 'bookSortAscending'],
  ['desc', 'bookSortDescending'],
] as const;

interface SortMenuProps<Criterion extends string> {
  criterion: Criterion;
  direction: BookSortDirection;
  onCriterionChange: (criterion: Criterion) => void;
  onDirectionChange: (direction: BookSortDirection) => void;
}

export function BookSortMenu(props: SortMenuProps<BookSortCriterion>) {
  return <SortMenu {...props} criteria={bookCriteria} />;
}

export function SortMenu<Criterion extends string>({
  criteria, criterion, direction, onCriterionChange, onDirectionChange, compact = false,
}: SortMenuProps<Criterion> & { criteria: readonly (readonly [Criterion, TranslationKey])[]; compact?: boolean }) {
  const { t } = useLanguage();
  const id = useId();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOutside(event: Event) {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    }

    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const optionClass = 'flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-indigo-50 has-checked:bg-indigo-50 has-checked:font-semibold has-checked:text-indigo-900 pointer-coarse:min-h-11';
  const radioClass = 'size-4 shrink-0 accent-indigo-600';

  return (
    <div className={compact ? 'contents' : 'relative'} ref={wrapper}>
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((previous) => !previous)}
        className={`inline-flex shrink-0 items-center border font-medium transition cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 ${compact
          ? 'h-8 gap-1 rounded-lg px-2 text-xs'
          : 'h-11 gap-2 rounded-xl px-3 text-sm sm:h-10'} ${open
          ? 'border-indigo-600 bg-indigo-600 text-on-accent'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'}`}
      >
        <ArrowDownUp className={compact ? 'size-3 shrink-0' : 'size-4'} aria-hidden="true" />
        {t('bookSortLabel')}
        {!compact && <ChevronDown className="size-4" aria-hidden="true" />}
      </button>

      <div id={id} hidden={!open} className={`absolute top-full z-30 mt-1.5 w-56 space-y-2 rounded-xl border border-slate-200 bg-white p-2 shadow-lg ${compact ? 'right-0 max-w-full' : 'left-0'}`}>
        <fieldset className="min-w-0">
          <legend className="px-2 text-xs font-semibold text-slate-500">{t('bookSortBy')}</legend>
          {criteria.map(([value, label]) => (
            <label key={value} className={optionClass}>
              <input
                type="radio"
                name={`${id}-criterion`}
                checked={criterion === value}
                onChange={() => onCriterionChange(value)}
                className={radioClass}
              />
              {t(label)}
            </label>
          ))}
        </fieldset>
        <div className="border-t border-slate-200" />
        <fieldset className="min-w-0">
          <legend className="px-2 text-xs font-semibold text-slate-500">{t('bookSortDirection')}</legend>
          {directions.map(([value, label]) => (
            <label key={value} className={optionClass}>
              <input
                type="radio"
                name={`${id}-direction`}
                checked={direction === value}
                onChange={() => onDirectionChange(value)}
                className={radioClass}
              />
              {t(label)}
            </label>
          ))}
        </fieldset>
      </div>
    </div>
  );
}
