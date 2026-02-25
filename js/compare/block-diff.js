// Block comparison view

import { loadBlock } from '../data.js';
import { clearContent, el, hexAddr, hexReset, accessLabel, accessClass, escapeHtml } from '../util.js';
import { setBreadcrumb } from '../components/breadcrumb.js';
import { renderRegisterMap } from '../components/register-map.js';

export async function renderBlockDiff(params) {
  const pathA = decodeURIComponent(params.a);
  const pathB = decodeURIComponent(params.b);

  setBreadcrumb([
    { label: 'Home', hash: '#/' },
    { label: 'Compare Blocks' },
  ]);

  const main = clearContent();
  main.innerHTML = '<div class="loading">Loading block data...</div>';

  let blockA, blockB;
  try {
    [blockA, blockB] = await Promise.all([loadBlock(pathA), loadBlock(pathB)]);
  } catch (e) {
    main.innerHTML = `<div class="loading">Failed to load: ${escapeHtml(e.message)}</div>`;
    return;
  }

  main.innerHTML = '';

  const nameA = blockA.name || pathA.split('/').pop();
  const nameB = blockB.name || pathB.split('/').pop();

  main.appendChild(el('div', { className: 'section-header' },
    el('h1', {}, `${nameA} vs ${nameB}`),
  ));

  // Links
  main.appendChild(el('div', { className: 'btn-group' },
    el('a', { className: 'btn', href: `#/block/${pathA}` }, nameA),
    el('a', { className: 'btn', href: `#/block/${pathB}` }, nameB),
  ));

  // Register comparison
  const regsA = blockA.registers || [];
  const regsB = blockB.registers || [];
  const regMapA = new Map(regsA.map(r => [r.name, r]));
  const regMapB = new Map(regsB.map(r => [r.name, r]));
  const allNames = [...new Set([...regMapA.keys(), ...regMapB.keys()])];

  // Sort by offset (use first available)
  allNames.sort((a, b) => {
    const offA = (regMapA.get(a) || regMapB.get(a)).addressOffset || 0;
    const offB = (regMapA.get(b) || regMapB.get(b)).addressOffset || 0;
    return offA - offB;
  });

  main.appendChild(el('div', { className: 'section-header' },
    el('h2', {}, 'Registers'),
    el('span', { className: 'subtitle' },
      `${regsA.length} vs ${regsB.length}`),
  ));

  const table = el('table', { className: 'data-table' });
  const thead = el('thead', {},
    el('tr', {},
      el('th', {}, 'Name'),
      el('th', {}, `${nameA} Offset`),
      el('th', {}, `${nameB} Offset`),
      el('th', {}, `${nameA} Fields`),
      el('th', {}, `${nameB} Fields`),
      el('th', {}, 'Status'),
    ));
  table.appendChild(thead);

  const tbody = el('tbody');
  for (const name of allNames) {
    const rA = regMapA.get(name);
    const rB = regMapB.get(name);
    let status = 'identical';
    let diffClass = '';

    if (!rA) { status = `only in ${nameB}`; diffClass = 'diff-added'; }
    else if (!rB) { status = `only in ${nameA}`; diffClass = 'diff-removed'; }
    else {
      // Compare fields
      const fA = (rA.fields || []).map(f => `${f.name}:${f.bitOffset}:${f.bitWidth}`).join(',');
      const fB = (rB.fields || []).map(f => `${f.name}:${f.bitOffset}:${f.bitWidth}`).join(',');
      if (fA !== fB || rA.addressOffset !== rB.addressOffset) {
        status = 'different';
        diffClass = 'diff-changed';
      }
    }

    tbody.appendChild(el('tr', { className: diffClass },
      el('td', { className: 'mono' }, name),
      el('td', { className: 'mono' }, rA ? hexAddr(rA.addressOffset).replace(/^0x0{4}/, '0x') : '\u2014'),
      el('td', { className: 'mono' }, rB ? hexAddr(rB.addressOffset).replace(/^0x0{4}/, '0x') : '\u2014'),
      el('td', {}, rA ? `${(rA.fields || []).length}` : '\u2014'),
      el('td', {}, rB ? `${(rB.fields || []).length}` : '\u2014'),
      el('td', {}, status),
    ));
  }
  table.appendChild(tbody);
  main.appendChild(table);

  // Show side-by-side register maps for changed registers
  const changedRegs = allNames.filter(name => {
    const rA = regMapA.get(name);
    const rB = regMapB.get(name);
    if (!rA || !rB) return false;
    const fA = (rA.fields || []).map(f => `${f.name}:${f.bitOffset}:${f.bitWidth}`).join(',');
    const fB = (rB.fields || []).map(f => `${f.name}:${f.bitOffset}:${f.bitWidth}`).join(',');
    return fA !== fB;
  });

  if (changedRegs.length > 0 && changedRegs.length <= 10) {
    main.appendChild(el('div', { className: 'section-header' },
      el('h2', {}, 'Field Differences'),
    ));

    for (const name of changedRegs) {
      main.appendChild(el('h3', { style: { marginTop: '16px' } }, name));
      const diffDiv = el('div', { className: 'diff-container' });

      for (const [label, reg] of [[nameA, regMapA.get(name)], [nameB, regMapB.get(name)]]) {
        const side = el('div', { className: 'diff-side' });
        side.appendChild(el('h3', {}, label));
        if (reg && reg.fields && reg.fields.length > 0) {
          side.appendChild(renderRegisterMap(reg));
        } else {
          side.appendChild(el('p', { className: 'description' }, 'No fields'));
        }
        diffDiv.appendChild(side);
      }
      main.appendChild(diffDiv);
    }
  }
}
