import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { Stack } from 'expo-router';

import { TruckCard } from '@/components/truck-card';
import { useFollows } from '@/lib/queries/follows';

export default function Favorites() {
  const { data, isLoading, error } = useFollows();

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <Stack.Screen options={{ headerShown: true, title: 'Favorites' }} />

      {isLoading ? (
        <ActivityIndicator className="mt-8" />
      ) : error ? (
        <Text className="mx-4 mt-6 text-sm text-red-600 dark:text-red-400">
          Couldn't load favorites: {String(error)}
        </Text>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={
            <Text className="mx-4 mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
              No favorites yet. Tap the star on a truck to add it.
            </Text>
          }
          renderItem={({ item }) => <TruckCard truck={item} />}
        />
      )}
    </View>
  );
}
