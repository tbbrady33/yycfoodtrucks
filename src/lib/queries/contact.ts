import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../supabase';
import { useSession } from '../session';

export type ContactStatus = 'new' | 'replied' | 'closed';

export type ContactRequest = {
  id: string;
  submitter_id: string | null;
  truck_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  status: ContactStatus;
  created_at: string;
};

/**
 * Submit a contact/booking request. Anyone can submit — RLS allows anon
 * inserts. When the user is signed in, submitter_id must match auth.uid()
 * (the RLS policy enforces this).
 *
 * Email notification to YYC Food Trucks management is a TODO for the
 * submit-contact-request Edge Function (Step 8/admin hookup). For v1 we
 * just write the row; admins see it in their inbox.
 */
export function useSubmitContactRequest() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      email: string;
      phone?: string;
      subject?: string;
      message: string;
      truckId?: string | null;
    }) => {
      const { error } = await supabase.from('contact_requests').insert({
        submitter_id: user?.id ?? null,
        truck_id: input.truckId ?? null,
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        subject: input.subject ?? null,
        message: input.message,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      // Refresh the signed-in user's inbox if they're looking at it.
      qc.invalidateQueries({ queryKey: ['my-contact-requests'] });
    },
  });
}

/** Customer's own submitted requests. RLS already scopes to them. */
export function useMyContactRequests() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['my-contact-requests', user?.id ?? null],
    enabled: !!user,
    queryFn: async (): Promise<ContactRequest[]> => {
      const { data, error } = await supabase
        .from('contact_requests')
        .select(
          'id, submitter_id, truck_id, name, email, phone, subject, message, status, created_at'
        )
        .eq('submitter_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContactRequest[];
    },
  });
}
