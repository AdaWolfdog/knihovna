// @vitest-environment jsdom
// @ts-nocheck
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { textToEmoji, SPECIAL_EMOJIS, EMOJI_LANGUAGE_NAME } from './types';
import { cs } from './locales/cs';
import { en } from './locales/en';
import { de } from './locales/de';
import { es } from './locales/es';
import { LanguageProvider, useLanguage } from './LanguageContext';

describe('i18n infrastructure & emoji translation', () => {
  let container: HTMLDivElement;
  let root: any;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('has all keys across CS, EN, DE, ES dictionaries', () => {
    const csKeys = Object.keys(cs).sort();
    const enKeys = Object.keys(en).sort();
    const deKeys = Object.keys(de).sort();
    const esKeys = Object.keys(es).sort();

    expect(enKeys).toEqual(csKeys);
    expect(deKeys).toEqual(csKeys);
    expect(esKeys).toEqual(csKeys);
  });

  it('contains all requested emojis in SPECIAL_EMOJIS pool', () => {
    // elf, elfka, víla, hvězdičky, hvězdičky s obloučkem, jednorožec, kytička, tulipán, hyacint, slunečnice
    expect(SPECIAL_EMOJIS).toContain('🧝');
    expect(SPECIAL_EMOJIS).toContain('🧝‍♀️');
    expect(SPECIAL_EMOJIS).toContain('🧚');
    expect(SPECIAL_EMOJIS).toContain('✨');
    expect(SPECIAL_EMOJIS).toContain('💫');
    expect(SPECIAL_EMOJIS).toContain('🦄');
    expect(SPECIAL_EMOJIS).toContain('🌸');
    expect(SPECIAL_EMOJIS).toContain('🌷');
    expect(SPECIAL_EMOJIS).toContain('🪻');
    expect(SPECIAL_EMOJIS).toContain('🌻');
    expect(EMOJI_LANGUAGE_NAME).toBe('🧝🧚✨🦄🌸');
  });

  it('deterministically generates the exact same emoji output for the same input', () => {
    const sample = 'Skenování fotoaparátem';
    const output1 = textToEmoji(sample);
    const output2 = textToEmoji(sample);

    expect(output1).toBe(output2);
    expect(output1.length).toBeGreaterThan(0);
    const withoutWhitespace = output1.replace(/\s+/g, '');
    for (const char of withoutWhitespace) {
      expect(SPECIAL_EMOJIS.some((e) => e.includes(char))).toBe(true);
    }
  });

  it('preserves word structure and spacing in emoji translation', () => {
    const text = 'Knihovna a Police';
    const emojiText = textToEmoji(text);
    const parts = emojiText.split(' ');
    expect(parts.length).toBe(3);
  });

  it('preserves form field labels in readable Czech when emoji mode is active', async () => {
    function TestComponent() {
      const { t, setLanguage } = useLanguage();
      return (
        <div>
          <button onClick={() => setLanguage('emoji')}>Switch to Emoji</button>
          <div data-testid="title-label">{t('formLabelBookTitle')}</div>
          <div data-testid="author-label">{t('formLabelAuthor')}</div>
          <div data-testid="button-text">{t('scanToThisShelfBtn')}</div>
        </div>
      );
    }

    await act(async () => {
      root.render(
        <LanguageProvider>
          <TestComponent />
        </LanguageProvider>
      );
    });

    const switchBtn = container.querySelector('button') as HTMLButtonElement;
    await act(async () => {
      switchBtn.click();
    });

    // Form labels remain in readable Czech
    expect(container.querySelector('[data-testid="title-label"]')?.textContent).toBe('Název knihy');
    expect(container.querySelector('[data-testid="author-label"]')?.textContent).toBe('Autor / Autoři');

    // Button text is translated into emojis
    const buttonText = container.querySelector('[data-testid="button-text"]')?.textContent || '';
    expect(buttonText).not.toBe('Skenovat do této police');
    expect(SPECIAL_EMOJIS.some((e) => buttonText.includes(e))).toBe(true);
  });

  it('loads and persists language preference in localStorage', async () => {
    localStorage.setItem('knihovnik_preferred_language', 'de');

    function TestComponent() {
      const { language, t } = useLanguage();
      return (
        <div>
          <span data-testid="current-lang">{language}</span>
          <span data-testid="app-title">{t('appTitle')}</span>
        </div>
      );
    }

    await act(async () => {
      root.render(
        <LanguageProvider>
          <TestComponent />
        </LanguageProvider>
      );
    });

    expect(container.querySelector('[data-testid="current-lang"]')?.textContent).toBe('de');
    expect(container.querySelector('[data-testid="app-title"]')?.textContent).toBe('Bibliothekar Mobile');
  });
});
