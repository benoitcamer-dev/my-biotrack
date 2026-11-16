import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Google Agenda — jeton d'accès frais SANS fenêtre (verify_jwt = true). Lit le jeton de renouvellement
// stocké par gcal-connect (service role) et le change contre un jeton d'accès d'1 h.
// Réponses : 200 { access_token, expires_in } | 404 { error: "not_connected" } (jamais connecté)
//            | 409 { error: "reauth" } (Google a révoqué le jeton : reconnecter une fois dans Réglages).
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u, error: ue } = await sb.auth.getUser(jwt);
    if (ue || !u?.user) return json({ error: "auth" }, 401);

    const secret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!secret) return json({ error: "secret_missing" }, 500);
    const body = await req.json().catch(() => ({}));
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID") || body.client_id;
    if (!clientId) return json({ error: "bad_request" }, 400);

    const { data: row } = await sb.from("google_tokens").select("refresh_token").eq("user_id", u.user.id).maybeSingle();
    if (!row?.refresh_token) return json({ error: "not_connected" }, 404);

    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId, client_secret: secret, refresh_token: row.refresh_token, grant_type: "refresh_token",
      }),
    });
    const t = await r.json();
    if (!r.ok) {
      if (t.error === "invalid_grant") { // révoqué / expiré (ex. écran de consentement resté en « Test » > 7 j)
        await sb.from("google_tokens").delete().eq("user_id", u.user.id);
        return json({ error: "reauth" }, 409);
      }
      return json({ error: "google", detail: t.error || "refresh_failed" }, 502);
    }
    return json({ access_token: t.access_token, expires_in: t.expires_in });
  } catch (_e) {
    return json({ error: "internal" }, 500);
  }
});
