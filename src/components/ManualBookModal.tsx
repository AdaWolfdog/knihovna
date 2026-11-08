import React, { useState, useRef } from 'react';
import type { Book } from '../db/db';
import { X, Save, BookPlus, Camera, Upload, Image as ImageIcon } from 'lucide-react';

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
    genre?: string;
    keywords?: string;
    coverUrl?: string;
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
  const [genre, setGenre] = useState(initialData?.genre || '');
  const [keywords, setKeywords] = useState(initialData?.keywords || '');
  const [coverUrl, setCoverUrl] = useState(initialData?.coverUrl || '');
  const [notes, setNotes] = useState(initialData?.notes || '');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setCoverUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

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
      genre: genre.trim(),
      keywords: keywords.trim(),
      coverUrl: coverUrl.trim(),
      notes: notes.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-3.5 sm:p-6 shadow-2xl border border-slate-100 my-auto animate-fade-in max-h-[96dvh] sm:max-h-none overflow-y-auto">
        <div className="flex items-center justify-between pb-2 sm:pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-indigo-600 min-w-0">
            <BookPlus className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm sm:text-lg font-bold text-slate-900 truncate">
                {initialData ? 'Upravit údaje o knize' : 'Ruční zadání údajů o knize'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                Cílová police: <span className="font-semibold text-slate-800">{shelfName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg shrink-0 cursor-pointer"
            title="Zavřít"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-3.5 mt-2.5 sm:mt-4">
          <div>
            <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-0.5 sm:mb-1">
              Název knihy <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Např. Babička"
              className="w-full px-2.5 py-1 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-0.5 sm:mb-1 truncate">
                Autor / Autoři
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Např. Božena Němcová"
                className="w-full px-2.5 py-1 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-0.5 sm:mb-1 truncate">
                ISBN (volitelné)
              </label>
              <input
                type="text"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="Např. 978-80-204-1234-5"
                className="w-full px-2.5 py-1 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-0.5 sm:mb-1 truncate">
                Rok vydání
              </label>
              <input
                type="text"
                value={publishedYear}
                onChange={(e) => setPublishedYear(e.target.value)}
                placeholder="Např. 1952"
                className="w-full px-2.5 py-1 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-0.5 sm:mb-1 truncate">
                Číslo vydání
              </label>
              <input
                type="text"
                value={editionNumber}
                onChange={(e) => setEditionNumber(e.target.value)}
                placeholder="Např. 2. vydání"
                className="w-full px-2.5 py-1 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-0.5 sm:mb-1 truncate">
                Počet kusů <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-2.5 py-1 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-indigo-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-0.5 sm:mb-1 truncate">
                Žánr
              </label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="Např. Sci-fi, Román"
                className="w-full px-2.5 py-1 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-0.5 sm:mb-1 truncate">
                Klíčová slova
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="Např. vesmír, klasika"
                className="w-full px-2.5 py-1 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Book Cover Thumbnail Section */}
          <div className="border border-slate-200 rounded-xl p-2 sm:p-3 bg-slate-50/50 space-y-1.5 sm:space-y-2">
            <label className="block text-[11px] sm:text-xs font-semibold text-slate-700">
              Miniatura / Obrázek přebalu
            </label>

            <div className="flex items-center gap-2 sm:gap-3">
              {coverUrl ? (
                <div className="relative group w-10 h-14 sm:w-14 sm:h-20 bg-slate-200 rounded-md overflow-hidden border border-slate-300 shrink-0">
                  <img
                    src={coverUrl}
                    alt="Přebal"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setCoverUrl('')}
                    className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 p-0.5 bg-red-600 text-white rounded-full opacity-90 hover:opacity-100 transition cursor-pointer"
                    title="Odstranit obálku"
                  >
                    <X className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-10 h-14 sm:w-14 sm:h-20 bg-slate-100 border border-dashed border-slate-300 rounded-md flex flex-col items-center justify-center text-slate-400 shrink-0">
                  <ImageIcon className="w-4 h-4 sm:w-6 sm:h-6 stroke-1" />
                  <span className="text-[8px] sm:text-[9px] mt-0.5">Bez obálky</span>
                </div>
              )}

              <div className="flex-1 space-y-1 sm:space-y-2 min-w-0">
                <input
                  type="text"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="URL adresa obrázku obálky..."
                  className="w-full px-2 py-1 text-[11px] sm:px-2.5 sm:py-1.5 sm:text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                />

                <div className="flex flex-wrap gap-1 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center gap-1 text-[10px] sm:text-xs px-2 py-0.5 sm:px-2.5 sm:py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded-lg transition border border-indigo-200 cursor-pointer"
                  >
                    <Camera className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span>Vyfotit obálku</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 text-[10px] sm:text-xs px-2 py-0.5 sm:px-2.5 sm:py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition border border-slate-200 cursor-pointer"
                  >
                    <Upload className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span>Nahrát fotku</span>
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-0.5 sm:mb-1 truncate">
                Překladatel (případně)
              </label>
              <input
                type="text"
                value={translator}
                onChange={(e) => setTranslator(e.target.value)}
                placeholder="Např. Jan Novák"
                className="w-full px-2.5 py-1 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-0.5 sm:mb-1 truncate">
                Poznámka / Stav
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Libovolná poznámka"
                className="w-full px-2.5 py-1 sm:px-3 sm:py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 sm:gap-3 pt-1.5 sm:pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-medium rounded-lg transition cursor-pointer"
            >
              Zrušit
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-medium rounded-lg transition shadow-sm cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Uložit knihu</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
