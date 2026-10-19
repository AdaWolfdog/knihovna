import React, { useState, useRef } from 'react';
import type { Book } from '../db/db';
import { X, Check, Camera, Upload, Image as ImageIcon, BookOpen } from 'lucide-react';

interface BookConfirmModalProps {
  initialData: Partial<Book>;
  shelfName: string;
  sourceName?: string;
  onConfirm: (bookData: Partial<Book>) => void;
  onCancel: () => void;
}

export const BookConfirmModal: React.FC<BookConfirmModalProps> = ({
  initialData,
  shelfName,
  sourceName,
  onConfirm,
  onCancel,
}) => {
  const [isbn, setIsbn] = useState(initialData.isbn || '');
  const [title, setTitle] = useState(initialData.title || '');
  const [author, setAuthor] = useState(initialData.author || '');
  const [publishedYear, setPublishedYear] = useState(initialData.publishedYear || '');
  const [translator, setTranslator] = useState(initialData.translator || '');
  const [editionNumber, setEditionNumber] = useState(initialData.editionNumber || '');
  const [quantity, setQuantity] = useState(initialData.quantity || 1);
  const [genre, setGenre] = useState(initialData.genre || '');
  const [keywords, setKeywords] = useState(initialData.keywords || '');
  const [coverUrl, setCoverUrl] = useState(initialData.coverUrl || '');
  const [publisher, setPublisher] = useState(initialData.publisher || '');
  const [placeOfPublication, setPlaceOfPublication] = useState(initialData.placeOfPublication || '');
  const [cnb, setCnb] = useState(initialData.cnb || '');
  const [physicalDescription, setPhysicalDescription] = useState(initialData.physicalDescription || '');
  const [notes, setNotes] = useState(initialData.notes || '');

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
    onConfirm({
      ...initialData,
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
      publisher: publisher.trim(),
      placeOfPublication: placeOfPublication.trim(),
      cnb: cnb.trim(),
      physicalDescription: physicalDescription.trim(),
      notes: notes.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 my-8 animate-fade-in">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-emerald-600">
            <BookOpen className="w-6 h-6" />
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Informace o naskenované knize
              </h3>
              {sourceName && (
                <span className="text-xs text-slate-500 font-normal">
                  Zdroj: {sourceName}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition cursor-pointer"
            title="Zavřít"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="my-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
          Zkontrolujte a potvrďte údaje o knize pro uložení do police{' '}
          <span className="font-bold underline">{shelfName}</span>.
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4 items-start">
            {/* Book Cover Preview */}
            <div className="w-24 h-36 bg-slate-100 border border-slate-200 rounded-xl overflow-hidden shrink-0 relative flex flex-col items-center justify-center">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={title || 'Obálka knihy'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-2 text-slate-400">
                  <ImageIcon className="w-8 h-8 mx-auto stroke-1 mb-1" />
                  <span className="text-[10px]">Bez obálky</span>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Název knihy <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
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
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ISBN
                </label>
                <input
                  type="text"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                />
              </div>
            </div>
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
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vydání
              </label>
              <input
                type="text"
                value={editionNumber}
                onChange={(e) => setEditionNumber(e.target.value)}
                placeholder="Např. 1. vydání"
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
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
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-emerald-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nakladatelství
              </label>
              <input
                type="text"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Místo vydání
              </label>
              <input
                type="text"
                value={placeOfPublication}
                onChange={(e) => setPlaceOfPublication(e.target.value)}
                placeholder="Např. Praha"
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Žánr
              </label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Klíčová slova
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Překladatel
              </label>
              <input
                type="text"
                value={translator}
                onChange={(e) => setTranslator(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ČČNB
              </label>
              <input
                type="text"
                value={cnb}
                onChange={(e) => setCnb(e.target.value)}
                placeholder="ccnb..."
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Fyzický popis / Rozsah
            </label>
            <input
              type="text"
              value={physicalDescription}
              onChange={(e) => setPhysicalDescription(e.target.value)}
              placeholder="Např. 320 s. : il. ; 21 cm"
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          {/* Cover Photo Buttons */}
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Obrázek přebalu (URL nebo fotka)
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
              />
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center gap-1 text-xs px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium rounded-lg border border-emerald-200 transition cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Vyfotit</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg border border-slate-200 transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Nahrát</span>
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Poznámka / Stav knihy
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Poznámka ke knize..."
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition cursor-pointer"
            >
              Zrušit
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition shadow-md cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Potvrdit a uložit knihu</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
