import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'react-native';

/**
 * Landing screen (placeholder). Step 4 will replace this with the real
 * landing: hero, "Browse by category" grid, search CTA, sign-in entry point.
 *
 * Right now it's a NativeWind smoke test — if the classes apply, the
 * Tailwind/NativeWind/gluestack foundation is wired correctly.
 */
export default function Landing() {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black" edges={['top']}>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
          YYC Street Food
        </Text>
        <Text className="mt-2 text-base text-neutral-500 dark:text-neutral-400">
          Foundation OK. Step 2 lights up the backend.
        </Text>
      </View>
    </SafeAreaView>
  );
}
