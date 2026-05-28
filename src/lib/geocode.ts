import * as Location from 'expo-location';

/**
 * In-memory geocode cache. Truck addresses rarely change, and a session
 * usually views the map a few times — caching cuts the number of OS
 * geocoder calls (which are rate-limited).
 *
 * The cache is keyed by the trimmed lowercase address string. Negative
 * results (address didn't resolve) are also cached so we don't retry
 * something that's known unparseable.
 */
type Coords = { latitude: number; longitude: number };

const cache = new Map<string, Coords | null>();

export async function geocodeAddress(rawAddress: string): Promise<Coords | null> {
  const key = rawAddress.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  try {
    const results = await Location.geocodeAsync(rawAddress);
    const first = results?.[0];
    if (!first) {
      cache.set(key, null);
      return null;
    }
    const coords: Coords = { latitude: first.latitude, longitude: first.longitude };
    cache.set(key, coords);
    return coords;
  } catch {
    // OS geocoder throws on rate-limit / no network. Treat as miss; we can
    // retry on a later render.
    return null;
  }
}

export function clearGeocodeCache() {
  cache.clear();
}
