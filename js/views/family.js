// Family view — subfamilies + family-level blocks

import { findFamily } from '../data.js';
import { clearContent, el } from '../util.js';
import { setBreadcrumb } from '../components/breadcrumb.js';

export function renderFamily(params) {
  const { code } = params;
  const fam = findFamily(code);
  if (!fam) {
    const main = clearContent();
    main.innerHTML = '<div class="loading">Family not found</div>';
    return;
  }

  setBreadcrumb([
    { label: 'Home', hash: '#/' },
    { label: fam.vendor, hash: `#/vendor/${fam.vendor}` },
    { label: fam.display },
  ]);

  const main = clearContent();

  main.appendChild(el('div', { className: 'section-header' },
    el('h1', {}, fam.display),
    el('span', { className: 'subtitle' }, `${fam.chipCount} chips, ${fam.blockCount} block types`),
  ));

  // Subfamilies
  main.appendChild(el('div', { className: 'section-header' },
    el('h2', {}, 'Subfamilies'),
  ));

  const grid = el('div', { className: 'card-grid' });
  for (const sub of fam.subfamilies) {
    const card = el('div', { className: 'card', onClick: () => {
      window.location.hash = `#/subfamily/${code}/${sub.name}`;
    }},
      el('h3', {}, sub.name),
      el('div', { className: 'card-stat' }, `${sub.chips.length} chips`),
      el('div', { className: 'card-stat' }, `${(sub.blocks || []).length} specific blocks`),
    );
    grid.appendChild(card);
  }
  main.appendChild(grid);

  // Family-level blocks
  const familyBlocks = fam.familyBlocks || [];
  if (familyBlocks.length > 0) {
    main.appendChild(el('div', { className: 'section-header' },
      el('h2', {}, 'Family Blocks'),
      el('span', { className: 'subtitle' }, `Shared across all ${fam.display} subfamilies`),
    ));

    const blockGrid = el('div', { className: 'block-grid' });
    for (const block of familyBlocks) {
      const item = el('a', {
        className: 'block-item',
        href: `#/block/${block.path}`,
      },
        el('div', { className: 'block-name' }, block.name),
        el('div', { className: 'block-desc' },
          block.isAlias ? `\u2192 ${block.derivedFrom}` :
          (block.description || `${block.registerCount} registers`)),
      );
      blockGrid.appendChild(item);
    }
    main.appendChild(blockGrid);
  }
}
