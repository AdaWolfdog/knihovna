import React from 'react';
import type { Book } from '../db/db';
import { AlertTriangle, Copy, XCircle } from 'lucide-react';

interface DuplicateModalProps {
  existingBook: Book;
  shelfName: string;
  onAddExemplar: () => void;
  onCancel: () => void;
}

export const DuplicateModal: React.FC<DuplicateModalProps> = ({
  existingBook,
  shelfName,
  onAddExemplar,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 text-amber-600 mb-4">
          <div className="p-2 bg-amber-100 rounded-full">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Kniha již existuje v databázi!
            </h3>
            <p className="text-xs text-slate-500">ISBN: {existingBook.isbn}</p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-5 space-y-2 text-sm text-slate-700">
          <div>
            <span className="font-semibold text-slate-900">Název:</span>{' '}
            {existingBook.title || 'Neznámý název'}
          </div>
          <div>
            <span className="font-semibold text-slate-900">Autor:</span>{' '}
            {existingBook.author || 'Neznámý autor'}
          </div>
          <div>
            <span className="font-semibold text-slate-900">Rok:</span>{' '}
            {existingBook.publishedYear || '-'}
          </div>
          <div>
            <span className="font-semibold text-slate-900">Stávající počet na polici:</span>{' '}
            <span className="font-bold text-indigo-700">{existingBook.quantity || 1} ks</span>
          </div>
          <div>
            <span className="font-semibold text-slate-900">Cílová police:</span>{' '}
            <span className="font-medium text-indigo-600">{shelfName}</span>
          </div>
        </div>

        <p className="text-sm text-slate-600 mb-6">
          Kniha již na této polici existuje. Chcete navyšovat <strong>počet kusů</strong> (na {(existingBook.quantity || 1) + 1} ks), nebo šlo o <strong>chybu při skenování</strong>?
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onAddExemplar}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition shadow-sm"
          >
            <Copy className="w-4 h-4" />
            <span>Přidat kus (+1 ks)</span>
          </button>
          <button
            onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-xl transition"
          >
            <XCircle className="w-4 h-4" />
            <span>Zrušit (Chyba)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
