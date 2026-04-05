/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Optional; if unset, media URLs are resolved from VITE_API_URL with /api stripped */
  readonly VITE_BACKEND_ORIGIN?: string;
}
