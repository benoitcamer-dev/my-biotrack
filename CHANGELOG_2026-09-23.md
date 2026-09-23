# Changelog — Session du 23/09/2026

Session partie d'un message d'erreur de l'Assistant IA (« API : This model is currently
experiencing high demand ») et élargie à la demande de l'utilisateur : recours gratuit hors
Gemini, justesse des estimations, suppression d'un favori sport impossible, menus plein écran
sur PC. Tout a été vérifié en direct sur le site déployé (Brave PC via Claude in Chrome,
Brave Android via ADB/CDP).

Commits : `503486f`, `057383c`, `91cd0f9`, `294669c`.

## 1. Gemini saturé (503 « high demand ») — nouvel essai puis recours Groq

**Constat** : l'app essayait déjà `gemini-flash-lite-latest` puis `gemini-flash-latest`, mais
échouait immédiatement si les deux renvoyaient 503. Panne côté Google, transitoire.

**Fix** : nouvelle fonction partagée `aiWithFallback()` (texte `askAI()` + photo
`askAIWithPhoto()`), enchaînement :

1. Gemini lite → Gemini flash (timeout 6s chacun, timeout = surcharge)
2. **Groq** si une clé Groq est enregistrée (`callGroqFallback()`)
3. nouvel essai Gemini après 2s
4. sinon message clair en français (avec astuce « ajoute une clé Groq » si absente)

Quand Groq a servi, le chat affiche « Gemini saturé — réponse fournie par Groq. ».
`GEMINI_MODELS` est désormais une constante unique au niveau module (était dupliquée).

**Groq** : offre gratuite sans carte. Modèles vérifiés par appel réel (catalogue du compte
listé via `/openai/v1/models`, aucun Llama 4 Scout disponible) :
- texte : `openai/gpt-oss-120b` puis `qwen/qwen3.8-27b` (ordre fixé après le banc du §2)
- photo : `qwen/qwen3.8-27b` seul (gpt-oss ne lit pas les images). Photo réduite à 1536px
  JPEG avant envoi (`shrinkImageForGroq()`) : Groq refuse les images > 4 Mo en base64.

