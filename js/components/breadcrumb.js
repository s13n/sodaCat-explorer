// Breadcrumb navigation

import { el } from '../util.js';

const crumbEl = document.getElementById('breadcrumb');

export function setBreadcrumb(items) {
  // items: [{label, hash}] — last item has no hash (current page)
  crumbEl.innerHTML = '';
  items.forEach((item, i) => {
    if (i > 0) {
      crumbEl.appendChild(el('span', { className: 'sep' }, '\u203A'));
    }
    if (item.hash) {
      crumbEl.appendChild(el('a', { href: item.hash }, item.label));
    } else {
      crumbEl.appendChild(el('span', {}, item.label));
    }
  });
}

export function clearBreadcrumb() {
  crumbEl.innerHTML = '';
}
