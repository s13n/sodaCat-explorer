// Sidebar collapsible family tree

import { el } from './util.js';

const treeEl = document.getElementById('sidebar-tree');

export function buildSidebar(families) {
  treeEl.innerHTML = '';

  for (const fam of families) {
    const familyDiv = el('div', { className: 'tree-family' });

    // Family toggle
    const toggle = el('button', { className: 'tree-toggle' },
      el('span', { className: 'arrow' }, '\u25B6'),
      ` STM32${fam.code}`
    );
    const children = el('div', { className: 'tree-children' });

    toggle.addEventListener('click', () => {
      toggle.classList.toggle('open');
      children.classList.toggle('open');
    });

    // Subfamilies
    for (const sub of fam.subfamilies) {
      const subDiv = el('div', { className: 'tree-subfamily' });
      const subToggle = el('button', { className: 'tree-sub-toggle' },
        el('span', { className: 'arrow' }, '\u25B6'),
        ` ${sub.name}`
      );
      const chipList = el('div', { className: 'tree-chip-list' });

      subToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        subToggle.classList.toggle('open');
        chipList.classList.toggle('open');
      });

      // Make subfamily name clickable to navigate
      subToggle.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        window.location.hash = `#/subfamily/${fam.code}/${sub.name}`;
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
