// Pin-list view — renders a chip's pin/ball definition table (from a model CSV)

import { loadPinList, findChip, findFamily } from '../data.js';
import { clearContent, el, escapeHtml } from '../util.js';
import { setBreadcrumb } from '../components/breadcrumb.js';
import { highlightChip } from '../sidebar.js';

export async function renderPinList(params) {
  const { family, sub, chip: chipName } = params;
  const path = `${family}/${sub}/${chipName}`;

  const fam = findFamily(family);
  setBreadcrumb([
    { label: 'Home', hash: '#/' },
    { label: fam ? fam.display : family, hash: `#/family/${family}` },
    { label: sub, hash: `#/subfamily/${family}/${sub}` },
    { label: chipName, hash: `#/chip/${path}` },
    { label: 'Pin list' },
  ]);

  highlightChip(family, sub, chipName);

  const main = clearContent();

  const meta = findChip(path);
  if (!meta || !meta.hasPinList) {
    main.innerHTML = `<div class="loading">No pin list available for ${escapeHtml(chipName)}.</div>`;
    return;
  }

  main.innerHTML = '<div class="loading">Loading pin list...</div>';

  let data;
  try {
    data = await loadPinList(meta.pinListPath);
  } catch (e) {
    main.innerHTML = `<div class="loading">Failed to load pin list: ${escapeHtml(e.message)}</div>`;
    return;
  }

  main.innerHTML = '';

  const rows = data.rows || [];
  const columns = data.columns || [];

  // Header
  const source = data.name && data.name !== chipName
    ? `from ${data.file || data.name + '.csv'}`
    : (data.file || '');
  main.appendChild(el('div', { className: 'section-header' },
    el('h1', {}, `${chipName} — Pin list`),
    el('span', { className: 'subtitle' }, source),
  ));

  // Filter box + live count
  const countLabel = el('span', { className: 'subtitle' }, `${rows.length} pins`);
  const filterInput = el('input', {
    type: 'text',
    className: 'pin-filter',
    placeholder: 'Filter pins (name, function, package…)',
    autocomplete: 'off',
  });
  main.appendChild(el('div', { className: 'pin-toolbar' }, filterInput, countLabel));

  // Table
  const table = el('table', { className: 'data-table pin-table' });
  const thead = el('thead');
  const headRow = el('tr');
  for (const col of columns) headRow.appendChild(el('th', {}, col));
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = el('tbody');
  const rowEntries = [];
  for (const cells of rows) {
    const tr = el('tr');
    for (let i = 0; i < columns.length; i++) {
      const val = cells[i] || '';
      const td = el('td', { className: i === 0 ? 'pin-name' : (val ? '' : 'pin-empty') }, val || '—');
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
    rowEntries.push({ tr, text: cells.join(' ').toLowerCase() });
  }
  table.appendChild(tbody);

  main.appendChild(el('div', { className: 'pin-table-wrap' }, table));

  // Live filtering: hide non-matching rows, update the count.
  let raf = 0;
  const applyFilter = () => {
    const q = filterInput.value.trim().toLowerCase();
    let shown = 0;
    for (const { tr, text } of rowEntries) {
      const match = !q || text.includes(q);
      tr.style.display = match ? '' : 'none';
      if (match) shown++;
    }
    countLabel.textContent = q
      ? `${shown} of ${rows.length} pins`
      : `${rows.length} pins`;
  };
  const onInput = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(applyFilter);
  };
  filterInput.addEventListener('input', onInput);

  return () => {
    cancelAnimationFrame(raf);
    filterInput.removeEventListener('input', onInput);
  };
}
