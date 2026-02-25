// Comparison picker panel

import { getIndex } from '../data.js';
import { el } from '../util.js';

export function openComparePanel(type, currentPath, familyCode, subName) {
  const overlay = el('div', { className: 'compare-overlay' });
  const panel = el('div', { className: 'compare-panel' });

  panel.appendChild(el('h3', {}, `Compare ${type === 'chip' ? 'Chip' : 'Block'} With...`));

  const input = el('input', {
    type: 'text',
    placeholder: `Search ${type}s...`,
  });
  panel.appendChild(input);

  const list = el('ul', { className: 'compare-list' });
  panel.appendChild(list);

  const index = getIndex();
  let candidates = [];

  if (type === 'chip') {
    // List all chips from same family, then others
    for (const fam of index.families) {
      for (const sub of fam.subfamilies) {
        for (const chip of sub.chips) {
          const path = `${fam.code}/${sub.name}/${chip}`;
          if (path !== currentPath) {
            candidates.push({
              name: chip,
              path,
              group: `STM32${fam.code}`,
              priority: fam.code === familyCode ? 0 : 1,
            });
          }
        }
      }
    }
  } else {
    // List all blocks
    const allBlocks = [];
    for (const b of (index.sharedBlocks || [])) {
      if (b.path !== currentPath) allBlocks.push(b);
    }
    for (const fam of index.families) {
      for (const b of (fam.familyBlocks || [])) {
        if (b.path !== currentPath) allBlocks.push(b);
      }
      for (const sub of fam.subfamilies) {
        for (const b of (sub.blocks || [])) {
          if (b.path !== currentPath) allBlocks.push(b);
        }
      }
    }
    candidates = allBlocks.map(b => ({
      name: b.name,
      path: b.path,
      group: b.path,
      priority: 0,
    }));
  }

  candidates.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

  function renderList(filter) {
    list.innerHTML = '';
    const q = (filter || '').toLowerCase();
    const filtered = q
      ? candidates.filter(c => c.name.toLowerCase().includes(q) || c.path.toLowerCase().includes(q))
      : candidates;

    for (const c of filtered.slice(0, 30)) {
      const li = el('li', { onClick: () => {
        overlay.remove();
        const hash = type === 'chip'
          ? `#/compare/chips/${encodeURIComponent(currentPath)}/${encodeURIComponent(c.path)}`
          : `#/compare/blocks/${encodeURIComponent(currentPath)}/${encodeURIComponent(c.path)}`;
        window.location.hash = hash;
      }},
        el('strong', {}, c.name),
        el('span', { style: { marginLeft: '8px', color: 'var(--text-muted)', fontSize: '12px' } }, c.group),
      );
      list.appendChild(li);
    }
    if (filtered.length > 30) {
      list.appendChild(el('li', { style: { color: 'var(--text-muted)', fontStyle: 'italic' } },
        `${filtered.length - 30} more...`));
    }
  }

  input.addEventListener('input', () => renderList(input.value));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  renderList('');
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  input.focus();
}
