// Chip detail view — CPU info, interrupt table, instance list

import { loadChip, findFamily, getIndex } from '../data.js';
import { clearContent, el, hexAddr, escapeHtml } from '../util.js';
import { setBreadcrumb } from '../components/breadcrumb.js';
import { highlightChip } from '../sidebar.js';
import { renderInterruptTable } from '../components/interrupt-table.js';
import { openComparePanel } from '../compare/panel.js';
import { renderExportButton } from '../components/export.js';

export async function renderChip(params) {
  const { family, sub, chip: chipName } = params;

  const fam = findFamily(family);
  setBreadcrumb([
    { label: 'Home', hash: '#/' },
    { label: fam ? fam.display : family, hash: `#/family/${family}` },
    { label: sub, hash: `#/subfamily/${family}/${sub}` },
    { label: chipName },
  ]);

  highlightChip(family, sub, chipName);

  const main = clearContent();
  main.innerHTML = '<div class="loading">Loading chip data...</div>';

  const path = `${family}/${sub}/${chipName}`;
  let data;
  try {
    data = await loadChip(path);
  } catch (e) {
    main.innerHTML = `<div class="loading">Failed to load chip: ${escapeHtml(e.message)}</div>`;
    return;
  }

  main.innerHTML = '';

  // Header
  const header = el('div', { className: 'section-header' },
    el('h1', {}, data.name),
    el('span', { className: 'subtitle' }, data.source || ''),
  );
  main.appendChild(header);

  // Buttons
  const btnGroup = el('div', { className: 'btn-group' });
  const compareBtn = el('button', { className: 'btn', onClick: () => {
    openComparePanel('chip', path, family, sub);
  }}, 'Compare with\u2026');
  btnGroup.appendChild(compareBtn);
  btnGroup.appendChild(renderExportButton(data, 'chip', null, path));
  main.appendChild(btnGroup);

  // CPU info
  if (data.cpu) {
    main.appendChild(el('div', { className: 'section-header' }, el('h2', {}, 'CPU')));
    const table = el('table', { className: 'data-table' });
    const tbody = el('tbody');
    for (const [key, val] of Object.entries(data.cpu)) {
      tbody.appendChild(el('tr', {},
        el('td', { className: 'mono' }, key),
        el('td', {}, String(val)),
      ));
    }
    table.appendChild(tbody);
    main.appendChild(table);
  }

  // Instances (declared early so interrupt links can reference them)
  const instances = data.instances || {};

  // Interrupts
  const interrupts = data.interrupts || {};
  const irqCount = Object.keys(interrupts).length;
  if (irqCount > 0) {
    main.appendChild(el('div', { className: 'section-header' },
      el('h2', {}, 'Interrupts'),
      el('span', { className: 'subtitle' }, `${irqCount} vectors`),
    ));
    main.appendChild(renderInterruptTable(interrupts, instances));
  }
  const instList = Object.entries(instances).sort((a, b) => a[0].localeCompare(b[0]));
  main.appendChild(el('div', { className: 'section-header' },
    el('h2', {}, 'Peripheral Instances'),
    el('span', { className: 'subtitle' }, `${instList.length} instances`),
  ));

  const instTable = el('table', { className: 'data-table' });
  const thead = el('thead', {},
    el('tr', {},
      el('th', {}, 'Instance'),
      el('th', {}, 'Base Address'),
      el('th', {}, 'Block Model'),
      el('th', {}, 'Parameters'),
    ));
  instTable.appendChild(thead);

  const tbody = el('tbody');
  for (const [name, inst] of instList) {
    const modelPath = inst.modelPath || inst.model;
    const params = inst.parameters || [];
    const paramsStr = params.map(p => `${p.name}=${p.value}`).join(', ');

    const row = el('tr', { id: `inst-${name}`, className: 'clickable', onClick: () => {
      window.location.hash = `#/block/${modelPath}`;
    }},
      el('td', { className: 'mono' }, name),
      el('td', { className: 'mono' }, inst.baseAddressHex || hexAddr(inst.baseAddress)),
      el('td', {},
        el('a', { href: `#/block/${modelPath}` }, inst.model)),
      el('td', { className: 'mono', style: { fontSize: '12px', color: 'var(--text-muted)' } },
        paramsStr || '\u2014'),
    );
    tbody.appendChild(row);
  }
  instTable.appendChild(tbody);
  main.appendChild(instTable);
}