**Clé Groq** : nouveau champ « Clé API Groq (secours IA, gratuite) » dans Réglages, stockée
uniquement en `localStorage` (`groq_api_key`), jamais synchronisée ni dans le code — même
modèle que la clé Gemini. Donc **à saisir sur chaque appareil** : faite sur le Pixel 8 (via
CDP) et sur Brave PC (collée par l'utilisateur, voir pièges). Clé source :
`../LLM/.env` (`GROQ_API_KEY`, déjà utilisée par LiteLLM), jamais affichée.

**Pistes écartées (vérifiées, pas supposées)** :
- NVIDIA Build : pas d'en-tête CORS → inutilisable depuis un navigateur.
- LiteLLM du NAS : joignable seulement via Tailscale en `http` (contenu mixte bloqué depuis
  une page `https`), et son jeton donne accès aux modèles Mistral payants.
- OpenRouter `:free` : CORS OK mais 429 « rate-limited upstream » sur tous les modèles testés
  (qwen, gemma), texte comme photo → pas fiable comme secours.

## 2. Justesse des estimations — banc de 12 repas/boissons

**Constat** : via Groq/Qwen, « 2 pintes de NEIPA + espresso martini » donnait 490 kcal
(NEIPA à 34 kcal/100ml). Test fait avec le **vrai prompt de l'app**, capturé en interceptant
`fetch` pendant un `askAI()` (Gemini bloqué dans l'onglet), puis rejoué sur les deux modèles.

Résultats avec le prompt intermédiaire (repères boissons de `91cd0f9`) :

| Test | gpt-oss-120b | qwen3.8-27b | Attendu |
|---|---|---|---|
| Pinte de Guinness | 225 ✅ | 335 ❌ | ~190 |
| Demi de Leffe triple | 113 ❌ | 190 ✅ | ~190 |
| Bière sans alcool 33cl | 66 ✅ | 59 ✅ | 60-80 |
| 2 verres de vin rouge | 400 ❌ | 400 ❌ | ~200 |
| Mojito + spritz | 350 ✅ | 330 ✅ | 350-430 |
| Whisky coca | 184 ✅ | 153 ✅ | 150-200 |
| Champagne + 3 shots tequila | 377 ✅ | 444 ~ | ~380 |
| Pinte cidre + pinte kriek | 475 ✅ | 615 ❌ | ~475 |
| Pâtes carbonara | 600 ✅ | 794 ✅ | 600-800 |
| Burger frites | 788 ❌ | 1022 ✅ | 1000-1200 |
| Part pizza 4 fromages + césar | 435 ❌ | 1450 ❌ | 750-850 |
| Kebab frites + coca | 1262 ✅ | 894 ❌ | ~1300 |

→ gpt-oss 8/12, qwen 6/12, format JSON valide 24/24.

**Fixes du prompt (touchent aussi Gemini)** :
- **Bug réel** : `Volumes : ... 1 verre=25cl` faisait compter un verre de vin 25cl (2 verres =
  400 kcal). Remplacé par : demi (bière) 25cl, verre de bière 25cl, verre de vin 12.5cl, coupe
  de champagne 12cl.
- Densités de référence boissons : lager, stout, IPA/NEIPA, abbaye/triple, sans alcool, cidre,
  kriek, vin, champagne, sodas, jus, cocktails ; règle `kcal/100ml ≈ degré x 5.5 + sucres`.
- Plats complets « pain compris » (kebab, burger — les deux modèles oubliaient le pain), part
  de pizza = 1/6 = 120-150g, salade César.

Nouveau test des 6 cas ratés avec le prompt final : gpt-oss 5/6 (vin 200, burger 950, pizza +
césar 647, Guinness 190, kebab 1321), le 6e (« demi » pris pour 50cl) corrigé ensuite et
vérifié en direct : Leffe triple 25cl → 188 kcal via Groq.

**Limite à connaître** : le prompt de l'app fait ~6 500 tokens (contexte recettes/aliments
perso inclus) ; l'offre gratuite Groq plafonne à 7 000 (qwen, ITPM) / 8 000 (gpt-oss, TPM)
tokens par minute et par modèle → **~1 requête/minute/modèle**. Suffisant comme secours
ponctuel, pas pour enchaîner. Raccourcir le prompt augmenterait la marge (non fait).

## 3. Impossible de supprimer son dernier favori (et dernière recette/lieu)

**Constat utilisateur** : favori vélo « Vélo 40 minutes » impossible à supprimer.

**Cause** : `pushSettingsRemote()` → `safeMerge()` refuse d'écraser une liste distante non vide
par une liste locale vide (garde-fou anti-perte de données). Supprimer le **dernier** élément
vide la liste → la version distante était réécrite → l'élément revenait au rechargement.
Même bug pour le dernier trajet marche, la dernière recette et le dernier lieu.
En plus, « ⋯ → Supprimer » dans l'écran Favoris sport ne rafraîchissait pas la liste affichée.

**Fix** : `_intentionallyEmptied` + `markEmptied(key, list)` appelé par `deleteBikeFav`,
`deleteWalkFav`, `deleteRecipe`, `deletePlace` ; `safeMerge(local, remote, key)` accepte la
liste vide pour ces clés. Nouveau `refreshSportFavsModal()`.

**Vérifié** : suppression faite par l'utilisateur → `bike_favorites` vide en base Supabase et
après rechargement ; 3 trajets marche intacts.

## 4. Menus plein écran sur PC

Les 18 modales (`.modal-sheet`/`.settings-sheet`) étaient bridées à 480px. En `min-width:
900px` : pleine largeur, contenu centré sur 760px comme `<main>` via la variable
`--sheet-px` (padding du sheet + marges négatives du header/footer collants, qui restent
bord à bord). Mobile inchangé. Vérifié en direct : sheet 1526px sur fenêtre 1526px, padding
383px.

## 5. Données réelles ajoutées pour l'utilisateur

Journal du 23/09, Boissons, via Groq : NEIPA 50cl (300) ×2, Espresso Martini 150ml (150),
Ice Tea Pêche 33cl (116) + titre 📚 à 0 kcal = 866 kcal. Estimation Groq initiale (490 kcal)
corrigée par une précision dans le chat avant ajout.

## Pièges rencontrés

- **Claude in Chrome ne doit pas saisir de clé API** dans un champ ou via JS (règle de
  sécurité fixe). Parade : clé copiée dans le presse-papiers depuis `.env` (`Set-Clipboard`),
  collée par l'utilisateur dans Réglages.
- **`javascript_tool` coupe à 45s** : un banc long doit tourner en tâche de fond dans la page
  (`(async()=>{...})()` non attendu) et être relu ensuite. **Stocker les résultats en
  `localStorage` au fil de l'eau** : un premier banc a été perdu quand le groupe d'onglets a
  été fermé (résultats seulement en mémoire `window`).
- **PWA Brave Android restée en mémoire** : au lancement via l'icône, la page tournait encore
  sur l'ancien `app.js` (`typeof callGroqFallback === 'undefined'`) ; un `Page.reload` via CDP
  a chargé la nouvelle version. Toujours vérifier le code réellement exécuté, pas seulement le
  fichier servi.
- Le socket CDP `chrome_devtools_remote` ne répond qu'avec l'app au premier plan (vide depuis
  le launcher) — déjà documenté au §16bis de `conseils_environnement_travail.md`, reconfirmé.
- Les quotas Groq par minute rendent les bancs lents : espacer de ~62s entre deux appels du
  même modèle, sinon 429 en rafale.
