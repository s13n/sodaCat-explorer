// Block detail view — params, register list

import { loadBlock, loadBlockSummary, findFamily, resolveBlockPath } from '../data.js';
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
    // Resolve target name to full block path using current block's family/subfamily context
    const familyCode = pathParts.length >= 2 ? pathParts[0] : '';
    const subName = pathParts.length >= 3 ? pathParts[1] : '';
    const targetPath = resolveBlockPath(target, familyCode, subName);
    main.appendChild(el('div', { className: 'section-header' },
      el('h1', {}, data.name || blockName),
    ));
    main.appendChild(el('p', { className: 'description' },
      'This block is an alias of ',
      el('a', { href: `#/block/${targetPath}` }, target),
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

  // Interrupts
  const interrupts = data.interrupts || [];
  if (interrupts.length > 0) {
    main.appendChild(el('div', { className: 'section-header' },
      el('h2', {}, 'Interrupts'),
    ));
    const irqTable = el('table', { className: 'data-table' });
    const irqHead = el('thead', {},
      el('tr', {},
        el('th', {}, 'Signal'),
        el('th', {}, 'Description'),
      ));
    irqTable.appendChild(irqHead);
    const irqBody = el('tbody');
    for (const irq of interrupts) {
      irqBody.appendChild(el('tr', {},
        el('td', { className: 'mono' }, irq.name),
        el('td', {}, irq.description || ''),
      ));
    }
    irqTable.appendChild(irqBody);
    main.appendChild(irqTable);
  }

  // Registers
  const registers = data.registers || [];
  const regCount = registers.reduce((n, r) =>
    n + (r.registers ? r.registers.length : 1), 0);
  main.appendChild(el('div', { className: 'section-header' },
    el('h2', {}, 'Registers'),
    el('span', { className: 'subtitle' }, `${regCount} registers`),
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

  const fmtOffset = (v) => hexAddr(v).replace(/^0x0{4}/, '0x');

  const tbody = el('tbody');
  for (const reg of registers) {
    const dim = reg.dim || 1;
    const dimStr = dim > 1 ? `[0..${dim - 1}]` : '';
    const baseName = (reg.name || '').replace('[%s]', '').replace('%s', '');

    if (reg.registers) {
      // Cluster: header row + sub-register rows
      tbody.appendChild(el('tr', { className: 'cluster-header' },
        el('td', { className: 'mono' }, fmtOffset(reg.addressOffset)),
        el('td', { className: 'mono', colSpan: '5' },
          `${baseName}${dimStr}`,
          dim > 1 ? ` (stride ${reg.dimIncrement})` : '',
          reg.description ? ` \u2014 ${reg.description}` : '',
        ),
      ));
      for (const sub of reg.registers) {
        const subDim = sub.dim || 1;
        const subDimStr = subDim > 1 ? `[0..${subDim - 1}]` : '';
        const subName = (sub.name || '').replace('[%s]', '').replace('%s', '');
        const access = sub.access || '';
        const reset = sub.resetValue;
        const bits = sub.size || 32;
        const fieldInfo = isSummary
          ? `${sub.fieldCount} fields`
          : `${(sub.fields || []).length} fields`;

        tbody.appendChild(el('tr', {
          className: 'clickable',
          onClick: () => {
            window.location.hash = `#/block/${path}/reg/${encodeURIComponent(reg.name)}/${encodeURIComponent(sub.name)}`;
          },
        },
          el('td', { className: 'mono' }, `+${fmtOffset(sub.addressOffset)}`),
          el('td', { className: 'mono cluster-indent' }, `${subName}${subDimStr}`),
          el('td', {},
            el('span', { className: `access-badge ${accessClass(access)}` }, accessLabel(access))),
          el('td', { className: 'mono' }, reset != null ? hexReset(reset, bits) : '\u2014'),
          el('td', {}, fieldInfo),
          el('td', { style: { maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
            sub.description || ''),
        ));
      }
    } else {
      // Plain register (or register array)
      const access = reg.access || '';
      const reset = reg.resetValue;
      const bits = reg.size || 32;
      const fieldInfo = isSummary
        ? `${reg.fieldCount} fields`
        : `${(reg.fields || []).length} fields`;

      const row = el('tr', {
        className: 'clickable',
        onClick: () => {
          window.location.hash = `#/block/${path}/reg/${encodeURIComponent(reg.name)}`;
        },
      },
        el('td', { className: 'mono' }, fmtOffset(reg.addressOffset)),
        el('td', { className: 'mono' }, `${baseName}${dimStr}`),
        el('td', {},
          el('span', { className: `access-badge ${accessClass(access)}` }, accessLabel(access))),
        el('td', { className: 'mono' }, reset != null ? hexReset(reset, bits) : '\u2014'),
        el('td', {}, fieldInfo),
        el('td', { style: { maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
          reg.description || ''),
      );
      tbody.appendChild(row);
    }
  }
  table.appendChild(tbody);
  main.appendChild(table);

  // Used in (which chips use this block)
  const usedIn = data.usedIn || [];
  if (usedIn.length > 0) {
    const chipSet = new Set(usedIn.map(u => u.chipPath));
    main.appendChild(el('div', { className: 'section-header' },
      el('h2', {}, 'Used in'),
      el('span', { className: 'subtitle' }, `${chipSet.size} chips, ${usedIn.length} instances`),
    ));

    // Collect unique parameter names across all instances
    const paramNames = [];
    const paramSet = new Set();
    for (const u of usedIn) {
      for (const p of (u.parameters || [])) {
        if (!paramSet.has(p.name)) {
          paramSet.add(p.name);
          paramNames.push(p.name);
        }
      }
    }

    const usedTable = el('table', { className: 'data-table' });
    const headerRow = el('tr', {},
      el('th', {}, 'Chip'),
      el('th', {}, 'Instance'),
      el('th', {}, 'Base Address'),
    );
    for (const name of paramNames) {
      headerRow.appendChild(el('th', {}, name));
    }
    usedTable.appendChild(el('thead', {}, headerRow));

    const usedBody = el('tbody');
    for (const u of usedIn) {
      const paramMap = new Map((u.parameters || []).map(p => [p.name, p.value]));
      const row = el('tr', {
        className: 'clickable',
        onClick: () => { window.location.hash = `#/chip/${u.chipPath}`; },
      },
        el('td', {},
          el('a', { href: `#/chip/${u.chipPath}` }, u.chip)),
        el('td', { className: 'mono' }, u.instance),
        el('td', { className: 'mono' }, u.address),
      );
      for (const name of paramNames) {
        const val = paramMap.get(name);
        row.appendChild(el('td', { className: 'mono', style: { fontSize: '12px', color: 'var(--text-muted)' } },
          val != null ? String(val) : '\u2014'));
      }
      usedBody.appendChild(row);
    }
    usedTable.appendChild(usedBody);
    main.appendChild(usedTable);
  }
}
