// Draggable sidebar resize handle

export function initSidebarResize() {
  const handle = document.getElementById('sidebar-resize');
  if (!handle) return;

  const MIN_WIDTH = 150;
  const MAX_WIDTH = 500;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    handle.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMove(e) {
      const width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, e.clientX));
      document.documentElement.style.setProperty('--sidebar-width', width + 'px');
    }

    function onUp() {
      handle.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
