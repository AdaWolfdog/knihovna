import React, { useState, useRef } from 'react';
import type { Book } from '../db/db';
import { X, Check, Camera, Upload, Image as ImageIcon, BookOpen } from 'lucide-react';
import { useLanguage } from '../i18n';

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
  const { t } = useLanguage();
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
      alert(t('fillTitleAlert'));
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-3.5 sm:p-6 shadow-2xl border border-slate-100 my-auto animate-fade-in max-h-[96dvh] sm:max-h-none overflow-y-auto">
        <div className="flex items-center justify-between pb-2 sm:pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-emerald-600 min-w-0">
            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm sm:text-lg font-bold text-slate-900 truncate">
                {t('confirmModalTitle')}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                {t('confirmModalShelf')}{' '}
                <span className="font-semibold text-slate-800">{shelfName}</span>
                {sourceName && <span> &bull; {t('confirmModalSource')} {sourceName}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition cursor-pointer shrink-0"
            title={t('closeTooltip')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-3 mt-2.5 sm:mt-4">
          <div className="flex gap-2.5 sm:gap-4 items-start">
            {/* Book Cover Preview */}
            <div className="w-16 h-24 sm:w-24 sm:h-36 bg-slate-100 border border-slate-200 rounded-lg sm:rounded-xl overflow-hidden shrink-0 relative flex flex-col items-center justify-center">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={title || 'Obálka knihy'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-1 sm:p-2 text-slate-400">
                  <ImageIcon className="w-5 h-5 sm:w-8 sm:h-8 mx-auto stroke-1 mb-0.5 sm:mb-1" />
                  <span className="text-[8px] sm:text-[10px] leading-tight">{t('noCover')}</span>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-1.5 sm:space-y-3 min-w-0">
              <div>
                <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-0.5 sm:mb-1">
                  {t('formLabelBookTitle')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-0.5 sm:mb-1">
                  {t('formLabelAuthor')}
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-0.5 sm:mb-1">
                  {t('formLabelIsbn')}
                </label>
                <input
                  type="text"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  className="w-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-0.5 sm:mb-1 truncate">
                {t('formLabelPublishedYear')}
              </label>
              <input
                type="text"
                value={publishedYear}
                onChange={(e) => setPublishedYear(e.target.value)}
                className="w-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-0.5 sm:mb-1 truncate">
                {t('formLabelEdition')}
              </label>
              <input
                type="text"
                value={editionNumber}
                onChange={(e) => setEditionNumber(e.target.value)}
                placeholder="Např. 1. vydání"
                className="w-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-0.5 sm:mb-1 truncate">
                {t('formLabelQuantity')} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-emerald-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-0.5 sm:mb-1 truncate">
                {t('formLabelPublisher')}
              </label>
              <input
                type="text"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                className="w-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-0.5 sm:mb-1 truncate">
                {t('formLabelPlaceOfPublication')}
              </label>
              <input
                type="text"
                value={placeOfPublication}
                onChange={(e) => setPlaceOfPublication(e.target.value)}
                placeholder="Např. Praha"
                className="w-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-0.5 sm:mb-1 truncate">
                {t('formLabelGenre')}
              </label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-0.5 sm:mb-1 truncate">
                {t('formLabelKeywords')}
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                className="w-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-0.5 sm:mb-1 truncate">
                {t('formLabelTranslator')}
              </label>
              <input
                type="text"
                value={translator}
                onChange={(e) => setTranslator(e.target.value)}
                className="w-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-0.5 sm:mb-1 truncate">
                {t('formLabelCnb')}
              </label>
              <input
                type="text"
                value={cnb}
                onChange={(e) => setCnb(e.target.value)}
                placeholder="ccnb..."
                className="w-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-0.5 sm:mb-1">
              {t('formLabelPhysicalDesc')}
            </label>
            <input
              type="text"
              value={physicalDescription}
              onChange={(e) => setPhysicalDescription(e.target.value)}
              placeholder="Např. 320 s. : il. ; 21 cm"
              className="w-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          {/* Cover Photo Buttons */}
          <div className="border border-slate-200 rounded-xl p-2 sm:p-3 bg-slate-50/50 space-y-1 sm:space-y-2">
            <label className="block text-[11px] sm:text-xs font-semibold text-slate-700">
              {t('formLabelCoverUrlOrPhoto')}
            </label>
            <div className="flex gap-1.5 sm:gap-2 items-center">
              <input
                type="text"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 min-w-0 px-2 py-1 text-[11px] sm:px-2.5 sm:py-1 sm:text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
              />
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center gap-1 text-[10px] sm:text-xs px-2 py-1 sm:px-2.5 sm:py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium rounded-lg border border-emerald-200 transition cursor-pointer shrink-0"
              >
                <Camera className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>{t('takePhotoBtn')}</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-[10px] sm:text-xs px-2 py-1 sm:px-2.5 sm:py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg border border-slate-200 transition cursor-pointer shrink-0"
              >
                <Upload className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>{t('uploadPhotoBtn')}</span>
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
            <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-0.5 sm:mb-1">
              {t('formLabelNotesBook')}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Poznámka ke knize..."
              className="w-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 sm:gap-3 pt-1.5 sm:pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-medium rounded-xl transition cursor-pointer"
            >
              {t('cancelBtn')}
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3.5 py-1.5 sm:px-5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition shadow-md cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{t('confirmAndSaveBtn')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
