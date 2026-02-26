// Block parameter table

import { el } from '../util.js';

export function renderParamTable(params) {
  const table = el('table', { className: 'data-table param-table' });
  const thead = el('thead', {},
    el('tr', {},
      el('th', {}, 'Name'),
      el('th', {}, 'Type'),
      el('th', {}, 'Default'),
      el('th', {}, 'Max'),
      el('th', {}, 'Description'),
    ));
  table.appendChild(thead);

  const tbody = el('tbody');
  for (const p of params) {
    tbody.appendChild(el('tr', {},
      el('td', { className: 'param-name' }, p.name),
      el('td', { className: 'param-type' }, p.type || ''),
      el('td', { className: 'mono' }, p.default != null ? String(p.default) : '\u2014'),
      el('td', { className: 'mono' }, p.max != null ? String(p.max) : '\u2014'),
      el('td', {}, p.description || ''),
    ));
  }
  table.appendChild(tbody);

  return table;
}
