import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Source versionnée dans le repo depuis le 12/10/2026 (avant : uniquement sur Supabase, v12).
// Déployée via le MCP Supabase (deploy_edge_function), verify_jwt = false.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const TZ = "Europe/Paris";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// "YYYY-MM-DD" du jour calendaire à Paris contenant l'instant ms.
const parisDate = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(ms));
// Instant (ms UTC) de minuit à Paris pour une date "YYYY-MM-DD" (gère heure d'été/hiver).
function parisMidnight(ymd: string): number {
  const guess = Date.parse(`${ymd}T00:00:00Z`);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(guess)).map(p => [p.type, p.value]));
  const wallAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return guess - (wallAsUtc - guess);
}

// Distance (km) des marches saisies à la main ce jour-là dans l'app — à retirer du total Fit,
// qui compte TOUS les pas de la journée (sinon double comptage). Les descriptions de l'app sont
// de la forme "🚶 Marche (30min · 3km · 6km/h)" ou "🚶 A → B (25min · 2.4km · 6km/h)".
async function manualWalkKm(sb: any, user_id: string, dateStr: string): Promise<number> {
  const { data } = await sb.from("entries").select("desc")
    .eq("user_id", user_id).eq("date", dateStr).eq("category", "Sport")
    .not("desc", "ilike", "%gfit:%");
  let km = 0;
  for (const { desc } of data || []) {
    const d = String(desc || "");
    if (!(d.includes("🚶") || /marche|trajet/i.test(d))) continue;
    const m = d.match(/(\d+(?:[.,]\d+)?)\s*km(?!\/h)/);
    if (m) km += parseFloat(m[1].replace(",", "."));
  }
  return km;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { user_id, user_weight, since_hours, force } = await req.json();
    const weight = user_weight || 75;
    // Jours calendaires (Paris) couverts : aujourd'hui + les (n-1) précédents. 48 h → hier et aujourd'hui.
    const days = Math.max(1, Math.round((since_hours || 48) / 24));

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: tokenRow } = await sb.from("google_tokens").select("refresh_token").eq("user_id", user_id).single();
    if (!tokenRow?.refresh_token) return json({ error: "no_token" }, 400);

    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ refresh_token: tokenRow.refresh_token, client_id: Deno.env.get("GOOGLE_CLIENT_ID")!, client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!, grant_type: "refresh_token" }),
    });
    const tokenData = await tokenResp.json();
    if (!tokenData.access_token) {
      console.error("gfit-sync token_failed:", JSON.stringify(tokenData));
      return json({ error: "token_failed", detail: tokenData.error || null }, 400);
    }

    const token = tokenData.access_token;
    const now = Date.now();
    // Avant le 12/10/2026 : fenêtre glissante "maintenant − 48 h" découpée en tranches de 24 h à
    // partir de l'heure de la sync, datées en UTC — une "journée" Fit pouvait aller de 16h47 la
    // veille à 16h47, et tomber sur la mauvaise date. Désormais : minuit → minuit, heure de Paris.
    const startDate = parisDate(now - (days - 1) * 86400000);
    const since = parisMidnight(startDate);

    const { data: importedRows } = await sb.from("gfit_imported").select("date").eq("user_id", user_id);
    const importedDates = new Set((importedRows || []).map(r => r.date));

    const aggResp = await fetch("https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        aggregateBy: [
          { dataTypeName: "com.google.step_count.delta" },
          { dataTypeName: "com.google.distance.delta" },
        ],
        bucketByTime: { period: { type: "day", value: 1, timeZoneId: TZ } },
        startTimeMillis: since,
        endTimeMillis: now,
      }),
    });

    if (!aggResp.ok) {
      const t = await aggResp.text();
      console.error("gfit-sync aggregate_failed:", aggResp.status, t);
      return json({ error: "aggregate_failed", body: t }, 400);
    }

    const aggData = await aggResp.json();
    const imported = [], updated = [];

    for (const bucket of aggData.bucket || []) {
      const dateStr = parisDate(parseInt(bucket.startTimeMillis));

      let steps = 0, distM = 0;
      for (const ds of bucket.dataset || []) {
        for (const pt of ds.point || []) {
          for (const v of pt.value || []) {
            if (ds.dataSourceId.includes("step_count")) steps += v.intVal || 0;
            if (ds.dataSourceId.includes("distance")) distM += v.fpVal || 0;
          }
        }
      }

      steps = Math.round(steps);
      const distKm = Math.round(distM / 10) / 100;
      if (steps < 500 && distKm < 0.1) continue;

      const totalKm = distKm > 0 ? distKm : Math.round(steps * 0.00075 * 100) / 100;
      const manualKm = Math.round((await manualWalkKm(sb, user_id, dateStr)) * 100) / 100;
      const finalDistKm = Math.max(0, Math.round((totalKm - manualKm) * 100) / 100);
      const kcal = Math.round(weight * finalDistKm * 0.83);

      const est = distKm > 0 ? "" : " est.";
      const distSource = manualKm > 0
        ? `${finalDistKm} km${est} hors marches saisies (${totalKm} km au total)`
        : `${finalDistKm} km${est}`;
      const desc = `Marche (Google Fit, ${distSource}, ${steps} pas)||gfit:daily-${dateStr}`;
      const gfitId = `daily-${dateStr}`;

      if (importedDates.has(dateStr)) {
        // Déjà importé — mise à jour si les données ont changé (y compris à la baisse, quand une
        // marche manuelle a été saisie après coup).
        const { data: existing } = await sb.from("entries")
          .select("id, val, desc")
          .ilike("desc", `%gfit:${gfitId}%`)
          .eq("user_id", user_id)
          .limit(1);

        if (existing?.length) {
          if (Math.abs(existing[0].val - kcal) > 10 || force) {
            await sb.from("entries").update({ val: kcal, desc }).eq("id", existing[0].id);
            updated.push({ dateStr, distKm: finalDistKm, steps, kcal });
          }
        }
      } else {
        if (kcal < 10) continue;
        const { error: insErr } = await sb.from("entries").insert({
          user_id, date: dateStr, category: "Sport", type: "burn",
          desc, val: kcal, prot: 0, gluc: 0, lip: 0,
        });
        if (!insErr) {
          await sb.from("gfit_imported").insert({ user_id, date: dateStr });
          imported.push({ dateStr, distKm: finalDistKm, steps, kcal });
        }
      }
    }

    return json({ ok: true, imported, updated });

  } catch (e) {
    console.error("gfit-sync error:", e);
    return json({ error: e.message }, 500);
  }
});
