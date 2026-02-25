// Main app entry point

import { loadIndex } from './data.js';
import { addRoute, startRouter } from './router.js';
import { buildSidebar } from './sidebar.js';
import { initSearch, renderSearchResults } from './search.js';
import { renderHome } from './views/home.js';
import { renderFamily } from './views/family.js';
import { renderSubfamily } from './views/subfamily.js';
import { renderChip } from './views/chip.js';
import { renderBlock } from './views/block.js';
import { renderRegister } from './views/register.js';
import { renderChipDiff } from './compare/chip-diff.js';
import { renderBlockDiff } from './compare/block-diff.js';

async function init() {
  try {
    const index = await loadIndex();

    // Build sidebar
    buildSidebar(index.families);

    // Register routes
    addRoute('/', renderHome);
    addRoute('/family/:code', renderFamily);
    addRoute('/subfamily/:family/:sub', renderSubfamily);
    addRoute('/chip/:family/:sub/:chip', renderChip);
    addRoute('/block/:path/reg/:reg', renderRegister);
    addRoute('/block/:path', renderBlock);
    addRoute('/compare/chips/:a/:b', renderChipDiff);
    addRoute('/compare/blocks/:a/:b', renderBlockDiff);
    addRoute('/search', renderSearchResults);

    // Init search
    initSearch();

    // Start router
    startRouter();

  } catch (e) {
    document.getElementById('content').innerHTML =
      `<div class="loading">Failed to initialize: ${e.message}<br>` +
      `Make sure to run <code>python3 website/build.py</code> first.</div>`;
    console.error('Init failed:', e);
  }
}

init();
