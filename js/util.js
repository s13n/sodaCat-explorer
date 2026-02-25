// Utility functions

export function hexAddr(value) {
  if (typeof value === 'string' && value.startsWith('0x')) return value;
  return '0x' + (value >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

export function hexReset(value, bits = 32) {
  if (value == null) return '';
  const hex = (value >>> 0).toString(16).toUpperCase();
  const pad = Math.ceil(bits / 4);
  return '0x' + hex.padStart(pad, '0');
}

export function accessLabel(access) {
  if (!access) return '';
  const map = {
    'read-write': 'RW',
    'read-only': 'RO',
    'write-only': 'WO',
    'writeOnce': 'W1',
    'read-writeOnce': 'RW1',
  };
  return map[access] || access;
}

export function accessClass(access) {
  if (!access) return 'access-rw';
  if (access.startsWith('read-write') || access === 'read-writeOnce') return 'access-rw';
  if (access === 'read-only') return 'access-ro';
  if (access === 'write-only' || access === 'writeOnce') return 'access-wo';
  return 'access-rw';
}

export function fieldAccessClass(access) {
  if (!access) return 'field-rw';
  if (access.startsWith('read-write') || access === 'read-writeOnce') return 'field-rw';
  if (access === 'read-only') return 'field-ro';
  if (access === 'write-only' || access === 'writeOnce') return 'field-wo';
  return 'field-rw';
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') e.className = v;
    else if (k === 'onClick') e.addEventListener('click', v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else e.setAttribute(k, v);
  }
  for (const child of children) {
    if (child == null) continue;
    if (typeof child === 'string') e.appendChild(document.createTextNode(child));
    else e.appendChild(child);
  }
  return e;
}

export function parsePath(hash) {
  // Remove leading #/ and split
  const clean = (hash || '').replace(/^#\/?/, '');
  return clean.split('/').filter(Boolean);
}

export function clearContent() {
  const main = document.getElementById('content');
  main.innerHTML = '';
  return main;
}
