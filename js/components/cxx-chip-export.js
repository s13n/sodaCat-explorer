// C++ chip header generator
// Port of sodaCat's generators/cxx/generate_chip_header.py
//
// Generates C++ chip headers with:
//  - per-chip `enum class Connection : uint16_t` (Connection-based output
//    routing introduced in sodaCat 75ac06c2; the enumerator names
//    instance-signal pairs the chip wires)
//  - per-target route tables (`c_<TARGET>`) — pair-list `RouteEntry[]`
//    when any port is wired twice, direct `Connection[]` array otherwise
//  - constexpr integration structs (`i_<NAME>`) for each peripheral
//    instance: parameters, `.conn<SIG> = Connection::<INST>_<SIG>`
//    initialisers, and base address

import { findFamily } from '../data.js';
import { deriveNamespace } from './cxx-export.js';

// ── Namespace helpers ────────────────────────────────────────────────

function deriveChipNamespace(chipPath) {
  const family = chipPath.split('/')[0];
  const fam = findFamily(family);
  if (fam) return fam.display.toLowerCase().replace(/[^a-z0-9_]/g, '');
  return family.toLowerCase();
}

function deriveModelNamespace(modelPath, chipNamespace) {
  if (!modelPath) return chipNamespace;
  const parts = modelPath.split('/');
  if (parts.length >= 2) return deriveNamespace(modelPath);
  return chipNamespace;
}

// ── Parameter / instance formatting ──────────────────────────────────

function formatParameters(params) {
  let txt = '';
  for (const p of params) {
    const v = p.value;
    if (typeof v === 'boolean') {
      txt += `\n\t.${p.name} = ${v ? 'true' : 'false'},`;
    } else if (typeof v === 'string') {
      txt += `\n\t.${p.name} = "${v}",`;
    } else {
      txt += `\n\t.${p.name} = ${v}u,`;
    }
  }
  return txt;
}

/**
 * Emit `.conn<SIG> = Connection::<INST>_<SIG>` initialisers for one
 * instance's wired signals. One entry per wired signal regardless of
 * how many destinations it has; the wiring itself lives in the per-
 * target route tables.
 */
function formatConnections(instName, connections) {
  let txt = '';
  for (const [sig, dests] of Object.entries(connections || {})) {
    if (!dests || dests.length === 0) continue;
    txt += `\n\t.conn${sig} = Connection::${instName}_${sig},`;
  }
  return txt;
}

// ── Connection enum + route tables ───────────────────────────────────

/**
 * Walk the merged instance set and collect:
 *   - enumerators: ordered list of "<INST>_<SIG>" strings naming every
 *     Connection enumerator the chip needs (instance-major order)
 *   - targetRoutes: {prefix: [[enumName, port], ...]} grouped by the
 *     part of the destination string up to the final dot
 */
function collectConnections(instances) {
  const enumerators = [];
  const seen = new Set();
  const targetRoutes = {};
  for (const [instName, inst] of Object.entries(instances)) {
    for (const [sigName, dests] of Object.entries(inst.connections || inst.outputs || {})) {
      if (!dests || dests.length === 0) continue;
      const enumName = `${instName}_${sigName}`;
      if (!seen.has(enumName)) {
        enumerators.push(enumName);
        seen.add(enumName);
      }
      for (const dest of dests) {
        const lastDot = dest.lastIndexOf('.');
        if (lastDot <= 0) continue;
        const prefix = dest.slice(0, lastDot);
        const port = parseInt(dest.slice(lastDot + 1), 10);
        if (Number.isNaN(port)) continue;
        (targetRoutes[prefix] = targetRoutes[prefix] || []).push([enumName, port]);
      }
    }
  }
  return { enumerators, targetRoutes };
}

/** Map target prefix → emitted table identifier (`c_<TARGET>`). */
function tableName(prefix) {
  return 'c_' + prefix.replaceAll('.', '_');
}

function emitConnectionEnum(enumerators) {
  let body;
  if (enumerators.length === 0) {
    body = '\n\tNONE = 0,\n';
  } else {
    const lines = ['\tNONE = 0,'];
    enumerators.forEach((name, i) => lines.push(`\t${name} = ${i + 1},`));
    body = '\n' + lines.join('\n') + '\n';
  }
  return (
    'extern "C++" {\n' +
    'inline namespace hwreg {\n' +
    'enum class Connection : uint16_t {' +
    body +
    '};\n' +
    '} // namespace hwreg\n' +
    '} // extern "C++"\n'
  );
}

