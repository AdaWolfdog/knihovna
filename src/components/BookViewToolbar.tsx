import { Grid2X2, List } from 'lucide-react';
import { useLanguage } from '../i18n';
import { BookSortMenu } from './BookSortMenu';
import type { useBookView } from './useBookView';

type BookViewToolbarProps = Omit<ReturnType<typeof useBookView>, 'sortedBooks'>;

export function BookViewToolbar({ view, setView, sortCriterion, setSortCriterion, sortDirection, setSortDirection }: BookViewToolbarProps) {
  const { t } = useLanguage();

  return (
    <div className="flex items-center justify-between gap-2">
      <BookSortMenu
        criterion={sortCriterion}
        direction={sortDirection}
        onCriterionChange={setSortCriterion}
        onDirectionChange={setSortDirection}
      />
      <div role="group" aria-label={t('bookViewLabel')} className="flex shrink-0 gap-1.5">
        {([
          ['list', List, t('bookViewList')],
          ['gallery', Grid2X2, t('bookViewGallery')],
        ] as const).map(([mode, Icon, label]) => (
          <button
            key={mode}
            type="button"
            aria-label={label}
            title={label}
            aria-pressed={view === mode}
            onClick={() => setView(mode)}
            className={`inline-flex size-11 items-center justify-center rounded-xl border transition cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 sm:size-10 ${view === mode
              ? 'bg-indigo-600 border-indigo-600 text-on-accent'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'}`}
          >
            <Icon className="size-5" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}
