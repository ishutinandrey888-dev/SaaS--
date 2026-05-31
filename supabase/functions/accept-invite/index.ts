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

    // The user must be authenticated (they clicked the magic link)
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "unauthorized" }, 401);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (authErr || !user) return json({ error: "unauthorized" }, 401);

    const { token } = await req.json();
    if (!token) return json({ error: "missing_token" }, 400);

    // Find the invite
    const { data: emp, error: findErr } = await supabase
      .from("employees")
      .select("*")
      .eq("invite_token", token)
      .eq("status", "invited")
      .single();

    if (findErr || !emp) return json({ error: "invalid_token" }, 404);

    // Link to the user and activate
    const { error: updateErr } = await supabase
      .from("employees")
      .update({
        user_id: user.id,
        status: "active",
        invite_token: null,
        last_active_at: new Date().toISOString(),
      })
      .eq("id", emp.id);

    if (updateErr) throw updateErr;

    return json({ status: "active", role: emp.role });
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
