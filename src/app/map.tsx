import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import Constants from 'expo-constants';
import * as Location from 'expo-location';

import { useMapTrucks, type MapTruck } from '@/lib/queries/map';
import { geocodeAddress } from '@/lib/geocode';

/**
 * Map screen — pins per truck + the device's current location.
 *
 * expo-maps requires native code that Expo Go doesn't ship with. We
 * therefore use a try/catch require so a missing native module degrades
 * to a "needs dev client" fallback instead of crashing the whole route.
 * The truck chip nav at the bottom still works either way.
 *
 *   eas build -p ios --profile development
 *   npm run ios:dev-client
 */

// Conditional require — Expo Go raises here; we catch and fall back.
type MapsModule = typeof import('expo-maps');
let mapsModule: MapsModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mapsModule = require('expo-maps') as MapsModule;
} catch {
  mapsModule = null;
}

const CALGARY_CENTER = { latitude: 51.0447, longitude: -114.0719 };

type GeocodedTruck = MapTruck & {
  coordinates: { latitude: number; longitude: number };
};

export default function MapScreen() {
  const trucks = useMapTrucks();
  const [geocoded, setGeocoded] = useState<GeocodedTruck[]>([]);
  const [geocoding, setGeocoding] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

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
          setGeocoded([...out]);
        }
      }
      if (!cancelled) setGeocoding(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [trucks.data]);

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
        tintColor: t.status === 'open' ? '#16a34a' : '#737373',
      })),
    [geocoded]
  );

  const nativeMapAvailable = !!mapsModule;

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <Stack.Screen options={{ headerShown: true, title: 'Map' }} />

      <View className="flex-1">
        {nativeMapAvailable ? (
          <NativeMap
            module={mapsModule!}
            center={center}
            markers={markers}
          />
        ) : (
          <ExpoGoFallback />
        )}
      </View>

      <View className="border-t border-neutral-200 dark:border-neutral-800 p-3">
        {trucks.isLoading || geocoding ? (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator />
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">
              {trucks.isLoading
                ? 'Loading trucks…'
                : `Resolving locations (${geocoded.length}/${trucks.data?.length ?? 0})…`}
            </Text>
          </View>
        ) : (
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            {geocoded.length} truck{geocoded.length === 1 ? '' : 's'}
            {nativeMapAvailable
              ? ` on the map · ${geocoded.filter((t) => t.status === 'open').length} open right now`
              : ` · ${geocoded.filter((t) => t.status === 'open').length} open right now`}
          </Text>
        )}
        {locationError && nativeMapAvailable ? (
          <Text className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            {locationError} The map is centered on downtown Calgary instead.
          </Text>
        ) : null}
        <View className="mt-2 flex-row flex-wrap gap-2">
          {geocoded.slice(0, 12).map((t) => (
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

function NativeMap({
  module: mod,
  center,
  markers,
}: {
  module: MapsModule;
  center: { latitude: number; longitude: number };
  markers: Array<{
    id: string;
    coordinates: { latitude: number; longitude: number };
    title: string;
    snippet: string;
    tintColor: string;
  }>;
}) {
  if (Platform.OS === 'ios') {
    return (
      <mod.AppleMaps.View
        style={{ flex: 1 }}
        cameraPosition={{ coordinates: center, zoom: 12 }}
        markers={markers}
        uiSettings={{ myLocationButtonEnabled: true }}
        properties={{ isMyLocationEnabled: true }}
      />
    );
  }
  return (
    <mod.GoogleMaps.View
      style={{ flex: 1 }}
      cameraPosition={{ coordinates: center, zoom: 12 }}
      markers={markers}
      uiSettings={{ myLocationButtonEnabled: true }}
      properties={{ isMyLocationEnabled: true }}
    />
  );
}

function ExpoGoFallback() {
  const inExpoGo = Constants.appOwnership === 'expo';
  return (
    <View className="flex-1 items-center justify-center px-6 gap-2">
      <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100 text-center">
        Map preview needs a dev client
      </Text>
      <Text className="text-sm text-neutral-500 dark:text-neutral-400 text-center">
        {inExpoGo
          ? "expo-maps' native module isn't bundled with Expo Go."
          : 'expo-maps native module unavailable in this build.'}
      </Text>
      <Text className="text-sm text-neutral-500 dark:text-neutral-400 text-center">
        Build the dev client to see truck pins:
      </Text>
      <Text className="font-mono text-xs text-neutral-700 dark:text-neutral-300 text-center">
        eas build -p ios --profile development
      </Text>
      <Text className="mt-3 text-xs text-neutral-500 dark:text-neutral-400 text-center">
        The truck chips below are still tappable.
      </Text>
    </View>
  );
}
