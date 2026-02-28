// Subfamily view — chips + subfamily-specific blocks

import { findFamily, findSubfamily } from '../data.js';
import { clearContent, el } from '../util.js';
import { setBreadcrumb } from '../components/breadcrumb.js';

export function renderSubfamily(params) {
  const { family, sub } = params;
  const fam = findFamily(family);
  const subfam = findSubfamily(family, sub);

  if (!fam || !subfam) {
    const main = clearContent();
    main.innerHTML = '<div class="loading">Subfamily not found</div>';
    return;
  }

  setBreadcrumb([
    { label: 'Home', hash: '#/' },
    { label: fam.display, hash: `#/family/${family}` },
    { label: sub },
  ]);

  const main = clearContent();

  main.appendChild(el('div', { className: 'section-header' },
    el('h1', {}, `${fam.display} — ${sub}`),
    el('span', { className: 'subtitle' }, `${subfam.chips.length} chips`),
  ));

  // Reference manual
  if (subfam.refManual) {
    const rm = subfam.refManual;
    main.appendChild(el('div', { className: 'meta-row' },
      el('span', {}, 'Ref. Manual: '),
      rm.url ? el('a', { href: rm.url, target: '_blank' }, rm.name) : el('span', {}, rm.name),
    ));
  }

  // Chips
  main.appendChild(el('div', { className: 'section-header' },
    el('h2', {}, 'Chips'),
  ));

  const chipList = el('div', { className: 'chip-list' });
  for (const chip of subfam.chips) {
    chipList.appendChild(el('a', {
      className: 'chip-tag',
      href: `#/chip/${family}/${sub}/${chip}`,
    }, chip));
  }
  main.appendChild(chipList);

  // Subfamily-specific blocks
  const blocks = subfam.blocks || [];
  if (blocks.length > 0) {
    main.appendChild(el('div', { className: 'section-header' },
      el('h2', {}, 'Subfamily-Specific Blocks'),
      el('span', { className: 'subtitle' }, `${blocks.length} blocks`),
    ));

    const blockGrid = el('div', { className: 'block-grid' });
    for (const block of blocks) {
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

  // Family-level blocks
  const familyBlocks = fam.familyBlocks || [];
  if (familyBlocks.length > 0) {
    main.appendChild(el('div', { className: 'section-header' },
      el('h2', {}, 'Family Blocks'),
      el('span', { className: 'subtitle' }, `Inherited from ${fam.display}`),
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

  // Shared (vendor-level) blocks used by this subfamily
  const sharedBlocks = subfam.usedSharedBlocks || [];
  if (sharedBlocks.length > 0) {
    main.appendChild(el('div', { className: 'section-header' },
      el('h2', {}, 'Shared Blocks'),
      el('span', { className: 'subtitle' }, `${sharedBlocks.length} blocks`),
    ));

    const blockGrid = el('div', { className: 'block-grid' });
    for (const block of sharedBlocks) {
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
