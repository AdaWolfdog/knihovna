export function attachStickyBookTable(table: HTMLTableElement | null) {
  const head = table?.tHead;
  const scrollport = table?.parentElement;
  const sticky = scrollport?.previousElementSibling;
  const appHeader = document.getElementById('app-header');
  if (!table || !head || !scrollport || !(sticky instanceof HTMLElement) || !sticky.classList.contains('book-table-sticky')) return;

  // The table keeps its semantic header and its horizontal scrollbar. A visual
  // copy outside that scroll container can stick to the page using CSS.
  const mirror = document.createElement('table');
  mirror.className = table.className;
  mirror.style.tableLayout = 'fixed';
  const colgroup = document.createElement('colgroup');
  mirror.append(colgroup);
  mirror.createTHead();

  const syncHorizontal = () => {
    sticky.scrollLeft = scrollport.scrollLeft;
  };
  const syncHeader = () => {
    const height = head.getBoundingClientRect().height;
    if (!height) return;

    const widths = Array.from(head.rows[0]?.cells ?? [], (cell) => cell.getBoundingClientRect().width);
    colgroup.replaceChildren(...widths.filter((width) => width > 0).map((width) => {
      const column = document.createElement('col');
      column.style.width = `${width}px`;
      return column;
    }));
    mirror.tHead?.replaceWith(head.cloneNode(true));
    mirror.style.width = `${table.getBoundingClientRect().width}px`;
    sticky.style.setProperty('--book-table-head-height', `${height}px`);
    sticky.style.setProperty('--book-table-top', `${appHeader?.getBoundingClientRect().height ?? 0}px`);
    if (!sticky.contains(mirror)) sticky.replaceChildren(mirror);
    scrollport.setAttribute('data-sticky-header-ready', '');
    syncHorizontal();
  };

  const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncHeader) : undefined;
  const observedCells = new Set<HTMLTableCellElement>();
  const observeCells = () => {
    const cells = new Set(Array.from(head.rows[0]?.cells ?? []));
    for (const cell of observedCells) {
      if (cells.has(cell)) continue;
      resize?.unobserve(cell);
      observedCells.delete(cell);
    }
    for (const cell of cells) {
      if (observedCells.has(cell)) continue;
      resize?.observe(cell);
      observedCells.add(cell);
    }
  };
  const changes = new MutationObserver(() => {
    observeCells();
    syncHeader();
  });

  syncHeader();
  resize?.observe(table);
  resize?.observe(head);
  if (appHeader) resize?.observe(appHeader);
  observeCells();
  changes.observe(head, { childList: true, characterData: true, subtree: true });
  scrollport.addEventListener('scroll', syncHorizontal, { passive: true });
  window.addEventListener('resize', syncHeader);

  return () => {
    changes.disconnect();
    resize?.disconnect();
    scrollport.removeEventListener('scroll', syncHorizontal);
    window.removeEventListener('resize', syncHeader);
    scrollport.removeAttribute('data-sticky-header-ready');
    mirror.remove();
    sticky.style.removeProperty('--book-table-head-height');
    sticky.style.removeProperty('--book-table-top');
  };
}
