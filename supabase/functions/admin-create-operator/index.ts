// Edge Function: admin-create-operator
//
// Caller must be an authenticated user whose profiles.role = 'admin'.
// Creates an auth.users row with a random temp password (email auto-
// confirmed), sets the resulting profiles row to role='operator' +
// must_change_password=true, and optionally creates an initial truck
// owned by them.
//
// Returns the temp password to the admin once — they share it with the
// operator out-of-band, and the operator is forced to change it on
// first login (Step 3's change-password flow).
//
// Email-based invites (inviteUserByEmail + PKCE callback) are wired up
// elsewhere in this repo — flowType: 'pkce' on the client, the
// /auth-callback route, and the Supabase Auth redirect-URL allow-list.
// Flipping this function back to inviteUserByEmail is the only change
// needed to switch over.
//
// Deploy: `supabase functions deploy admin-create-operator`

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
  const { data: profile, error: pErr } = await admin
    .from('profiles')
    .select('role')
    .eq('id', caller.user.id)
    .single();
  if (pErr || profile?.role !== 'admin') {
    return json({ error: 'Forbidden — admin only' }, 403);
  }

  let body: {
    email?: string;
    display_name?: string;
    truck_name?: string;
    category_id?: number;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body must be JSON' }, 400);
  }
  const { email, display_name, truck_name, category_id } = body;
  if (!email || typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: 'A valid email is required' }, 400);
  }

  const tempPassword = generatePassword();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    return json({ error: `Create user failed: ${createErr?.message}` }, 500);
  }

  const { error: updErr } = await admin
    .from('profiles')
    .update({
      role: 'operator',
      display_name: display_name ?? null,
      must_change_password: true,
    })
    .eq('id', created.user.id);
  if (updErr) {
    return json({ error: `Promote to operator failed: ${updErr.message}` }, 500);
  }

  let truck_id: string | null = null;
  if (truck_name && typeof truck_name === 'string' && Number.isInteger(category_id)) {
    const slug = slugify(truck_name);
    const { data: truck, error: tErr } = await admin
      .from('trucks')
      .insert({
        name: truck_name,
        slug,
        category_id,
        owner_id: created.user.id,
      })
      .select('id')
      .single();
    if (tErr) {
      return json(
        {
          user_id: created.user.id,
          email,
          temp_password: tempPassword,
          truck_id: null,
          warning: `User created but initial truck failed: ${tErr.message}`,
        },
        207
      );
    }
    truck_id = truck.id;
  }

  return json({
    user_id: created.user.id,
    email,
    temp_password: tempPassword,
    truck_id,
  });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function generatePassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
