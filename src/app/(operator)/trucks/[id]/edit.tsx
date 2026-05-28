import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';

import { useCategories } from '@/lib/queries/categories';
import {
  useOperatorTruck,
  useUpdateTruckBasics,
} from '@/lib/queries/operator-trucks';

export default function EditTruckBasics() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const truck = useOperatorTruck(id);
  const categories = useCategories();
  const update = useUpdateTruckBasics();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (truck.data) {
      setName(truck.data.name);
      setDescription(truck.data.description ?? '');
      setCategoryId(truck.data.category_id);
    }
  }, [truck.data]);

  const onSave = async () => {
    if (!truck.data || !categoryId) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setServerError('Name is required.');
      return;
    }
    setServerError(null);
    try {
      await update.mutateAsync({
        id: truck.data.id,
        name: trimmed,
        description: description.trim() ? description.trim() : null,
        category_id: categoryId,
      });
      router.back();
    } catch (e) {
      setServerError(String(e));
    }
  };

  if (truck.isLoading || categories.isLoading) {
    return (
      <View className="flex-1 bg-white dark:bg-black">
        <Stack.Screen options={{ headerShown: true, title: '' }} />
        <ActivityIndicator className="mt-8" />
      </View>
    );
  }

  if (!truck.data) {
    return (
      <View className="flex-1 bg-white dark:bg-black">
        <Stack.Screen options={{ headerShown: true, title: 'Not found' }} />
        <Text className="mx-4 mt-6 text-sm text-neutral-500 dark:text-neutral-400">
          Truck not found.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-black"
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <Stack.Screen options={{ headerShown: true, title: 'Edit basics' }} />

      <View className="gap-4">
        <View>
          <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Truck name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="The Big Cheese"
            placeholderTextColor="#9ca3af"
            className="mt-1 rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-3 text-base text-neutral-900 dark:text-neutral-100"
          />
        </View>

        <View>
          <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Description
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Smash burgers and grilled cheese."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className="mt-1 min-h-[100px] rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-3 text-base text-neutral-900 dark:text-neutral-100"
          />
        </View>

        <View>
          <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Category
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {(categories.data ?? []).map((c) => {
              const selected = categoryId === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCategoryId(c.id)}
                  className={`rounded-full px-3 py-1.5 ${
                    selected
                      ? 'bg-neutral-900 dark:bg-neutral-100'
                      : 'border border-neutral-300 dark:border-neutral-700'
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      selected
                        ? 'font-semibold text-white dark:text-neutral-900'
                        : 'text-neutral-900 dark:text-neutral-100'
                    }`}
                  >
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {serverError ? (
          <Text className="text-sm text-red-600 dark:text-red-400">{serverError}</Text>
        ) : null}

        <Pressable
          onPress={onSave}
          disabled={update.isPending}
          className={`mt-2 items-center justify-center rounded-lg bg-neutral-900 px-4 py-3 ${
            update.isPending ? 'opacity-60' : ''
          }`}
        >
          {update.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-base font-semibold text-white">Save</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}
