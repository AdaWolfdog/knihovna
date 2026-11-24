export function attachStickyBookTable(table: HTMLTableElement | null) {
  const head = table?.tHead;
  const appHeader = document.getElementById('app-header');
  if (!table || !head) return;

  let frame = 0;
  const positionHeader = () => {
    frame = 0;
    const { top, height } = table.getBoundingClientRect();
    const headerBottom = Math.max(0, appHeader?.getBoundingClientRect().bottom ?? 0);
    const limit = Math.max(0, height - head.offsetHeight);
    const offset = Math.min(limit, Math.max(0, headerBottom - top));

    // Keep the header in the same horizontal scroll container as its columns.
    head.style.transform = offset ? `translateY(${offset}px)` : '';
  };
  const schedulePosition = () => {
    if (!frame) frame = window.requestAnimationFrame(positionHeader);
  };

  positionHeader();
  window.addEventListener('scroll', schedulePosition, { passive: true });
  window.addEventListener('resize', schedulePosition);
  const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedulePosition) : undefined;
  resize?.observe(table);
  if (appHeader) resize?.observe(appHeader);
  const main = table.closest('main');
  if (main) resize?.observe(main);

  return () => {
    window.removeEventListener('scroll', schedulePosition);
    window.removeEventListener('resize', schedulePosition);
    resize?.disconnect();
    if (frame) window.cancelAnimationFrame(frame);
    head.style.transform = '';
  };
}
