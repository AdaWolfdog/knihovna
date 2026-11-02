// @vitest-environment jsdom
// @ts-nocheck
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Header } from './Header';

describe('Header component', () => {
  let container: HTMLDivElement;
  let root: any;

  beforeEach(() => {
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
        <Header
          activeTab="scan"
          setActiveTab={vi.fn()}
          activeShelfName="Police B2"
        />
      );
    });

    expect(container.textContent).toContain('Knihovník Mobile');
    expect(container.textContent).toContain('Aktivní police: Police B2');
  });

  it('toggles collapsible menu on mobile and auto-collapses on tab change', async () => {
    const setActiveTab = vi.fn();
    await act(async () => {
      root.render(
        <Header
          activeTab="scan"
          setActiveTab={setActiveTab}
          activeShelfName="Police A1"
        />
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
