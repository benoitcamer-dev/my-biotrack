# PROJECT_BRIEF.md

À lire en premier à chaque nouvelle session sur ce repo (voir `CLAUDE.md`). Pour le détail visuel/produit, voir `DESIGN.md` et `PRODUCT.md`.

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
  - Google Fit / Google Calendar (sync sport, OAuth via une Edge Function Supabase)
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

- **Conversion d'icônes emoji → Lucide** : pas exhaustive — le dashboard principal, les catégories du journal et le menu du bouton "+" sont encore en partie en emoji natifs alors que la nav du bas et une partie des boutons sont déjà en Lucide.
- **CSS orphelines à trier** (trouvées le 14/08/2026, non traitées) : `.bike-fav-section`, `.builder-item-hover-actions`, `.date-nav-today`, `.entry-action`, `.entry-add-btn`, `.entry-group-clear`, `.entry-group-kcal-row`, `.icon-only`, `.macro-kpi`/`.macro-kpi-row`, `.meal-save-btn`, `.mono`, `.orange`, `.other-month`, `.saved-link-btn`, `.skeleton-block`, `.sport-fav-hover-actions`, `.summary-kpi-row`, `.summary-sub`, `.tooltiptext`. `node verify.js` re-détecte ce type de classe automatiquement.
- Consolidation des styles inline → classes CSS : partielle, seulement sur le code déjà retouché.
- `modal-dose-fav` (popup de dose par défaut) est **volontairement** en dehors du système swipe-to-close standard.
- Quelques ID HTML dupliqués existent (`sf-edit-*`/`sf-new-*`) mais sans risque réel : templates walk/bike mutuellement exclusifs, jamais présents simultanément dans le DOM.
- Layout desktop : seule la grille de stats du dashboard a été retravaillée pour la largeur. Pistes évoquées non retenues : vraies deux colonnes (Journal + Bilan côte à côte), sidebar de navigation desktop.
- Cible tactile sous 44px restante (audit 22/08/2026) : `.entry-action` (36px). `.food-btn` corrigé à 44px le 23/08/2026.
- `escHtml()` : appliqué au journal (22/08/2026) puis généralisé aux listes recette/aliment/lieu/favoris/autocomplete (23/08/2026, voir historique). Reste à vérifier au fil de l'eau sur tout nouveau texte libre affiché via `innerHTML`.
- Architecture mono-fichier `app.js` (~6800 lignes, tout global) : pas de risque immédiat en solo, point de vigilance si le projet passe à plusieurs développeurs.
- Pas de tests automatisés — `node verify.js` couvre les vérifications syntaxiques/structurelles, pas le comportement. L'accès navigateur réel (Claude in Chrome/Brave, MCP playwright) permet une vérification live quand disponible — à préférer à la seule analyse statique du code.
