# CLAUDE.md

Instructions pour Claude Code sur ce repo. À appliquer à chaque session.

## Contexte

Ce projet est documenté dans `PROJECT_BRIEF.md` — **à lire en premier à chaque nouvelle session** — ainsi que dans `DESIGN.md` et `PRODUCT.md` (contexte visuel et produit utilisé par le skill Impeccable).

Site statique sans étape de build, déployé sur GitHub Pages à **https://benoitcamer-dev.github.io/my-biotrack/**.

## Workflow d'édition

`index-complet.html` est la source de vérité (fichier bundlé combinant HTML + JS + CSS). Toute modification apportée à `app.js` ou `styles.css` doit être reportée dans `index-complet.html`, et inversement — sous peine de désynchronisation entre le bundle et les fichiers séparés.

## Vérifications avant tout commit

Lancer **`node verify.js`** (racine du repo) : regroupe en une commande la syntaxe JS (`node --check` sur `app.js`), l'équilibrage des balises `<div>`/`<button>` (`index.html` et `index-complet.html`), l'équilibrage des accolades `{ }` (`styles.css`), la synchronisation byte-exacte d'`index-complet.html` avec les 3 fichiers séparés, et un signalement (non bloquant) des classes CSS orphelines. Code de sortie non nul si un problème est détecté.

## Vérification live obligatoire après tout changement visuel/fonctionnel

Après avoir commité et poussé un changement qui touche l'UI ou le comportement de l'app, vérifier soi-même que c'est bien effectif sur le site déployé — ne jamais se contenter du seul contenu des fichiers locaux ou du résumé du commit.

Utiliser le MCP playwright ou chrome-devtools pour :

1. Ouvrir https://benoitcamer-dev.github.io/my-biotrack/ avec un **vrai hard reload navigateur (Ctrl+Shift+R)** — pas seulement un `navigate()`/reload simple, et pas seulement un re-fetch du document HTML avec un paramètre `?_=timestamp`. GitHub Pages sert les fichiers avec `Cache-Control: max-age=600` : le navigateur peut resservir `index.html` **et les fichiers liés comme `styles.css`** depuis son cache HTTP pendant 10 minutes après la dernière visite, indépendamment du service worker et même après une navigation normale vers l'URL. Un cache-busting sur l'URL du document ne rafraîchit que ce document — les ressources liées (CSS, JS chargés via `<link>`/`<script src>`) gardent leur URL inchangée et restent donc servies depuis le cache tant qu'elles sont dans leur fenêtre de fraîcheur. Seul un hard reload complet (Ctrl+Shift+R, ou l'équivalent "vider le cache et actualiser" des devtools) recharge la page et toutes ses sous-ressources en ignorant le cache HTTP. Si un doute subsiste sur la fraîcheur de ce qui est chargé, vérifier via un `fetch(url, {cache:'no-store'})` direct et comparer au DOM réellement rendu dans l'onglet avant de conclure.

   **Le fix du 16/08/2026 (`sw.js` en network-first) était incomplet, corrigé le 18/09/2026** : `fetch(e.request)` dans le handler `fetch` du SW respecte le cache HTTP normal du navigateur — pendant les 10 minutes suivant un déploiement, ce `fetch()` pouvait être satisfait par le cache HTTP local sans jamais toucher le réseau, malgré la logique "network-first" (qui ne s'appliquait qu'au Cache Storage propre du SW, pas au cache HTTP du navigateur). Fix : `fetch(e.request, { cache: 'reload' })`, qui force l'ignorance du cache HTTP local à chaque requête.

   **Piège découvert en vérifiant ce fix, à connaître pour toute vérification live impliquant le service worker** : **un hard reload (Ctrl+Shift+R) peut bypasser le service worker pour la navigation elle-même** — `navigator.serviceWorker.controller` reste `null` sur la page qui vient d'être hard-reloadée, même si le SW est bien enregistré et actif en arrière-plan. Autrement dit, tester uniquement via hard reload ne vérifie PAS le comportement réel du service worker (celui qu'un utilisateur normal — qui recharge/rouvre l'app sans hard reload — rencontre réellement) ; ça vérifie seulement le comportement du cache HTTP nu, en le contournant. Pour un test représentatif du SW : naviguer une seconde fois normalement (`navigate()` simple, pas hard reload) après un premier hard reload/désenregistrement, vérifier que `navigator.serviceWorker.controller` n'est pas `null`, puis contrôler la fraîcheur via l'en-tête `date` de la réponse (`fetch(url).then(r=>r.headers.get('date'))`) : s'il colle à l'heure réelle (`new Date().toUTCString()`) à chaque appel répété, c'est qu'un vrai aller-retour réseau a lieu à chaque fois ; s'il reste figé, la réponse vient du cache disque local. Le `transferSize` de la Resource Timing API s'est révélé peu fiable pour ce diagnostic spécifique quand un service worker est dans la boucle (peut afficher 0 même sur un vrai hit réseau) — ne pas s'y fier seul pour ce cas précis, préférer `date`/`age`.

   En cas de doute persistant malgré tout ça, désenregistrer le service worker et vider les caches (`caches.keys()` + `delete`) avant de recharger reste la méthode la plus sûre pour repartir d'un état propre.
