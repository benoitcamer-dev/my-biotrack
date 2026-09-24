# Changelog — Session du 24/09/2026

Session partie d'une estimation absurde de l'Assistant IA (repas à 2309 kcal), puis d'un
message « serveurs Gemini saturés » persistant depuis la veille. Diagnostic et vérifications
faits en direct sur le téléphone (Brave Android, PWA, via ADB/CDP) et sur le PC (Chrome via
Claude in Chrome).

Commits : `d762a64`, `9a106fc`, `c4191da`, `a2833c1`.

Revient en grande partie sur la session du 23/09 (`CHANGELOG_2026-09-23.md` §1) : le recours
Groq ajouté ce jour-là est supprimé, et la cause réelle du « Gemini saturé » est corrigée.

## 1. Estimation absurde via Groq / gpt-oss-120b — Groq supprimé

**Constat** (écran du téléphone, via ADB/CDP) : saisie « Ramen chinois, 3 toutes petites
pièces de poulet frit, 1 gyozas poulet. 33cl de tsintao. Un éclair au praliné pistache ».
Gemini en 503 → réponse fournie par Groq (message affiché dans le chat). Aucun échec Groq
dans la console → c'est `openai/gpt-oss-120b` (premier modèle Groq) qui a répondu :
- Tsingtao 330 ml à **220 kcal/100 ml → 726 kcal** (réalité : ~43 kcal/100 ml, ~142 kcal)
- ramen à 250 kcal/100 g dans les champs alors que son propre texte disait 87,5
- total annoncé dans son message : 1529 kcal ; total réel de ses lignes : 2306 kcal

**Fix** :
1. `d762a64` — gpt-oss-120b retiré (qwen seul).
2. `9a106fc` — à la demande de l'utilisateur, **Groq entièrement supprimé** :
   `callGroqFallback()`, `shrinkImageForGroq()`, champ « Clé API Groq » des Réglages
   (`index.html`), message « réponse fournie par Groq ». La clé `groq_api_key` encore
   stockée dans le navigateur est purgée au chargement (`localStorage.removeItem`).
   `aiWithFallback(callModel)` ne prend plus `contents`.

Vérifié sur le téléphone : `typeof callGroqFallback === 'undefined'`, champ `s-groq`
absent, `groq_api_key` à `null`, clé Gemini conservée.

La clé Groq de `../LLM/.env` (LiteLLM) n'a pas été touchée.

## 2. « Serveurs Gemini saturés » en boucle — vraie cause : réflexion trop longue

**Constat** : message d'erreur systématique depuis la veille. La console montrait bien des
503, mais un test direct depuis le téléphone avec la vraie clé (44 modèles listés) a donné :

| Modèle | Résultat (question courte) |
|---|---|
| `gemini-flash-latest` | 503 high demand |
| `gemini-flash-lite-latest` (→ `gemini-3.5-flash-lite`) | 200 en **54 s** |
| `gemini-2.5-flash` | 200 en 0,8 s |
| `gemini-2.5-flash-lite` | 200 en 0,7 s |
| `gemini-3.6-flash` | 200 en 7 s (puis 503 plus tard) |
| `gemini-3.7-flash`, `3.8-flash`, `3.1-flash-lite` | 503 |
| `gemini-omni-*` | 429 quota |

Premier fix (`c4191da`) : versions fixes `3.6-flash` puis `2.5-flash`, timeout 6 s → 12 s,
429/404 traités comme surcharge. **Insuffisant** : avec la vraie requête de l'app, tous les
appels dépassaient encore 12 s.

Requête réelle capturée sur le téléphone puis rejouée sans timeout :
- prompt ≈ **6 250 tokens** (message système de ~13 000 caractères)
- `gemini-2.5-flash` par défaut : **16,4 s**, dont **3 387 tokens de réflexion** (thinking)
- `gemini-2.5-flash` avec `thinkingBudget: 0` : **2,2 s**, estimation correcte
  (Tsingtao 33 cl → 142 kcal)

**Cause** : un timeout est classé `isOverload` → message « saturé » trompeur. Les alias
`-latest` avaient glissé vers des modèles 3.x récents, plus lents et saturés, d'où la panne
soudaine sans changement de code.

**Fix** (`a2833c1`) :
- `GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite']` (versions fixes, plus
  d'alias `-latest`)
- `GEMINI_GEN_CONFIG = { thinkingConfig: { thinkingBudget: 0 } }` envoyé par `askAI()` et
  `askAIWithPhoto()`
- timeout 12 s ; 503/529/429/404 font passer au modèle suivant

⚠️ `thinkingBudget` est propre à la famille 2.5. Les modèles 3.x utilisent `thinkingLevel` :
ne pas ajouter un modèle 3.x à `GEMINI_MODELS` sans adapter la config.

**Vérifié en direct avec le message de l'utilisateur** (rien ajouté au journal) :

| Où | Durée | Tsingtao | Total |
|---|---|---|---|
| PC, Chrome (Claude in Chrome) | 2,0 s | 142 kcal | 1422 kcal |
| Téléphone, Brave PWA (ADB/CDP) | 2,8 s | 142 kcal | 1662 kcal |

L'écart de total vient des portions supposées (ramen, éclair), pas d'une erreur de calcul.

## 3. Piège de vérification live rencontré

Après le déploiement de `a2833c1`, le téléphone a continué d'exécuter l'ancien `app.js`
pendant plusieurs rechargements (`location.reload()`), alors que `fetch('app.js')` depuis
la page — via le service worker comme en `no-store` — renvoyait déjà la nouvelle version.
Resource Timing : le `app.js` chargé par la balise `<script>` avait `workerStart: 0` et
`deliveryType: "cache"` → servi depuis le cache HTTP du navigateur **sans passer par le
service worker**. Résolu seul une fois la fenêtre `max-age=600` de GitHub Pages écoulée.

**Réflexe** : avant de tester un changement sur le téléphone, vérifier qu'une variable du
nouveau code est bien présente (ex. `typeof GEMINI_GEN_CONFIG`), sinon attendre ~10 min.
