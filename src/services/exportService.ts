import * as XLSX from 'xlsx';
import type { Book, Library, Room, Shelf } from '../db/db';

export interface BookExportRow {
  Knihovna: string;
  Místnost: string;
  Police: string;
  ISBN: string;
  Název: string;
  Autor: string;
  'Rok vydání': string;
  Žánr: string;
  'Klíčová slova': string;
  Překladatel: string;
  'Číslo vydání': string;
  'Počet kusů': number;
  'Datum a čas naskenování': string;
  Poznámka: string;
}

export function prepareExportData(
  books: Book[],
  librariesMap: Map<number, Library>,
  roomsMap: Map<number, Room>,
  shelvesMap: Map<number, Shelf>
): BookExportRow[] {
  return books.map((book) => {
    const library = librariesMap.get(book.libraryId);
    const room = roomsMap.get(book.roomId);
    const shelf = shelvesMap.get(book.shelfId);

    const scannedDate = new Date(book.scannedAt);
    const formattedDate = !isNaN(scannedDate.getTime())
      ? scannedDate.toLocaleString('cs-CZ')
      : '';

    return {
      Knihovna: library?.name || 'Neznámá knihovna',
      Místnost: room?.name || 'Neznámá místnost',
      Police: shelf?.name || 'Neznámá police',
      ISBN: book.isbn || '',
      Název: book.title || '',
      Autor: book.author || '',
      'Rok vydání': book.publishedYear || '',
      Žánr: book.genre || '',
      'Klíčová slova': book.keywords || '',
      Překladatel: book.translator || '',
      'Číslo vydání': book.editionNumber || '',
      'Počet kusů': book.quantity || 1,
      'Datum a čas naskenování': formattedDate,
      Poznámka: book.notes || '',
    };
  });
}

export function exportToXLSX(data: BookExportRow[], filename = 'knihy_export.xlsx'): void {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Knihy');

  // Set column widths
  const colWidths = [
    { wch: 18 }, // Knihovna
    { wch: 18 }, // Místnost
    { wch: 18 }, // Police
    { wch: 16 }, // ISBN
    { wch: 30 }, // Název
    { wch: 22 }, // Autor
    { wch: 12 }, // Rok vydání
    { wch: 16 }, // Žánr
    { wch: 24 }, // Klíčová slova
    { wch: 18 }, // Překladatel
    { wch: 14 }, // Číslo vydání
    { wch: 12 }, // Počet kusů
    { wch: 22 }, // Datum a čas naskenování
    { wch: 20 }, // Poznámka
  ];
  worksheet['!cols'] = colWidths;

  XLSX.writeFile(workbook, filename);
}

export function exportToCSV(data: BookExportRow[], filename = 'knihy_export.csv'): void {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });

  // Add UTF-8 BOM so Excel opens CSV with Czech diacritics correctly
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvOutput], { type: 'text/csv;charset=utf-8;' });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
