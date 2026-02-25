// Tiered search with progressive loading

import { loadSearchTier1, loadSearchTier2, loadSearchTier3 } from './data.js';
import { el, escapeHtml } from './util.js';

let tier1 = null;
let tier2 = null;
let tier3 = null;

const inputEl = document.getElementById('search-input');
const dropdownEl = document.getElementById('search-dropdown');

let activeIndex = -1;
let results = [];

function scoreMatch(name, query) {
  const lower = name.toLowerCase();
  const q = query.toLowerCase();
  if (lower === q) return 100;
  if (lower.startsWith(q)) return 80;
  if (lower.includes(q)) return 60;
  return 0;
}

function typeWeight(type) {
  switch (type) {
    case 'chip': return 10;
    case 'block': return 8;
    case 'register': return 5;
    case 'field': return 3;
    default: return 1;
  }
}

async function doSearch(query) {
  if (!query || query.length < 2) {
    results = [];
    return results;
  }

  // Ensure tier 1 is loaded
  if (!tier1) tier1 = await loadSearchTier1();

  let all = tier1.filter(e => scoreMatch(e.name, query) > 0);

  // Load tier 2 for deeper search
  if (query.length >= 3 && all.length < 5) {
    if (!tier2) tier2 = await loadSearchTier2();
    const t2matches = tier2.filter(e => scoreMatch(e.name, query) > 0);
    all = all.concat(t2matches);
  }

  // Load tier 3 for very specific search
  if (query.length >= 4 && all.length < 5) {
    if (!tier3) tier3 = await loadSearchTier3();
    const t3matches = tier3.filter(e => scoreMatch(e.name, query) > 0);
    all = all.concat(t3matches);
  }

  // Score and sort
  all.sort((a, b) => {
    const sa = scoreMatch(a.name, query) + typeWeight(a.type);
    const sb = scoreMatch(b.name, query) + typeWeight(b.type);
    return sb - sa;
  });

  results = all.slice(0, 20);
  return results;
}

function resultHash(item) {
  switch (item.type) {
    case 'chip': return `#/chip/${item.path}`;
    case 'block': return `#/block/${item.path}`;
    case 'register': return `#/block/${item.blockPath}/reg/${item.name}`;
    case 'field': return `#/block/${item.blockPath}/reg/${item.register}`;
    default: return '#/';
  }
}

function resultDetail(item) {
  switch (item.type) {
    case 'block': return item.description || item.path;
    case 'register': return `${item.block} \u203A ${item.name}`;
    case 'field': return `${item.block} \u203A ${item.register} \u203A ${item.name}`;
    default: return item.path || '';
  }
}

function renderDropdown() {
  dropdownEl.innerHTML = '';
  if (results.length === 0) {
    dropdownEl.classList.add('hidden');
    return;
  }
  dropdownEl.classList.remove('hidden');

  results.forEach((item, i) => {
    const div = el('div', {
      className: `search-result ${i === activeIndex ? 'active' : ''}`,
    },
      el('span', {},
        el('span', { className: 'result-name' }, item.name),
        el('span', { className: 'result-type' }, item.type),
      ),
      el('div', { className: 'result-detail' }, resultDetail(item)),
    );
    div.addEventListener('click', () => {
      window.location.hash = resultHash(item);
      closeDropdown();
    });
    div.addEventListener('mouseenter', () => {
      activeIndex = i;
      updateActive();
    });
    dropdownEl.appendChild(div);
  });
}

function updateActive() {
  const items = dropdownEl.querySelectorAll('.search-result');
  items.forEach((item, i) => {
    item.classList.toggle('active', i === activeIndex);
  });
}

function closeDropdown() {
  dropdownEl.classList.add('hidden');
  results = [];
  activeIndex = -1;
  inputEl.value = '';
}

let debounceTimer = null;

export function initSearch() {
  inputEl.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = inputEl.value.trim();
    debounceTimer = setTimeout(async () => {
      activeIndex = -1;
      await doSearch(query);
      renderDropdown();
    }, 150);
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, results.length - 1);
      updateActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      updateActive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        window.location.hash = resultHash(results[activeIndex]);
        closeDropdown();
      } else if (inputEl.value.trim()) {
        window.location.hash = `#/search?q=${encodeURIComponent(inputEl.value.trim())}`;
        closeDropdown();
      }
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      dropdownEl.classList.add('hidden');
    }
  });

  // Global keyboard shortcut: / to focus search
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey &&
        document.activeElement !== inputEl &&
        document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      inputEl.focus();
    }
  });
}

// Full search results page
export async function renderSearchResults(params) {
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const query = urlParams.get('q') || '';

  if (!query) return;

  const { clearContent } = await import('./util.js');
  const { setBreadcrumb } = await import('./components/breadcrumb.js');

  setBreadcrumb([
    { label: 'Home', hash: '#/' },
    { label: `Search: "${query}"` },
  ]);

  const main = clearContent();
  main.innerHTML = '<div class="loading">Searching...</div>';

  // Do full search
  if (!tier1) tier1 = await loadSearchTier1();
  if (!tier2) tier2 = await loadSearchTier2();
  if (!tier3) tier3 = await loadSearchTier3();

  let all = [...tier1, ...tier2, ...tier3].filter(e => scoreMatch(e.name, query) > 0);
  all.sort((a, b) => {
    const sa = scoreMatch(a.name, query) + typeWeight(a.type);
    const sb = scoreMatch(b.name, query) + typeWeight(b.type);
    return sb - sa;
  });

  main.innerHTML = '';
  main.appendChild(el('div', { className: 'section-header' },
    el('h1', {}, `Search: "${query}"`),
    el('span', { className: 'subtitle' }, `${all.length} results`),
  ));

  if (all.length === 0) {
    main.appendChild(el('p', { className: 'description' }, 'No results found.'));
    return;
  }

  const table = el('table', { className: 'data-table' });
  const thead = el('thead', {},
    el('tr', {},
      el('th', {}, 'Type'),
      el('th', {}, 'Name'),
      el('th', {}, 'Context'),
    ));
  table.appendChild(thead);

  const tbody = el('tbody');
  for (const item of all.slice(0, 100)) {
    const row = el('tr', { className: 'clickable', onClick: () => {
      window.location.hash = resultHash(item);
    }},
      el('td', {},
        el('span', { className: `access-badge` }, item.type)),
      el('td', { className: 'mono' }, item.name),
      el('td', {}, resultDetail(item)),
    );
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  main.appendChild(table);

  if (all.length > 100) {
    main.appendChild(el('p', { className: 'description' },
      `Showing first 100 of ${all.length} results.`));
  }
}
