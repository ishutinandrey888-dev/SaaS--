import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth check
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "unauthorized" }, 401);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (authErr || !user) return json({ error: "unauthorized" }, 401);

    // Permission check
    const { data: allowed } = await supabase.rpc("has_permission", {
      p_user_id: user.id,
      p_perm: "employees.manage",
    });
    if (!allowed) return json({ error: "forbidden" }, 403);

    const { email, name, position, role } = await req.json();
    if (!email || !position || !role) return json({ error: "missing_fields" }, 400);

    const token = crypto.randomUUID();

    const { data: emp, error: empErr } = await supabase
      .from("employees")
      .upsert({
        email,
        name: name || null,
        position,
        role,
        status: "invited",
        invite_token: token,
      }, { onConflict: "email" })
      .select()
      .single();

    if (empErr) throw empErr;

    // Send invite email via Supabase Auth (magic link)
    const siteUrl = Deno.env.get("SITE_URL") ?? "https://app.dozim.ai";
    const { error: mailErr } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/accept-invite?token=${token}`,
      data: { invite_token: token, role, position },
    });
    if (mailErr) throw mailErr;

    return json({ id: emp.id, status: "invited" });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
