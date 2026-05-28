import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { useTruckMenu, type MenuItem } from '@/lib/queries/menu';
import {
  useCreateMenuItem,
  useDeleteMenuItem,
  useUpdateMenuItem,
} from '@/lib/queries/operator-menu';
import { useRequireOperator } from '@/lib/auth-gates';

/**
 * Menu CRUD for an operator's truck.
 *
 * UI pattern: rows are read-only display + Edit / Delete buttons. Tapping
 * Edit flips that row into form mode with Save / Cancel. New items use the
 * same form shape via a separate "Add item" form below the list. Reorder
 * is deferred to a polish pass — for ~4-item menus the position is
 * append-only and that's fine for v1.
 */
export default function EditMenu() {
  const gate = useRequireOperator();
  const { id: truckId } = useLocalSearchParams<{ id: string }>();
  const menu = useTruckMenu(truckId);
  if (gate) return gate;

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-black"
      contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
    >
      <Stack.Screen options={{ headerShown: true, title: 'Menu' }} />

      {menu.isLoading ? (
        <ActivityIndicator className="mt-4" />
      ) : (menu.data ?? []).length === 0 ? (
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">
          No items yet — add your first below.
        </Text>
      ) : (
        menu.data!.map((item) => (
          <MenuItemRow key={item.id} item={item} truckId={truckId!} />
        ))
      )}

      <NewItemForm truckId={truckId!} />
    </ScrollView>
  );
}

function MenuItemRow({ item, truckId }: { item: MenuItem; truckId: string }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [priceText, setPriceText] = useState(formatPriceInput(item.price_cents));
  const update = useUpdateMenuItem();
  const del = useDeleteMenuItem();

  const onSave = async () => {
    const cents = parsePriceInput(priceText);
    if (cents === null) {
      Alert.alert('Invalid price', 'Enter a price like 12.50');
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required');
      return;
    }
    await update.mutateAsync({
      id: item.id,
      truckId,
      name: trimmed,
      priceCents: cents,
    });
    setEditing(false);
  };

  const onDelete = () => {
    Alert.alert('Delete this item?', `"${item.name}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => del.mutate({ id: item.id, truckId }),
      },
    ]);
  };

  if (editing) {
    return (
      <View className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3 gap-2">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name"
          placeholderTextColor="#9ca3af"
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-base text-neutral-900 dark:text-neutral-100"
        />
        <TextInput
          value={priceText}
          onChangeText={setPriceText}
          placeholder="12.50"
          placeholderTextColor="#9ca3af"
          keyboardType="decimal-pad"
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-base text-neutral-900 dark:text-neutral-100"
        />
        <View className="flex-row gap-2">
          <Pressable
            onPress={onSave}
            disabled={update.isPending}
            className="flex-1 items-center justify-center rounded-lg bg-neutral-900 px-3 py-2"
          >
            <Text className="text-sm font-semibold text-white">Save</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setName(item.name);
              setPriceText(formatPriceInput(item.price_cents));
              setEditing(false);
            }}
            className="flex-1 items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2"
          >
            <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Cancel
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3">
      <View className="flex-row items-baseline justify-between">
        <Text className="flex-1 text-base text-neutral-900 dark:text-neutral-100">
          {item.name}
        </Text>
        <Text className="text-base font-medium text-neutral-700 dark:text-neutral-300">
          ${(item.price_cents / 100).toFixed(2)}
        </Text>
      </View>
      <View className="mt-2 flex-row gap-3">
        <Pressable onPress={() => setEditing(true)}>
          <Text className="text-sm font-medium text-blue-600 dark:text-blue-400">Edit</Text>
        </Pressable>
        <Pressable onPress={onDelete}>
          <Text className="text-sm font-medium text-red-600 dark:text-red-400">Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

function NewItemForm({ truckId }: { truckId: string }) {
  const [name, setName] = useState('');
  const [priceText, setPriceText] = useState('');
  const create = useCreateMenuItem();

  const onAdd = async () => {
    const cents = parsePriceInput(priceText);
    if (cents === null) {
      Alert.alert('Invalid price', 'Enter a price like 12.50');
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required');
      return;
    }
    await create.mutateAsync({ truckId, name: trimmed, priceCents: cents });
    setName('');
    setPriceText('');
  };

  return (
    <View className="mt-4 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-3 gap-2">
      <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
        Add a new item
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Name"
        placeholderTextColor="#9ca3af"
        className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-base text-neutral-900 dark:text-neutral-100"
      />
      <TextInput
        value={priceText}
        onChangeText={setPriceText}
        placeholder="Price (e.g. 12.50)"
        placeholderTextColor="#9ca3af"
        keyboardType="decimal-pad"
        className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-base text-neutral-900 dark:text-neutral-100"
      />
      <Pressable
        onPress={onAdd}
        disabled={create.isPending}
        className={`items-center justify-center rounded-lg bg-neutral-900 px-3 py-2 ${
          create.isPending ? 'opacity-60' : ''
        }`}
      >
        <Text className="text-sm font-semibold text-white">Add item</Text>
      </Pressable>
    </View>
  );
}

function formatPriceInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** "12.50" or "12" -> 1250. Returns null on invalid input. */
function parsePriceInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