2. Naviguer jusqu'à l'écran concerné par le changement et vérifier visuellement/dans le DOM que le changement est bien présent.
3. Signaler explicitement si ce qui est vu en live diffère de ce qui est dans le code source — ne jamais supposer que « poussé sur GitHub » signifie « visible en live » sans l'avoir vérifié.

## Vérification live sur mobile via ADB (si l'extension Claude in Chrome est indisponible)

Fallback déjà utilisé plusieurs fois (04-13/09/2026) quand l'extension Claude in Chrome ne se connecte pas au téléphone (elle ne se connecte **jamais** à un navigateur Android — pas la peine de réessayer). Méthode complète (prérequis, commandes de base, pièges généraux ADB, calibration CDP) déjà documentée dans le doc transversal **`../Bonne pratiques IA/conseils_environnement_travail.md` §16/§16bis** — **à lire avant toute session ADB sur ce projet**, ne pas la redécouvrir à chaque fois (vécu le 13/09/2026 : plusieurs pièges déjà connus ont été redécouverts faute d'avoir relu ce doc en premier).

**⚠️ Spécifique à ce projet — l'app réelle tourne sous Brave, pas Chrome** (déjà noté au §16bis, précisé ici) : le raccourci "LeGrosBarbu" de l'écran d'accueil est une PWA sous `com.brave.browser` (confirmé via `adb shell dumpsys shortcut`, intent `ACTION_START_WEBAPP`) — un `am start … com.android.chrome` sur l'URL ouvre un tout autre contexte (cache/cookies/service worker séparés) et ne reflète pas l'usage réel. Toujours taper la vraie icône.

**Emplacement actuel de l'icône (à revérifier si l'écran d'accueil a été réorganisé depuis)** : écran d'accueil → 2e page (dossiers Fit/Utilitaires/Hue/Santé en haut) → dossier **"Santé" en bas à droite de cette page** — ⚠️ il existe deux dossiers "Santé" sur cette page, ne pas confondre : celui à ouvrir contient fatsecret / RENPHO Health / Insight Timer / **LeGrosBarbu** (badge Brave visible sur l'icône) / MyTherapy / Petit BamBou ; l'autre dossier "Santé" (en haut de la page) contient des apps fitness différentes (Google Fit et consorts).

**Pour toute mesure précise (audit de mise en page, espace écran, débordement clavier)** : préférer la méthode CDP décrite au §16bis (`chrome_devtools_remote` + `Runtime.evaluate`) à des taps + captures d'écran devinés à l'œil — bien plus fiable, et la calibration tap déjà établie le 11/09/2026 est réutilisable telle quelle : `physical_x = css_x * 2.625`, `physical_y = css_y * 2.625 + 131` (écran 412×915 CSS logique / 1080×2400 physique). Voir `AUDIT_MODALES_2026-09-11.md` (racine du repo) pour le détail de cette méthode appliquée aux modales de l'app, et la mémoire `audit-modales-espace-ecran` pour l'état d'avancement (5/19 modales auditées, 14 restantes).
