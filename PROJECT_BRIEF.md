# PROJECT_BRIEF.md

À lire en premier à chaque nouvelle session sur ce repo (voir `CLAUDE.md`). Pour le détail visuel/produit, voir `DESIGN.md` et `PRODUCT.md`.

**Avant toute action** : lire aussi les 4 docs de référence transversales (valables pour tous les projets de `IA - Automatisations/`, pas seulement celui-ci — déjà rappelées dans le `CLAUDE.md` racine, reliées ici pour qu'un agent qui n'ouvrirait que ce fichier ne les manque pas) :
- `../Bonne pratiques IA/securite_cles_credentials.md` — sécurité des clés API/credentials.
- `../Bonne pratiques IA/bonnes_pratiques_claude_md.md` — garder un `CLAUDE.md`/`PROJECT_BRIEF.md` sous contrôle (état actuel vs journal daté).
- `../Bonne pratiques IA/boucles_de_verification.md` — découper un objectif en sous-tâches vérifiables, ne jamais déclarer une sous-tâche terminée sans vérification indépendante de l'action elle-même.
- `../Bonne pratiques IA/conseils_environnement_travail.md` — pièges déjà rencontrés sur cet environnement (Windows/PowerShell/Bash, NAS, n8n, OneDrive, encodage...).

## Qu'est-ce que c'est

**LeGrosBarbu** ("my-biotrack") — un journal quotidien de nutrition, poids et sport. Application personnelle (un seul utilisateur réel : Benoit), positionnée comme alternative gratuite et sans pub à MyFitnessPal/Yazio : base d'aliments auto-curatée, estimation par photo IA (Gemini, clé perso), pas de multi-tenant à concevoir. Journal alimentaire par repas, activité physique (marche/vélo avec calcul d'itinéraire), suivi de poids/IMC, bilans sur période, favoris, recettes, lieux enregistrés, scan de code-barres, assistant IA pour l'analyse de repas/photos.

Détail produit complet → `PRODUCT.md`. Système visuel (thème, typographie, tokens) → `DESIGN.md`.

## Stack technique

