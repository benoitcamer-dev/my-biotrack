# PROJECT_BRIEF.md

À lire en premier à chaque nouvelle session sur ce repo (voir `CLAUDE.md`). Pour le détail visuel/produit, voir `DESIGN.md` et `PRODUCT.md`.

## Qu'est-ce que c'est

**LeGrosBarbu** — un journal quotidien de nutrition, poids et sport. Application personnelle (un seul utilisateur réel : Benoit), positionnée comme alternative gratuite et sans pub à MyFitnessPal/Yazio : base d'aliments auto-curatée, estimation par photo IA (Gemini, clé perso), pas de multi-tenant à concevoir.

Détail produit complet → `PRODUCT.md`. Système visuel (thème, typographie, tokens) → `DESIGN.md`.

## Stack technique

- **Aucun build, pas de `package.json`.** HTML/CSS/JS servis tels quels.
- Frontend : `index.html` + `app.js` + `styles.css` (fichiers séparés), plus `index-complet.html` qui est un **bundle des trois en un seul fichier** — voir "Point critique" ci-dessous.
- Backend : **Supabase** (auth + Postgres). Tables par utilisateur : `entries`, `custom_foods`, `favorites`, `weight_entries`, etc. URL/clé anon Supabase codées en dur en tête de `app.js`.
- Intégrations optionnelles à clé API fournie par l'utilisateur (stockée en `localStorage`, chargée conditionnellement au boot) :
  - Gemini (estimation nutritionnelle par photo)
  - Google Maps/Places (recherche d'adresse pour l'onglet "Lieux")
  - Google Fit / Google Calendar (sync sport, OAuth via une Edge Function Supabase)
  - OpenRouteService (`ORS_KEY`, calcul d'itinéraires pour le mode marche/vélo)
- Icônes : Lucide (chargé en CDN, rendu par un `MutationObserver` sur `[data-lucide]` car la majorité du contenu est injectée en `innerHTML`).
- PWA : `manifest.json` + `sw.js` (service worker, cache `bt-v5`). **Network-first + fallback cache sur tout le même-origine** (HTML, `app.js`, `styles.css` compris — pas seulement le HTML, corrigé le 16/08/2026 : `app.js`/`styles.css` étaient avant en cache-first sans jamais être revalidés, un déploiement pouvait rester invisible indéfiniment même après un reload normal). Une bannière "Nouvelle version disponible" (`showUpdateBanner()` dans `app.js`) se déclenche via l'événement `controllerchange` si l'onglet reste ouvert après un déploiement. Malgré ça, un hard reload naïf reste la vérification la plus fiable en session de dev (voir règle de vérification live dans `CLAUDE.md`).

## Structure de l'app (UI)

- Navigation basse (`bottom-nav`) : Aliments, Recettes, Lieux, Sports, Poids, Réglages.
- Écran principal : "Journal" (saisie du jour) + "Bilan" (tendances : calories objectif vs réel, progression protéines).
- Ajout d'entrée via un FAB (bouton flottant) → modale avec catégories Petit-déjeuner / Déjeuner / Dîner / Snack / Boissons / Sport, chacune avec sa couleur et son icône (voir map `ICONS` dans `app.js`).
- Thème sombre par défaut, thème clair disponible (`toggleTheme()`, attribut `data-theme` sur `<html>`, tokens CSS dans `:root` / `[data-theme="light"]` de `styles.css`).
- Français uniquement, mobile-first (PWA installable), pas d'i18n prévue.
- "Mes lieux" : un lieu peut être marqué **Domicile** (checkbox unique, un seul à la fois) — pré-remplit automatiquement le champ Départ à l'ouverture de l'onglet Itinéraire (marche), sans jamais écraser une saisie déjà en cours (`prefillHomeDeparture()`).
- Cible tactile 44px min : classes utilitaires `.tap-target`/`.tap-target-block` (styles.css) à ajouter — pas remplacer — sur un bouton dont le padding ne suffit pas, plutôt que de recalculer un padding par composant à chaque fois.

## Déploiement

Site statique, **GitHub Pages** → https://benoitcamer-dev.github.io/my-biotrack/. Un `git push` sur la branche déployée suffit à publier ; pas de pipeline CI/CD custom à surveiller. Voir `CLAUDE.md` pour la procédure de vérification post-déploiement (obligatoire pour tout changement visuel/fonctionnel).

## ⚠️ Point critique : `index-complet.html` vs fichiers séparés

`index-complet.html` est la **source de vérité** (fichier unique bundlant HTML+JS+CSS). `index.html`/`app.js`/`styles.css` sont les fichiers de travail séparés, plus faciles à éditer/diff. **Toute modification faite d'un côté doit être reportée manuellement de l'autre** — il n'y a pas d'outil de build qui les régénère l'un depuis l'autre. Voir `CLAUDE.md` pour les vérifications obligatoires avant commit (équilibrage des balises, syntaxe JS valide des deux côtés).

## Repères utiles

- Pas de framework de test (ajouter une dépendance npm irait à l'encontre du choix "sans build"), mais **`node verify.js`** (racine du repo) formalise en une commande les vérifications pré-commit habituelles : syntaxe JS, équilibrage `<div>`/`<button>` HTML, équilibrage `{ }` CSS, synchronisation byte-exacte d'`index-complet.html` avec les 3 fichiers séparés, classes CSS orphelines. Pas de linter configuré non plus à ce jour.
- **⚠️ Marqueurs de données en emoji dans les descriptions d'entrées — ne jamais convertir en icône ni supprimer.** `📚` (lié à une recette), `🚶` (marche) et `🚴` (vélo) préfixent le texte de `entry.desc` et sont relus par du code de classification à plusieurs endroits d'`app.js` (`.includes('🚶')`, `.replace('🚴','')`, etc.), y compris pour les titres d'événements Google Agenda. Casser un de ces préfixes casse la classification des entrées déjà enregistrées. Avant de toucher un emoji décoratif quel qu'il soit, vérifier par `grep` qu'il n'est pas aussi utilisé comme marqueur (`includes`/`replace`/`startsWith` dessus dans `app.js`).
- `.impeccable/` contient l'état du skill Impeccable (audits design, ignores) — ne pas modifier à la main, passer par `hook-admin.mjs`.
- Secrets/clés utilisateur (Gemini, Google Maps, Google Client ID) : jamais codés en dur, toujours lus depuis `localStorage` et saisis par l'utilisateur dans Réglages.
