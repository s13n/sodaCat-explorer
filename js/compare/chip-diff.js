// Chip comparison view

import { loadChip } from '../data.js';
import { clearContent, el, hexAddr, escapeHtml } from '../util.js';
import { setBreadcrumb } from '../components/breadcrumb.js';

export async function renderChipDiff(params) {
  const pathA = decodeURIComponent(params.a);
  const pathB = decodeURIComponent(params.b);

  setBreadcrumb([
    { label: 'Home', hash: '#/' },
    { label: 'Compare Chips' },
  ]);

  const main = clearContent();
  main.innerHTML = '<div class="loading">Loading chip data...</div>';

  let chipA, chipB;
  try {
    [chipA, chipB] = await Promise.all([loadChip(pathA), loadChip(pathB)]);
  } catch (e) {
    main.innerHTML = `<div class="loading">Failed to load: ${escapeHtml(e.message)}</div>`;
    return;
  }

  main.innerHTML = '';

  main.appendChild(el('div', { className: 'section-header' },
    el('h1', {}, `${chipA.name} vs ${chipB.name}`),
  ));

  // CPU comparison
  main.appendChild(el('div', { className: 'section-header' }, el('h2', {}, 'CPU')));
  const cpuDiv = el('div', { className: 'diff-container' });
  for (const chip of [chipA, chipB]) {
    const side = el('div', { className: 'diff-side' });
    side.appendChild(el('h3', {},
      el('a', { href: `#/chip/${chip === chipA ? pathA : pathB}` }, chip.name)));
    if (chip.cpu) {
      const table = el('table', { className: 'data-table' });
      const tbody = el('tbody');
      for (const [k, v] of Object.entries(chip.cpu)) {
        tbody.appendChild(el('tr', {},
          el('td', { className: 'mono' }, k),
          el('td', {}, String(v)),
        ));
      }
      table.appendChild(tbody);
      side.appendChild(table);
    }
    cpuDiv.appendChild(side);
  }
  main.appendChild(cpuDiv);

  // Instance comparison
  main.appendChild(el('div', { className: 'section-header' }, el('h2', {}, 'Instances')));

  const instA = chipA.instances || {};
  const instB = chipB.instances || {};
  const allNames = [...new Set([...Object.keys(instA), ...Object.keys(instB)])].sort();

  const table = el('table', { className: 'data-table' });
  const thead = el('thead', {},
    el('tr', {},
      el('th', {}, 'Instance'),
      el('th', {}, `${chipA.name} Address`),
      el('th', {}, `${chipA.name} Model`),
      el('th', {}, `${chipB.name} Address`),
      el('th', {}, `${chipB.name} Model`),
    ));
  table.appendChild(thead);

  const tbody = el('tbody');
  for (const name of allNames) {
    const a = instA[name];
    const b = instB[name];
    let diffClass = '';
    if (!a) diffClass = 'diff-added';
    else if (!b) diffClass = 'diff-removed';
    else if (a.baseAddress !== b.baseAddress || a.model !== b.model) diffClass = 'diff-changed';

    tbody.appendChild(el('tr', { className: diffClass },
      el('td', { className: 'mono' }, name),
      el('td', { className: 'mono' }, a ? (a.baseAddressHex || hexAddr(a.baseAddress)) : '\u2014'),
      el('td', {}, a ? a.model : '\u2014'),
      el('td', { className: 'mono' }, b ? (b.baseAddressHex || hexAddr(b.baseAddress)) : '\u2014'),
      el('td', {}, b ? b.model : '\u2014'),
    ));
  }
  table.appendChild(tbody);
  main.appendChild(table);

  // Interrupt comparison
  const irqA = chipA.interrupts || {};
  const irqB = chipB.interrupts || {};
  const allIrqs = [...new Set([...Object.keys(irqA), ...Object.keys(irqB)])]
    .map(Number).sort((a, b) => a - b);

  if (allIrqs.length > 0) {
    main.appendChild(el('div', { className: 'section-header' }, el('h2', {}, 'Interrupts')));

    const irqTable = el('table', { className: 'data-table' });
    const irqThead = el('thead', {},
      el('tr', {},
        el('th', {}, 'IRQ #'),
        el('th', {}, chipA.name),
        el('th', {}, chipB.name),
      ));
    irqTable.appendChild(irqThead);

    const irqTbody = el('tbody');
    for (const num of allIrqs) {
      const sigA = irqA[num] ? (Array.isArray(irqA[num]) ? irqA[num].join(', ') : irqA[num]) : '';
      const sigB = irqB[num] ? (Array.isArray(irqB[num]) ? irqB[num].join(', ') : irqB[num]) : '';
      let diffClass = '';
      if (!sigA) diffClass = 'diff-added';
      else if (!sigB) diffClass = 'diff-removed';
      else if (sigA !== sigB) diffClass = 'diff-changed';

      irqTbody.appendChild(el('tr', { className: diffClass },
        el('td', { className: 'mono' }, String(num)),
        el('td', { className: 'mono' }, sigA || '\u2014'),
        el('td', { className: 'mono' }, sigB || '\u2014'),
      ));
    }
    irqTable.appendChild(irqTbody);
    main.appendChild(irqTable);
  }
}
