// @vitest-environment jsdom
// @ts-nocheck
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ManualBookModal } from './ManualBookModal';
import { BookConfirmModal } from './BookConfirmModal';

describe('Responsive Modals', () => {
  let container: HTMLDivElement;
  let root: any;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders ManualBookModal with compact classes and without crashing', async () => {
    const handleSave = vi.fn();
    const handleClose = vi.fn();
    await act(async () => {
      root.render(
        <ManualBookModal
          shelfName="Police A1"
          onSave={handleSave}
          onClose={handleClose}
        />
      );
    });
    expect(container.textContent).toContain('Ruční zadání údajů o knize');
    expect(container.textContent).toContain('Uložit knihu');
  });

  it('renders BookConfirmModal with compact classes and without crashing', async () => {
    const handleConfirm = vi.fn();
    const handleCancel = vi.fn();
    await act(async () => {
      root.render(
        <BookConfirmModal
          initialData={{
            title: 'Test Kniha',
            author: 'Test Autor',
            isbn: '9788020412345',
          }}
          shelfName="Police A1"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      );
    });
    expect(container.textContent).toContain('Informace o naskenované knize');
    expect(container.textContent).toContain('Potvrdit a uložit');
  });
});
