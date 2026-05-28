import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../supabase';
import type { ContactRequest, ContactStatus } from './contact';
import type { Review } from './reviews';

/**
 * Admin-side queries and mutations. Authorization is enforced by RLS +
 * the auth_role helper, not by the client. Anyone hitting these without
 * the admin role will just see empty result sets / 403s.
 */

export type OperatorRow = {
  id: string;
  display_name: string | null;
  must_change_password: boolean;
  created_at: string;
};

export function useAllOperators() {
  return useQuery({
    queryKey: ['admin-operators'],
    queryFn: async (): Promise<OperatorRow[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, must_change_password, created_at')
        .eq('role', 'operator')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as OperatorRow[];
    },
  });
}

export function useAllContactRequests() {
  return useQuery({
    queryKey: ['admin-contact-requests'],
    queryFn: async (): Promise<ContactRequest[]> => {
      const { data, error } = await supabase
        .from('contact_requests')
        .select(
          'id, submitter_id, truck_id, name, email, phone, subject, message, status, created_at'
        )
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContactRequest[];
    },
  });
}

export function useUpdateContactRequestStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: ContactStatus }) => {
      const { error } = await supabase
        .from('contact_requests')
        .update({ status: input.status })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-contact-requests'] }),
  });
}

export function useFlaggedReviews() {
  return useQuery({
    queryKey: ['admin-flagged-reviews'],
    queryFn: async (): Promise<Review[]> => {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, truck_id, author_id, rating, body, status, created_at, updated_at')
        .neq('status', 'visible') // flagged + removed
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Review[];
    },
  });
}

/** Admin action: restore (visible) or remove a flagged review. */
export function useModerateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: 'visible' | 'removed' }) => {
      const { error } = await supabase
        .from('reviews')
        .update({ status: input.status })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-flagged-reviews'] });
      qc.invalidateQueries({ queryKey: ['reviews'] });
      qc.invalidateQueries({ queryKey: ['truck'] });
      qc.invalidateQueries({ queryKey: ['trucks'] });
    },
  });
}

export type InviteOperatorResult = {
  user_id: string;
  email: string;
  temp_password: string;
  truck_id: string | null;
  warning?: string;
};

/**
 * Calls admin-create-operator. The Edge Function returns the generated
 * temp password ONCE — admin captures it and shares with the operator
 * out-of-band. Operator's must_change_password is set so their next
 * sign-in routes through /change-password.
 */
export function useInviteOperator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      email: string;
      display_name?: string;
      truck_name?: string;
      category_id?: number;
    }): Promise<InviteOperatorResult> => {
      const { data, error } = await supabase.functions.invoke('admin-create-operator', {
        body: input,
      });
      if (error) throw error;
      if (!data || typeof data !== 'object') throw new Error('Unexpected response');
      return data as InviteOperatorResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-operators'] });
      qc.invalidateQueries({ queryKey: ['trucks'] });
    },
  });
}

/**
 * Calls admin-delete-operator. Removes the operator's auth.users row,
 * which cascades to their profile, follows, push tokens, reviews, and
 * messages. Trucks they owned survive with owner_id=NULL — admin can
 * reassign or delete them via the operator's truck pages.
 */
export function useDeleteOperator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (user_id: string) => {
      const { data, error } = await supabase.functions.invoke('admin-delete-operator', {
        body: { user_id },
      });
      if (error) throw error;
      if (!data || typeof data !== 'object' || !('ok' in data)) {
        throw new Error('Unexpected response from admin-delete-operator');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-operators'] });
      qc.invalidateQueries({ queryKey: ['trucks'] });
      qc.invalidateQueries({ queryKey: ['operator-messages-thread'] });
    },
  });
}
