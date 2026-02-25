// 32-bit register map visualization (CSS Grid)

import { el, fieldAccessClass } from '../util.js';

let tooltipEl = null;

function getTooltip() {
  if (!tooltipEl) {
    tooltipEl = el('div', { className: 'field-tooltip' });
    tooltipEl.style.display = 'none';
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}

function showTooltip(e, field) {
  const tip = getTooltip();
  const bitHigh = (field.bitOffset || 0) + (field.bitWidth || 1) - 1;
  const bitLow = field.bitOffset || 0;
  const bitStr = bitHigh === bitLow ? `[${bitLow}]` : `[${bitHigh}:${bitLow}]`;

  tip.innerHTML = '';
  tip.appendChild(el('span', { className: 'tt-name' }, field.name));
  tip.appendChild(el('span', { className: 'tt-bits' }, bitStr));
  if (field.access) {
    tip.appendChild(el('div', { className: 'tt-access' }, field.access));
  }
  if (field.description) {
    tip.appendChild(el('div', { className: 'tt-desc' }, field.description));
  }

  tip.style.display = 'block';
  const rect = e.target.getBoundingClientRect();
  tip.style.left = Math.min(rect.left, window.innerWidth - 320) + 'px';
  tip.style.top = (rect.bottom + 4) + 'px';
}

function hideTooltip() {
  const tip = getTooltip();
  tip.style.display = 'none';
}

export function renderRegisterMap(reg, onFieldClick) {
  const bits = reg.size || 32;
  const fields = reg.fields || [];
  const resetValue = reg.resetValue || 0;

  const container = el('div', { className: 'reg-map-container' });
  const grid = el('div', { className: `reg-map ${bits <= 16 ? 'reg-map-16' : ''}` });

  // Build field occupation map
  const bitMap = new Array(bits).fill(null);
  for (const field of fields) {
    const offset = field.bitOffset || 0;
    const width = field.bitWidth || 1;
    for (let i = offset; i < offset + width && i < bits; i++) {
      bitMap[i] = field;
    }
  }

  // Row 1: Bit labels (MSB to LSB)
  for (let i = bits - 1; i >= 0; i--) {
    grid.appendChild(el('div', { className: 'bit-label' }, String(i)));
  }

  // Row 2: Fields (MSB to LSB)
  // Group contiguous bits into spans
  let bit = bits - 1;
  while (bit >= 0) {
    const field = bitMap[bit];
    if (field) {
      // This bit belongs to a field — find the full span
      const offset = field.bitOffset || 0;
      const width = field.bitWidth || 1;
      const spanStart = offset + width - 1; // MSB of field
      const spanEnd = offset; // LSB of field
      const colStart = bits - spanStart;
      const colEnd = bits - spanEnd + 1;

      const cell = el('div', {
        className: `field-cell ${fieldAccessClass(field.access || reg.access)}`,
        style: { gridColumn: `${colStart} / ${colEnd}` },
      },
        el('span', { className: 'field-name' }, field.name),
      );

      cell.addEventListener('mouseenter', (e) => showTooltip(e, field));
      cell.addEventListener('mouseleave', hideTooltip);
      if (onFieldClick) {
        cell.addEventListener('click', () => onFieldClick(field.name));
      }

      grid.appendChild(cell);
      bit = spanEnd - 1;
    } else {
      // Reserved bit — find contiguous reserved range
      const start = bit;
      while (bit >= 0 && bitMap[bit] === null) bit--;
      const end = bit + 1;
      const colStart = bits - start;
      const colEnd = bits - end + 1;

      grid.appendChild(el('div', {
        className: 'field-cell field-reserved',
        style: { gridColumn: `${colStart} / ${colEnd}` },
      }, el('span', { className: 'field-name' }, 'Reserved')));
    }
  }

  // Row 3: Reset value bits (MSB to LSB)
  for (let i = bits - 1; i >= 0; i--) {
    const bitVal = (resetValue >>> i) & 1;
    grid.appendChild(el('div', { className: 'reset-bit' }, String(bitVal)));
  }

  container.appendChild(grid);
  return container;
}
