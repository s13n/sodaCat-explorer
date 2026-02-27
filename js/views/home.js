// Home view — vendor grid overview

import { getIndex } from '../data.js';
import { clearContent, el } from '../util.js';
import { setBreadcrumb } from '../components/breadcrumb.js';

export function renderHome() {
  const index = getIndex();
  if (!index) return;

  setBreadcrumb([{ label: 'Home' }]);

  const main = clearContent();

  main.appendChild(el('div', { className: 'section-header' },
    el('h1', {}, 'Hardware Database'),
  ));

  const totalFamilies = index.vendors.reduce((n, v) => n + v.familyCount, 0);
  const totalChips = index.vendors.reduce((n, v) => n + v.chipCount, 0);
  main.appendChild(el('p', { className: 'description' },
    `Browse register-level hardware descriptions for ${totalFamilies} families and ${totalChips} chips across ${index.vendors.length} vendors.`,
  ));

  const grid = el('div', { className: 'card-grid' });
  for (const vendor of index.vendors) {
    const sharedCount = (vendor.sharedBlocks || []).length;
    const card = el('div', { className: 'card', onClick: () => {
      window.location.hash = `#/vendor/${vendor.name}`;
    }},
      el('h3', {}, vendor.name),
      el('div', { className: 'card-stat' }, `${vendor.familyCount} families`),
      el('div', { className: 'card-stat' }, `${vendor.chipCount} chips`),
      ...(sharedCount > 0
        ? [el('div', { className: 'card-stat' }, `${sharedCount} shared blocks`)]
        : []),
    );
    grid.appendChild(card);
  }
  main.appendChild(grid);
}
