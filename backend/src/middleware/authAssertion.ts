/**
 * Startup safety net: fails the boot if any non-exempt API route is missing
 * `authenticateToken`. Without this, a route added without auth (settings router,
 * groups/form, groups/clear all shipped this way originally) is invisible until
 * someone notices data changed without a login.
 */

/** Middleware function names that count as "this route requires a logged-in user". */
const AUTH_MIDDLEWARE_NAMES = new Set(['authenticateToken']);

/** Route prefixes that are intentionally public (login/register/password-reset, health check). */
const EXEMPT_PREFIXES = ['/api/auth', '/health'];

export interface RouteAuthInfo {
  method: string;
  path: string;
  hasAuth: boolean;
}

/**
 * Express compiles a router mount path like '/api/groups' into a RegExp such as
 * /^\/api\/groups\/?(?=\/|$)/i. Strip the regex wrapper to recover the literal prefix.
 * Only used for router *mount* paths (always static strings in this app - no
 * mount-level :params) - individual route paths come through as plain strings already.
 */
function decodeMountPath(regexp: RegExp): string {
  const decoded = regexp.source
    .replace(/\\\//g, '/')
    .replace(/^\^/, '')
    .replace(/\/\?\(\?=\/\|\$\)$/, '')
    .replace(/\/\?\$$/, '')
    .replace(/\$$/, '');
  return decoded || '/';
}

function joinPaths(prefix: string, path: string): string {
  if (path === '*') return prefix ? `${prefix}/*` : '*';
  const joined = `${prefix}${path === '/' ? '' : path}`.replace(/\/{2,}/g, '/');
  return joined.length > 1 ? joined.replace(/\/$/, '') : joined;
}

/**
 * Recursively collect every {method, path} route with whether it carries authenticateToken -
 * either directly on the route (`router.get(path, authenticateToken, handler)`) or inherited
 * from a `router.use(authenticateToken, ...)` registered earlier in the same stack (e.g. how
 * settings.ts gates its whole router). Express runs stack layers in registration order, so a
 * bare `.use()` middleware protects every route layer that comes after it in that same stack.
 */
export function collectRouteAuthInfo(stack: any[], prefix = '', inheritedAuth = false): RouteAuthInfo[] {
  const out: RouteAuthInfo[] = [];
  let authSoFar = inheritedAuth;
  for (const layer of stack) {
    if (layer.route) {
      const fullPath = joinPaths(prefix, layer.route.path);
      const handlers = layer.route.stack.map((s: any) => s.handle);
      const routeOwnAuth = handlers.some((fn: any) => AUTH_MIDDLEWARE_NAMES.has(fn?.name));
      const hasAuth = authSoFar || routeOwnAuth;
      for (const method of Object.keys(layer.route.methods)) {
        out.push({ method: method.toUpperCase(), path: fullPath, hasAuth });
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      const childPrefix = layer.regexp ? joinPaths(prefix, decodeMountPath(layer.regexp)) : prefix;
      out.push(...collectRouteAuthInfo(layer.handle.stack, childPrefix, authSoFar));
    } else if (layer.name && AUTH_MIDDLEWARE_NAMES.has(layer.name)) {
      // A bare `.use(authenticateToken)` layer - protects every route after it in this stack.
      authSoFar = true;
    }
  }
  return out;
}

function isExempt(route: RouteAuthInfo): boolean {
  if (route.method === 'OPTIONS' || route.path === '*') return true;
  return EXEMPT_PREFIXES.some((p) => route.path === p || route.path.startsWith(`${p}/`));
}

/**
 * Throws (and thus aborts server startup - see server.ts's try/catch -> process.exit(1))
 * if any non-exempt route has no authenticateToken middleware.
 */
export function assertAllRoutesAuthenticated(appRouterStack: any[]): void {
  const routes = collectRouteAuthInfo(appRouterStack);
  const violations = routes.filter((r) => !isExempt(r) && !r.hasAuth);
  if (violations.length > 0) {
    const lines = violations.map((v) => `  - ${v.method} ${v.path}`).join('\n');
    throw new Error(
      `Startup auth assertion failed: ${violations.length} route(s) have no authenticateToken middleware:\n${lines}`
    );
  }
}
