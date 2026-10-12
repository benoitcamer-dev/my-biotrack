import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Pas/distance Health Connect, deux usages (verify_jwt = false, l'authentification est faite ici) :
//
// 1. SYNCHRO DU TÉLÉPHONE — app Android "HC Webhook" (POST JSON, en-tête x-api-key, dont l'empreinte
//    SHA-256 est comparée à hc_webhook_keys.api_key_hash ; la clé n'existe que dans l'app du tél).
//    Résolution "Complet" pour Pas et Distance : un enregistrement par intervalle brut (≈ 1 min) :
//      { "steps": [{ "count", "start_time", "end_time" }], "distance": [{ "meters", "start_time", "end_time" }] }
//    Synchro incrémentale : tout est stocké dans hc_samples, totaux du jour dans hc_daily.
//    AUCUNE entrée de journal n'est créée automatiquement (v9, choix de l'utilisateur le 12/10/2026 :
//    il saisit ses marches à la main).
//
// 2. MARCHE AUTO À LA DEMANDE (v10) — bouton « Marche auto » de l'app (POST, Authorization: Bearer
//    <JWT de session>, body { date, speed, commit }). Aperçu du jour choisi ; avec commit = true,
//    crée ou met à jour l'entrée « 🚶 Marche auto » de ce jour (tag hc:auto-AAAA-MM-JJ).
//
// Calcul (choix de l'utilisateur le 12/10/2026) : seules les VRAIES marches comptent, pas les pas
// dispersés à la maison. Les pas sont répartis minute par minute ; une minute est « en marche » si
// elle compte au moins MIN_CADENCE pas ; une séquence = minutes en marche consécutives (trous de
// MAX_GAP_MIN minutes tolérés : feu rouge, porte…), gardée si elle dure au moins MIN_BOUT_MIN minutes.
// - Durée = minutes en marche (fiable, capteurs). Distance = durée × vitesse CHOISIE par l'utilisateur
//   (la distance Google Fit, estimée pas × foulée ≈ 0,65 m, paraît trop courte — affichée pour info).
// - Les km des marches saisies à la main ce jour-là sont retirés (évite le double comptage).
// - Coût NET (repos exclu, déjà compté dans le BMR) = (MET(vitesse) − 1) × poids × durée, même courbe
//   MET que l'app (WALK_MET_POINTS dans app.js, Compendium 2011).
const TZ = "Europe/Paris";
const MIN_CADENCE = 60;
const MIN_BOUT_MIN = 5;
const MAX_GAP_MIN = 1;
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
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-api-key, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const parisFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
const parisDate = (t: string | number | Date) => parisFmt.format(new Date(t));
const fmt = (n: number) => String(n).replace(".", ",");
const round2 = (n: number) => Math.round(n * 100) / 100;

// Distance (km) des marches saisies à la main ce jour-là (hors entrées générées) — à retirer.
async function manualWalkKm(sb: any, user_id: string, dateStr: string): Promise<number> {
  const { data } = await sb.from("entries").select("desc")
    .eq("user_id", user_id).eq("date", dateStr).eq("category", "Sport")
    .not("desc", "ilike", "%gfit:%").not("desc", "ilike", "%hc:daily-%").not("desc", "ilike", "%hc:auto-%");
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

// Intervalles stockés couvrant [fromIso, toIso[ (pagination : PostgREST plafonne à 1000 lignes).
async function loadSamples(sb: any, user_id: string, fromIso: string, toIso: string) {
  const samples: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("hc_samples").select("kind, start_time, end_time, value")
      .eq("user_id", user_id).gte("end_time", fromIso).lt("start_time", toIso)
      .order("start_time").range(from, from + 999);
    if (error) throw new Error(error.message);
    samples.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return samples;
}

// Minutes (clé = minute UTC) d'un jour de Paris donné, triées : chaque intervalle est réparti sur les
// minutes qu'il couvre, au prorata du temps.
function minutesOfDay(samples: any[], dateStr: string) {
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
  return [...mins].filter(([m]) => parisDate(m) === dateStr).sort((x, y) => x[0] - y[0]);
}

async function handlePhoneSync(sb: any, req: Request, key: string) {
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key))))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  const { data: keyRow } = await sb.from("hc_webhook_keys").select("user_id").eq("api_key_hash", hash).maybeSingle();
  if (!keyRow) return json({ error: "unauthorized" }, 401);
  const user_id = keyRow.user_id;

  // Un intervalle modifié par Health Connect écrase l'ancien (clé = user, type, début, fin).
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

  // Totaux des jours touchés (information), recalculés depuis la table.
  const days = [...new Set<string>(rows.map(r => parisDate(r.start_time)))].sort();
  const result = [];
  for (const dateStr of days) {
    const t0 = Date.parse(dateStr + "T00:00:00Z");
    const samples = await loadSamples(sb, user_id, new Date(t0 - 86400000).toISOString(), new Date(t0 + 2 * 86400000).toISOString());
    const minutes = minutesOfDay(samples, dateStr);
    const steps = Math.round(minutes.reduce((s, [, v]) => s + v.steps, 0));
    const meters = Math.round(minutes.reduce((s, [, v]) => s + v.meters, 0));
    await sb.from("hc_daily").upsert({ user_id, date: dateStr, steps, meters, updated_at: now });
    result.push({ dateStr, steps, meters });
  }
  return json({ ok: true, stored: rows.length, days: result });
}

