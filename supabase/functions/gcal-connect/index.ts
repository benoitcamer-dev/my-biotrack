import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Google Agenda — connexion UNIQUE (verify_jwt = true : session Supabase de l'utilisateur exigée).
// L'app envoie le code d'autorisation obtenu par google.accounts.oauth2.initCodeClient (popup, redirect_uri
// "postmessage", prompt "consent", access_type "offline"). On l'échange ici contre un jeton de renouvellement
// qu'on stocke dans google_tokens (RLS sans policy : jamais lisible depuis l'app). Le jeton de renouvellement
// n'est JAMAIS renvoyé à l'app ; on renvoie seulement un jeton d'accès d'1 h.
// Secrets requis (Supabase → Edge Functions → Secrets) : GOOGLE_CLIENT_SECRET, et GOOGLE_CLIENT_ID
// (sinon client_id lu dans le corps de la requête — c'est un identifiant public).
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
    const url = Deno.env.get("SUPABASE_URL")!;
    const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u, error: ue } = await sb.auth.getUser(jwt);
    if (ue || !u?.user) return json({ error: "auth" }, 401);

    const secret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!secret) return json({ error: "secret_missing" }, 500);
    const body = await req.json().catch(() => ({}));
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID") || body.client_id;
    if (!body.code || !clientId) return json({ error: "bad_request" }, 400);

    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: body.code, client_id: clientId, client_secret: secret,
        redirect_uri: "postmessage", grant_type: "authorization_code",
      }),
    });
    const t = await r.json();
    if (!r.ok) return json({ error: "google", detail: t.error || "exchange_failed" }, 400);
    if (!t.refresh_token) return json({ error: "no_refresh_token" }, 400); // consentement déjà donné sans prompt=consent

    const { error: ie } = await sb.from("google_tokens").upsert({
      user_id: u.user.id, refresh_token: t.refresh_token, scope: t.scope || null, updated_at: new Date().toISOString(),
    });
    if (ie) return json({ error: "store" }, 500);
    return json({ ok: true, access_token: t.access_token, expires_in: t.expires_in });
  } catch (_e) {
    return json({ error: "internal" }, 500);
  }
});
