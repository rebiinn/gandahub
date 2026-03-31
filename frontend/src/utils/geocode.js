/**
 * Reverse geocode using Nominatim (OpenStreetMap). Use sparingly (1 req/sec).
 */
export async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const a = data?.address || {};
  return {
    address: [a.road, a.house_number, a.suburb, a.neighbourhood].filter(Boolean).join(', ') || a.village || a.town || data?.display_name?.split(',')[0] || '',
    city: a.city || a.municipality || a.town || a.village || a.county || '',
    state: a.state || a.province || '',
    zip_code: a.postcode || '',
    country: a.country || 'Philippines',
  };
}
