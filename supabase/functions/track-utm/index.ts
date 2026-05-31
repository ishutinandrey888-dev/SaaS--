import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Use service role so this works from landing page (no user session)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    // Accept ?utm_id=<id>&event=click|conversion
    const utmId = url.searchParams.get("utm_id") ?? (await req.json().catch(() => ({}))).utm_id;
    const event = url.searchParams.get("event") ?? "click";

    if (!utmId) return json({ error: "missing utm_id" }, 400);

    const column = event === "conversion" ? "conversions" : "clicks";

    const { error } = await supabase.rpc("increment_utm_counter", {
      p_id: utmId,
      p_column: column,
    });

    // Fallback: raw update if rpc not available
    if (error) {
      const { error: updateErr } = await supabase
        .from("utm_links")
        .update({ [column]: supabase.rpc("coalesce", {}) }) // handled client-side fallback
        .eq("id", utmId);
      if (updateErr) throw updateErr;
    }

    return json({ ok: true });
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
