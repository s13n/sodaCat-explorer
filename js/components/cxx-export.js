// C++ peripheral header generator
// Port of sodaCat's generators/cxx/generate_peripheral_header.py
//
// Generates C++ headers with inline namespaces, bitfield structs, enum
// definitions, HwReg<>/HwPtr<> wrappers and integration metadata — the same
// output the Python generator produces.

import { findFamily } from '../data.js';

// ── Identifier sanitization ─────────────────────────────────────────────

const RESERVED_NAMES = new Set([
  // C++20 keywords
  'alignas', 'alignof', 'and', 'and_eq', 'asm', 'auto',
  'bitand', 'bitor', 'bool', 'break',
  'case', 'catch', 'char', 'char8_t', 'char16_t', 'char32_t', 'class',
  'compl', 'concept', 'const', 'consteval', 'constexpr', 'constinit',
  'const_cast', 'continue', 'co_await', 'co_return', 'co_yield',
  'decltype', 'default', 'delete', 'do', 'double', 'dynamic_cast',
  'else', 'enum', 'explicit', 'export', 'extern',
  'false', 'float', 'for', 'friend',
  'goto',
  'if', 'inline', 'int',
  'long',
  'mutable',
  'namespace', 'new', 'noexcept', 'not', 'not_eq', 'nullptr',
  'operator', 'or', 'or_eq',
  'private', 'protected', 'public',
  'register', 'reinterpret_cast', 'requires', 'return',
  'short', 'signed', 'sizeof', 'static', 'static_assert', 'static_cast',
  'struct', 'switch',
  'template', 'this', 'thread_local', 'throw', 'true', 'try', 'typedef',
  'typeid', 'typename',
  'union', 'unsigned', 'using',
  'virtual', 'void', 'volatile',
  'wchar_t', 'while',
  'xor', 'xor_eq',
  'NULL',
]);

function safeName(name) {
  if (!name) return name;
  if (/^\d/.test(name)) return 'e' + name;
  return RESERVED_NAMES.has(name) ? name + '_' : name;
}

// ── Array dimensions ────────────────────────────────────────────────────

/**
 * Determine HwArray dimensions for a register. Returns a list of [count, base]
 * tuples (outermost first), or null if the register is not an array or uses
 * non-numeric/non-sequential labels that HwArray can't represent.
 */
function parseArrayDims(reg) {
  const dim = reg.dim;
  if (Array.isArray(dim)) {
    // Multi-dimensional array (sodaCat extension): always 0-based.
    return dim.map(d => [d, 0]);
  }
  if (typeof dim === 'number' && dim > 1) {
    const dimIndex = reg.dimIndex || '';
    if (dimIndex) {
      const tokens = String(dimIndex).split(',').map(t => t.trim());
      const ints = tokens.map(t => /^-?\d+$/.test(t) ? parseInt(t, 10) : NaN);
      if (ints.some(Number.isNaN)) return null;  // letter/named labels — keep flat
      const base = ints[0];
      const expected = ints.every((v, i) => v === base + i);
      if (!expected) return null;  // non-sequential — keep flat
      return [[ints.length, base]];
    }
    return [[dim, 0]];
  }
  return null;
}

/** Wrap elemType in nested HwArray<...> for each dimension. */
function wrapArrayType(elemType, dims) {
  for (let i = dims.length - 1; i >= 0; i--) {
    const [count, base] = dims[i];
    elemType = base === 0
      ? `HwArray<${elemType}, ${count}>`
      : `HwArray<${elemType}, ${count}, ${base}>`;
  }
  return elemType;
}

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
    return `\n\t/** ${desc} */\n\t${safeName(e.name)} = ${value},`;
  }).join('');
}

// ── Field / bitfield formatting ─────────────────────────────────────────

/**
 * Format field bitfields and their enum definitions.
 * @returns {[string, string]} [fieldsStr, enumsStr]
 */
