import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/**
 * Resolve the EAS projectId from app config. expo-notifications needs
 * this to mint a token tied to our project.
 */
const PROJECT_ID =
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
    ?.projectId ??
  (Constants.easConfig as { projectId?: string } | undefined)?.projectId ??
  null;

/**
 * Foreground notification presentation. Without this, an arriving push
 * while the app is open shows nothing. With this, it shows the system
 * banner.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Register the device with Expo Push and persist the token to
 * public.push_tokens. Safe to call repeatedly — uses upsert keyed on
 * (user_id, device_id).
 *
 * No-ops gracefully in environments where push isn't possible: simulators
 * never get a real token, and Expo Go has push disabled since SDK 53.
 * Callers shouldn't await this for critical paths.
 */
export async function registerPushToken(userId: string): Promise<void> {
  try {
    if (!Device.isDevice) return;

    // appOwnership === 'expo' means we're running inside Expo Go, which
    // can't receive remote pushes on SDK 53+. The dev client / standalone
    // builds return 'standalone' / null.
    if (Constants.appOwnership === 'expo') return;

    if (!PROJECT_ID) {
      console.warn(
        '[push] No EAS projectId in app config; skipping push token registration.'
      );
      return;
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let granted = existing === 'granted';
    if (!granted) {
      const { status: requested } = await Notifications.requestPermissionsAsync();
      granted = requested === 'granted';
    }
    if (!granted) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: PROJECT_ID,
    });

    const deviceId = Device.osBuildId ?? Device.modelId ?? 'unknown';

    const { error } = await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        device_id: deviceId,
        expo_push_token: token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,device_id' }
    );
    if (error) console.warn('[push] upsert failed', error);
  } catch (e) {
    // Push isn't critical to app function — swallow and log.
    console.warn('[push] registration failed', e);
  }
}
