import { useEffect } from 'react';
import { router, useSegments } from 'expo-router';

import { useSession } from '@/lib/session';
import { useProfile } from '@/lib/queries/profile';

/**
 * Watches session + profile state and force-routes the user when there's
 * a mismatch between where they are and where they should be. Renders nothing.
 *
 * Rules (Step 3 scope):
 *   - If signed in AND profiles.must_change_password is true, route to
 *     /change-password (unless already there).
 *   - Otherwise leave the user alone. Public screens (landing, sign-in)
 *     stay reachable to everyone.
 *
 * Role-based gating for (operator) / (admin) groups lands in Step 4+.
 */
export function AuthRedirect() {
  const { loading, session } = useSession();
  const profile = useProfile().data;
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    if (!session) return;
    if (!profile) return;

    const current = segments[0] ?? '';

    if (profile.must_change_password && current !== 'change-password') {
      router.replace('/change-password');
    }
  }, [loading, session, profile, segments]);

  return null;
}
