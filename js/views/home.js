// Home view — family grid overview

import { getIndex } from '../data.js';
import { clearContent, el } from '../util.js';
import { setBreadcrumb } from '../components/breadcrumb.js';

export function renderHome() {
  const index = getIndex();
  if (!index) return;

  setBreadcrumb([{ label: 'Home' }]);

  const main = clearContent();

  const header = el('div', { className: 'section-header' },
    el('h1', {}, 'STM32 Hardware Database'),
  );
  main.appendChild(header);

  const desc = el('p', { className: 'description' },
    `Browse register-level hardware descriptions for ${index.families.length} STM32 families.`
  );
  main.appendChild(desc);

  // Shared blocks section
  if (index.sharedBlocks && index.sharedBlocks.length > 0) {
    main.appendChild(el('div', { className: 'section-header' },
      el('h2', {}, 'Cross-Family Shared Blocks'),
      el('span', { className: 'subtitle' }, `${index.sharedBlocks.length} blocks`)
    ));
    const grid = el('div', { className: 'block-grid' });
    for (const block of index.sharedBlocks) {
      const item = el('a', {
        className: 'block-item',
        href: `#/block/${block.path}`,
      },
        el('div', { className: 'block-name' }, block.name),
        el('div', { className: 'block-desc' }, block.description || `${block.registerCount} registers`),
      );
      grid.appendChild(item);
    }
    main.appendChild(grid);
  }

  // Family grid
  main.appendChild(el('div', { className: 'section-header' },
    el('h2', {}, 'Families'),
  ));

  const grid = el('div', { className: 'card-grid' });

  for (const fam of index.families) {
    const card = el('div', { className: 'card', onClick: () => {
      window.location.hash = `#/family/${fam.code}`;
    }},
      el('h3', {}, fam.display),
      el('div', { className: 'card-stat' }, `${fam.chipCount} chips`),
      el('div', { className: 'card-stat' }, `${fam.blockCount} block types`),
      el('div', { className: 'card-stat' }, `${fam.subfamilies.length} subfamilies`),
    );
    grid.appendChild(card);
  }

  main.appendChild(grid);
}
