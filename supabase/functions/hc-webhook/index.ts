import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Réception des pas/distance envoyés par l'app Android "HC Webhook" (Health Connect → POST JSON),
// remplaçant de gfit-sync (API Google Fit en fin de vie en 2026). Créée le 12/10/2026.
// Déployée via le MCP Supabase (deploy_edge_function), verify_jwt = false : l'authentification
// se fait par l'en-tête x-api-key, dont l'empreinte SHA-256 est comparée à
// hc_webhook_keys.api_key_hash — la clé elle-même n'est stockée nulle part côté serveur,
// elle n'existe que dans la config de l'app sur le téléphone.
//
// Format attendu (docs/webhook.md du projet HC Webhook) : résolution "Daily" (défaut pour
// Steps/Distance) → un enregistrement par jour local du téléphone :
//   { "steps": [{ "count", "start_time", "end_time" }], "distance": [{ "meters", "start_time", "end_time" }] }
// Le jour le plus ancien de la fenêtre glissante de 48 h n'est que partiel (start_time = début
// de fenêtre, pas minuit) : on garde donc le MAX reçu par jour, jamais une valeur plus petite.

const TZ = "Europe/Paris";
// Calcul des kcal (choix validé par l'utilisateur le 12/10/2026) : on ne compte que l'activité EN
// PLUS d'une journée sédentaire, car le "Métabolisme" de l'app vaut déjà BMR × 1,2 (facteur
// sédentaire, qui couvre les petits déplacements du quotidien).
// - BASELINE_STEPS : premiers pas de la journée considérés comme déjà inclus dans ce × 1,2.
//   Convention, pas une mesure (une journée « sédentaire » est usuellement < 5 000 pas).
// - NET_KCAL_PER_KG_KM : coût NET de la marche (repos exclu, déjà compté dans le BMR), pour une
//   marche du quotidien à ~5 km/h : (MET 3,7 − 1) / 5 km/h ≈ 0,54 kcal/kg/km (Compendium 2011).
const BASELINE_STEPS = 3500;
const NET_KCAL_PER_KG_KM = 0.54;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const parisDate = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));

// Distance (km) des marches saisies à la main ce jour-là — à retirer du total Health Connect,
// qui compte TOUS les pas de la journée (même logique que gfit-sync).
async function manualWalkKm(sb: any, user_id: string, dateStr: string): Promise<number> {
  const { data } = await sb.from("entries").select("desc")
    .eq("user_id", user_id).eq("date", dateStr).eq("category", "Sport")
    .not("desc", "ilike", "%gfit:%").not("desc", "ilike", "%hc:daily-%");
  let km = 0;
  for (const { desc } of data || []) {
    const d = String(desc || "");
    if (!(d.includes("🚶") || /marche|trajet/i.test(d))) continue;
    const m = d.match(/(\d+(?:[.,]\d+)?)\s*km(?!\/h)/);
    if (m) km += parseFloat(m[1].replace(",", "."));
  }
  return km;
}

