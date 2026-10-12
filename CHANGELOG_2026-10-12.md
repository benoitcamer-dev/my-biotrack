# Changelog — Session du 12/10/2026

Demande de l'utilisateur : vérifier le calcul des calories de la marche (saisie simple et
sync Google Fit) en fonction de la vitesse. A débouché sur le remplacement de la sync
Google Fit par Health Connect.

Commits : `996b031`, `b0a14a5`, `db8fa5e`, `9d6c23e`, `e51581d`.

## 1. Calories marche : paliers MET remplacés par une interpolation (`b0a14a5`)

`getMETWalk()` utilisait des paliers fixes : saut de +16 % entre 6,5 et 6,6 km/h, et marche
rapide sous-estimée (−29 % à 7,2 km/h par rapport au Compendium Ainsworth 2011 qu'il citait).
Désormais : interpolation linéaire entre les points du Compendium (`WALK_MET_POINTS`,
2,4 → 8 km/h, bornée aux extrémités). Ex. 75 kg : 6 km/h = 349 kcal/h (avant 322), 7 km/h =
487 (avant 375). Les entrées déjà enregistrées ne sont pas recalculées.

Même commit : vitesse par défaut unifiée à 6 km/h quand `#in-speed` est vide (le calcul kcal
prenait 6, la description enregistrée affichait 5).

## 2. Sync Google Fit : dernier poids pesé (`996b031`)

L'app envoyait `userWeight` (poids du profil) à `gfit-sync` au lieu de `getCurrentWeight()`.

## 3. Edge Function `gfit-sync` (v13, `db8fa5e`)

Constat : ne tient pas compte de la vitesse (`kcal = poids × km du jour × 0,83`, Fit ne
fournit que des totaux journaliers). Corrigé : jours calendaires Europe/Paris (avant :
tranches de 24 h démarrant à l'heure de la sync, datées en UTC) et déduction des km des
marches saisies à la main ce jour-là (double comptage). Source désormais versionnée dans
`supabase/functions/gfit-sync/`.

**Mais la sync Fit ne fonctionne plus** : dernière importation le 05/05/2026, appels en
erreur 400 (scopes Fit retirés le 31/08), et l'API Google Fit est dépréciée par Google
(arrêt annoncé courant 2026, sans date précise). Le bouton "📲 Google Fit" est toujours
présent dans l'app — à retirer.

## 4. Remplacement : Health Connect → app Android « HC Webhook » → Edge Function `hc-webhook`

- App **HC Webhook** (open source, github.com/mcnaveen/health-connect-webhook, v1.9.22
  installée depuis les releases GitHub) sur le Pixel 8 : types **Pas** + **Distance** en
  résolution **Quotidien**, synchro **toutes les 60 min**, autorisation Health Connect en
  arrière-plan accordée, app exclue de l'optimisation batterie.
- Edge Function **`hc-webhook`** (`supabase/functions/hc-webhook/`, `verify_jwt = false`) :
  authentification par en-tête `x-api-key`, dont l'**empreinte SHA-256** est comparée à
  `hc_webhook_keys.api_key_hash`. La clé elle-même n'est stockée nulle part côté serveur ni
  dans le repo — elle n'existe que dans la config de l'app sur le téléphone. Pour la
  changer : générer une nouvelle clé, mettre à jour `api_key_hash`, la ressaisir dans l'app
  (Webhooks → crayon → Gérer les en-têtes).
- Tables créées : `hc_webhook_keys` (user_id, api_key_hash) et `hc_daily` (user_id, date,
  steps, meters — on garde le **max** reçu par jour, car le jour le plus ancien de la
  fenêtre glissante de 48 h n'est envoyé que partiellement). RLS activée sans policy
  (accès service role uniquement).
- Entrée créée/mise à jour par jour : `🚶 Marche (Health Connect, X km hors marches saisies
  (Y km au total), N pas)||hc:daily-YYYY-MM-DD`, kcal = dernier poids pesé × km × 0,83,
  km des marches saisies à la main déduits.
- Vérifié : première synchro manuelle à 17:29 → HTTP 200, entrées créées pour le 11/10
  (108 kcal) et le 12/10 (228 kcal).

⚠️ Ne pas utiliser le bouton « Tester le Webhook » de l'app : il envoie des données
fictives qui créeraient une fausse entrée de marche dans le journal.

## 5. Suite de session

- Bouton et code de sync Google Fit retirés de l'app (`4ba843a`, 95 lignes d'`app.js` +
  2 boutons d'`index.html`). La classe `.tap-target-block` n'est plus utilisée nulle part
  (signalée par `verify.js`), conservée car utilitaire.
- `hc-webhook` v3 (`c195a2f`) : recalcule aussi les 7 derniers jours connus de `hc_daily` à
  chaque synchro. HC Webhook n'envoie plus un jour passé après sa dernière synchro, donc une
  marche saisie à la main après coup pour ce jour n'aurait jamais été déduite.

## Reste à faire

- Supprimer les Edge Functions `gfit-sync`/`gfit-callback` et les tables `google_tokens`/
  `gfit_imported` (plus appelées par l'app).
- `gfit-sync` reste appelable par n'importe qui connaissant un `user_id` (`verify_jwt = false`,
  pas d'authentification) — sans effet tant que la sync Fit est cassée, mais à supprimer.
