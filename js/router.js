// Hash-based router with support for multi-segment block paths

const routes = [];
let cleanupFn = null;

export function addRoute(pattern, handler) {
  routes.push({ pattern, handler });
}

export function navigate(hash) {
  window.location.hash = hash;
}

function getPath() {
  const hash = window.location.hash || '#/';
  return hash.slice(1); // Remove #
}

function matchSimpleRoute(pattern, path) {
  const patParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  if (patParts.length !== pathParts.length) return null;

  const params = {};
  for (let i = 0; i < patParts.length; i++) {
    if (patParts[i].startsWith(':')) {
      params[patParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (patParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

async function handleRoute() {
  if (cleanupFn) {
    cleanupFn();
    cleanupFn = null;
  }

  const path = getPath();

  // Special handling for multi-segment block paths:
  // #/block/H7/H742_H753/ADC/reg/ISR  (register view)
  // #/block/H7/H742_H753/ADC          (block view)
  // #/block/WWDG                       (shared block view)
  const regMatch = path.match(/^\/block\/(.+)\/reg\/([^/]+)$/);
  if (regMatch) {
    const route = routes.find(r => r.pattern === '/block/:path/reg/:reg');
    if (route) {
      const cleanup = await route.handler({
        path: regMatch[1],
        reg: decodeURIComponent(regMatch[2]),
      });
      if (typeof cleanup === 'function') cleanupFn = cleanup;
      return;
    }
  }

  const blockMatch = path.match(/^\/block\/(.+)$/);
  if (blockMatch) {
    const route = routes.find(r => r.pattern === '/block/:path');
    if (route) {
      const cleanup = await route.handler({ path: blockMatch[1] });
      if (typeof cleanup === 'function') cleanupFn = cleanup;
      return;
    }
  }

  // Search with query string
  if (path.startsWith('/search')) {
    const route = routes.find(r => r.pattern === '/search');
    if (route) {
      const cleanup = await route.handler({});
      if (typeof cleanup === 'function') cleanupFn = cleanup;
      return;
    }
  }

  // Standard fixed-segment routes
  for (const route of routes) {
    // Skip special patterns handled above
    if (route.pattern.includes('/block/') || route.pattern === '/search') continue;

    const params = matchSimpleRoute(route.pattern, path);
    if (params) {
      const cleanup = await route.handler(params);
      if (typeof cleanup === 'function') cleanupFn = cleanup;
      return;
    }
  }

  // Home route
  if (!path || path === '/') {
    const route = routes.find(r => r.pattern === '/');
    if (route) {
      const cleanup = await route.handler({});
      if (typeof cleanup === 'function') cleanupFn = cleanup;
      return;
    }
  }

  document.getElementById('content').innerHTML =
    `<div class="loading">Route not found: ${path}</div>`;
}

export function startRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
