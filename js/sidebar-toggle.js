// Collapse/expand the sidebar (selection tree) to free horizontal space.

const STORAGE_KEY = 'sidebarCollapsed';

export function initSidebarToggle() {
  const btn = document.getElementById('sidebar-toggle');
  if (!btn) return;

  const apply = (collapsed) => {
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    btn.setAttribute('aria-expanded', String(!collapsed));
    btn.title = collapsed ? 'Show sidebar' : 'Hide sidebar';
  };

  let collapsed = false;
  try {
    collapsed = localStorage.getItem(STORAGE_KEY) === '1';
  } catch { /* localStorage may be unavailable */ }
  apply(collapsed);

  btn.addEventListener('click', () => {
    collapsed = !document.body.classList.contains('sidebar-collapsed');
    apply(collapsed);
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch { /* ignore persistence failures */ }
  });
}
