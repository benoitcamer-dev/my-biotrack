import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Réception des pas/distance envoyés par l'app Android "HC Webhook" (Health Connect → POST JSON),
// remplaçant de gfit-sync (API Google Fit en fin de vie en 2026). Créée le 12/10/2026.
// Déployée via le MCP Supabase (deploy_edge_function), verify_jwt = false : l'authentification
// se fait par l'en-tête x-api-key, dont l'empreinte SHA-256 est comparée à
// hc_webhook_keys.api_key_hash — la clé elle-même n'est stockée nulle part côté serveur,
// elle n'existe que dans la config de l'app sur le téléphone.
//
// Format attendu (docs/webhook.md du projet HC Webhook), résolution "Full" pour Pas et Distance
// (depuis la v8, 12/10/2026) : un enregistrement par intervalle brut de Health Connect :
//   { "steps": [{ "count", "start_time", "end_time" }], "distance": [{ "meters", "start_time", "end_time" }] }
// La synchro normale est incrémentale (seuls les intervalles nouveaux/modifiés arrivent) : on les
// stocke tous dans hc_samples et on recalcule chaque jour à partir de la table, jamais du seul payload.

const TZ = "Europe/Paris";
// Calcul des kcal (v8, choix de l'utilisateur le 12/10/2026) : seules les VRAIES marches comptent,
// pas les quelques pas dispersés à la maison. Les pas sont répartis minute par minute ; une minute
// est « en marche » si elle compte au moins MIN_CADENCE pas ; une séquence = minutes en marche
// consécutives (trous de MAX_GAP_MIN minutes tolérés : feu rouge, porte…), gardée si elle dure au
// moins MIN_BOUT_MIN minutes en marche. Seuils de départ, à ajuster selon le journal.
// - Vitesse réelle de chaque séquence (distance / minutes en marche), plus d'allure fixe.
// - Coût NET (repos exclu, déjà compté dans le BMR) = (MET(vitesse) − 1) × poids × durée, avec la
//   même courbe MET que l'app (WALK_MET_POINTS dans app.js, Compendium 2011).
// - Les km des marches saisies à la main ce jour-là sont retirés (évite le double comptage), au
//   prorata des kcal des séquences.
// - Plus de base sédentaire (retirée en v7) : le filtre par séquence la remplace.
const MIN_CADENCE = 60;
const MIN_BOUT_MIN = 5;
const MAX_GAP_MIN = 1;
const DEFAULT_STRIDE_KM = 0.00075;
// Garde-fou : un intervalle de plus de 3 h est un agrégat (ex. résolution « Quotidien »), pas une
// mesure brute — le répartir à la minute fausserait la détection des séquences.
const MAX_SAMPLE_MS = 3 * 3600000;
const WALK_MET_POINTS = [[2.4, 2.0], [3.2, 2.8], [4.0, 3.0], [4.8, 3.5], [5.6, 4.3], [6.4, 5.0], [7.2, 7.0], [8.0, 8.3]];
function metWalk(spd: number): number {
  const pts = WALK_MET_POINTS;
  if (!(spd > pts[0][0])) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    if (spd <= x1) { const [x0, y0] = pts[i - 1]; return y0 + (y1 - y0) * (spd - x0) / (x1 - x0); }
  }
  return pts[pts.length - 1][1];
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const parisFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
const parisDate = (t: string | number | Date) => parisFmt.format(new Date(t));
const fmt = (n: number) => String(n).replace(".", ",");
const round2 = (n: number) => Math.round(n * 100) / 100;

// Distance (km) des marches saisies à la main ce jour-là — à retirer des séquences détectées.
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

