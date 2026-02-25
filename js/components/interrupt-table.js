// Interrupt vector table

import { el } from '../util.js';

export function renderInterruptTable(interrupts) {
  // interrupts: { number: [string] } or { number: string }
  const table = el('table', { className: 'data-table' });
  const thead = el('thead', {},
    el('tr', {},
      el('th', {}, 'IRQ #'),
      el('th', {}, 'Signal'),
    ));
  table.appendChild(thead);

  const tbody = el('tbody');

  // Sort by IRQ number
  const entries = Object.entries(interrupts)
    .map(([num, signals]) => [parseInt(num), signals])
    .sort((a, b) => a[0] - b[0]);

  for (const [num, signals] of entries) {
    const signalList = Array.isArray(signals) ? signals : [signals];
    for (let i = 0; i < signalList.length; i++) {
      tbody.appendChild(el('tr', {},
        el('td', { className: 'mono' }, i === 0 ? String(num) : ''),
        el('td', { className: 'mono' }, signalList[i]),
      ));
    }
  }

  table.appendChild(tbody);
  return table;
}
