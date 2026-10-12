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

- Vitesse côté Health Connect : étudiée puis écartée. Google Fit n'écrit aucune séance
  « Exercice » dans Health Connect sur le Pixel (seulement Pas, Distance, Calories actives —
  vérifié le 12/10), donc pas de durée/vitesse par marche. Alternative possible (pas/distance en
  résolution 1 min → vitesse minute par minute) proposée, **refusée par l'utilisateur** : on garde
  le calcul fixe `poids × km × 0,83` (≈ marche à 6,5 km/h).

- `hc-webhook` v4 (`af4c017`) : libellé « 🚶 Marche du jour (N pas · X km comptés sur Y) » sans
  parenthèses imbriquées (le journal découpe titre/sous-titre sur les parenthèses, l'ancien libellé
  s'affichait tronqué sur une ligne). Détail du calcul dans la note (après `||`, derrière le tag).
- `hc-webhook` v5 (`d6afd26`), validé par l'utilisateur : ne compte plus que l'activité en plus d'une
  journée sédentaire — le « Métabolisme » de l'app vaut déjà BMR × 1,2. Coût **net** de la marche
  0,54 kcal/kg/km (au lieu de 0,83 brut) et **3 500 premiers pas** du jour déduits (convertis en km
  avec la foulée du jour). Entrée supprimée si < 10 kcal. Effet au 12/10 : 228 → 41 kcal ; entrée
  du 11/10 retirée (marches saisies + base couvrent tout). Constantes `BASELINE_STEPS` /
  `NET_KCAL_PER_KG_KM` en tête de `supabase/functions/hc-webhook/index.ts`.
- Tables `google_tokens` et `gfit_imported` supprimées (autorisation de l'utilisateur).

- `hc-webhook` v6 : allure de référence **5,5 km/h** (allure habituelle donnée par l'utilisateur),
  coût net calculé avec la même courbe MET que l'app → 0,58 kcal/kg/km. 12/10 : 41 → 44 kcal.
  Option « vitesse réelle minute par minute » (résolution 1 min dans HC Webhook) gardée en réserve.

- `hc-webhook` v7 : **base sédentaire de 3 500 pas retirée** (demande de l'utilisateur) — tous les
  pas du jour comptent, seules les marches saisies à la main sont déduites. Semaine recalculée par
  une synchro « 7 derniers jours » : 06/10 57 kcal, 07/10 38, 08/10 69, 11/10 76, 12/10 44 → 160 ;
  09 et 10/10 sans entrée (marches saisies 17 et 15 km > mesuré), 05/10 ignoré (290 pas).
- `hc-webhook` v8 : **seules les vraies marches comptent** (demande de l'utilisateur). HC Webhook
  passe en résolution **Complet** (intervalles bruts ≈ 1 min) pour Pas et Distance, stockés dans
  la nouvelle table `hc_samples` ; séquences ≥ 5 min à ≥ 60 pas/min (1 min de trou tolérée),
  vitesse réelle par séquence, coût net MET − 1. Semaine recalculée : seule l'entrée du 12/10 reste
  (3 séquences, 45 min, 3,16 km − 1,5 km saisis → 70 kcal) ; les autres jours, les marches saisies
  couvrent les séquences détectées. Vitesses mesurées basses (3,4-4,4 km/h) : distance Fit à
  calibrer.
- `hc-webhook` v9 : **plus aucune entrée créée automatiquement** (`AUTO_ENTRIES = false`, demande
  de l'utilisateur, qui saisit ses marches à la main). Les intervalles restent stockés.
- `hc-webhook` v10 + app : **Marche auto à la demande** — bouton dans l'écran Sport, jour et
  vitesse au choix, aperçu puis ajout (entrée `hc:auto-DATE`). Distance = durée détectée × vitesse
  choisie. CORS ajouté, authentification par JWT de session (en plus de x-api-key pour le téléphone).
- `hc-webhook` v11 + app : la vitesse unique de la v10 surestimait les jours de marche lente
  (11/10 : 19,8 km à 5,5 km/h contre 12,35 km mesurés). Chaque marche garde désormais sa vitesse
  mesurée ; le champ Vitesse devient « Correction distance (%) » ; l'aperçu liste les marches.

## Reste à faire

- `gfit-sync` / `gfit-callback` : neutralisées (410, JWT requis) mais pas supprimées — le MCP
  Supabase ne sait pas supprimer une Edge Function ; à faire depuis le dashboard si souhaité.
