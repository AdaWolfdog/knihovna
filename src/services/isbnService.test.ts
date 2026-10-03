import { describe, it, expect } from 'vitest';
import { normalizeIsbn } from './isbnService';

describe('normalizeIsbn', () => {
  it('removes hyphens and spaces from ISBN-13', () => {
    expect(normalizeIsbn('978-80-204-1234-5')).toBe('9788020412345');
    expect(normalizeIsbn('978 80 204 1234 5')).toBe('9788020412345');
    expect(normalizeIsbn(' 978-80-204 1234-5 ')).toBe('9788020412345');
  });

  it('removes hyphens and spaces from ISBN-10', () => {
    expect(normalizeIsbn('80-204-1234-X')).toBe('802041234X');
  });

  it('handles empty strings', () => {
    expect(normalizeIsbn('')).toBe('');
  });
});
