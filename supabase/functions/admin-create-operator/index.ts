// Edge Function: admin-create-operator
//
// Caller must be an authenticated user whose profiles.role = 'admin'.
// Sends an invite email to the operator via Supabase Auth's
// inviteUserByEmail. The link in the email lands at the configured
// redirectTo (yycfoodtruck://auth-callback?code=...), where the app
// exchanges the PKCE code for a session. The new user's profile is then
// promoted to role='operator' with must_change_password=true so they're
// routed through /change-password on first sign-in.
//
// Returns no password — the email is the credential. Admin just
// confirms the invite was sent.
//
// Deploy:  supabase functions deploy admin-create-operator
//
// IMPORTANT: the redirect URL `yycfoodtruck://auth-callback` MUST be in
// the Supabase Auth → URL Configuration → Redirect URLs allow-list, or
// the email link will refuse to redirect. Configure once per project at
// https://supabase.com/dashboard/project/<ref>/auth/url-configuration

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const REDIRECT_URL = 'yycfoodtruck://auth-callback';

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

  // -- Authn: caller must present a JWT --
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: caller, error: callerErr } = await userClient.auth.getUser();
  if (callerErr || !caller?.user) return json({ error: 'Invalid token' }, 401);

  // -- Authz: caller must be admin --
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: profile, error: pErr } = await admin
    .from('profiles')
    .select('role')
    .eq('id', caller.user.id)
    .single();
  if (pErr || profile?.role !== 'admin') {
    return json({ error: 'Forbidden — admin only' }, 403);
  }

  // -- Payload --
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

  // -- Send the invite email --
  // inviteUserByEmail creates the auth.users row (which fires the
  // on_auth_user_created trigger to insert a profiles row with default
  // role='customer'), then dispatches an email via the project's auth
  // mailer. The link in the email redirects to REDIRECT_URL with a
  // PKCE code.
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: display_name ? { display_name } : undefined,
    redirectTo: REDIRECT_URL,
  });
  if (inviteErr || !invited?.user) {
    return json({ error: `Invite failed: ${inviteErr?.message ?? 'unknown'}` }, 500);
  }

  // -- Promote the auto-created profile to operator --
  // The on_auth_user_created trigger has inserted with default role=customer;
  // we now overwrite role, set display_name, and mark must_change_password
  // so the operator hits /change-password after exchanging the invite code.
  const { error: updErr } = await admin
    .from('profiles')
    .update({
      role: 'operator',
      display_name: display_name ?? null,
      must_change_password: true,
    })
    .eq('id', invited.user.id);
  if (updErr) {
    return json({ error: `Promote to operator failed: ${updErr.message}` }, 500);
  }

  // -- Optionally create their first truck --
  let truck_id: string | null = null;
  if (truck_name && typeof truck_name === 'string' && Number.isInteger(category_id)) {
    const slug = slugify(truck_name);
    const { data: truck, error: tErr } = await admin
      .from('trucks')
      .insert({
        name: truck_name,
        slug,
        category_id,
        owner_id: invited.user.id,
      })
      .select('id')
      .single();
    if (tErr) {
      return json(
        {
          user_id: invited.user.id,
          email,
          truck_id: null,
          warning: `Operator invited but initial truck failed: ${tErr.message}`,
        },
        207
      );
    }
    truck_id = truck.id;
  }

  return json({
    user_id: invited.user.id,
    email,
    truck_id,
  });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
