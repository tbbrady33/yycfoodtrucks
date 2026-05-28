import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { useMapTrucks, type MapTruck } from '@/lib/queries/map';
import { geocodeAddress } from '@/lib/geocode';

/**
 * Map screen — pins per truck (color-coded by open/closed) plus the
 * device's current location.
 *
 * Implementation notes:
 *   - We render expo-maps (AppleMaps on iOS, GoogleMaps on Android). The
 *     library handles platform native maps; no API key needed for Apple
 *     Maps. Android Google Maps would need an API key in production.
 *   - Geocoding is client-side via expo-location. Results cached in
 *     src/lib/geocode.ts so a session doesn't re-resolve.
 *   - Default region: downtown Calgary. Once user grants location, we
 *     re-center on them.
 */

const CALGARY_CENTER = { latitude: 51.0447, longitude: -114.0719 };

type GeocodedTruck = MapTruck & { coordinates: { latitude: number; longitude: number } };

export default function MapScreen() {
  const trucks = useMapTrucks();
  const [geocoded, setGeocoded] = useState<GeocodedTruck[]>([]);
  const [geocoding, setGeocoding] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  const [locationError, setLocationError] = useState<string | null>(null);

  // Geocode trucks as they load.
  useEffect(() => {
    let cancelled = false;
    if (!trucks.data || trucks.data.length === 0) return;
    setGeocoding(true);
    (async () => {
      const out: GeocodedTruck[] = [];
      for (const t of trucks.data!) {
        const coords = await geocodeAddress(t.address);
        if (cancelled) return;
        if (coords) {
          out.push({ ...t, coordinates: coords });
          setGeocoded([...out]); // incremental render so pins appear as they resolve
        }
      }
      if (!cancelled) setGeocoding(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [trucks.data]);

  // Ask for permission + fetch location once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Location permission denied.');
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setUserLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      } catch (e) {
        if (!cancelled) setLocationError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const center = userLocation ?? CALGARY_CENTER;

  const markers = useMemo(
    () =>
      geocoded.map((t) => ({
        id: t.truck_id,
        coordinates: t.coordinates,
        title: t.name,
        snippet: `${t.status === 'open' ? '● OPEN' : '● Closed'} · ${t.location_label}`,
        tintColor: t.status === 'open' ? '#16a34a' : '#737373', // green / neutral
      })),
    [geocoded]
  );

  // expo-maps doesn't expose a clean marker-press callback we can wire to
  // useState on every platform yet; this is a tap-to-zoom overlay that
  // surfaces a list of nearby trucks below the map as a fallback nav.

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <Stack.Screen options={{ headerShown: true, title: 'Map' }} />

      <View className="flex-1">
        {Platform.OS === 'ios' ? (
          <AppleMaps.View
            style={{ flex: 1 }}
            cameraPosition={{
              coordinates: center,
              zoom: 12,
            }}
            markers={markers}
            uiSettings={{ myLocationButtonEnabled: true }}
            properties={{ isMyLocationEnabled: true }}
          />
        ) : (
          <GoogleMaps.View
            style={{ flex: 1 }}
            cameraPosition={{
              coordinates: center,
              zoom: 12,
            }}
            markers={markers}
            uiSettings={{ myLocationButtonEnabled: true }}
            properties={{ isMyLocationEnabled: true }}
          />
        )}
      </View>

      <View className="border-t border-neutral-200 dark:border-neutral-800 p-3">
        {trucks.isLoading || geocoding ? (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator />
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">
              {trucks.isLoading ? 'Loading trucks…' : `Resolving locations (${geocoded.length}/${trucks.data?.length ?? 0})…`}
            </Text>
          </View>
        ) : (
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            {geocoded.length} truck{geocoded.length === 1 ? '' : 's'} on the map ·{' '}
            {geocoded.filter((t) => t.status === 'open').length} open right now
          </Text>
        )}
        {locationError ? (
          <Text className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            {locationError} The map is centered on downtown Calgary instead.
          </Text>
        ) : null}
        <View className="mt-2 flex-row flex-wrap gap-2">
          {geocoded.slice(0, 8).map((t) => (
            <Pressable
              key={t.truck_id}
              onPress={() => router.push(`/trucks/${t.slug}`)}
              className={`rounded-full px-3 py-1 ${
                t.status === 'open'
                  ? 'bg-green-100 dark:bg-green-900/40'
                  : 'border border-neutral-300 dark:border-neutral-700'
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  t.status === 'open'
                    ? 'text-green-800 dark:text-green-200'
                    : 'text-neutral-700 dark:text-neutral-300'
                }`}
              >
                {t.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
