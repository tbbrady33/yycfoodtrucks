import { Redirect, Slot } from 'expo-router';

import { useSession } from '@/lib/session';

/**
 * Auth gate for the (customer) route group. Uses <Slot /> so the routes
 * underneath stay in the root Stack — that way back navigation works
 * correctly (a nested <Stack /> would orphan its history; see the (public)
 * group bug we fixed in commit 547ef96-ish).
 */
export default function CustomerLayout() {
  const { loading, session } = useSession();
  if (loading) return null;
  if (!session) return <Redirect href="/sign-in" />;
  return <Slot />;
}
