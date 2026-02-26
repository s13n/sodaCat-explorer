// Export — copy as JSON, C struct, or C++ header

import { el } from '../util.js';
import { loadBlock } from '../data.js';
import { generatePeripheralHeader, generateRegisterStruct } from './cxx-export.js';
import { generateChipHeader } from './cxx-chip-export.js';

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    // Flash feedback
    const toast = el('div', {
      style: {
        position: 'fixed', bottom: '20px', right: '20px',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '4px', padding: '8px 16px', fontSize: '13px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: '1000',
      },
    }, 'Copied to clipboard');
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  });
}

function exportAsJson(data) {
  copyToClipboard(JSON.stringify(data, null, 2));
}

function exportAsCStruct(data, type, blockName) {
  if (type === 'register') {
    const name = blockName ? `${blockName}_${data.name}` : data.name;
    const bits = data.size || 32;
    const cType = bits <= 8 ? 'uint8_t' : bits <= 16 ? 'uint16_t' : 'uint32_t';
    const fields = (data.fields || [])
      .sort((a, b) => (a.bitOffset || 0) - (b.bitOffset || 0));

    let lines = [`typedef union {`, `  ${cType} raw;`, `  struct {`];
    let pos = 0;
    let reserved = 0;
    for (const f of fields) {
      const offset = f.bitOffset || 0;
      const width = f.bitWidth || 1;
      if (offset > pos) {
        lines.push(`    ${cType} _reserved${reserved} : ${offset - pos};`);
        reserved++;
      }
      lines.push(`    ${cType} ${f.name} : ${width};`);
      pos = offset + width;
    }
    if (pos < bits) {
      lines.push(`    ${cType} _reserved${reserved} : ${bits - pos};`);
    }
    lines.push(`  } bits;`);
    lines.push(`} ${name}_t;`);
    copyToClipboard(lines.join('\n'));
  } else if (type === 'block') {
    // Block-level: register offset layout
    const name = data.name || 'PERIPH';
    let lines = [`typedef struct {`];
    const regs = data.registers || [];
    let pos = 0;
    let reserved = 0;
    for (const reg of regs) {
      const offset = reg.addressOffset || 0;
      const size = (reg.size || 32) / 8;
      const cType = size <= 1 ? 'uint8_t' : size <= 2 ? 'uint16_t' : 'uint32_t';
      if (offset > pos) {
        const gap = offset - pos;
        lines.push(`  uint8_t _reserved${reserved}[${gap}];`);
        reserved++;
      }
      lines.push(`  volatile ${cType} ${reg.name};`);
      pos = offset + size;
    }
    lines.push(`} ${name}_TypeDef;`);
    copyToClipboard(lines.join('\n'));
  }
}

async function exportAsCxxHeader(data, type, blockName, blockPath) {
  if (type === 'chip') {
    copyToClipboard(generateChipHeader(data, blockPath));
  } else if (type === 'block') {
    // Always load full block data (summary data lacks field arrays)
    let fullData = data;
    if (blockPath && data.registers?.[0] && 'fieldCount' in data.registers[0]) {
      try { fullData = await loadBlock(blockPath); } catch { /* use summary */ }
    }
    copyToClipboard(generatePeripheralHeader(fullData, blockPath));
  } else if (type === 'register') {
    copyToClipboard(generateRegisterStruct(data));
  }
}

export function renderExportButton(data, type, blockName, blockPath) {
  const wrapper = el('div', { className: 'export-dropdown' });
  const btn = el('button', { className: 'btn' }, 'Export \u25BE');
  const menu = el('div', { className: 'export-menu' });

  menu.appendChild(el('button', { onClick: () => {
    exportAsJson(data);
    menu.classList.remove('open');
  }}, 'Copy as JSON'));

  if (type !== 'chip') {
    menu.appendChild(el('button', { onClick: () => {
      exportAsCStruct(data, type, blockName);
      menu.classList.remove('open');
    }}, 'Copy as C struct'));
  }

  menu.appendChild(el('button', { onClick: () => {
    exportAsCxxHeader(data, type, blockName, blockPath);
    menu.classList.remove('open');
  }}, 'Copy as C++ header'));

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('open');
  });

  // Close on outside click
  document.addEventListener('click', () => menu.classList.remove('open'));

  wrapper.appendChild(btn);
  wrapper.appendChild(menu);
  return wrapper;
}
