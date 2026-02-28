// Sidebar collapsible family tree

import { el } from './util.js';

const treeEl = document.getElementById('sidebar-tree');

export function buildSidebar(families) {
  treeEl.innerHTML = '';

  // Group families by vendor
  const vendorGroups = new Map();
  for (const fam of families) {
    const vendor = fam.vendor || 'Other';
    if (!vendorGroups.has(vendor)) vendorGroups.set(vendor, []);
    vendorGroups.get(vendor).push(fam);
  }
  const multiVendor = vendorGroups.size > 1;

  for (const [vendor, vendorFamilies] of vendorGroups) {
    if (multiVendor) {
      treeEl.appendChild(el('a', {
        className: 'tree-vendor-header',
        href: `#/vendor/${vendor}`,
      }, vendor));
    }

    for (const fam of vendorFamilies) {
      const familyDiv = el('div', { className: 'tree-family' });

      // Family row: arrow toggles children, label navigates
      const toggle = el('div', { className: 'tree-toggle' });
      const arrow = el('span', { className: 'arrow' }, '\u25B6');
      const label = el('a', { className: 'tree-label', href: `#/family/${fam.code}` }, fam.display);
      toggle.appendChild(arrow);
      toggle.appendChild(label);
      const children = el('div', { className: 'tree-children' });

      arrow.addEventListener('click', () => {
        toggle.classList.toggle('open');
        children.classList.toggle('open');
      });

      // Subfamilies
      for (const sub of fam.subfamilies) {
        const subDiv = el('div', { className: 'tree-subfamily' });
        const subToggle = el('div', { className: 'tree-sub-toggle' });
        const subArrow = el('span', { className: 'arrow' }, '\u25B6');
        const subLabel = el('a', { className: 'tree-label', href: `#/subfamily/${fam.code}/${sub.name}` }, sub.name);
        subToggle.appendChild(subArrow);
        subToggle.appendChild(subLabel);
        const chipList = el('div', { className: 'tree-chip-list' });

        subArrow.addEventListener('click', (e) => {
          e.stopPropagation();
          subToggle.classList.toggle('open');
          chipList.classList.toggle('open');
        });

        for (const chip of sub.chips) {
          const chipLink = el('a', {
            className: 'tree-chip',
            href: `#/chip/${fam.code}/${sub.name}/${chip}`,
          }, chip);
          chipList.appendChild(chipLink);
        }

        subDiv.appendChild(subToggle);
        subDiv.appendChild(chipList);
        children.appendChild(subDiv);
      }

      familyDiv.appendChild(toggle);
      familyDiv.appendChild(children);
      treeEl.appendChild(familyDiv);
    }
  }
}

export function highlightChip(familyCode, subName, chipName) {
  // Remove previous highlights
  treeEl.querySelectorAll('.tree-chip.active').forEach(el => el.classList.remove('active'));

  // Find and highlight
  const href = `#/chip/${familyCode}/${subName}/${chipName}`;
  const link = treeEl.querySelector(`.tree-chip[href="${href}"]`);
  if (link) {
    link.classList.add('active');
    // Expand parents
    const chipList = link.closest('.tree-chip-list');
    if (chipList && !chipList.classList.contains('open')) {
      chipList.classList.add('open');
      chipList.previousElementSibling?.classList.add('open');
    }
    const children = link.closest('.tree-children');
    if (children && !children.classList.contains('open')) {
      children.classList.add('open');
      children.previousElementSibling?.classList.add('open');
    }
    link.scrollIntoView({ block: 'nearest' });
  }
}
