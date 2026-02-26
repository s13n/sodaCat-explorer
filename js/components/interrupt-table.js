// Interrupt vector table

import { el } from '../util.js';

/**
 * @param {Object} interrupts - { number: string | string[] }
 * @param {Object} [instances] - instance name → { model, modelPath, ... }
 */
export function renderInterruptTable(interrupts, instances) {
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
      const sig = signalList[i];
      const dot = sig.indexOf('.');
      const inst = dot > 0 ? sig.slice(0, dot) : null;
      const instData = inst && instances && instances[inst];
      const signalCell = instData
        ? el('td', { className: 'mono' },
            el('a', { className: 'irq-instance-link',
              href: `#/block/${instData.modelPath || instData.model}` }, sig))
        : el('td', { className: 'mono' }, sig);
      tbody.appendChild(el('tr', {},
        el('td', { className: 'mono' }, i === 0 ? String(num) : ''),
        signalCell,
      ));
    }
  }

  table.appendChild(tbody);
  return table;
}