// Dernier poids pesé, sinon poids du profil, sinon 75 kg.
async function currentWeight(sb: any, user_id: string): Promise<number> {
  const { data: w } = await sb.from("weight_entries").select("weight")
    .eq("user_id", user_id).order("date", { ascending: false }).limit(1);
  if (w?.length && Number(w[0].weight) > 0) return Number(w[0].weight);
  const { data: s } = await sb.from("user_settings").select("weight").eq("user_id", user_id).limit(1);
  return (s?.length && Number(s[0].weight) > 0) ? Number(s[0].weight) : 75;
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const key = req.headers.get("x-api-key") || "";
    if (key.length < 32) return json({ error: "unauthorized" }, 401);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key))))
      .map(b => b.toString(16).padStart(2, "0")).join("");
    const { data: keyRow } = await sb.from("hc_webhook_keys").select("user_id").eq("api_key_hash", hash).maybeSingle();
    if (!keyRow) return json({ error: "unauthorized" }, 401);
    const user_id = keyRow.user_id;

    const body = await req.json();
    const perDay = new Map<string, { steps: number; meters: number }>();
    const day = (d: string) => perDay.get(d) || perDay.set(d, { steps: 0, meters: 0 }).get(d)!;
    for (const r of body.steps || []) if (r?.start_time && r.count > 0) day(parisDate(r.start_time)).steps += r.count;
    for (const r of body.distance || []) if (r?.start_time && r.meters > 0) day(parisDate(r.start_time)).meters += r.meters;
    // Recalcule aussi les 7 derniers jours déjà connus, même absents de ce payload : l'app
    // n'envoie plus un jour passé une fois synchronisé après sa fin, donc une marche saisie
    // à la main après coup pour ce jour-là ne serait jamais déduite (double comptage).
    const { data: recent } = await sb.from("hc_daily").select("date")
      .eq("user_id", user_id).gte("date", parisDate(new Date(Date.now() - 7 * 86400000).toISOString()));
    for (const { date } of recent || []) day(date);
    if (!perDay.size) return json({ ok: true, days: [] });

    const weight = await currentWeight(sb, user_id);
    const result = [];

    for (const [dateStr, incoming] of perDay) {
      const { data: prev } = await sb.from("hc_daily").select("steps, meters")
        .eq("user_id", user_id).eq("date", dateStr).maybeSingle();
      const steps = Math.max(prev?.steps || 0, Math.round(incoming.steps));
      const meters = Math.max(prev?.meters || 0, incoming.meters);
      await sb.from("hc_daily").upsert({ user_id, date: dateStr, steps, meters, updated_at: new Date().toISOString() });

      const distKm = Math.round(meters / 10) / 100;
      if (steps < 500 && distKm < 0.1) { result.push({ dateStr, steps, skipped: true }); continue; }

      const totalKm = distKm > 0 ? distKm : Math.round(steps * 0.00075 * 100) / 100;
      const manualKm = Math.round((await manualWalkKm(sb, user_id, dateStr)) * 100) / 100;
      // Base sédentaire convertie en km avec la foulée réelle du jour (distance/pas), à défaut 0,75 m.
      const strideKm = distKm > 0 && steps > 0 ? distKm / steps : 0.00075;
      const baselineKm = Math.round(Math.min(steps, BASELINE_STEPS) * strideKm * 100) / 100;
      const finalKm = Math.max(0, Math.round((totalKm - manualKm - baselineKm) * 100) / 100);
      const kcal = Math.round(weight * finalKm * NET_KCAL_PER_KG_KM);

      // Libellé "Titre (sous-titre)" SANS parenthèses imbriquées : le journal de l'app découpe
      // titre/sous-titre sur la dernière paire de parenthèses (renderEntry, regex /^(.*?)\s*\(([^)]+)\)$/)
      // — une parenthèse dans le sous-titre cassait le découpage et tronquait tout sur une ligne.
      // Sous-titre court (.entry-sub est en nowrap) ; le détail du calcul va dans la note (après
      // "||", affichée dans la fiche de l'entrée), derrière le tag qui sert à retrouver l'entrée.
      const est = distKm > 0 ? "" : " est.";
      const fmt = (n: number) => String(n).replace(".", ",");
      const tag = `hc:daily-${dateStr}`;
      const note = `${fmt(totalKm)} km${est} au total − ${fmt(manualKm)} km saisis − ${fmt(baselineKm)} km de base sédentaire (${BASELINE_STEPS} pas) = ${fmt(finalKm)} km comptés`;
      const desc = `🚶 Marche du jour (${steps} pas · ${fmt(finalKm)} km comptés sur ${fmt(totalKm)})||${tag} · ${note}`;

      const { data: existing } = await sb.from("entries").select("id, val, desc")
        .eq("user_id", user_id).ilike("desc", `%${tag}%`).limit(1);
      if (existing?.length && kcal < 10) {
        // Plus rien à compter ce jour-là (base sédentaire / marches saisies couvrent tout) : on
        // retire l'entrée générée plutôt que d'afficher "−0" — elle revient si les pas augmentent.
        await sb.from("entries").delete().eq("id", existing[0].id);
        result.push({ dateStr, steps, km: finalKm, kcal, action: "removed" });
      } else if (existing?.length) {
        if (existing[0].val !== kcal || existing[0].desc !== desc) await sb.from("entries").update({ val: kcal, desc }).eq("id", existing[0].id);
        result.push({ dateStr, steps, km: finalKm, kcal, action: "updated" });
      } else if (kcal >= 10) {
        const { error } = await sb.from("entries").insert({
          user_id, date: dateStr, category: "Sport", type: "burn",
          desc, val: kcal, prot: 0, gluc: 0, lip: 0,
        });
        if (error) throw new Error(error.message);
        result.push({ dateStr, steps, km: finalKm, kcal, action: "inserted" });
      }
    }

    return json({ ok: true, days: result });
  } catch (e) {
    console.error("hc-webhook error:", e);
    return json({ error: e.message }, 500);
  }
});
