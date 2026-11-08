import { describe, it, expect } from 'vitest';
import { isValidIsbnChecksum, extractIsbnFromText } from './isbnOcrService';

describe('isbnOcrService checksum validation', () => {
  it('validates correct ISBN-13 checksums', () => {
    expect(isValidIsbnChecksum('978-80-257-0367-0')).toBe(true);
    expect(isValidIsbnChecksum('9788025703670')).toBe(true);
    expect(isValidIsbnChecksum('978-80-7335-267-7')).toBe(true);
    expect(isValidIsbnChecksum('9788073352677')).toBe(true);
  });

  it('rejects invalid ISBN-13 checksums', () => {
    // Last digit is wrong
    expect(isValidIsbnChecksum('978-80-257-0367-1')).toBe(false);
    expect(isValidIsbnChecksum('9788025703679')).toBe(false);
    expect(isValidIsbnChecksum('1234567890123')).toBe(false);
  });

  it('validates correct ISBN-10 checksums', () => {
    // 80-204-0105-9
    expect(isValidIsbnChecksum('80-204-0105-9')).toBe(true);
    // 0-306-40615-2
    expect(isValidIsbnChecksum('0-306-40615-2')).toBe(true);
    // ISBN with 'X' check digit: 0-8044-2957-X
    expect(isValidIsbnChecksum('0-8044-2957-X')).toBe(true);
    expect(isValidIsbnChecksum('080442957x')).toBe(true);
  });

  it('rejects invalid ISBN-10 checksums', () => {
    expect(isValidIsbnChecksum('80-204-0105-1')).toBe(false);
    expect(isValidIsbnChecksum('0804429571')).toBe(false);
    expect(isValidIsbnChecksum('1234567890')).toBe(false);
  });
});

describe('isbnOcrService extraction from text', () => {
  it('extracts ISBN with "ISBN" prefix', () => {
    const sampleText = 'Vydalo nakladatelství Argo, 2011.\nISBN 978-80-257-0367-0\nVytiskly Těšínské papírny';
    const result = extractIsbnFromText(sampleText);
    expect(result).toBe('9788025703670');
  });

  it('extracts ISBN-10 with prefix and check digit X', () => {
    const sampleText = 'ISBN: 0-8044-2957-X\nFirst edition.';
    const result = extractIsbnFromText(sampleText);
    expect(result).toBe('080442957X');
  });

  it('extracts ISBN without prefix when checksum matches', () => {
    const sampleText = '978-80-7335-267-7\nVyšehrad 2012';
    const result = extractIsbnFromText(sampleText);
    expect(result).toBe('9788073352677');
  });

  it('returns null when no valid ISBN is found in text', () => {
    const sampleText = 'Toto je náhodný text bez jakéhokoliv čísla nebo 123456 neplatného čísla';
    expect(extractIsbnFromText(sampleText)).toBeNull();
  });

  it('ignores invalid numbers even if they look like ISBN', () => {
    const sampleText = 'ISBN 978-80-000-0000-0'; // invalid checksum
    expect(extractIsbnFromText(sampleText)).toBeNull();
  });
});
