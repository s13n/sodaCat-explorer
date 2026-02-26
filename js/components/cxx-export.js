// C++ peripheral header generator
// Port of sodaCat's generators/cxx/generate_peripheral_header.py
//
// Generates C++ headers with inline namespaces, bitfield structs, enum
// definitions, HwReg<>/HwPtr<> wrappers and integration metadata — the same
// output the Python generator produces.

import { findFamily } from '../data.js';

// ── Namespace derivation ────────────────────────────────────────────────

/**
 * Derive a C++ namespace from a block path.
 * e.g. "H7/ADC" with display "STM32H7" → "stm32h7"
 */
export function deriveNamespace(blockPath) {
  const parts = blockPath.split('/');
  if (parts.length >= 2) {
    const fam = findFamily(parts[0]);
    if (fam) return fam.display.toLowerCase().replace(/[^a-z0-9_]/g, '');
    return parts[0].toLowerCase();
  }
  return 'hw';
}

// ── Enum formatting ─────────────────────────────────────────────────────

function formatEnumList(enums) {
  return enums.map(e => {
    const value = e.value ?? 1;
    const desc = e.description || '';
    return `\n\t/** ${desc} */\n\t${e.name} = ${value},`;
  }).join('');
}

// ── Field / bitfield formatting ─────────────────────────────────────────

/**
 * Format field bitfields and their enum definitions.
 * @returns {[string, string]} [fieldsStr, enumsStr]
 */
function formatFieldList(fields, type) {
  const items = fields.map(field => {
    let enumStr = '';
    if (field.enumeratedValues && field.enumeratedValues.length) {
      const enumTxt = formatEnumList(field.enumeratedValues);
      if (enumTxt) {
        enumStr = `\ninline namespace ${field.name}_ {\nenum ${field.name} : ${type} {${enumTxt}\n};\n} // namespace ${field.name}_\n`;
      }
    }
    const width = field.bitWidth || 1;
    const desc = field.description || '';
    return {
      text: `\n\t/** ${desc} */\n\t${type} ${field.name}:${width};`,
      offset: field.bitOffset || 0,
      width,
      enumStr,
    };
  });

  items.sort((a, b) => a.offset - b.offset);

  let txt = '';
  let enums = '';
  let res = 0;
  let pos = 0;
  for (const item of items) {
    enums += item.enumStr;
    if (item.offset > pos) {
      txt += `\n\t${type} _${res}:${item.offset - pos};\t// reserved`;
      res++;
    }
    txt += item.text;
    pos = item.offset + item.width;
  }
  return [txt, enums];
}

// ── Register list formatting ────────────────────────────────────────────

/**
 * Format a register list into struct definitions and instance declarations.
 * @returns {[string, string, number, string]} [structs, regs, size, enums]
 */
function formatRegisterList(reglist, defaultType, padToSize, defaultSize) {
  let enums = '';
  let structs = '';
  const items = [];

  for (const reg of reglist) {
    const addressOffset = reg.addressOffset || 0;
    const description = reg.description || '';
    const dim = reg.dim || 1;

    if (reg.registers) {
      // Nested sub-register array (dimIncrement grouping)
      const name = (reg.name || '').replace('[%s]', '');
      const padSize = reg.dimIncrement || 0;
      const [subTypes, subRegs, subSize, subEnums] = formatRegisterList(
        reg.registers, 'uint32_t', padSize, 4
      );
      enums += subEnums;
      structs += `\n${subTypes}\n/** ${description} */\nstruct ${name} {${subRegs}\n}; // size = ${subSize}\n`;

      const names = dim > 1 ? `${name}[${dim}]` : name;
      items.push({
        text: `\n\t/** ${description} */\n\tstruct ${name} ${names};`,
        offset: addressOffset,
        size: subSize * dim,
      });
    } else {
      const dimIndex = reg.dimIndex || '';
      let name = (reg.name || '').replace('%s', '');
      let names = name;

      if (dimIndex) {
        names = dimIndex.split(',').map(item =>
          (reg.name || '').replace('%s', item.trim())
        ).join(',');
      } else if (dim > 1) {
        name = (reg.name || '').replace('[%s]', '');
        names = `${name}[${dim}]`;
      }

      const size = reg.size || (defaultSize * 8);
      const type = reg.dataType || `uint${size}_t`;

      if (reg.fields && reg.fields.length) {
        const [fieldsTxt, fieldEnums] = formatFieldList(reg.fields, type);
        if (fieldEnums) {
          enums += `\ninline namespace ${name}_ {${fieldEnums}} // namespace ${name}_\n`;
        }
        structs += `\n/** ${description} */\nstruct ${name} {${fieldsTxt}\n};\n`;
      }

      const hwRegType = `HwReg<struct ${name}>`;
      items.push({
        text: `\n\t/** ${description} */\n\t${hwRegType} ${names};`,
        offset: addressOffset,
        size: (size >> 3) * dim,
      });
    }
  }

  items.sort((a, b) => a.offset - b.offset);
  items.push({ text: '', offset: 0xFFFFFFFF, size: 0 }); // sentinel

  let txt = '';
  let res = 0;
  let pos = 0;
  let inUnion = false;

  for (let i = 0; i < items.length - 1; i++) {
    const current = items[i];
    const next = items[i + 1];

    // Enter union when consecutive registers share the same offset
    if (!inUnion && current.offset === next.offset) {
      inUnion = true;
      txt += '\n\tunion {';
    }

    // Insert reserved gap bytes
    if (current.offset > pos) {
      txt += `\n\tuint8_t _${res}[${current.offset - pos}];\t// reserved`;
      res++;
      pos = current.offset;
    }

    txt += current.text;

    // Close union when the next register has a different offset
    if (inUnion && current.offset !== next.offset) {
      inUnion = false;
      txt += '\n\t};';
    } else {
      pos += current.size;
    }
  }

  if (padToSize > pos) {
    txt += `\n\tuint8_t _${res}[${padToSize - pos}];\t// reserved`;
    pos = padToSize;
  }

  return [structs, txt, pos, enums];
}

