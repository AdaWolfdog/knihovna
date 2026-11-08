// @vitest-environment jsdom
// @ts-nocheck
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Header } from './Header';
import { LanguageProvider } from '../i18n';

describe('Header component', () => {
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

  it('renders branding and active shelf name', async () => {
    await act(async () => {
      root.render(
        <LanguageProvider>
          <Header
            activeTab="scan"
            setActiveTab={vi.fn()}
            activeShelfName="Police B2"
          />
        </LanguageProvider>
      );
    });

    expect(container.textContent).toContain('Knihovník Mobile');
    expect(container.textContent).toContain('Aktivní police: Police B2');
  });

  it('renders language selector right next to the title on both desktop and mobile without opening menu', async () => {
    await act(async () => {
      root.render(
        <LanguageProvider>
          <Header
            activeTab="scan"
            setActiveTab={vi.fn()}
            activeShelfName="Police B2"
          />
        </LanguageProvider>
      );
    });

    const select = container.querySelector('select[data-testid="language-select"]') as HTMLSelectElement;
    expect(select).not.toBeNull();
    // Default is Czech
    expect(select.value).toBe('cs');

    // Switch to English
    await act(async () => {
      select.value = 'en';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('Librarian Mobile');
    expect(container.textContent).toContain('Active shelf: Police B2');

    // Switch to Emoji language
    await act(async () => {
      select.value = 'emoji';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Option exists and has the emojis
    expect(select.value).toBe('emoji');
    // Active shelf name "Police B2" is user data and must remain preserved in text
    expect(container.textContent).toContain('Police B2');
  });

  it('toggles collapsible menu on mobile and auto-collapses on tab change', async () => {
    const setActiveTab = vi.fn();
    await act(async () => {
      root.render(
        <LanguageProvider>
          <Header
            activeTab="scan"
            setActiveTab={setActiveTab}
            activeShelfName="Police A1"
          />
        </LanguageProvider>
      );
    });

    // Expand button is present
    const expandBtn = container.querySelector('button[aria-label="Rozbalit menu"]') as HTMLButtonElement;
    expect(expandBtn).not.toBeNull();

    // Click expand button
    await act(async () => {
      expandBtn.click();
    });

    // Collapse button should now be present
    const collapseBtn = container.querySelector('button[aria-label="Sbalit menu"]') as HTMLButtonElement;
    expect(collapseBtn).not.toBeNull();

    // Find and click the structure tab
    const structureTab = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Knihovna & Police')
    );
    expect(structureTab).toBeDefined();

    await act(async () => {
      structureTab?.click();
    });

    expect(setActiveTab).toHaveBeenCalledWith('structure');

    // Menu auto-collapses after selecting a tab
    const expandBtnAfter = container.querySelector('button[aria-label="Rozbalit menu"]') as HTMLButtonElement;
    expect(expandBtnAfter).not.toBeNull();
  });
});
