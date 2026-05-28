import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { useRequireOperator } from '@/lib/auth-gates';
import {
  useCreateDatedSlot,
  useCreateTemplateSlot,
  useDeleteDatedSlot,
  useDeleteTemplateSlot,
  useOperatorSchedule,
  useUpdateDatedSlot,
  useUpdateTemplateSlot,
} from '@/lib/queries/operator-schedule';
import type { DatedSlot, TemplateSlot } from '@/lib/queries/schedule';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type TemplateRow = TemplateSlot & { published: boolean };
type DatedRow = DatedSlot & { published: boolean };

/**
 * The operator's schedule editor. Two sections:
 *   - Weekly template (recurring): one block per day-of-week
 *   - Upcoming exceptions: dated additions / closures / replacements
 *
 * Each row stays in display mode by default; tapping Edit flips it into a
 * form. Add forms are inline at the top of each section's list. Toggling
 * a slot's `published` is what fires the on_*_publish trigger and emits
 * a notification_events(kind='schedule_changed') row (Step 9 consumes it).
 */
export default function ScheduleEditor() {
  const gate = useRequireOperator();
  const { id: truckId } = useLocalSearchParams<{ id: string }>();
  const sched = useOperatorSchedule(truckId);
  if (gate) return gate;

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-black"
      contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}
    >
      <Stack.Screen options={{ headerShown: true, title: 'Schedule' }} />

      {sched.isLoading ? (
        <ActivityIndicator className="mt-4" />
      ) : sched.error ? (
        <Text className="text-sm text-red-600 dark:text-red-400">
          Couldn't load schedule: {String(sched.error)}
        </Text>
      ) : (
        <>
          <Text className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            Weekly template
          </Text>
          {DAY_NAMES.map((name, day) => (
            <DayBlock
              key={day}
              day={day}
              dayName={name}
              slots={(sched.data?.template ?? []).filter((s) => s.day_of_week === day)}
              truckId={truckId!}
            />
          ))}

          <Text className="mt-4 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            Upcoming exceptions
          </Text>
          <ExceptionsBlock dated={sched.data?.dated ?? []} truckId={truckId!} />
        </>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Weekly template — one block per day
// ---------------------------------------------------------------------------

function DayBlock({
  day,
  dayName,
  slots,
  truckId,
}: {
  day: number;
  dayName: string;
  slots: TemplateRow[];
  truckId: string;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <View className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {dayName}
        </Text>
        <Pressable onPress={() => setAdding((v) => !v)}>
          <Text className="text-sm font-medium text-blue-600 dark:text-blue-400">
            {adding ? 'Cancel' : '+ Add slot'}
          </Text>
        </Pressable>
      </View>

      {adding ? (
        <TemplateForm
          truckId={truckId}
          dayOfWeek={day}
          onDone={() => setAdding(false)}
        />
      ) : null}

      {slots.length === 0 && !adding ? (
        <Text className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          No slots.
        </Text>
      ) : null}

      {slots.map((s) =>
        editingId === s.id ? (
          <TemplateForm
            key={s.id}
            truckId={truckId}
            dayOfWeek={day}
            existing={s}
            onDone={() => setEditingId(null)}
          />
        ) : (
          <TemplateRow
            key={s.id}
            slot={s}
            truckId={truckId}
            onEdit={() => setEditingId(s.id)}
          />
        )
      )}
    </View>
  );
}

function TemplateRow({
  slot,
  truckId,
  onEdit,
}: {
  slot: TemplateRow;
  truckId: string;
  onEdit: () => void;
}) {
  const update = useUpdateTemplateSlot();
  const del = useDeleteTemplateSlot();

  const togglePublished = () =>
    update.mutate({ id: slot.id, truckId, patch: { published: !slot.published } });

  const onDelete = () => {
    Alert.alert('Delete this slot?', 'It will be removed from the schedule.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => del.mutate({ id: slot.id, truckId }),
      },
    ]);
  };

  return (
    <View className="mt-2 border-t border-neutral-100 dark:border-neutral-900 pt-2">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
        </Text>
        <DraftBadge published={slot.published} />
      </View>
      <Text className="text-sm text-neutral-600 dark:text-neutral-400">
        {slot.location_label} · {slot.address}
      </Text>
      <View className="mt-2 flex-row gap-3">
        <Pressable onPress={onEdit}>
          <Text className="text-sm font-medium text-blue-600 dark:text-blue-400">Edit</Text>
        </Pressable>
        <Pressable onPress={togglePublished} disabled={update.isPending}>
          <Text className="text-sm font-medium text-green-700 dark:text-green-400">
            {slot.published ? 'Unpublish' : 'Publish'}
          </Text>
        </Pressable>
        <Pressable onPress={onDelete} disabled={del.isPending}>
          <Text className="text-sm font-medium text-red-600 dark:text-red-400">Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TemplateForm({
  truckId,
  dayOfWeek,
  existing,
  onDone,
}: {
  truckId: string;
  dayOfWeek: number;
  existing?: TemplateRow;
  onDone: () => void;
}) {
  const [start, setStart] = useState(existing?.start_time.slice(0, 5) ?? '11:00');
  const [end, setEnd] = useState(existing?.end_time.slice(0, 5) ?? '14:00');
  const [label, setLabel] = useState(existing?.location_label ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');
  const create = useCreateTemplateSlot();
  const update = useUpdateTemplateSlot();

  const onSave = async () => {
    if (!isValidTime(start) || !isValidTime(end)) {
      Alert.alert('Invalid time', 'Times must be HH:MM in 24-hour format.');
      return;
    }
    if (start >= end) {
      Alert.alert('Invalid range', 'End time must be after start time.');
      return;
    }
    if (!label.trim() || !address.trim()) {
      Alert.alert('Location required', 'Add a location label and address.');
      return;
    }
    try {
      if (existing) {
        await update.mutateAsync({
          id: existing.id,
          truckId,
          patch: {
            start_time: `${start}:00`,
            end_time: `${end}:00`,
            location_label: label.trim(),
            address: address.trim(),
          },
        });
      } else {
        await create.mutateAsync({
          truckId,
          slot: {
            day_of_week: dayOfWeek,
            start_time: `${start}:00`,
            end_time: `${end}:00`,
            location_label: label.trim(),
            address: address.trim(),
            published: false,
          },
        });
      }
      onDone();
    } catch (e) {
      Alert.alert('Save failed', String(e));
    }
  };

  return (
    <View className="mt-2 border-t border-neutral-100 dark:border-neutral-900 pt-2 gap-2">
      <View className="flex-row gap-2">
        <Input value={start} onChange={setStart} placeholder="11:00" />
        <Input value={end} onChange={setEnd} placeholder="14:00" />
      </View>
      <Input value={label} onChange={setLabel} placeholder="Location label (e.g. Stephen Ave)" />
      <Input value={address} onChange={setAddress} placeholder="Address" />
      <View className="flex-row gap-2">
        <Pressable
          onPress={onSave}
          disabled={create.isPending || update.isPending}
          className="flex-1 items-center justify-center rounded-lg bg-neutral-900 px-3 py-2"
        >
          <Text className="text-sm font-semibold text-white">Save</Text>
        </Pressable>
        <Pressable
          onPress={onDone}
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

// ---------------------------------------------------------------------------
// Dated exceptions
// ---------------------------------------------------------------------------

function ExceptionsBlock({ dated, truckId }: { dated: DatedRow[]; truckId: string }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <View className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">
          One-off additions, closures, and replacements.
        </Text>
        <Pressable onPress={() => setAdding((v) => !v)}>
          <Text className="text-sm font-medium text-blue-600 dark:text-blue-400">
            {adding ? 'Cancel' : '+ Add'}
          </Text>
        </Pressable>
      </View>

      {adding ? <DatedForm truckId={truckId} onDone={() => setAdding(false)} /> : null}

      {dated.length === 0 && !adding ? (
        <Text className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          No exceptions.
        </Text>
      ) : null}

      {dated.map((s) =>
        editingId === s.id ? (
          <DatedForm
            key={s.id}
            truckId={truckId}
            existing={s}
            onDone={() => setEditingId(null)}
          />
        ) : (
          <DatedRowView
            key={s.id}
            slot={s}
            truckId={truckId}
            onEdit={() => setEditingId(s.id)}
          />
        )
      )}
    </View>
  );
}

function DatedRowView({
  slot,
  truckId,
  onEdit,
}: {
  slot: DatedRow;
  truckId: string;
  onEdit: () => void;
}) {
  const update = useUpdateDatedSlot();
  const del = useDeleteDatedSlot();
  const togglePublished = () =>
    update.mutate({ id: slot.id, truckId, patch: { published: !slot.published } });
  const onDelete = () => {
    Alert.alert('Delete this exception?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => del.mutate({ id: slot.id, truckId }),
      },
    ]);
  };

  return (
    <View className="mt-2 border-t border-neutral-100 dark:border-neutral-900 pt-2">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {slot.slot_date} · {kindLabel(slot.kind)}
        </Text>
        <DraftBadge published={slot.published} />
      </View>
      <Text className="text-sm text-neutral-600 dark:text-neutral-400">
        {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)} · {slot.location_label}
      </Text>
      <View className="mt-2 flex-row gap-3">
        <Pressable onPress={onEdit}>
          <Text className="text-sm font-medium text-blue-600 dark:text-blue-400">Edit</Text>
        </Pressable>
        <Pressable onPress={togglePublished} disabled={update.isPending}>
          <Text className="text-sm font-medium text-green-700 dark:text-green-400">
            {slot.published ? 'Unpublish' : 'Publish'}
          </Text>
        </Pressable>
        <Pressable onPress={onDelete} disabled={del.isPending}>
          <Text className="text-sm font-medium text-red-600 dark:text-red-400">Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DatedForm({
  truckId,
  existing,
  onDone,
}: {
  truckId: string;
  existing?: DatedRow;
  onDone: () => void;
}) {
  const [date, setDate] = useState(existing?.slot_date ?? todayIso());
  const [start, setStart] = useState(existing?.start_time.slice(0, 5) ?? '11:00');
  const [end, setEnd] = useState(existing?.end_time.slice(0, 5) ?? '14:00');
  const [label, setLabel] = useState(existing?.location_label ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');
  const [kind, setKind] = useState<DatedRow['kind']>(existing?.kind ?? 'addition');
  const create = useCreateDatedSlot();
  const update = useUpdateDatedSlot();

  const onSave = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD.');
      return;
    }
    if (!isValidTime(start) || !isValidTime(end)) {
      Alert.alert('Invalid time', 'Times must be HH:MM in 24-hour format.');
      return;
    }
    if (start >= end) {
      Alert.alert('Invalid range', 'End time must be after start time.');
      return;
    }
    if (!label.trim() || !address.trim()) {
      Alert.alert('Location required', 'Add a location label and address.');
      return;
    }
    try {
      if (existing) {
        await update.mutateAsync({
          id: existing.id,
          truckId,
          patch: {
            slot_date: date,
            start_time: `${start}:00`,
            end_time: `${end}:00`,
            location_label: label.trim(),
            address: address.trim(),
            kind,
          },
        });
      } else {
        await create.mutateAsync({
          truckId,
          slot: {
            slot_date: date,
            start_time: `${start}:00`,
            end_time: `${end}:00`,
            location_label: label.trim(),
            address: address.trim(),
            kind,
            published: false,
          },
        });
      }
      onDone();
    } catch (e) {
      Alert.alert('Save failed', String(e));
    }
  };

  return (
    <View className="mt-2 border-t border-neutral-100 dark:border-neutral-900 pt-2 gap-2">
      <Input value={date} onChange={setDate} placeholder="2026-05-30" />
      <View className="flex-row gap-2">
        <Input value={start} onChange={setStart} placeholder="11:00" />
        <Input value={end} onChange={setEnd} placeholder="14:00" />
      </View>
      <Input value={label} onChange={setLabel} placeholder="Location label" />
      <Input value={address} onChange={setAddress} placeholder="Address" />
      <View className="flex-row gap-2">
        {(['addition', 'closure', 'replacement'] as const).map((k) => (
          <Pressable
            key={k}
            onPress={() => setKind(k)}
            className={`flex-1 items-center rounded-full px-3 py-1.5 ${
              kind === k
                ? 'bg-neutral-900 dark:bg-neutral-100'
                : 'border border-neutral-300 dark:border-neutral-700'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                kind === k ? 'text-white dark:text-neutral-900' : 'text-neutral-900 dark:text-neutral-100'
              }`}
            >
              {kindLabel(k)}
            </Text>
          </Pressable>
        ))}
      </View>
      <View className="flex-row gap-2">
        <Pressable
          onPress={onSave}
          disabled={create.isPending || update.isPending}
          className="flex-1 items-center justify-center rounded-lg bg-neutral-900 px-3 py-2"
        >
          <Text className="text-sm font-semibold text-white">Save</Text>
        </Pressable>
        <Pressable
          onPress={onDone}
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

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------

function DraftBadge({ published }: { published: boolean }) {
  if (published) {
    return (
      <View className="rounded-full bg-green-100 dark:bg-green-900/40 px-2 py-0.5">
        <Text className="text-[10px] font-semibold text-green-700 dark:text-green-300">
          Published
        </Text>
      </View>
    );
  }
  return (
    <View className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5">
      <Text className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">
        Draft
      </Text>
    </View>
  );
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#9ca3af"
      autoCapitalize="none"
      className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
    />
  );
}

function isValidTime(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function kindLabel(k: DatedRow['kind']): string {
  return k === 'addition' ? 'Addition' : k === 'closure' ? 'Closure' : 'Replacement';
}
