/**
 * Single source of truth for API base URL and backend origin used to resolve
 * Django MEDIA_URL paths (/media/...) which live outside the /api/ prefix.
 */

export const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000/api/";

/** Pure helper for tests and for deriving media host from the same env vars. */
export function deriveBackendOriginForMedia(
  viteApiUrl: string | undefined,
  viteBackendOrigin: string | undefined,
): string {
  const explicit = viteBackendOrigin?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const api = viteApiUrl?.trim();
  if (!api) return "http://127.0.0.1:8000";

  return api.replace(/\/+$/, "").replace(/\/api$/i, "");
}

/**
 * Axios base URL (trailing slash). Prefer VITE_API_URL in .env for production.
 */
export function getApiBaseUrl(): string {
  const env = import.meta.env.VITE_API_URL?.trim();
  if (!env) return DEFAULT_API_BASE_URL;
  return env.endsWith("/") ? env : `${env}/`;
}

/**
 * Origin/host for static files and uploaded media. Optional VITE_BACKEND_ORIGIN
 * overrides derivation from VITE_API_URL (strips a trailing /api segment).
 */
export function getBackendOriginForMedia(): string {
  return deriveBackendOriginForMedia(
    import.meta.env.VITE_API_URL,
    import.meta.env.VITE_BACKEND_ORIGIN,
  );
}

/**
 * Builds a browser-ready src for &lt;img&gt; from API strings (absolute URL,
 * relative /media/..., or path without leading slash).
 */
export function resolveMediaSrcWithOrigin(
  href: string,
  origin: string,
  cacheBust?: string | number,
): string {
  let url: string;
  if (
    href.startsWith("http") ||
    href.startsWith("blob:") ||
    href.startsWith("data:")
  ) {
    url = href;
  } else {
    const cleanPath = href.startsWith("/") ? href : `/${href}`;
    url = `${origin}${cleanPath}`;
  }
  if (cacheBust === undefined) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${cacheBust}`;
}

export function resolveMediaSrc(
  href: string,
  cacheBust?: string | number,
): string {
  return resolveMediaSrcWithOrigin(href, getBackendOriginForMedia(), cacheBust);
}