async function handleAutoWalk(sb: any, req: Request, jwt: string) {
  const { data: { user } } = await sb.auth.getUser(jwt);
  if (!user) return json({ error: "unauthorized" }, 401);
  const user_id = user.id;
  const body = await req.json();
  const dateStr = String(body.date || "");
  const speed = Number(body.speed);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return json({ error: "date invalide" }, 400);
  if (!(speed >= 2 && speed <= 9)) return json({ error: "vitesse invalide (2 à 9 km/h)" }, 400);

  const t0 = Date.parse(dateStr + "T00:00:00Z");
  const samples = await loadSamples(sb, user_id, new Date(t0 - 86400000).toISOString(), new Date(t0 + 2 * 86400000).toISOString());
  const minutes = minutesOfDay(samples, dateStr);
  const totalSteps = Math.round(minutes.reduce((s, [, v]) => s + v.steps, 0));

  // Séquences de marche.
  const bouts: { min: number; steps: number; meters: number }[] = [];
  let cur: { min: number; steps: number; meters: number } | null = null, lastActive = -Infinity;
  for (const [m, v] of minutes) {
    if (v.steps < MIN_CADENCE) continue;
    if (!cur || m - lastActive > (MAX_GAP_MIN + 1) * 60000) { cur = { min: 0, steps: 0, meters: 0 }; bouts.push(cur); }
    cur.min++; cur.steps += v.steps; cur.meters += v.meters;
    lastActive = m;
  }
  const kept = bouts.filter(b => b.min >= MIN_BOUT_MIN);
  const walkMin = kept.reduce((s, b) => s + b.min, 0);
  const walkSteps = Math.round(kept.reduce((s, b) => s + b.steps, 0));
  const fitKm = round2(kept.reduce((s, b) => s + b.meters, 0) / 1000);
  const fitSpeed = walkMin > 0 ? round2(fitKm / (walkMin / 60)) : 0;

  const km = round2(speed * walkMin / 60);
  const manualKm = round2(await manualWalkKm(sb, user_id, dateStr));
  const finalKm = Math.max(0, round2(km - manualKm));
  const finalMin = Math.round(finalKm / speed * 60);
  const weight = await currentWeight(sb, user_id);
  const kcal = Math.round((metWalk(speed) - 1) * weight * finalKm / speed);

  const { data: last } = await sb.from("hc_samples").select("updated_at")
    .eq("user_id", user_id).order("updated_at", { ascending: false }).limit(1);
  const tag = `hc:auto-${dateStr}`;
  const { data: existing } = await sb.from("entries").select("id")
    .eq("user_id", user_id).ilike("desc", `%${tag}%`).limit(1);
  const preview = {
    date: dateStr, bouts: kept.length, walkMin, walkSteps, totalSteps, fitKm, fitSpeed, speed, km,
    manualKm, finalKm, finalMin, kcal, weight, lastSync: last?.[0]?.updated_at || null,
    existing: !!existing?.length,
  };
  if (!body.commit) return json({ ok: true, ...preview });
  if (kcal < 1) return json({ error: "rien à ajouter ce jour-là" }, 400);

  // Libellé "Titre (sous-titre)" SANS parenthèses imbriquées : le journal découpe titre/sous-titre sur
  // la dernière paire de parenthèses (renderEntry) ; sous-titre court (.entry-sub en nowrap). Détail du
  // calcul dans la note (après "||", affichée dans la fiche de l'entrée), derrière le tag.
  const note = `${kept.length} séquence${kept.length > 1 ? "s" : ""} de marche détectée${kept.length > 1 ? "s" : ""}, ${walkMin} min (Fit : ${fmt(fitKm)} km, ${fmt(fitSpeed)} km/h) · à ${fmt(speed)} km/h : ${fmt(km)} km − ${fmt(manualKm)} km saisis = ${fmt(finalKm)} km`;
  const desc = `🚶 Marche auto (${finalMin} min · ${fmt(finalKm)} km · ${fmt(speed)} km/h)||${tag} · ${note}`;
  if (existing?.length) {
    const { error } = await sb.from("entries").update({ val: kcal, desc }).eq("id", existing[0].id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb.from("entries").insert({
      user_id, date: dateStr, category: "Sport", type: "burn", desc, val: kcal, prot: 0, gluc: 0, lip: 0,
    });
    if (error) throw new Error(error.message);
  }
  return json({ ok: true, saved: true, ...preview });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const key = req.headers.get("x-api-key") || "";
    if (key) return key.length < 32 ? json({ error: "unauthorized" }, 401) : await handlePhoneSync(sb, req, key);
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (jwt) return await handleAutoWalk(sb, req, jwt);
    return json({ error: "unauthorized" }, 401);
  } catch (e) {
    console.error("hc-webhook error:", e);
    return json({ error: e.message }, 500);
  }
});
