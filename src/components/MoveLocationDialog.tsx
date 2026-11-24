import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { FolderInput } from 'lucide-react';
import { useLanguage } from '../i18n';

export interface MoveDestinationLibrary {
  id: number;
  name: string;
  rooms: readonly { id: number; name: string; shelves?: readonly { id: number; name: string }[] }[];
}

interface MoveLocationDialogProps {
  kind: 'room' | 'shelf' | 'book';
  name: string;
  destinations: readonly MoveDestinationLibrary[];
  availableCopies?: number;
  onMove: (libraryId: number, roomId: number | undefined, shelfId: number | undefined, quantity: number) => Promise<void>;
  onClose: () => void;
}

export function MoveLocationDialog({ kind, name, destinations, availableCopies = 1, onMove, onClose }: MoveLocationDialogProps) {
  const { t } = useLanguage();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [libraryId, setLibraryId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [shelfId, setShelfId] = useState('');
  const [quantityInput, setQuantityInput] = useState(String(availableCopies));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const selectedLibrary = destinations.find((library) => String(library.id) === libraryId);
  const selectedRoom = selectedLibrary?.rooms.find((room) => String(room.id) === roomId);
  const selectedShelf = selectedRoom?.shelves?.find((shelf) => String(shelf.id) === shelfId);
  const quantity = Number(quantityInput);
  const validQuantity = Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= availableCopies;
  const canMove = validQuantity && selectedLibrary !== undefined && (kind === 'room' || (kind === 'shelf' ? selectedRoom !== undefined : selectedShelf !== undefined));
  const titleKey = { room: 'moveRoomTooltip', shelf: 'moveShelfTooltip', book: 'moveBookTooltip' } as const;
  const noDestinationsKey = { room: 'moveNoLibraries', shelf: 'moveNoRooms', book: 'moveNoShelves' } as const;
  const selectClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm';

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMove || saving) return;

    setSaving(true);
    setFailed(false);
    try {
      await onMove(selectedLibrary.id, selectedRoom?.id, selectedShelf?.id, quantity);
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
          <span>{t(titleKey[kind])} · {name}</span>
        </h2>
        {destinations.length ? (
          <div className="space-y-3">
            {kind === 'book' && availableCopies > 1 && (
              <label className="grid gap-1.5 text-sm font-medium">
                {t('moveBookQuantity')}
                <span className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={availableCopies}
                    step={1}
                    required
                    value={quantityInput}
                    onChange={(event) => setQuantityInput(event.target.value)}
                    disabled={saving}
                    className={`${selectClass} max-w-28`}
                  />
                  <span className="text-xs text-slate-500">{t('moveBookAvailableQuantity', { count: availableCopies })}</span>
                </span>
              </label>
            )}
            <label className="grid gap-1.5 text-sm font-medium">
              {t('moveTargetLibrary')}
              <select
                required
                value={selectedLibrary ? libraryId : ''}
                onChange={(event) => {
                  setLibraryId(event.target.value);
                  setRoomId('');
                  setShelfId('');
                }}
                disabled={saving}
                className={selectClass}
              >
                <option value="" disabled>{t('moveChooseTarget')}</option>
                {destinations.map((library) => <option key={library.id} value={library.id}>{library.name}</option>)}
              </select>
            </label>
            {kind !== 'room' && selectedLibrary && (
              <label className="grid gap-1.5 text-sm font-medium">
                {t('moveTargetRoom')}
                <select
                  required
                  value={selectedRoom ? roomId : ''}
                  onChange={(event) => {
                    setRoomId(event.target.value);
                    setShelfId('');
                  }}
                  disabled={saving}
                  className={selectClass}
                >
                  <option value="" disabled>{t('moveChooseTarget')}</option>
                  {selectedLibrary.rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                </select>
              </label>
            )}
            {kind === 'book' && selectedRoom && (
              <label className="grid gap-1.5 text-sm font-medium">
                {t('moveTargetShelf')}
                <select
                  required
                  value={selectedShelf ? shelfId : ''}
                  onChange={(event) => setShelfId(event.target.value)}
                  disabled={saving}
                  className={selectClass}
                >
                  <option value="" disabled>{t('moveChooseTarget')}</option>
                  {selectedRoom.shelves?.map((shelf) => <option key={shelf.id} value={shelf.id}>{shelf.name}</option>)}
                </select>
              </label>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-600">{t(noDestinationsKey[kind])}</p>
        )}
        {failed && <p role="alert" className="text-sm text-red-700">{t('moveLocationError')}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium">
            {t('cancelBtn')}
          </button>
          <button type="submit" disabled={!canMove || saving} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-on-accent disabled:opacity-50">
            {t('moveLocationBtn')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
