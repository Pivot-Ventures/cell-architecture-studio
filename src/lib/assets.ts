/**
 * Resolve a public asset against Vite's base URL so the app works at the site
 * root in development and under a nested mount such as /atlas/cells/ on EASI.
 * Root-relative paths ("/models/x.glb") were the reason two specimens never
 * loaded on the hosted build: they resolved to the origin root and 404ed.
 */
export function assetUrl(path: string) {
  const base = import.meta.env.BASE_URL || "/";
  const clean = path.replace(/^\/+/, "");
  return `${base.endsWith("/") ? base : `${base}/`}${clean}`;
}