function formatFieldList(fields, type, sname = '') {
  const items = fields.map(field => {
    const fname = safeName(field.name);
    let enumStr = '';
    if (field.enumeratedValues && field.enumeratedValues.length) {
      const enumTxt = formatEnumList(field.enumeratedValues);
      if (enumTxt) {
        const enumType = sname ? `${sname}_${fname}` : `${fname}_e`;
        enumStr = `\ninline namespace ${fname}_ {\nenum ${enumType} : ${type} {${enumTxt}\n};\n} // namespace ${fname}_\n`;
      }
    }
    const width = field.bitWidth || 1;
    const desc = field.description || '';
    return {
      text: `\n\t/** ${desc} */\n\t${type} ${fname}:${width};`,
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
function formatRegisterList(reglist, defaultType, padToSize, defaultSize, structPrefix = '', blockName = '') {
  let enums = '';
  let structs = '';
  const items = [];

  for (const reg of reglist) {
    const addressOffset = reg.addressOffset || 0;
    const description = reg.description || '';
    const dim = reg.dim || 1;
    const dimTotal = Array.isArray(dim) ? dim.reduce((a, b) => a * b, 1) : dim;

    if (reg.registers) {
      // Nested sub-register array (dimIncrement grouping)
      const dimIndex = reg.dimIndex || '';
      const rawName = reg.name || '';
      // Derive struct type name: strip [%s] or %s, drop trailing _
      let name = rawName.replaceAll('[%s]', '').replaceAll('%s', '').replace(/_+$/, '');
      // Disambiguate from peripheral struct name (only at top level)
      if (!structPrefix && blockName && name === blockName) name = name + '_';
      const padSize = reg.dimIncrement || 0;
      const innerPrefix = structPrefix + name + '_';
      const [subTypes, subRegs, subSize, subEnums] = formatRegisterList(
        reg.registers, 'uint32_t', padSize, 4, innerPrefix
      );
      enums += subEnums;
      structs += `\n${subTypes}\n/** ${description} */\nstruct ${name} {${subRegs}\n}; // size = ${subSize}\n`;

      const dims = parseArrayDims(reg);
      let line;
      if (dims !== null) {
        const fieldType = wrapArrayType('struct ' + name, dims);
        const fieldName = rawName.replaceAll('[%s]', '').replaceAll('%s', '');
        line = `\n\t/** ${description} */\n\t${fieldType} ${fieldName};`;
      } else if (dimIndex) {
        // Letter or named labels — keep expanded comma-separated fields.
        const names = dimIndex.split(',').map(item =>
          rawName.replace('%s', item.trim())
        ).join(',');
        line = `\n\t/** ${description} */\n\tstruct ${name} ${names};`;
      } else {
        line = `\n\t/** ${description} */\n\tstruct ${name} ${rawName};`;
      }
      items.push({ text: line, offset: addressOffset, size: subSize * dimTotal });
    } else {
      const dimIndex = reg.dimIndex || '';
      const dims = parseArrayDims(reg);
      let memberName, typeName, names;

      if (dims === null && dimIndex) {
        // Letter or named labels — keep expanded comma-separated fields.
        // Disambiguate the bitfield struct name when multiple dimIndex
        // arrays share a prefix in the same scope: include the first
        // dimIndex token in the struct name.
        const tokens = dimIndex.split(',').map(t => t.trim());
        memberName = (reg.name || '').replace('%s', tokens[0]);
        typeName = structPrefix + memberName;
        names = tokens.map(item => (reg.name || '').replace('%s', item)).join(',');
      } else {
        // Single register, or HwArray-wrapped array.
        memberName = (reg.name || '').replaceAll('[%s]', '').replaceAll('%s', '');
        typeName = structPrefix + memberName;
        names = memberName;
      }
      // Avoid clashing the bitfield struct name with the peripheral struct
      if (!structPrefix && blockName && typeName === blockName) typeName = typeName + '_';

      const size = reg.size || (defaultSize * 8);
      const type = reg.dataType || `uint${size}_t`;

      if (reg.fields && reg.fields.length) {
        const [fieldsTxt, fieldEnums] = formatFieldList(reg.fields, type, typeName);
        if (fieldEnums) {
          enums += `\ninline namespace ${typeName}_ {${fieldEnums}} // namespace ${typeName}_\n`;
        }
        structs += `\n/** ${description} */\nstruct ${typeName} {${fieldsTxt}\n};\n`;
      }

      let regType = reg.fields && reg.fields.length
        ? `HwReg<struct ${typeName}>`
        : type;
      if (dims !== null) regType = wrapArrayType(regType, dims);
      items.push({
        text: `\n\t/** ${description} */\n\t${regType} ${names};`,
        offset: addressOffset,
        size: (size >> 3) * dimTotal,
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

    // Advance `pos` once per union (on close) or once per non-union
    // register. A union of N overlapping registers occupies the space of
    // one member; advancing per-member would over-count by (N-1)*size.
    if (inUnion) {
      if (current.offset !== next.offset) {
        inUnion = false;
        txt += '\n\t};';
        pos += current.size;
      }
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
      ? `HwPtr<struct ${data.name} volatile> `
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
  for (const par of (data.params || [])) {
    const desc = par.description || '';
    const ptype = par.type || 'int';   // type: is optional; defaults to int
    if (par.bits != null) {
      // Explicit bit-width wins over any derivation; some authors round up
      // (e.g. bits: 16, max: 32767) for alignment reasons.
      params += `\tuint16_t ${par.name}:${par.bits};\t//!< ${desc}\n`;
    } else if (ptype === 'bool') {
      params += `\tuint16_t ${par.name}:1;\t//!< ${desc}\n`;
    } else if (ptype === 'int' && par.max != null) {
      const bits = (32 - Math.clz32(par.max)) || 1;
      params += `\tuint16_t ${par.name}:${bits};\t//!< ${desc}\n`;
    } else {
      const ctype = { string: 'const char*' }[ptype] || 'uint32_t';
      params += `\t${ctype} ${par.name};\t//!< ${desc}\n`;
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
    data.registers || [], 'uint32_t', 0, defaultSize, '', name
  );
  const [blocks, ints, params] = formatIntegrationList(data);

  let out = '';
  out += '// Generated by sodaCat Explorer\n';
  out += '#pragma once\n';
  out += '#include "hwreg.hpp"\n';
  out += '#include <cstdint>\n';
  out += `\nnamespace ${ns} {\n`;

  out += `\nnamespace ${name} {`;
  if (enums) out += enums;
  out += `\n${types}`;
  out += `\n/** ${description} */`;
  out += `\nstruct ${name} {${regs}`;
  out += `\n}; // size = ${size}\n`;

  out += `\n/** Integration of peripheral in the SoC. */`;
  out += `\nstruct Intgr {\n${params}${ints}${blocks}};\n`;

  out += `} // namespace ${name}\n`;
  out += `\n} // namespace ${ns}\n`;

  return out;
}

/**
 * Generate a C++ struct for a single register.
 * @param {Object} reg - Register data with fields
 * @returns {string} C++ struct with bitfields and enums
 */
export function generateRegisterStruct(reg) {
  const name = safeName(reg.name || 'REG');
  const bits = reg.size || 32;
  const type = `uint${bits}_t`;
  const description = reg.description || '';

  let result = '';

  if (reg.fields && reg.fields.length) {
    const [fieldsTxt, enumsTxt] = formatFieldList(reg.fields, type, name);
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
