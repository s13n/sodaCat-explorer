// Vendor view — families + shared blocks for one vendor

import { getIndex, findVendor } from '../data.js';
import { clearContent, el } from '../util.js';
import { setBreadcrumb } from '../components/breadcrumb.js';

export function renderVendor(params) {
  const { name } = params;
  const index = getIndex();
  if (!index) return;

  const vendor = findVendor(name);
  if (!vendor) {
    const main = clearContent();
    main.innerHTML = '<div class="loading">Vendor not found</div>';
    return;
  }

  setBreadcrumb([
    { label: 'Home', hash: '#/' },
    { label: vendor.name },
  ]);

  const main = clearContent();

  main.appendChild(el('div', { className: 'section-header' },
    el('h1', {}, vendor.name),
    el('span', { className: 'subtitle' }, `${vendor.familyCount} families, ${vendor.chipCount} chips`),
  ));

  // Families
  const vendorFamilies = index.families.filter(f => f.vendor === name);
  main.appendChild(el('div', { className: 'section-header' },
    el('h2', {}, 'Families'),
    el('span', { className: 'subtitle' }, `${vendorFamilies.length} families`),
  ));

  const grid = el('div', { className: 'card-grid' });
  for (const fam of vendorFamilies) {
    grid.appendChild(el('div', { className: 'card', onClick: () => {
      window.location.hash = `#/family/${fam.code}`;
    }},
      el('h3', {}, fam.display),
      el('div', { className: 'card-stat' }, `${fam.chipCount} chips`),
      el('div', { className: 'card-stat' }, `${fam.blockCount} block types`),
      el('div', { className: 'card-stat' }, `${fam.subfamilies.length} subfamilies`),
    ));
  }
  main.appendChild(grid);

  // Shared blocks
  const sharedBlocks = vendor.sharedBlocks || [];
  if (sharedBlocks.length > 0) {
    main.appendChild(el('div', { className: 'section-header' },
      el('h2', {}, 'Shared Blocks'),
      el('span', { className: 'subtitle' }, `${sharedBlocks.length} blocks shared across families`),
    ));
    const blockGrid = el('div', { className: 'block-grid' });
    for (const block of sharedBlocks) {
      blockGrid.appendChild(el('a', {
        className: 'block-item',
        href: `#/block/${block.path}`,
      },
        el('div', { className: 'block-name' }, block.name),
        el('div', { className: 'block-desc' }, block.description || `${block.registerCount} registers`),
      ));
    }
    main.appendChild(blockGrid);
  }
}
