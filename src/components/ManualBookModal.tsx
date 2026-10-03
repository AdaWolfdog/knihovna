import React, { useState } from 'react';
import type { Book } from '../db/db';
import { X, Save, BookPlus } from 'lucide-react';

interface ManualBookModalProps {
  initialIsbn?: string;
  initialData?: Partial<Book>;
  shelfName: string;
  onSave: (bookData: {
    isbn: string;
    title: string;
    author: string;
    publishedYear: string;
    translator?: string;
    editionNumber?: string;
    quantity: number;
    notes?: string;
  }) => void;
  onClose: () => void;
}

export const ManualBookModal: React.FC<ManualBookModalProps> = ({
  initialIsbn = '',
  initialData,
  shelfName,
  onSave,
  onClose,
}) => {
  const [isbn, setIsbn] = useState(initialData?.isbn || initialIsbn);
  const [title, setTitle] = useState(initialData?.title || '');
  const [author, setAuthor] = useState(initialData?.author || '');
  const [publishedYear, setPublishedYear] = useState(initialData?.publishedYear || '');
  const [translator, setTranslator] = useState(initialData?.translator || '');
  const [editionNumber, setEditionNumber] = useState(initialData?.editionNumber || '');
  const [quantity, setQuantity] = useState(initialData?.quantity || 1);
  const [notes, setNotes] = useState(initialData?.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Prosím vyplňte název knihy.');
      return;
    }
    onSave({
      isbn: isbn.trim(),
      title: title.trim(),
      author: author.trim(),
      publishedYear: publishedYear.trim(),
      translator: translator.trim(),
      editionNumber: editionNumber.trim(),
      quantity: Math.max(1, Number(quantity) || 1),
      notes: notes.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-indigo-600">
            <BookPlus className="w-6 h-6" />
            <h3 className="text-lg font-bold text-slate-900">
              {initialData ? 'Upravit údaje o knize' : 'Ruční zadání údajů o knize'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 my-3">
          Cílová police: <span className="font-semibold text-slate-800">{shelfName}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ISBN (volitelné pro staré knihy)
            </label>
            <input
              type="text"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="Např. 978-80-204-1234-5"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Název knihy <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Např. Babička"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Autor / Autoři
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Např. Božena Němcová"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rok vydání
              </label>
              <input
                type="text"
                value={publishedYear}
                onChange={(e) => setPublishedYear(e.target.value)}
                placeholder="Např. 1952"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Číslo vydání
              </label>
              <input
                type="text"
                value={editionNumber}
                onChange={(e) => setEditionNumber(e.target.value)}
                placeholder="Např. 2. vydání"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Počet kusů <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-indigo-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Překladatel (případně)
            </label>
            <input
              type="text"
              value={translator}
              onChange={(e) => setTranslator(e.target.value)}
              placeholder="Např. Jan Novák"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Poznámka / Stav knihy
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Libovolné poškození, poznámka apod."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition"
            >
              Zrušit
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>Uložit knihu</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
