/**
 * Product shades / swatches for cosmetics — stored on the backend as
 * product.attributes.shades: [{ name, hex?, image? }]
 */
export function getProductShades(product) {
  const attrs = product?.attributes;
  if (!attrs || typeof attrs !== 'object') return [];
  const raw = attrs.shades;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s, i) => {
      if (typeof s === 'string') {
        return { name: s.trim(), hex: null, image: null, _key: `s-${i}` };
      }
      const name = (s?.name ?? s?.label ?? '').toString().trim();
      if (!name) return null;
      const hex = s.hex || s.color || null;
      const image = s.image || s.thumbnail || null;
      return {
        name,
        hex: hex ? String(hex).trim() || null : null,
        image: image ? String(image).trim() || null : null,
        _key: s.id || s.slug || `s-${i}`,
      };
    })
    .filter(Boolean);
}

/**
 * When a product has variant shades, prepend a synthetic "Original" option that
 * uses the main listing images (thumbnail / gallery) — no variant image override.
 */
export function getProductShadesWithOriginal(product) {
  const shades = getProductShades(product);
  if (shades.length === 0) return [];
  return [
    {
      name: 'Original',
      hex: null,
      image: null,
      _key: '__original__',
      isOriginal: true,
    },
    ...shades,
  ];
}

/** Options saved on cart/order items (see CartController / OrderController). */
export function formatShadeOptionLabel(options) {
  if (!options || typeof options !== 'object') return null;
  const shade = options.shade;
  if (shade == null || shade === '') return null;
  return `Shade: ${shade}`;
}

/** Value for HTML `<input type="color" />` (requires #rrggbb). */
export function shadeHexForColorInput(hex) {
  const h = (hex || '').trim();
  if (/^#[0-9A-Fa-f]{6}$/i.test(h)) return h.toLowerCase();
  if (/^#[0-9A-Fa-f]{3}$/i.test(h)) {
    const r = h[1];
    const g = h[2];
    const b = h[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return '#cccccc';
}
