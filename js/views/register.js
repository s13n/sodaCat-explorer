// Register detail view — field map + enum values

import { loadBlock, findFamily } from '../data.js';
import { clearContent, el, hexReset, accessLabel, accessClass, escapeHtml } from '../util.js';
import { setBreadcrumb } from '../components/breadcrumb.js';
import { renderRegisterMap } from '../components/register-map.js';
import { renderExportButton } from '../components/export.js';

export async function renderRegister(params) {
  const { path, reg: regName } = params;
  const pathParts = path.split('/');
  const blockName = pathParts[pathParts.length - 1];

  // Breadcrumb
  const crumbs = [{ label: 'Home', hash: '#/' }];
  if (pathParts.length >= 2) {
    const fam = findFamily(pathParts[0]);
    crumbs.push({ label: fam ? fam.display : pathParts[0], hash: `#/family/${pathParts[0]}` });
  }
  if (pathParts.length >= 3) {
    crumbs.push({ label: pathParts[1], hash: `#/subfamily/${pathParts[0]}/${pathParts[1]}` });
  }
  crumbs.push({ label: blockName, hash: `#/block/${path}` });
  crumbs.push({ label: regName });
  setBreadcrumb(crumbs);

  const main = clearContent();
  main.innerHTML = '<div class="loading">Loading register data...</div>';

  let blockData;
  try {
    blockData = await loadBlock(path);
  } catch (e) {
    main.innerHTML = `<div class="loading">Failed to load block: ${escapeHtml(e.message)}</div>`;
    return;
  }

  // Find register
  const regs = blockData.registers || [];
  const reg = regs.find(r => r.name === regName);
  if (!reg) {
    main.innerHTML = `<div class="loading">Register "${escapeHtml(regName)}" not found in ${escapeHtml(blockName)}</div>`;
    return;
  }

  main.innerHTML = '';

  // Header
  main.appendChild(el('div', { className: 'section-header' },
    el('h1', {}, `${blockName}.${reg.name}`),
    el('span', { className: 'subtitle' }, reg.description || ''),
  ));

  // Meta info
  const bits = reg.size || 32;
  const metaItems = [
    `Offset: 0x${(reg.addressOffset >>> 0).toString(16).toUpperCase()}`,
    `Size: ${bits} bits`,
    `Access: ${accessLabel(reg.access) || 'RW'}`,
  ];
  if (reg.resetValue != null) {
    metaItems.push(`Reset: ${hexReset(reg.resetValue, bits)}`);
  }
  main.appendChild(el('div', { className: 'meta-row' }, metaItems.join('  |  ')));

  // Export button
  main.appendChild(el('div', { className: 'btn-group' },
    renderExportButton(reg, 'register', blockName),
  ));

  // Register map
  const fields = reg.fields || [];
  if (fields.length > 0) {
    main.appendChild(renderRegisterMap(reg, (fieldName) => {
      // Scroll to field detail
      const card = document.getElementById(`field-${fieldName}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('highlighted');
        setTimeout(() => card.classList.remove('highlighted'), 2000);
      }
    }));

    // Field details
    main.appendChild(el('div', { className: 'section-header' },
      el('h2', {}, 'Fields'),
      el('span', { className: 'subtitle' }, `${fields.length} fields`),
    ));

    const detail = el('div', { className: 'field-detail' });
    // Sort fields by bit offset descending (MSB first)
    const sorted = [...fields].sort((a, b) => (b.bitOffset || 0) - (a.bitOffset || 0));
    for (const field of sorted) {
      const bitHigh = (field.bitOffset || 0) + (field.bitWidth || 1) - 1;
      const bitLow = field.bitOffset || 0;
      const bitStr = bitHigh === bitLow ? `[${bitLow}]` : `[${bitHigh}:${bitLow}]`;

      const card = el('div', {
        className: 'field-detail-card',
        id: `field-${field.name}`,
      });

      card.appendChild(el('h4', {}, field.name));
      card.appendChild(el('div', { className: 'field-bits' },
        `Bits ${bitStr}  |  ${field.bitWidth || 1} bit${(field.bitWidth || 1) > 1 ? 's' : ''}`,
        field.access ? `  |  ${accessLabel(field.access)}` : '',
      ));

      if (field.description) {
        card.appendChild(el('div', { className: 'field-desc' }, field.description));
      }

      // Enum values
      const enums = field.enumeratedValues || [];
      if (enums.length > 0) {
        const enumTable = el('table', { className: 'data-table enum-table' });
        const ethead = el('thead', {},
          el('tr', {},
            el('th', {}, 'Value'),
            el('th', {}, 'Name'),
            el('th', {}, 'Description'),
          ));
        enumTable.appendChild(ethead);
        const etbody = el('tbody');
        for (const ev of enums) {
          etbody.appendChild(el('tr', {},
            el('td', { className: 'enum-val mono' }, ev.value != null ? String(ev.value) : ''),
            el('td', { className: 'mono' }, ev.name || ''),
            el('td', {}, ev.description || ''),
          ));
        }
        enumTable.appendChild(etbody);
        card.appendChild(enumTable);
      }

      detail.appendChild(card);
    }
    main.appendChild(detail);
  } else {
    main.appendChild(el('p', { className: 'description' }, 'No fields defined for this register.'));
  }

  // Navigation: prev/next register
  const regIdx = regs.indexOf(reg);
  const nav = el('div', { className: 'btn-group', style: { marginTop: '24px' } });
  if (regIdx > 0) {
    const prev = regs[regIdx - 1];
    nav.appendChild(el('a', { className: 'btn', href: `#/block/${path}/reg/${prev.name}` },
      `\u2190 ${prev.name}`));
  }
  if (regIdx < regs.length - 1) {
    const next = regs[regIdx + 1];
    nav.appendChild(el('a', { className: 'btn', href: `#/block/${path}/reg/${next.name}` },
      `${next.name} \u2192`));
  }
  main.appendChild(nav);
}