function emitTargetTables(enumerators, targetRoutes) {
  const prefixes = Object.keys(targetRoutes).sort();
  if (prefixes.length === 0) return '';
  const enumIndex = new Map(enumerators.map((n, i) => [n, i]));
  let out = '';
  for (const prefix of prefixes) {
    const routes = targetRoutes[prefix];
    const ports = routes.map(r => r[1]);
    const portsUnique = new Set(ports);
    const shape = portsUnique.size !== ports.length ? 'pair_list' : 'array';
    const tid = tableName(prefix);
    if (shape === 'pair_list') {
      // Dedup identical (conn, port) rows, then sort by enumerator index
      const seen = new Set();
      const rows = [];
      for (const [n, p] of routes) {
        const key = `${n}|${p}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push([n, p]);
      }
      rows.sort((a, b) => enumIndex.get(a[0]) - enumIndex.get(b[0]));
      const body = rows.map(([n, p]) => `\n\t{Connection::${n}, ${p}},`).join('');
      out += `\nconstexpr RouteEntry ${tid}[] = {${body}\n};\n`;
    } else {
      // Direct array: size to max(port)+1, slots default to NONE
      const size = Math.max(...ports) + 1;
      const slots = new Array(size).fill(null);
      for (const [n, p] of routes) slots[p] = n;
      const body = slots.map(n => `\n\tConnection::${n || 'NONE'},`).join('');
      out += `\nconstexpr Connection ${tid}[${size}] = {${body}\n};\n`;
    }
  }
  return out;
}

// ── Public API ───────────────────────────────────────────────────────

export function generateChipHeader(data, chipPath) {
  const ns = deriveChipNamespace(chipPath);
  const interruptOffset = data.interruptOffset || 0;
  const interrupts = data.interrupts || {};
  const interruptKeys = Object.keys(interrupts).map(Number).filter(n => !isNaN(n));
  const interruptCount = interruptKeys.length
    ? Math.max(...interruptKeys) + 1
    : interruptOffset;
  const instances = data.instances || {};

  // Connection enum + per-target route tables
  const { enumerators, targetRoutes } = collectConnections(instances);
  const connEnum = emitConnectionEnum(enumerators);
  const targetTables = emitTargetTables(enumerators, targetRoutes);

  // Collect unique models for #include directives
  const models = new Map();
  for (const inst of Object.values(instances)) {
    if (!models.has(inst.model)) {
      models.set(inst.model, inst.modelPath || inst.model);
    }
  }
  const includes = [...models.keys()].sort()
    .map(m => `#include "${m}.hpp"`)
    .join('\n');

  // Build instance declarations
  let decl = '';
  const sorted = Object.entries(instances).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [name, inst] of sorted) {
    const modelNs = inst.modelNamespace || deriveModelNamespace(inst.modelPath, ns);
    const params = formatParameters(inst.parameters || []);
    const conns = formatConnections(name, inst.connections || inst.outputs);
    const addr = inst.baseAddressHex
      || `0x${(inst.baseAddress >>> 0).toString(16).toUpperCase()}`;
    const init = `\n\t.registers = ${addr}u`;

    decl += `\n/** Integration parameters for ${name} */`;
    decl += `\nconstexpr struct ${modelNs}::${inst.model}::Intgr i_${name} = {`;
    decl += `${params}${conns}${init}`;
    decl += `\n};\n`;
  }

  // Assemble header
  let out = '';
  out += '// Generated by sodaCat Explorer\n';
  out += '#pragma once\n';
  if (includes) out += includes + '\n';
  out += `\n${connEnum}`;
  out += `\nnamespace ${ns} {\n`;
  out += `\nconstexpr Exception interruptOffset = ${interruptOffset};\t//!< Exception number of first interrupt`;
  out += `\nconstexpr Exception interruptCount = ${interruptCount};\t//!< Total number of exceptions (interrupts + system exceptions)\n`;
  out += targetTables;
  out += decl;
  out += `\n} // namespace ${ns}\n`;

  return out;
}
