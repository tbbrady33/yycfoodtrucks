import { Redirect } from 'expo-router';
import { type ReactElement } from 'react';

import { useSession } from './session';
import { useProfile } from './queries/profile';

/**
 * Inline auth gates used by individual route screens (instead of a group
 * _layout that nests a Stack/Slot — those broke header propagation for
 * routes underneath, so each screen does its own check).
 *
 * Each hook returns either a Redirect element to render-and-return, or
 * `null` once the gate is satisfied. Usage:
 *
 *   const gate = useRequireAuth();
 *   if (gate) return gate;
 *   // ...render the real screen
 */

export function useRequireAuth(): ReactElement | null {
  const { loading, session } = useSession();
  if (loading) return null; // brief flash, intentional
  if (!session) return <Redirect href="/sign-in" />;
  return null;
}

export function useRequireOperator(): ReactElement | null {
  const { loading, session } = useSession();
  const profile = useProfile();
  if (loading) return null;
  if (!session) return <Redirect href="/sign-in" />;
  if (profile.isLoading) return null;
  const role = profile.data?.role;
  if (role !== 'operator' && role !== 'admin') {
    return <Redirect href="/" />;
  }
  return null;
}
