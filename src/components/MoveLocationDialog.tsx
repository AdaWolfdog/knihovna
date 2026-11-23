import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { FolderInput, Search } from 'lucide-react';
import { useLanguage } from '../i18n';

interface MoveLocationDialogProps {
  kind: 'room' | 'shelf';
  name: string;
  destinations: readonly { id: number; name: string }[];
  onMove: (destination: number) => Promise<void>;
  onClose: () => void;
}

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function MoveLocationDialog({ kind, name, destinations, onMove, onClose }: MoveLocationDialogProps) {
  const { t } = useLanguage();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [destination, setDestination] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const searchTerms = normalizeSearch(query).trim().split(/\s+/).filter(Boolean);
  const visibleDestinations = searchTerms.length
    ? destinations.filter(({ name }) => {
        const normalized = normalizeSearch(name);
        return searchTerms.every((term) => normalized.includes(term));
      })
    : destinations;
  const validDestination = visibleDestinations.some((item) => String(item.id) === destination);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validDestination || saving) return;

    setSaving(true);
    setFailed(false);
    try {
      await onMove(Number(destination));
      onClose();
    } catch (error) {
      console.error('Failed to move library location:', error);
      setFailed(true);
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
      className="m-auto w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl backdrop:bg-overlay/60 max-[420px]:w-[calc(100%-2rem)]"
    >
      <form onSubmit={submit} className="space-y-4">
        <h2 id={id} className="flex items-start gap-2 font-bold [overflow-wrap:anywhere]">
          <FolderInput className="mt-0.5 size-4 shrink-0 text-indigo-600" aria-hidden="true" />
          <span>{t(kind === 'room' ? 'moveRoomTooltip' : 'moveShelfTooltip')} · {name}</span>
        </h2>
        {destinations.length ? (
          <div className="space-y-3">
            <label className="grid gap-1.5 text-sm font-medium">
              {t('moveSearchTarget')}
              <span className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setDestination('');
                  }}
                  disabled={saving}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-base sm:text-sm"
                />
              </span>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              {t(kind === 'room' ? 'moveTargetLibrary' : 'moveTargetRoom')}
              <select
                required
                value={validDestination ? destination : ''}
                onChange={(event) => setDestination(event.target.value)}
                disabled={saving || visibleDestinations.length === 0}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="" disabled>{t('moveChooseTarget')}</option>
                {visibleDestinations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <p role="status" className="empty:hidden text-sm text-slate-600">
              {visibleDestinations.length === 0 ? t('moveNoMatchingTargets') : ''}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-600">{t(kind === 'room' ? 'moveNoLibraries' : 'moveNoRooms')}</p>
        )}
        {failed && <p role="alert" className="text-sm text-red-700">{t('moveLocationError')}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium">
            {t('cancelBtn')}
          </button>
          <button type="submit" disabled={!validDestination || saving} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-on-accent disabled:opacity-50">
            {t('moveLocationBtn')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
