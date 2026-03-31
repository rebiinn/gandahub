/** Fallback image for products with no thumbnail or when image fails to load. */
export const PLACEHOLDER_PRODUCT = '/placeholder-product.svg';

const getApiBaseURL = () => {
  const raw =
    (typeof window !== 'undefined' && (window.__API_BASE_URL__ || window.__VITE_API_URL__)) ||
    import.meta.env.VITE_API_URL ||
    'http://localhost:8000/api/v1';
  return String(raw).replace(/\/$/, '');
};

/**
 * Get the API origin (base URL without /api/v1) for building absolute image URLs.
 */
export function getApiOrigin() {
  return getApiBaseURL().replace(/\/api\/v1\/?$/, '');
}

/**
 * If thumbnail is a full URL to our storage, return the path part (e.g. /storage/products/xxx.jpg).
 * Otherwise return as-is. Use this before sending to API so the DB stores a short path.
 */
export function thumbnailToPath(thumbnail) {
  if (!thumbnail || typeof thumbnail !== 'string') return thumbnail;
  const trimmed = thumbnail.trim();
  const origin = getApiOrigin();
  if (trimmed.startsWith(origin + '/storage/')) {
    return trimmed.slice(origin.length); // "/storage/products/xxx.jpg"
  }
  if (trimmed.startsWith(origin) && trimmed.includes('/storage/')) {
    const i = trimmed.indexOf('/storage/');
    return trimmed.slice(i);
  }
  return trimmed;
}

/**
 * Convert a possibly-relative image URL from the API into an absolute URL.
 * Uses the API /storage/serve endpoint so images always load from the same app.
 */
export function toAbsoluteImageUrl(url, fallback = PLACEHOLDER_PRODUCT) {
  if (!url || typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  if (!trimmed) return fallback;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^blob:/i.test(trimmed)) return trimmed;
  const pathForServe = trimmed.startsWith('/storage/') ? trimmed.slice(9) : trimmed;
  const pathNorm = pathForServe.startsWith('/') ? pathForServe.slice(1) : pathForServe;
  const base = getApiBaseURL();
  return base + '/storage/serve?path=' + encodeURIComponent(pathNorm);
}
