import { useState } from 'react';
import { ActivityIndicator, FlatList, Switch, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';

import { TruckCard } from '@/components/truck-card';
import { useTrucks } from '@/lib/queries/trucks';

export default function TrucksList() {
  const [search, setSearch] = useState('');
  const [openNow, setOpenNow] = useState(false);
  const { data, isLoading, error } = useTrucks({ search, openNow });

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <Stack.Screen options={{ title: 'All trucks' }} />

      <View className="border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 gap-3">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          autoCorrect={false}
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2.5 text-base text-neutral-900 dark:text-neutral-100"
        />
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Open now only
          </Text>
          <Switch value={openNow} onValueChange={setOpenNow} />
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator className="mt-8" />
      ) : error ? (
        <Text className="mx-4 mt-6 text-sm text-red-600 dark:text-red-400">
          Couldn't load trucks: {String(error)}
        </Text>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={
            <Text className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
              No trucks match.
            </Text>
          }
          renderItem={({ item }) => <TruckCard truck={item} />}
        />
      )}
    </View>
  );
}