// ── Integration section ─────────────────────────────────────────────────

function formatIntegrationList(data) {
  let blocks = '';
  for (const block of (data.addressBlocks || [])) {
    const usage = block.usage || '';
    const type = usage === 'registers'
      ? `HwPtr<struct ${data.name}_::${data.name} volatile> `
      : 'std::span<std::byte> ';
    const offset = block.offset ?? 0;
    const size = block.size ?? 0;
    blocks += `\t${type}${usage};\t// offset = ${offset}, size = ${size}\n`;
  }

  let ints = '';
  const interrupts = [...(data.interrupts || [])].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  );
  for (const int of interrupts) {
    const desc = int.description || '';
    ints += `\tException ex${int.name};\t//!< ${desc}\n`;
  }

  let params = '';
  for (const par of (data.params || data.parameters || [])) {
    const desc = par.description || '';
    if (par.bits) {
      params += `\tuint16_t ${par.name}:${par.bits};\t//!< ${desc}\n`;
    } else {
      const ptype = { bool: 'bool', string: 'const char*' }[par.type] || 'uint32_t';
      params += `\t${ptype} ${par.name};\t//!< ${desc}\n`;
    }
  }

  return [blocks, ints, params];
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Generate a complete C++ peripheral header for a block.
 * @param {Object} data - Full block data object
 * @param {string} blockPath - Block path (e.g. "H7/ADC")
 * @returns {string} Complete C++ header file content
 */
export function generatePeripheralHeader(data, blockPath) {
  const ns = deriveNamespace(blockPath);
  const name = data.name || 'PERIPH';
  const description = data.description || '';
  const defaultSize = (data.size || 32) >> 3;

  const [types, regs, size, enums] = formatRegisterList(
    data.registers || [], 'uint32_t', 0, defaultSize
  );
  const [blocks, ints, params] = formatIntegrationList(data);

  let out = '';
  out += '// Generated by sodaCat Explorer\n';
  out += '#pragma once\n';
  out += '#include "hwreg.hpp"\n';
  out += '#include <cstdint>\n';
  out += `\nnamespace ${ns} {\n`;

  out += `\ninline namespace ${name}_ {`;
  if (enums) out += enums;
  out += `\n${types}`;
  out += `\n/** ${description} */`;
  out += `\nstruct ${name} {${regs}`;
  out += `\n}; // size = ${size}`;
  out += `\n} // inline namespace ${name}_\n`;

  if (blocks || ints || params) {
    out += `\n/** Integration of peripheral in the SoC. */`;
    out += `\nnamespace integration {`;
    out += `\nstruct ${name} {\n${params}${ints}${blocks}};`;
    out += `\n} // namespace integration\n`;
  }

  out += `\n} // namespace ${ns}\n`;

  return out;
}

/**
 * Generate a C++ struct for a single register.
 * @param {Object} reg - Register data with fields
 * @returns {string} C++ struct with bitfields and enums
 */
export function generateRegisterStruct(reg) {
  const name = reg.name || 'REG';
  const bits = reg.size || 32;
  const type = `uint${bits}_t`;
  const description = reg.description || '';

  let result = '';

  if (reg.fields && reg.fields.length) {
    const [fieldsTxt, enumsTxt] = formatFieldList(reg.fields, type);
    if (enumsTxt) {
      result += `inline namespace ${name}_ {${enumsTxt}} // namespace ${name}_\n\n`;
    }
    result += `/** ${description} */\n`;
    result += `struct ${name} {${fieldsTxt}\n};\n`;
  } else {
    result += `/** ${description} */\n`;
    result += `struct ${name} {\n\t${type} raw;\n};\n`;
  }

  return result;
}
