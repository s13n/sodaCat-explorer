// Block detail view — params, register list

import { loadBlock, loadBlockSummary, findFamily } from '../data.js';
import { clearContent, el, hexAddr, hexReset, accessLabel, accessClass, escapeHtml } from '../util.js';
import { setBreadcrumb } from '../components/breadcrumb.js';
import { renderParamTable } from '../components/param-table.js';
import { openComparePanel } from '../compare/panel.js';
import { renderExportButton } from '../components/export.js';

export async function renderBlock(params) {
  const path = params.path;
  const pathParts = path.split('/');
  const blockName = pathParts[pathParts.length - 1];

  // Build breadcrumb
  const crumbs = [{ label: 'Home', hash: '#/' }];
  if (pathParts.length >= 2) {
    const fam = findFamily(pathParts[0]);
    crumbs.push({ label: fam ? fam.display : pathParts[0], hash: `#/family/${pathParts[0]}` });
  }
  if (pathParts.length >= 3) {
    crumbs.push({ label: pathParts[1], hash: `#/subfamily/${pathParts[0]}/${pathParts[1]}` });
  }
  crumbs.push({ label: blockName });
  setBreadcrumb(crumbs);

  const main = clearContent();
  main.innerHTML = '<div class="loading">Loading block data...</div>';

  let data;
  let isSummary = false;
  try {
    // Try summary first for large blocks
    data = await loadBlockSummary(path);
    isSummary = data.registers && data.registers[0] && 'fieldCount' in data.registers[0];
  } catch {
    try {
      data = await loadBlock(path);
    } catch (e) {
      main.innerHTML = `<div class="loading">Failed to load block: ${escapeHtml(e.message)}</div>`;
      return;
    }
  }

  main.innerHTML = '';

  // Handle derivedFrom aliases
  if (data.derivedFrom || data['@derivedFrom']) {
    const target = data.derivedFrom || data['@derivedFrom'];
    main.appendChild(el('div', { className: 'section-header' },
      el('h1', {}, data.name || blockName),
    ));
    main.appendChild(el('p', { className: 'description' },
      'This block is an alias of ',
      el('a', { href: `#/block/${target}` }, target),
      '. The register map is identical.',
    ));
    if (data.source) {
      main.appendChild(el('div', { className: 'meta-row' }, `Source: ${data.source}`));
    }
    return;
  }

  // Header
  main.appendChild(el('div', { className: 'section-header' },
    el('h1', {}, data.name || blockName),
    el('span', { className: 'subtitle' }, data.description || ''),
  ));

  if (data.source) {
    main.appendChild(el('div', { className: 'meta-row' }, `Source: ${data.source}`));
  }

  // Buttons
  const btnGroup = el('div', { className: 'btn-group' });
  btnGroup.appendChild(el('button', { className: 'btn', onClick: () => {
    openComparePanel('block', path);
  }}, 'Compare with\u2026'));
  btnGroup.appendChild(renderExportButton(data, 'block', null, path));
  main.appendChild(btnGroup);

  // Parameters
  const params_list = data.params || [];
  if (params_list.length > 0) {
    main.appendChild(el('div', { className: 'section-header' },
      el('h2', {}, 'Parameters'),
    ));
    main.appendChild(renderParamTable(params_list));
  }

  // Registers
  const registers = data.registers || [];
  main.appendChild(el('div', { className: 'section-header' },
    el('h2', {}, 'Registers'),
    el('span', { className: 'subtitle' }, `${registers.length} registers`),
  ));

  if (registers.length === 0) {
    main.appendChild(el('p', { className: 'description' }, 'No registers defined.'));
    return;
  }

  const table = el('table', { className: 'data-table' });
  const thead = el('thead', {},
    el('tr', {},
      el('th', {}, 'Offset'),
      el('th', {}, 'Name'),
      el('th', {}, 'Access'),
      el('th', {}, 'Reset'),
      el('th', {}, 'Fields'),
      el('th', {}, 'Description'),
    ));
  table.appendChild(thead);

  const tbody = el('tbody');
  for (const reg of registers) {
    const offset = reg.addressOffset;
    const access = reg.access || '';
    const reset = reg.resetValue;
    const bits = reg.size || 32;
    const fieldInfo = isSummary
      ? `${reg.fieldCount} fields`
      : `${(reg.fields || []).length} fields`;

    const row = el('tr', {
      className: 'clickable',
      onClick: () => {
        window.location.hash = `#/block/${path}/reg/${reg.name}`;
      },
    },
      el('td', { className: 'mono' }, hexAddr(offset).replace(/^0x0{4}/, '0x')),
      el('td', { className: 'mono' }, reg.name),
      el('td', {},
        el('span', { className: `access-badge ${accessClass(access)}` }, accessLabel(access))),
      el('td', { className: 'mono' }, reset != null ? hexReset(reset, bits) : '\u2014'),
      el('td', {}, fieldInfo),
      el('td', { style: { maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
        reg.description || ''),
    );
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  main.appendChild(table);
}