- **Aucun build, pas de `package.json`.** HTML/CSS/JS servis tels quels.
- Frontend : `index.html` + `app.js` + `styles.css` (fichiers séparés), plus `index-complet.html` qui est un **bundle des trois en un seul fichier** — voir "Point critique" ci-dessous.
- Backend : **Supabase** (`https://zlbwoxsmmdytoucgyhmc.supabase.co`, auth + Postgres). Tables connues : `entries`, `weight_entries`, `sleep_entries`, `custom_foods`, `favorites`, `user_settings`, `google_tokens`, `ciqual_foods`, `ciqual_hidden`. URL/clé anon Supabase codées en dur en tête de `app.js` (normal pour une clé anon Supabase — la vraie barrière d'isolation entre utilisateurs est la policy RLS côté Postgres, pas le secret de la clé).
- Intégrations optionnelles à clé API fournie par l'utilisateur (stockée en `localStorage`, chargée conditionnellement au boot) :
  - Gemini (estimation nutritionnelle par photo)
  - Google Maps/Places (recherche d'adresse pour l'onglet "Lieux")
  - Google Fit / Google Calendar (sync sport, OAuth via une Edge Function Supabase) — **⚠️ scopes Fit
    retirés du projet Google Cloud partagé le 31/08/2026** (non utilisés, voir `CHANGELOG_2026-08-31.md`) :
    la connexion Google Fit ne fonctionnera plus tant que les scopes ne sont pas recréés côté Google Cloud
  - OpenRouteService (`ORS_KEY`, calcul d'itinéraires pour le mode marche/vélo)
- Icônes : Lucide (CDN, rendu par un `MutationObserver` sur `[data-lucide]` car la majorité du contenu est injectée en `innerHTML`). Conversion emoji → Lucide en cours, pas exhaustive (voir "Ce qui reste à faire").
- Google Fonts (Inter).
- PWA : `manifest.json` + `sw.js` (service worker, cache `bt-v5`). **Network-first + fallback cache sur tout le même-origine** (HTML, `app.js`, `styles.css` compris — corrigé le 16/08/2026 : avant, `app.js`/`styles.css` étaient en cache-first sans jamais être revalidés, un déploiement pouvait rester invisible indéfiniment même après un reload normal). Une bannière "Nouvelle version disponible" (`showUpdateBanner()` dans `app.js`) se déclenche via l'événement `controllerchange` si l'onglet reste ouvert après un déploiement. Malgré ça, un hard reload naïf reste la vérification la plus fiable en session de dev (voir règle de vérification live dans `CLAUDE.md`).
- `_headers` et `site.webmanifest` sont des reliquats inutilisés (conventions Cloudflare Pages/Netlify et générateur de favicons) — aucun effet réel, jamais référencés. Netlify a été testé à un moment mais n'est plus utilisé.

## Structure de l'app (UI)

- Navigation basse (`bottom-nav`) : Aliments, Recettes, Lieux, Sports, Poids, Réglages.
- Écran principal : "Journal" (saisie du jour) + "Bilan" (tendances : calories objectif vs réel, progression protéines).
- Ajout d'entrée via un FAB (bouton flottant) → modale avec catégories Petit-déjeuner / Déjeuner / Dîner / Snack / Boissons / Sport, chacune avec sa couleur et son icône (voir map `ICONS` dans `app.js`).
- Thème sombre par défaut, thème clair disponible (`toggleTheme()`, attribut `data-theme` sur `<html>`, tokens CSS dans `:root` / `[data-theme="light"]` de `styles.css`). `data-theme` posé sur `<html>` : tout élément injecté hors de l'arbre applicatif normal (popups tierces ajoutées à `<body>`) hérite quand même du thème via les variables CSS.
- Français uniquement, mobile-first (PWA installable), pas d'i18n prévue.
- "Mes lieux" : un lieu peut être marqué **Domicile** (checkbox unique, un seul à la fois) — pré-remplit automatiquement le champ Départ à l'ouverture de l'onglet Itinéraire (marche), sans jamais écraser une saisie déjà en cours (`prefillHomeDeparture()`).
- Modales en "bottom sheet" : structure `.modal-overlay > .modal-sheet|.settings-sheet > .modal-handle + .modal-title-row + (contenu)`. La plupart des modales utilisent `.settings-sheet`, une seule (`modal-add`) utilise `.modal-sheet` — les deux classes doivent systématiquement être visées ensemble dans tout sélecteur JS (`'.modal-sheet, .settings-sheet'`).
- Swipe-to-close : uniquement amorçable depuis `.modal-handle`/`.modal-title-row`/`.modal-sticky-header` (jamais depuis le corps scrollable, pour ne pas entrer en conflit avec le scroll). Câblé via une map `CLOSE_FNS` (id de modale → fonction de fermeture) parcourue au chargement.
- Réordonnancement tactile (Lieux, favoris sport, étapes d'itinéraire) : Pointer Events (`pointerdown`/`pointermove`/`pointerup` **et `pointercancel`** — les deux doivent toujours être gérés en parallèle, sous peine de capture de pointeur qui reste bloquée et rend des boutons ailleurs sur la page non cliquables). Fonction générique `initTouchReorder(container, arr, onReordered)`.
- Graphiques : SVG générés en JS (poids, bilan calories/net/protéines). Zoom tactile (pincer/glisser/double-tap) via `enableChartZoom(svg)`, horizontal uniquement.
- Classes utilitaires CSS : `.action-btn` (+ `.action-cyan/purple/red/green/amber/grey`), `.icon-btn`, `.form-input`, `.form-field-label`, `.flex-center-gap8`, `.eyebrow-label(-block)`. Appliquées seulement là où le code a été retouché — le reste du fichier a encore beaucoup de styles inline non consolidés.
- Cible tactile 44px min : classes utilitaires `.tap-target`/`.tap-target-block` (styles.css) à ajouter — pas remplacer — sur un bouton dont le padding ne suffit pas, plutôt que de recalculer un padding par composant à chaque fois. Pas encore appliqué partout (`.entry-action` à 36px, `.food-btn` à 40px identifiés comme sous le seuil — audit du 22/08/2026).
- Helpers notables : `emptyStateHTML(icon, texte)` (états vides), `animateNumber(el, valeur)` (compteur animé), `esc()` (échappement pour insertion dans une chaîne JS d'attribut `onclick`), `escHtml()` (échappement HTML classique pour du texte inséré en contenu — ajouté le 22/08/2026, à généraliser à tout texte libre utilisateur affiché via `innerHTML`, seuls le nom d'entrée du journal et le titre de la fiche détail sont couverts pour l'instant).
- **Champs d'adresse (Google Places Autocomplete)** : tout `<input>` destiné à une adresse doit avoir `autocomplete="off"`, sinon l'autofill natif du navigateur se superpose visuellement au dropdown Google Places (`.pac-container`). Le dropdown est injecté par Google directement dans `<body>`, hors du scoping CSS habituel — règles dédiées déjà en place dans `styles.css` (`.pac-container`, `.pac-item`, `.pac-icon`, `.pac-logo`) pour hériter du thème sombre.
- **Itinéraire multi-étapes** : supporté nativement jusqu'à **6 étapes** (`addWalkStep()`, `walk-steps-container`/`.walk-step-input`, plafond codé en dur). Réordonnançable (voir Pointer Events ci-dessus).
- **Layout desktop** : `main { max-width: 480px }` par défaut (mobile-first). `@media (min-width: 900px)` élargit `main` à 760px et passe `.stats-grid` en 4 colonnes. Reste minimal — le reste du contenu profite de la largeur en plus sans réagencement dédié.

## Déploiement

Site statique, **GitHub Pages** → https://benoitcamer-dev.github.io/my-biotrack/. Un `git push` sur `main` suffit à publier ; pas de pipeline CI/CD custom à surveiller. Voir `CLAUDE.md` pour la procédure de vérification post-déploiement (obligatoire pour tout changement visuel/fonctionnel) et les gotchas de cache ci-dessous.

### Gotchas déploiement

- **Vérifier un push directement sur `raw.githubusercontent.com/<user>/<repo>/<sha>/<fichier>`** (avec le SHA exact du commit, pas juste `main`) donne le contenu réel déployé sans ambiguïté — plus fiable que de se fier au seul résumé `git commit`/`git push`.
- **Vérification live post-déploiement, piège du cache** : un simple re-fetch de `index.html` (même avec un paramètre `?_=timestamp`) ne suffit pas — les ressources liées (`styles.css`, `app.js`) gardent leur URL inchangée et restent servies depuis le cache HTTP/service worker. Hard reload complet (Ctrl+Shift+R) ou DevTools → Application → Service Workers → Unregister avant de conclure qu'un changement n'est pas passé.
- Le dossier de travail temporaire de Claude (sous `AppData\Local\Packages\...\LocalCache\...`) est souvent illisible depuis un terminal externe (sandboxing Windows) — passer par un téléchargement classique avant de copier des fichiers dans un repo local, si l'upload direct par API/CLI n'est pas possible.
- **Désynchronisation dossier local ↔ dépôt distant (leçon du 22/08/2026)** : le dossier de travail local n'était pas un dépôt git et n'avait jamais récupéré les changements poussés lors d'une session antérieure (fonctionnalité "Domicile", réordonnancement des étapes, bannière MAJ, etc.). Un correctif préparé sur une base locale périmée aurait effacé ce travail en écrasant le dépôt. Avant tout push : cloner le dépôt distant à part, comparer avec `diff` (en ignorant les fins de ligne CRLF/LF avec `--strip-trailing-cr`), et appliquer les correctifs par-dessus l'état distant réel plutôt que d'uploader la copie locale telle quelle.

## ⚠️ Point critique : `index-complet.html` vs fichiers séparés

`index-complet.html` est la **source de vérité** (fichier unique bundlant HTML+JS+CSS). `index.html`/`app.js`/`styles.css` sont les fichiers de travail séparés, plus faciles à éditer/diff. **Toute modification faite d'un côté doit être reportée manuellement de l'autre** — il n'y a pas d'outil de build qui les régénère l'un depuis l'autre. Voir `CLAUDE.md` pour les vérifications obligatoires avant commit.

Méthode de régénération complète (depuis `index-complet.html` vers les 3 fichiers séparés) : repérer les lignes exactes de `<style>`/`</style>` et du dernier `<script>`/`</script>` via `grep -n`, découper en trois, remplacer le bloc `<style>` par `<link rel="stylesheet" href="styles.css">` et le dernier `<script>` par `<script src="app.js"></script>`. Pour un patch ciblé : appliquer le même remplacement texte exact séparément dans les fichiers concernés, tant que le bloc existe à l'identique partout.

## Repères utiles

- Pas de framework de test (irait à l'encontre du choix "sans build"), mais **`node verify.js`** (racine du repo) formalise en une commande les vérifications pré-commit : syntaxe JS, équilibrage `<div>`/`<button>` HTML, équilibrage `{ }` CSS, synchronisation byte-exacte d'`index-complet.html` avec les 3 fichiers séparés, classes CSS orphelines (signalement seulement, non bloquant). Pas de linter configuré à ce jour.
- **⚠️ Marqueurs de données en emoji dans les descriptions d'entrées — ne jamais convertir en icône ni supprimer.** `📚` (lié à une recette), `🚶` (marche) et `🚴` (vélo) préfixent le texte de `entry.desc` et sont relus par du code de classification à plusieurs endroits d'`app.js` (`.includes('🚶')`, `.replace('🚴','')`, etc.), y compris pour les titres d'événements Google Agenda. Avant de toucher un emoji décoratif quel qu'il soit, vérifier par `grep` qu'il n'est pas aussi utilisé comme marqueur.
- `.impeccable/` contient l'état du skill Impeccable (audits design, ignores) — ne pas modifier à la main, passer par `hook-admin.mjs`.
- Secrets/clés utilisateur (Gemini, Google Maps, Google Client ID) : jamais codés en dur, toujours lus depuis `localStorage` et saisis par l'utilisateur dans Réglages.
- Décision explicite : pas d'intégration Google Maps Directions API ni de bouton "ouvrir dans Google Maps" (évalué le 14/08/2026, écarté par l'utilisateur).

## Historique des correctifs

### Session du 04/09/2026

Bugs remontés en usage réel + revue multi-agents (3 agents en parallèle, lecture seule sur
modales/état résiduel, affichage CSS, mapping des fonctions d'édition). Détail complet, repro et
raisonnement de chaque fix : `CHANGELOG_2026-09-04.md`.

- **Vélo** : mode "Kcal machine" perdu à l'édition (retombait toujours en mode vitesse, 18km/h par
  défaut) — corrigé, `editEntry()` détecte et restaure le bon mode.
- **Entrée Boisson/repas affichant des champs "calories vélo"** : `editEntry()` avait sa propre
  logique de reset divergente de `resetModalForm()` — corrigé, `resetModalForm()` appelée en tête.
- **Édition IA d'un repas/recette** : ajout d'un bouton de suppression par ingrédient (résultat IA
  et détail d'entrée), + régénération de la note détaillée après correction (`_syncAIIngredientTotals`).
- **Scroll bizarre liste de recettes** (et aliments/lieux/favoris sport) : le blocage de scroll de
  fond sous les modales ciblait le mauvais conteneur (`.recipes-list` au lieu de `.settings-sheet`,
  l'ancêtre réellement scrollable) — corrigé.
- **Haut des suggestions d'aliment invisible au clavier ouvert** : le remontage du sheet au-dessus
  du clavier pouvait pousser son haut au-dessus de l'écran — plafonné à `sheetRect.top - 8px`.
- **`closeRecipeEditor()` ne retirait jamais `modal-open` du body** (bug critique : app scrollée-
  bloquée + FAB masqué en permanence après usage de l'éditeur de recette) — corrigé, avec plusieurs
  modales apparentées (Aliments/Réglages/Lieux/Recettes/Poids) qui n'ajoutaient jamais `modal-open`
  à l'ouverture directe depuis la nav du bas.
- **`parseDesc()` totalement cassée** (regex avec des `$` littéraux au lieu de parenthèses
  échappées, ne matchait jamais) : toute conversion d'une entrée du journal en ingrédient de
  recette retombait sur 100g par défaut — corrigé, + support `cl`.
- **Marche en itinéraire nommé** : nom du trajet perdu à l'édition (même famille que le bug vélo) —
  corrigé (préservation du libellé sans reconstruire l'itinéraire interactif complet).
- **Nouvel aliment caché derrière Mes aliments** (z-index, bouton "+ Créer") — corrigé.
- **`.food-name`/`.food-meta`** (onglet Ciqual) et **`.summary-card`** (Bilan) : classes CSS
  référencées mais jamais définies, rendu dégradé — corrigées.
- **Favoris vélo** : sauvegarde silencieusement fausse en mode "Kcal machine" — garde-fou ajouté.
- **Cible tactile `.walk-move-btn`** (26×19px, sous 44px) : zone de tap agrandie via `::before`,
  uniquement vers l'extérieur de la paire monter/descendre (jamais l'un vers l'autre).
- **Unité ml/cl perdue dans le détail d'ingrédients** (`_saveIngEdits()`/résultat IA réétiquetaient
  toujours "g", même pour une boisson) — `_parseNoteIngredients()` mémorise maintenant l'unité
  d'origine, réutilisée partout où la note est reconstruite.
- Ajout d'un pointeur explicite dans ce fichier vers les 4 docs de référence transversales
  (`../Bonne pratiques IA/*.md`).

**Vérifié et écarté (pas un bug)** : `sportFavDateDate` (date pré-remplie en ajoutant une activité
depuis un favori sport) — se réinitialise déjà correctement à la date du journal affiché à chaque
ouverture (`loadWalkFavQuick()`/`loadBikeFavQuick()`, seuls points d'entrée réels), confirmé en
direct sur le site déployé. Détail des deux points ci-dessus et de cette vérification :
`CHANGELOG_2026-09-04.md` (section "Suite (même journée)").

### Session du 23/08/2026

**Audit UI/UX + cohérence design system (commit `2c14cb5`) :**
- Couleur "Protéines" unifiée (trois couleurs incompatibles coexistaient) sur `var(--accent)`/`var(--accent2)`.
- Menu "+" (FAB) : les 7 boutons de catégorie avaient chacun une couleur saturée différente, unifiés sur l'accent violet (icône seule garde une teinte de repère).
- Contraste texte secondaire (thème sombre) : `--muted` sous le seuil AA (≈4.0:1) → `#8886B3` (≈5.8:1).
- Cibles tactiles : `.food-btn` 40px→44px, zone de tap invisible ajoutée à `.weight-entry-edit`.
- Affordance d'édition recette : icône crayon ajoutée sur les cartes recette cliquables.

**Sécurité — XSS stocké (généralisation d'`escHtml()`) :** au-delà du journal (déjà fait le 22/08), appliqué aux noms d'aliment/recette/lieu affichés dans les listes, résultats de recherche, favoris, autocomplete d'adresse — partout où du texte libre utilisateur (ou source externe type Open Food Facts) était inséré via `innerHTML` sans échappement.

**Audit mobile Android (retour d'usage réel, Pixel 8) — commit `a0c3778` :**
- **Bug critique** : sélectionner "Vélo" dans le formulaire Sport écrasait par erreur (`innerHTML`) le conteneur `#walk-advanced`, qui héberge le formulaire *statique* de la Marche (`renderBikeFavsInModal()` visait le mauvais conteneur). Conséquence : `resetModalForm()` — appelée à **chaque** ouverture du bouton "+", toutes catégories confondues — référençait ensuite un élément détruit, levait une `TypeError`, et l'ajout d'entrée restait silencieusement inerte pour le reste de la session (symptôme observé : "les boutons du journal ne sont plus cliquables" après un Annuler). Fix : nouveau conteneur dédié `#bike-advanced`, `#walk-advanced` n'est plus jamais écrasé. Vérifié qu'aucun autre conteneur du code (recettes, lieux, poids, réglages, IA compris) ne partage ce défaut — c'était un cas unique.
- Bouton "Valider" du formulaire Sport pouvant rester hors écran après fermeture du clavier virtuel (formulaire plus long que la hauteur visible, footer volontairement non collant sur cette catégorie — voir `.static-footer` dans `styles.css`) : recalage auto (`scrollIntoView`, seulement si nécessaire) sur détection de fermeture clavier.
- Les deux bugs reproduits puis revérifiés en exécutant le code réel (avant/après correctif), y compris sur le site déployé après un vrai hard reload (piège de cache HTTP confirmé : un simple reload servait encore l'ancien `app.js`).
- Détail complet : voir `CHANGELOG_2026-08-23.md`.

**En attente (décision produit, non traité)** : densité du tableau de bord (8 chiffres avant le journal, non visibles sans scroller), chiffre héros en rouge plein lors d'un dépassement (déroge à la "Gradient Numeral Rule" de `DESIGN.md`, probablement volontaire mais non acté).

**Bug remonté (usage mobile réel) — adresse d'itinéraire qui reste affichée à l'écran (commit `89780a4`) :**
- `resetModalForm()` ne réinitialisait jamais le sous-formulaire itinéraire (`.walk-step-input` Départ/Arrivée/étapes, case "Aller-retour") : la dernière adresse tapée restait affichée à la prochaine ouverture du formulaire Sport, même après être passé par une autre modale entre-temps. Fix : nouvelle fonction `resetWalkRouteForm()`, appelée depuis `resetModalForm()`.
- `.pac-container` (dropdown Google) pouvait rester visible et suivre l'utilisateur sur tout le reste de l'appli (ajouté par Google en `position:absolute` sur `<body>`, hors DOM de la modale) — le `blurActiveAddressInput()` existant (15/08) dépendait uniquement du `blur()`, insuffisant sur mobile. Fix : force `display:none` sur tout `.pac-container` sans dépendre du blur, avec deux nouveaux points d'appel : écouteur `click` global (capture, exclut le champ d'adresse et le dropdown lui-même) et `showPage()`.
- Fuite DOM annexe : `removeWalkStep()` ne nettoyait jamais le `.pac-container` de l'étape supprimée (Google n'offrant aucune API de destruction) — `_attachPlacesAutocomplete()` capture désormais `input._pacContainer` pour permettre ce nettoyage.
- Détail complet (repro, preuves live) : voir `CHANGELOG_2026-08-23.md`.

### Session du 22/08/2026

**Audit UX/robustesse + corrections :**
- **Bouton "Ajouter aux favoris" inactif** (fiche détail d'une entrée du journal) : id de l'aliment injecté sans guillemets dans l'attribut `onclick` (`custom_foods.id` est un identifiant texte) → JS invalide, clic sans effet. Guillemetage corrigé.
- **Recherche d'ingrédient inactive dans l'éditeur de recette** : le champ `#re-desc` n'avait aucun `oninput` (recherche uniquement sur Enter), contrairement au champ de recherche principal. Ajout de `onRecipeSearchInput()` avec le même debounce 600ms.
- **Suppression de recette sans confirmation** : ajout de `showConfirm()`, aligné sur le comportement déjà en place pour les aliments personnalisés.
- **Défense en profondeur multi-utilisateurs** : ajout de `.eq('user_id', user.id)` sur ~15 `UPDATE`/`DELETE` (`entries`, `custom_foods`, `weight_entries`, `favorites`) qui ne filtraient que par `id` de ligne. Vérifié en conditions réelles que RLS bloque bien tout accès anonyme non authentifié sur ces tables.
- **Anti double-tap** : garde ajoutée sur sauvegarde aliment perso / recette / toggle favori (même principe que le garde déjà existant sur la validation du journal). Feedback visuel (bouton désactivé + libellé) et toast de confirmation sur le bouton "Valider" du journal.
- **XSS stocké** : `escHtml()` ajoutée et appliquée au nom d'aliment/repas affiché dans le journal et la fiche détail (texte libre utilisateur inséré via `innerHTML` sans échappement HTML jusque-là).
- **Lisibilité mobile** : `.entry-desc`/`.entry-sub` (texte principal du journal) : 12px/11px → 14px/12px.
- Détail complet : voir `CHANGELOG_2026-08-22.md`.

### Session du 16/08/2026

- Service worker : `app.js`/`styles.css` passés en network-first (étaient en cache-first, un déploiement pouvait rester invisible indéfiniment). Ajout d'une bannière "Nouvelle version disponible" (`showUpdateBanner()`).

### Session du 13/08/2026

**Bugs fonctionnels corrigés :**
- Sync Google Agenda pour le vélo qui ne se déclenchait pas en saisie manuelle (uniquement via favoris avant), + pré-autorisation du popup Google avant tout `await` pour éviter le blocage popup.
- Trou noir sous les modales quand le clavier virtuel s'ouvre (position fixed ne suit pas le visualViewport) → hauteur réelle trackée en JS.
- Étiquette du graphique de poids illisible/mal positionnée près du bord droit.
- Graphiques du Bilan (calories/net/protéines) : dates "S1/S2..." remplacées par vraies dates, anti-chevauchement des étiquettes, clic sur une barre → ouvre le journal du jour concerné.
- Formulaire vélo : ordre des champs (kcal avant durée), étapes d'itinéraire ajoutées incomplètes (pas de bouton sauvegarde, mauvais suivi du champ actif).
- Réordonnancement des lieux enregistrés qui ne marchait jamais sur mobile (drag-and-drop HTML5 natif = souris uniquement).
- Ajout d'une fonction "copier une seule entrée du journal vers un autre jour" (sans dupliquer tout le repas), + swipe gauche/droite sur les entrées pour accès rapide.
- IMC : le curseur se positionnait sur une échelle réelle (16-40) mais les couleurs/chiffres affichés utilisaient un découpage complètement différent → jamais alignés.
- Graphique de poids : axe Y figé en dur à 70-100kg (écrasait les vraies variations, risque de points hors cadre) → rendu dynamique.
- **Scan de code-barres → nouvel aliment** : mauvais IDs de champs (`cf-prot/gluc/lip` au lieu de `cf-p/g/l`), plantait silencieusement avant de préremplir les macros.
- Animation du menu flottant "+" jamais active (keyframes `fabItemIn` référencées mais jamais définies).
- **Boutons devenus non cliquables après usage d'une modale** (deux causes distinctes trouvées et corrigées séparément) :
  1. `draggable="true"` (HTML5 DnD natif, cassé sur mobile) laissé sur les listes de favoris sport → remplacé par le système Pointer Events.
  2. Fuite de capture de pointeur : le nettoyage ne gérait que `pointerup`, pas `pointercancel` → capture de pointeur restée bloquée sur un élément en cours de suppression, boutons ailleurs sur la page injoignables jusqu'au rechargement. Corrigé dans les deux systèmes de réordonnancement tactile.
- Swipe-to-close jamais réellement actif sur 16 des 17 modales (le sélecteur ne cherchait que `.modal-sheet`, jamais `.settings-sheet`) — corrigé partout.
- Bug CSS pré-existant (pas introduit cette session) : règle `.weight-chart-wrap` orpheline de son sélecteur → jamais stylée en prod.
- Fonction `normalize()` dupliquée (identique, sans impact mais nettoyée).

**Modernisation UI :**
- Remplacement d'emoji par des icônes Lucide cohérentes sur les zones les plus visibles (nav, boutons d'action, catégories de repas, menus contextuels) — **pas exhaustif**.
- États de chargement (squelette animé) au premier chargement du journal.
- Nombres animés (compteur ease-out) pour le total kcal principal.
- Cibles tactiles agrandies à 44px minimum sur les boutons icône isolés.
- Toasts avec animation d'entrée/sortie (fondu + glissement).
- États vides avec icône au lieu de texte gris nu (8 endroits).
- Animations d'apparition sur les graphiques (tracé progressif, croissance des barres).

### Session du 14/08/2026

- **Bug corrigé (partiel — complété le 15/08/2026)** : dropdown de suggestions d'adresse (Google Places) qui restait affiché/figé à l'écran quand on scrollait dans une modale. Fix : fermeture (blur) du champ actif dès que son conteneur scrollable défile.
- **Bug corrigé** : le dropdown Google Places se superposait visuellement à l'autofill natif du navigateur, et gardait un thème blanc en rupture avec le thème sombre de l'appli. Fix : `autocomplete="off"` sur les champs d'adresse + thème sombre custom pour `.pac-container`/`.pac-item`/`.pac-icon`/`.pac-logo`.
- **Clarification** : l'itinéraire à plus de 2 adresses était déjà supporté (bouton "+ Étape", jusqu'à 6) — il semblait absent car masqué par le bug de dropdown ci-dessus.
- **Amélioration** : layout desktop élargi en pur CSS (media query `min-width: 900px`), sans impact sur le mobile.
- **Audit statique** (aucune modification appliquée à l'époque) : ~20 règles CSS orphelines repérées dans `styles.css` — voir "Ce qui reste à faire".

### Session du 15/08/2026

- **Bug corrigé** : `.pac-container` restait affiché à l'écran après la **fermeture complète** d'une modale contenant un champ d'adresse, flottant par-dessus l'écran suivant. Le fix du 14/08 ne blurait le champ actif que sur le scroll interne — jamais sur fermeture directe (bouton Valider/Fermer/×, swipe-to-close, clic overlay).
  - Fix : nouvelle fonction utilitaire `blurActiveAddressInput()`, appelée en tout début de chaque fonction de fermeture de modale susceptible de contenir un tel champ (`closeModal()`, `closeSportFavsModal()`, `closePlacesModal()`) ainsi que dans le gestionnaire générique de clic sur overlay.

## Ce qui reste à faire / hors scope

- ~~Conversion d'icônes emoji → Lucide (dashboard principal, catégories du journal, menu du bouton "+")~~ **résolu** : vérifié le 04/09/2026, les trois zones citées sont déjà entièrement en Lucide (`ICONS` dans `app.js`, `#stats-grid` et `#fab-menu` dans `index.html`) — ce paragraphe ne reflétait plus l'état du code. Des emoji restent ailleurs (Réglages, Poids/IMC, calendrier, placeholders de recherche...), hors du périmètre décrit ici et pas audités ; à traiter comme un chantier à part si voulu, pas comme la suite de ce point.
- ~~CSS orphelines à trier~~ **résolu** : la liste trouvée le 14/08/2026 (`.bike-fav-section`, `.builder-item-hover-actions`, etc.) ne reflétait plus l'état du code — `node verify.js` (re-vérifié le 04/09/2026) ne détecte plus aucune classe orpheline, ces classes ont dû être utilisées ou nettoyées au fil des sessions intermédiaires sans que ce paragraphe soit mis à jour. Le check reste actif dans `verify.js` pour signaler toute nouvelle régression.
- Consolidation des styles inline → classes CSS : partielle, seulement sur le code déjà retouché.
- `modal-dose-fav` (popup de dose par défaut) est **volontairement** en dehors du système swipe-to-close standard.
- Quelques ID HTML dupliqués existent (`sf-edit-*`/`sf-new-*`) mais sans risque réel : templates walk/bike mutuellement exclusifs, jamais présents simultanément dans le DOM.
- Layout desktop : seule la grille de stats du dashboard a été retravaillée pour la largeur. Pistes évoquées non retenues : vraies deux colonnes (Journal + Bilan côte à côte), sidebar de navigation desktop.
- Cible tactile sous 44px restante (audit 22/08/2026) : `.entry-action` (36px). `.food-btn` corrigé à 44px le 23/08/2026.
- **Demandé par l'utilisateur (06/09/2026)** : retravailler le design du bouton fermer (×) des modales (`.modal-close`, `styles.css:1017`) — le rendre plus gros et plus esthétique. Pas un problème de zone tactile (déjà 44×44px, conforme) mais de perception visuelle : le glyphe "×" (`font-size:20px` dans un cercle `rgba(255,255,255,0.08)`) paraît petit/peu marqué. Piste à explorer : glyphe plus grand et/ou plus contrasté, cercle agrandi, icône Lucide (`x`) au lieu du caractère brut, meilleur contraste au repos (pas seulement au survol/tap).
- **Demandé par l'utilisateur (06/09/2026)** : faire en sorte que l'appli se voie moins comme conçue en "vibe coding" — en particulier la couleur bleu/violet omniprésente. Palette actuelle (`styles.css:12` dark, `:29` light) : `--accent:#7C6FFF`/`--accent2:#9B5CFF` (dark), `--accent:#5B4FE8`/`--accent2:#7B3FE4` (light) — dégradé indigo/violet très caractéristique des palettes par défaut générées par les outils IA ("AI slop" / "purple gradient" déjà documenté ailleurs, ex. articles sur les design systems par défaut de v0/Lovable/Bolt). L'utilisateur veut qu'on cherche sur internet (recherche à faire à une prochaine session) des pistes concrètes pour s'en démarquer avant de retoucher : palette de couleurs distinctive, ou système de couleurs par section/fonction plutôt qu'un seul accent omniprésent. Chantier large (la couleur d'accent est utilisée dans tout `styles.css` — boutons, icônes, bordures, focus, graphiques) : à cadrer avant de commencer (juste la palette, ou aussi typographie/ombres/rayons de bordure qui contribuent au même effet).
- `escHtml()` : appliqué au journal (22/08/2026) puis généralisé aux listes recette/aliment/lieu/favoris/autocomplete (23/08/2026, voir historique). Reste à vérifier au fil de l'eau sur tout nouveau texte libre affiché via `innerHTML`.
- Architecture mono-fichier `app.js` (~6800 lignes, tout global) : pas de risque immédiat en solo, point de vigilance si le projet passe à plusieurs développeurs.
- Pas de tests automatisés — `node verify.js` couvre les vérifications syntaxiques/structurelles, pas le comportement. L'accès navigateur réel (Claude in Chrome/Brave, MCP playwright) permet une vérification live quand disponible — à préférer à la seule analyse statique du code.
- ~~Bug remonté (usage réel mobile, 04/09/2026, non investigué)~~ **résolu le 04/09/2026** : repro confirmé via vidéo utilisateur (frames extraites à la main, ffmpeg local) — dans `#modal-add` (ajout d'aliment), en tapant "Huile" clavier ouvert, le champ `#in-desc` et la liste `#search-results` étaient scrollés au-dessus de la zone visible, cachés sous la barre de statut.
  - **Cause racine identifiée** (pas celle du fix du 04/09 précédent, conformément à la mise en garde qui suit ce paragraphe dans l'historique) : `styles.css`, règle `.modal-sheet,.settings-sheet` (`max-height:92dvh`) et son override `.settings-sheet` (`max-height:90dvh`) ignoraient `--app-height` (hauteur réelle visible clavier compris, déjà trackée en JS via `visualViewport.height` — voir `app.js:1-13` — et déjà utilisée par `.modal-overlay`). Si `dvh` seul ne se réduit pas de façon fiable avec le clavier sur l'appareil, le sheet reste plus grand que son conteneur flex (`.modal-overlay`, `align-items:flex-end`) et déborde par le HAUT (au-dessus de l'écran), pas par le bas — confirmé par simulation JS (réduction de `--app-height`, comparaison avant/après fix) : champ de recherche à `top:-136px` (invisible) avant, `top:154px` (visible) après, sur un scénario clavier ~340px.
  - **Fix** (`styles.css`) : `max-height: min(92dvh, calc(var(--app-height, 100dvh) - 8px))` sur les deux règles — borne désormais tout sheet à la hauteur réellement visible et force son scroll interne déjà prévu (`overflow-y:auto`) au lieu du débordement visuel. S'applique à **toutes** les modales via la classe partagée, pas seulement `modal-add` : au passage, deux overrides inline redondants et non couverts par `SHEETS_TO_LIFT` ont été supprimés pour laisser la règle corrigée s'appliquer — `modal-recipes` (`92dvh` en dur) et `modal-barcode` (`92vh`, unité différente et non plus cohérente avec le reste). `modal-places` (champs `place-form-name`/`place-form-addr`) était également exposé à la même cause racine et bénéficie du même fix, sans changement de code dédié nécessaire.
  - Le mécanisme JS `SHEETS_TO_LIFT`/`translateY` (`app.js:6895-6961`, fix du 04/09 précédent) n'était pas la cause de ce bug-ci — conformément à la consigne de ne pas le réutiliser à l'aveugle. Affiné dans la 2e vague ci-dessous (lift conditionné à un débordement réel), sans changer son rôle.
  - **2e vague (même jour, suite à vérification réelle par l'utilisateur — capture à l'appui)** : le fix ci-dessus corrigeait bien le débordement au-dessus de l'écran (titre/date/champ redevenus visibles), mais a révélé un **second bug, préexistant et distinct**, jusque-là masqué par le premier : les résultats de recherche (`#search-results`) sont bien générés dans le DOM après la frappe, mais s'affichaient **cachés sous** la carte "kcal"/les boutons Valider-Fermer.
    - **Cause racine** : `.modal-sticky-footer` (`styles.css:869`, unique dans `modal-add`) est en `position:sticky; bottom:-40px`, volontairement, pour rester visible pendant qu'on scrolle un long formulaire déjà rempli. Un mécanisme équivalent (`.static-footer`, `app.js:1392`) existait déjà pour désactiver ce sticky sur les formulaires Sport trop longs (même souci, déjà documenté dans le commentaire CSS de `.static-footer`) — mais jamais appliqué à la recherche d'aliment, car le sheet ne se retrouvait quasiment jamais correctement clampé à une petite hauteur visible tant que le bug ci-dessus existait. Une fois `.modal-sheet` correctement borné par `--app-height` (clavier ouvert), son contenu dépasse presque toujours sa petite zone visible dès l'ouverture : le footer sticky se plaque alors immédiatement en bas, avant tout scroll manuel, et recouvre les résultats qui viennent d'apparaître juste sous le champ.
    - **Fix** : nouvelle classe `.search-active-footer` (même effet CSS que `.static-footer`, `styles.css`), posée/retirée sur `.modal-sheet` par un `MutationObserver` sur `#search-results` (`app.js`, juste après le bloc `SHEETS_TO_LIFT`) — footer repassé en flux normal tant que des résultats sont affichés, sticky de nouveau dès qu'ils sont masqués (aliment choisi ou recherche vidée). Indépendant de `.static-footer` (Sport), qui garde sa propre logique.
    - `SHEETS_TO_LIFT` affiné au passage (`app.js:6929`) : le lift ne s'applique plus que si `overflow > 0` (débordement réel) — l'ancienne formule (`overflow + 8` sans condition) appliquait un lift fantôme de ~8px à chaque ouverture de clavier, même sans débordement, désormais le cas courant grâce au fix CSS ; un `transform` actif sans raison sur l'élément scrollable qui reçoit les résultats injectés dynamiquement était une piste sérieuse mais s'est révélée insuffisante seule pour expliquer le recouvrement observé (vérifié : l'écrasement persistait même transform vide) — la vraie cause était le sticky-footer.
    - Vérifié par script (simulation clavier + injection de résultats, avant/après) : chevauchement résultats/footer confirmé puis éliminé ; footer revient bien sticky une fois les résultats masqués.
  - **Non vérifié sur appareil mobile réel pour cette 2e vague** — seule la 1ère vague a été testée en réel par l'utilisateur (ce qui a révélé le bug de la 2e vague). À reconfirmer en usage réel avant de considérer le point définitivement clos.
