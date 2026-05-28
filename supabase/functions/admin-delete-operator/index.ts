// Edge Function: admin-delete-operator
//
// Caller must be admin. Deletes the operator's auth.users row, which
// cascades to:
//   - public.profiles  (FK on delete cascade)
//   - public.follows, push_tokens, reviews, review_flags, operator_messages
//     (all FK on delete cascade from profiles)
//
// Their owned trucks survive — `trucks.owner_id` is `on delete set null`
// — so admin can reassign or delete them separately. Menu items, schedule
// slots, etc. live under the trucks and are untouched.
//
// Guards: cannot delete yourself; cannot delete other admins from here
// (admin-removal is rare enough to belong in the dashboard, not the app).
//
// Deploy:  supabase functions deploy admin-delete-operator

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: caller, error: callerErr } = await userClient.auth.getUser();
  if (callerErr || !caller?.user) return json({ error: 'Invalid token' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: callerProfile, error: pErr } = await admin
    .from('profiles')
    .select('role')
    .eq('id', caller.user.id)
    .single();
  if (pErr || callerProfile?.role !== 'admin') {
    return json({ error: 'Forbidden — admin only' }, 403);
  }

  let body: { user_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body must be JSON' }, 400);
  }
  const { user_id } = body;
  if (!user_id || typeof user_id !== 'string') {
    return json({ error: 'user_id required' }, 400);
  }

  if (user_id === caller.user.id) {
    return json({ error: "Can't delete your own account" }, 400);
  }

  const { data: target, error: tErr } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user_id)
    .single();
  if (tErr || !target) {
    return json({ error: 'Target user not found' }, 404);
  }
  if (target.role === 'admin') {
    return json({ error: 'Admin accounts must be removed from the Supabase dashboard' }, 400);
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(user_id);
  if (delErr) {
    return json({ error: `Delete failed: ${delErr.message}` }, 500);
  }

  return json({ ok: true });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
