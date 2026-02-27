// Data layer with LRU cache

const CACHE_SIZE = 50;
const cache = new Map();

function cacheGet(key) {
  if (!cache.has(key)) return undefined;
  const value = cache.get(key);
  // Move to end (most recently used)
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function cacheSet(key, value) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  // Evict oldest if over limit
  if (cache.size > CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

async function fetchJson(url) {
  const cached = cacheGet(url);
  if (cached) return cached;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Fetch failed: ${url} (${resp.status})`);
  const data = await resp.json();
  cacheSet(url, data);
  return data;
}

// Public API

let indexData = null;

export async function loadIndex() {
  if (indexData) return indexData;
  indexData = await fetchJson('data/index.json');
  return indexData;
}

export function getIndex() {
  return indexData;
}

export async function loadBlock(path) {
  return fetchJson(`data/blocks/${path}.json`);
}

export async function loadBlockSummary(path) {
  try {
    return await fetchJson(`data/blocks/${path}.summary.json`);
  } catch {
    // No summary file, load full block
    return loadBlock(path);
  }
}

export async function loadChip(path) {
  return fetchJson(`data/chips/${path}.json`);
}

export async function loadSearchTier1() {
  return fetchJson('data/search-tier1.json');
}

export async function loadSearchTier2() {
  return fetchJson('data/search-tier2.json');
}

export async function loadSearchTier3() {
  return fetchJson('data/search-tier3.json');
}

export function findVendor(name) {
  if (!indexData) return null;
  return indexData.vendors.find(v => v.name === name);
}

export function findFamily(code) {
  if (!indexData) return null;
  return indexData.families.find(f => f.code === code);
}

export function findSubfamily(familyCode, subName) {
  const fam = findFamily(familyCode);
  if (!fam) return null;
  return fam.subfamilies.find(s => s.name === subName);
}

export function findChipPath(familyCode, subName, chipName) {
  return `${familyCode}/${subName}/${chipName}`;
}

export function resolveBlockPath(modelName, familyCode, subName) {
  // Check subfamily -> family -> shared
  if (!indexData) return modelName;
  const paths = [
    `${familyCode}/${subName}/${modelName}`,
    `${familyCode}/${modelName}`,
    modelName,
  ];
  // Use chipIndex blocks data
  for (const fam of indexData.families) {
    if (fam.code !== familyCode) continue;
    // Check subfamily blocks
    for (const sub of fam.subfamilies) {
      if (sub.name !== subName) continue;
      for (const b of (sub.blocks || [])) {
        if (b.name === modelName) return b.path;
      }
    }
    // Check family blocks
    for (const b of (fam.familyBlocks || [])) {
      if (b.name === modelName) return b.path;
    }
  }
  // Check shared blocks across all vendors
  for (const v of (indexData.vendors || [])) {
    for (const b of (v.sharedBlocks || [])) {
      if (b.name === modelName) return b.path;
    }
  }
  return modelName;
}
