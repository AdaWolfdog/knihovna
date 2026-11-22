import { changeBookQuantity, type Book } from '../db/db';
import { useLanguage } from '../i18n';

interface BookQuantityControlProps {
  book: Book;
  compact?: 'portrait' | 'landscape';
}

const buttonClassName = 'w-5 h-5 flex items-center justify-center bg-white hover:bg-indigo-100 text-indigo-700 font-bold rounded text-xs shadow-xs transition cursor-pointer';

export function BookQuantityControl({ book, compact }: BookQuantityControlProps) {
  const { t } = useLanguage();
  const layout = compact
    ? `hidden gap-1 p-0.5 ${compact === 'portrait' ? 'mobile-portrait-only' : 'mobile-landscape-quantity'}`
    : 'inline-flex gap-1.5 p-1';

  const changeQuantity = async (delta: -1 | 1) => {
    if (book.id === undefined) return;
    try {
      await changeBookQuantity(book.id, delta, () => confirm(t('confirmDeleteBookCompletely')));
    } catch (error) {
      console.error('Failed to change book quantity:', error);
      alert(t('dbSaveError'));
    }
  };

  return (
    <div className={`${layout} items-center bg-indigo-50 border border-indigo-200 rounded-lg`}>
      <button type="button" onClick={() => changeQuantity(-1)} className={buttonClassName} title={t('decreaseQtyTooltip')}>
        -
      </button>
      <span className={`font-extrabold text-indigo-900 px-1 whitespace-nowrap ${compact ? 'text-xs' : 'text-sm'}`}>
        {book.quantity || 1} {t('piecesSuffix')}
      </span>
      <button type="button" onClick={() => changeQuantity(1)} className={buttonClassName} title={t('increaseQtyTooltip')}>
        +
      </button>
    </div>
  );
}
