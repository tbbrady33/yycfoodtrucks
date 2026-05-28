import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../supabase';
import { useSession } from '../session';

export type OperatorMessage = {
  id: string;
  sender_id: string | null;
  recipient_id: string;
  subject: string | null;
  body: string;
  created_at: string;
  read_at: string | null;
};

/** Messages received by the current user (operator or admin). */
export function useReceivedMessages() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['operator-messages-received', user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<OperatorMessage[]> => {
      const { data, error } = await supabase
        .from('operator_messages')
        .select('id, sender_id, recipient_id, subject, body, created_at, read_at')
        .eq('recipient_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as OperatorMessage[];
    },
  });
}

/** Just the unread count — used for the landing badge. */
export function useUnreadMessageCount() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['operator-messages-unread', user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('operator_messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user!.id)
        .is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/**
 * Admin-only mutation. RLS rejects non-admins; the recipient-role guard
 * trigger rejects non-operator/admin recipients.
 */
export function useSendOperatorMessage() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: async (input: {
      recipientId: string;
      subject: string | null;
      body: string;
    }) => {
      if (!user) throw new Error('Not signed in');
      const { error } = await supabase.from('operator_messages').insert({
        sender_id: user.id,
        recipient_id: input.recipientId,
        subject: input.subject,
        body: input.body,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operator-messages-received'] });
      qc.invalidateQueries({ queryKey: ['operator-messages-unread'] });
    },
  });
}

/**
 * Mark a single message read. Only flips rows that are still unread,
 * so calling this on an already-read message is a cheap no-op.
 */
export function useMarkMessageRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('operator_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operator-messages-received'] });
      qc.invalidateQueries({ queryKey: ['operator-messages-unread'] });
    },
  });
}
