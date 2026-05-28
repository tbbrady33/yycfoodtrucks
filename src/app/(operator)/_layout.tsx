import { Redirect, Slot } from 'expo-router';

import { useSession } from '@/lib/session';
import { useProfile } from '@/lib/queries/profile';

/**
 * Auth + role gate for operator screens. Uses Slot to keep routes in the
 * root Stack (same fix as the (public) bug from earlier).
 *
 * Operators and admins pass; customers and anon get bounced to /.
 *
 * RLS is the real enforcement: even if a customer somehow lands here,
 * trucks/menu_items policies will reject any write. This just keeps the
 * UI from showing forms they can't submit.
 */
export default function OperatorLayout() {
  const { loading, session } = useSession();
  const profile = useProfile();

  if (loading) return null;
  if (!session) return <Redirect href="/sign-in" />;
  // Wait for profile so we don't flicker the wrong layout.
  if (profile.isLoading) return null;

  const role = profile.data?.role;
  if (role !== 'operator' && role !== 'admin') {
    return <Redirect href="/" />;
  }

  return <Slot />;
}