// Répartit chaque intervalle sur les minutes qu'il couvre, au prorata du temps (clé = minute UTC).
function spreadPerMinute(samples: { kind: string; start_time: string; end_time: string; value: number }[]) {
  const mins = new Map<number, { steps: number; meters: number }>();
  for (const s of samples) {
    const a = Date.parse(s.start_time), b = Date.parse(s.end_time);
    if (!(b > a) || b - a > MAX_SAMPLE_MS) continue;
    for (let m = Math.floor(a / 60000) * 60000; m < b; m += 60000) {
      const share = (Math.min(b, m + 60000) - Math.max(a, m)) / (b - a);
      const cur = mins.get(m) || mins.set(m, { steps: 0, meters: 0 }).get(m)!;
      if (s.kind === "steps") cur.steps += s.value * share; else cur.meters += s.value * share;
    }
  }
  return mins;
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

    // 1. Stockage des intervalles reçus (un intervalle modifié par Health Connect écrase l'ancien).
    const body = await req.json();
    const now = new Date().toISOString();
    const rows = [
      ...(body.steps || []).filter((r: any) => r?.start_time && r?.end_time && r.count > 0)
        .map((r: any) => ({ user_id, kind: "steps", start_time: r.start_time, end_time: r.end_time, value: r.count, updated_at: now })),
      ...(body.distance || []).filter((r: any) => r?.start_time && r?.end_time && r.meters > 0)
        .map((r: any) => ({ user_id, kind: "distance", start_time: r.start_time, end_time: r.end_time, value: r.meters, updated_at: now })),
    ];
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await sb.from("hc_samples").upsert(rows.slice(i, i + 500));
      if (error) throw new Error(error.message);
    }

    // 2. Recalcul des jours touchés par ce payload + des 7 derniers jours (une marche saisie à la main
    //    après coup doit être déduite à la synchro suivante), à partir de TOUS les intervalles stockés.
    const days = new Set<string>(rows.map(r => parisDate(r.start_time)));
    for (let d = 0; d <= 7; d++) days.add(parisDate(Date.now() - d * 86400000));
    const sorted = [...days].sort();
    const fromIso = new Date(Date.parse(sorted[0] + "T00:00:00Z") - 86400000).toISOString();
    const samples: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from("hc_samples").select("kind, start_time, end_time, value")
        .eq("user_id", user_id).gte("end_time", fromIso).order("start_time").range(from, from + 999);
      if (error) throw new Error(error.message);
      samples.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    const perDay = new Map<string, [number, { steps: number; meters: number }][]>();
    for (const [m, v] of [...spreadPerMinute(samples)].sort((x, y) => x[0] - y[0])) {
      const d = parisDate(m);
      if (days.has(d)) (perDay.get(d) || perDay.set(d, []).get(d)!).push([m, v]);
    }

    const weight = await currentWeight(sb, user_id);
    const result = [];

    for (const [dateStr, minutes] of perDay) {
      const totalSteps = Math.round(minutes.reduce((s, [, v]) => s + v.steps, 0));
      const totalMeters = minutes.reduce((s, [, v]) => s + v.meters, 0);
      await sb.from("hc_daily").upsert({ user_id, date: dateStr, steps: totalSteps, meters: Math.round(totalMeters), updated_at: now });
      // Foulée du jour pour les minutes sans distance (Health Connect peut ne pas en fournir).
      const strideKm = totalSteps > 0 && totalMeters > 0 ? totalMeters / 1000 / totalSteps : DEFAULT_STRIDE_KM;

      // Séquences de marche.
      const bouts: { min: number; steps: number; km: number }[] = [];
      let cur: { min: number; steps: number; km: number } | null = null, lastActive = -Infinity;
      for (const [m, v] of minutes) {
        if (v.steps < MIN_CADENCE) continue;
        if (!cur || m - lastActive > (MAX_GAP_MIN + 1) * 60000) { cur = { min: 0, steps: 0, km: 0 }; bouts.push(cur); }
        cur.min++; cur.steps += v.steps; cur.km += v.meters > 0 ? v.meters / 1000 : v.steps * strideKm;
        lastActive = m;
      }
      const kept = bouts.filter(b => b.min >= MIN_BOUT_MIN);
      const walkMin = kept.reduce((s, b) => s + b.min, 0);
      const walkSteps = Math.round(kept.reduce((s, b) => s + b.steps, 0));
      const walkKm = round2(kept.reduce((s, b) => s + b.km, 0));
      const walkKcal = kept.reduce((s, b) => s + (metWalk(b.km / (b.min / 60)) - 1) * weight * b.min / 60, 0);

      const manualKm = round2(await manualWalkKm(sb, user_id, dateStr));
      const finalKm = Math.max(0, round2(walkKm - manualKm));
      const kcal = walkKm > 0 ? Math.round(walkKcal * finalKm / walkKm) : 0;
      const speed = walkMin > 0 ? round2(walkKm / (walkMin / 60)) : 0;

      // Libellé "Titre (sous-titre)" SANS parenthèses imbriquées : le journal de l'app découpe
      // titre/sous-titre sur la dernière paire de parenthèses (renderEntry, regex /^(.*?)\s*\(([^)]+)\)$/)
      // — une parenthèse dans le sous-titre cassait le découpage et tronquait tout sur une ligne.
      // Sous-titre court (.entry-sub est en nowrap) ; le détail du calcul va dans la note (après
      // "||", affichée dans la fiche de l'entrée), derrière le tag qui sert à retrouver l'entrée.
      const tag = `hc:daily-${dateStr}`;
      const note = `${kept.length} séquence${kept.length > 1 ? "s" : ""} de marche, ${walkMin} min, ${fmt(walkKm)} km à ${fmt(speed)} km/h en moyenne − ${fmt(manualKm)} km saisis = ${fmt(finalKm)} km comptés · journée : ${totalSteps} pas, ${fmt(round2(totalMeters / 1000))} km`;
      const desc = `🚶 Marche du jour (${walkSteps} pas en marche · ${fmt(finalKm)} km comptés)||${tag} · ${note}`;

      const { data: existing } = await sb.from("entries").select("id, val, desc")
        .eq("user_id", user_id).ilike("desc", `%${tag}%`).limit(1);
      if (existing?.length && kcal < 10) {
        // Plus rien à compter ce jour-là (pas de vraie marche, ou marches saisies qui couvrent tout) :
        // on retire l'entrée générée plutôt que d'afficher "−0" — elle revient si ça change.
        await sb.from("entries").delete().eq("id", existing[0].id);
        result.push({ dateStr, walkMin, km: finalKm, kcal, action: "removed" });
      } else if (existing?.length) {
        if (existing[0].val !== kcal || existing[0].desc !== desc) await sb.from("entries").update({ val: kcal, desc }).eq("id", existing[0].id);
        result.push({ dateStr, walkMin, km: finalKm, kcal, action: "updated" });
      } else if (kcal >= 10) {
        const { error } = await sb.from("entries").insert({
          user_id, date: dateStr, category: "Sport", type: "burn",
          desc, val: kcal, prot: 0, gluc: 0, lip: 0,
        });
        if (error) throw new Error(error.message);
        result.push({ dateStr, walkMin, km: finalKm, kcal, action: "inserted" });
      } else {
        result.push({ dateStr, walkMin, km: finalKm, kcal, action: "none" });
      }
    }

    return json({ ok: true, stored: rows.length, days: result });
  } catch (e) {
    console.error("hc-webhook error:", e);
    return json({ error: e.message }, 500);
  }
});
