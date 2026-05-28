import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { TruckCard } from '@/components/truck-card';
import { useCategoryBySlug } from '@/lib/queries/categories';
import { useTrucks } from '@/lib/queries/trucks';

export default function CategoryListing() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const category = useCategoryBySlug(slug);
  const trucks = useTrucks({ categoryId: category.data?.id });

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <Stack.Screen
        options={{ headerShown: true, title: category.data?.name ?? 'Category' }}
      />

      {category.isLoading || trucks.isLoading ? (
        <ActivityIndicator className="mt-8" />
      ) : !category.data ? (
        <Text className="mx-4 mt-6 text-sm text-neutral-500 dark:text-neutral-400">
          Category not found.
        </Text>
      ) : trucks.error ? (
        <Text className="mx-4 mt-6 text-sm text-red-600 dark:text-red-400">
          Couldn't load trucks: {String(trucks.error)}
        </Text>
      ) : (
        <FlatList
          data={trucks.data ?? []}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={
            <Text className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
              No trucks in {category.data.name} yet.
            </Text>
          }
          renderItem={({ item }) => <TruckCard truck={item} />}
        />
      )}
    </View>
  );
}
