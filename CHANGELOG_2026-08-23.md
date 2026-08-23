# Changelog — Session du 23/08/2026

Audit technique et UX complet (bugs signalés, cohérence du design system, ergonomie mobile) sur le journal, les recettes, le tableau de bord et le menu d'ajout. Fichiers touchés : `app.js`, `index-complet.html` (source de vérité), `styles.css`, `index.html`. Rapport complet (contexte, preuves, code des correctifs) publié en artifact — lien dans l'historique de conversation, non reproduit ici.

## Bugs signalés — déjà résolus, revérifiés en direct

Deux bugs remontés (favoris inactifs depuis le journal, recherche inopérante en modification de recette) correspondaient exactement à deux correctifs déjà livrés lors de la session du 22/08/2026 (commit `2a9d005`). Plutôt que de recorriger du code déjà sain, chacun a été revérifié en conditions réelles sur le site déployé :

- **Favoris** : fiche détail d'une entrée du journal → clic "Ajouter aux favoris" → insertion réelle confirmée dans la table `favorites` (lue via le client Supabase de la page) → UI bascule sur "Retirer des favoris" → retrait fonctionnel. Donnée de test créée puis supprimée immédiatement, aucune trace laissée en base.
- **Recherche recette** : ouverture de "Bœuf bourguignon" en modification → frappe de "poulet" dans le champ ingrédient (`#re-desc`) → liste filtrée en direct (Bouillon poulet maison dégraissé, Blanc de poulet sans peau…). Fermeture sans enregistrer : recette ressortie inchangée.

Aucune régression détectée, aucune action de code nécessaire sur ces deux points. Si le symptôme revient côté utilisateur, la piste la plus probable est un cache HTTP GitHub Pages non purgé (10 min sur les ressources liées) — un vrai hard-reload (Ctrl+Shift+R) permet de trancher.

## Correction d'architecture (précision pour l'audit)

Pas de code React Native/Expo/Flutter/Next.js séparé : LeGrosBarbu est une PWA statique unique (`index.html` + `app.js` + `styles.css`, sans build), déployée telle quelle sur GitHub Pages. La "version mobile" est exactement le même code, rendu en responsive et installable via `manifest.json` + `sw.js`. "Web vs mobile" n'est donc pas un sujet de mutualisation de code (un seul code existe), mais de responsive design et d'ergonomie tactile.

## Cohérence du design system — corrigé

Cinq constats de l'audit UI/UX, chiffrés et vérifiés (code + capture live), corrigés et déployés (commit `2c14cb5`) :

- **Couleur "Protéines" unifiée** — trois couleurs incompatibles coexistaient pour la même macro (violet sur `.macro-pill.prot`, bleu `#7da4ff` sur les badges journal `.meal-macro.p`, vert/teal `#00C896` codé en dur sur la barre du tableau de bord — `app.js:3696`). Tout ramené sur `var(--accent)`/`var(--accent2)`, avec lecture de la variable CSS depuis le JS plutôt qu'une valeur en dur.
- **Menu "+" (FAB)** — les 7 boutons (Petit-déjeuner, Déjeuner, Dîner, Snack, Boissons, Sport, Assistant IA) avaient chacun un fond/bordure d'une couleur saturée différente, en rupture avec "The One Accent Rule" de `DESIGN.md`. Fond et bordure unifiés sur l'accent violet (nouvelles variables `--accent-bg-soft` / `--accent-border-soft`) ; seule l'icône garde une teinte de repère par catégorie.
- **Contraste du texte secondaire (thème sombre)** — `--muted: #6B6B99` sur `--bg: #08080F` donnait un ratio ≈4.0:1, sous le seuil AA (4.5:1) pour ce texte utilisé partout en 9-11px (sous-titres, labels, méta). Passé à `#8886B3` (≈5.8:1), même teinte perçue. Thème clair inchangé (déjà ≈4.6:1, conforme).
- **Cibles tactiles** — `.food-btn` porté de 40px à 44px ; `.weight-entry-edit` reçoit la même zone de tap invisible (`::before{inset:-12px}`) que `.weight-entry-del` juste à côté, qui l'avait déjà (oubli de la passe du 15-16/08).
- **Affordance d'édition des recettes** — une icône crayon apparaît désormais à côté du nom sur les cartes recette cliquables (recherche et liste Recettes), jusqu'ici seul un `cursor:pointer` CSS (invisible au doigt) signalait que le tap ouvrait l'édition.

`index-complet.html` resynchronisé (bloc `<style>` + dernier `<script>`) avec `styles.css`/`app.js` à jour. `node verify.js` : tout au vert. Déployé et vérifié en direct sur le site (hard reload + `fetch(...,{cache:'no-store'})` sur `styles.css` pour écarter tout doute de cache) : barre "Protéines" violette, menu "+" unifié, icône crayon visible sur les cartes recette — tous confirmés en production.

## En attente — décision produit, pas encore traité

- **Densité du tableau de bord** — la carte du jour affiche 8 chiffres (héros, barre calories, 4 stat-boxes, bilan, barre protéines, 2 pastilles macros) avant la moindre ligne du journal, qui n'est pas visible sans scroller sur mobile au premier chargement. Piste proposée : accordéon "Détails" pour les stat-boxes/macros, chiffre héros + barre + bilan visibles d'emblée. Pas implémenté — décision volontairement laissée en suspens (voir avec l'utilisateur après quelques jours d'usage des correctifs ci-dessus).
- **Chiffre héros en rouge plein lors d'un dépassement** ("574 KCAL EN EXCÈS") — déroge à la "Gradient Numeral Rule" documentée dans `DESIGN.md` (chiffres-titres toujours en dégradé). Probablement volontaire (rouge = alerte), mais l'exception n'est nulle part actée dans le document. Faible priorité, non traité.

## Audit mobile Android (retour utilisateur Pixel 8) — corrigé

Deux bugs remontés en usage réel sur Pixel 8, reproduits et corrigés (pas seulement supposés — vérifiés en exécutant le code réel dans le navigateur, avant/après correctif) :

- **Bug critique — le formulaire "Sport" cassait l'ajout d'entrée pour le reste de la session.** `renderBikeFavsInModal()` (rendu des favoris vélo) écrivait via `innerHTML` directement sur `#walk-advanced`, le conteneur qui héberge le formulaire **statique** de la marche (onglets Simple/Itinéraire, étapes d'adresse, durée personnalisée...). Sélectionner "Vélo" détruisait donc irréversiblement ce balisage. Conséquence concrète : `resetModalForm()` (appelée à **chaque** ouverture du bouton "+", toutes catégories confondues) référence sans garde `#walk-custom-dur-box`, un des éléments détruits — elle levait une `TypeError` et interrompait l'ouverture du formulaire en plein milieu. Résultat observé par l'utilisateur : après être passé par Sport → Vélo une fois dans la session, le bouton "+" (et donc tout ajout d'entrée au journal) restait silencieusement inerte jusqu'au rechargement complet de la page — exactement le symptôme "les boutons du journal ne sont plus cliquables" remonté après un "Annuler". Un second effet du même bug : repasser de Vélo à Marche dans la même session de modale plantait aussi (`setWalkMode()` référence les mêmes éléments détruits).
  - Fix : nouveau conteneur dédié `#bike-advanced` (HTML statique, `index.html`/`index-complet.html`), `renderBikeFavsInModal()` y écrit désormais au lieu d'écraser `#walk-advanced`. Masquage symétrique ajouté aux points de transition (`selectWalkMode()`, `resetModalForm()`, `editEntry()`) pour éviter toute superposition résiduelle des deux formulaires.
  - Reproduit en direct sur le site déployé (avant correctif) : `openModal('Sport'); selectBikeMode();` détruit bien `#walk-custom-dur-box` ; un `openModal(...)` suivant lève `TypeError: Cannot read properties of null (reading 'style')` à `resetModalForm`. Revérifié après correctif (build local) : plus aucune erreur sur les deux séquences (Vélo → autre catégorie, Vélo → Marche).
- **Bouton "Valider" hors écran après fermeture du clavier virtuel.** Le formulaire Sport (surtout en mode "Kcal machine" : 2 champs + note + liste de sorties favorites) dépasse fréquemment la hauteur visible ; son footer est volontairement en flux normal plutôt que collant sur cette catégorie (`.static-footer`, décision déjà documentée le 13/08 pour éviter qu'un footer collant ne recouvre des champs pas encore scrollés). Problème non couvert jusqu'ici : quand le clavier virtuel se ferme (retour Android, "OK"...), rien ne recalait le scroll interne du formulaire — le bouton restait où l'auto-scroll-vers-le-champ du navigateur l'avait laissé, hors champ, sans indice pour l'utilisateur qu'il fallait scroller.
  - Fix : sur fermeture détectée du clavier (`visualViewport resize`, seuil déjà existant), si le bouton Valider se retrouve hors du viewport visible, il est ramené en vue (`scrollIntoView`, uniquement si nécessaire — aucun scroll parasite si le bouton était déjà visible).
  - Vérifié en simulant l'ouverture/fermeture du clavier via `visualViewport` (impossible de reproduire un vrai clavier Android depuis Chrome desktop) : bouton hors écran confirmé avant correctif, ramené dans le viewport après.

`node verify.js` : tout au vert (bundle `index-complet.html` resynchronisé). Fichiers touchés : `app.js`, `index.html`, `index-complet.html`.

## Bug remonté (usage réel) — adresse d'itinéraire qui reste affichée à l'écran

Deux symptômes distincts remontés par l'utilisateur en usage mobile, tous deux confirmés en direct sur le site déployé puis corrigés (commit `89780a4`) :

- **Le champ "Arrivée" (et plus largement tout le sous-formulaire itinéraire) n'était jamais réinitialisé.** `resetModalForm()` — appelée à chaque fermeture du formulaire Sport (Valider, Fermer, ×, swipe, overlay) — remettait bien à zéro tous les autres champs (recherche, kcal, vitesse…) mais jamais les champs `.walk-step-input` (Départ/Arrivée/étapes ajoutées via "+ Étape") ni la case "Aller-retour". Résultat : la dernière adresse tapée restait affichée à la prochaine ouverture du formulaire, y compris après être passé par une autre modale entre-temps — rien dans l'app ne permettait de la faire disparaître (ni tap, ni scroll, puisqu'aucun code ne la vidait jamais).
  - Reproduit en direct : `Arrivée = "Place Bellecour"` → fermeture/réouverture du formulaire → `Arrivée` toujours `"Place Bellecour"`. Une étape ajoutée un jour réapparaissait elle aussi indéfiniment (3 champs au lieu de 2 après un seul cycle fermer/rouvrir).
  - Fix : nouvelle fonction `resetWalkRouteForm()` (vide Départ/Arrivée, décoche "Aller-retour", retire les lignes d'étape ajoutées au-delà des 2 de base), appelée depuis `resetModalForm()`.
- **Le dropdown de suggestions Google (`.pac-container`) restait visible et "suivait" l'utilisateur sur tout le reste de l'appli**, pas seulement dans la modale d'origine — cohérent avec sa nature : Google l'ajoute directement dans `<body>`, en position `absolute`, hors du DOM de la modale. Le mécanisme existant (`blurActiveAddressInput()`, en place depuis le 15/08) ne fermait le dropdown qu'en blurant le champ actif — insuffisant sur mobile (timing du blur à la fermeture du clavier virtuel, tap sur une suggestion qui chevauche un bouton de fermeture, retour Android…) : si le blur ne se produit pas au bon moment, rien d'autre ne force jamais sa fermeture.
  - Fix : `blurActiveAddressInput()` force désormais `display:none` sur tout `.pac-container`, sans dépendre du seul blur. Deux nouveaux points d'appel : (1) un écouteur `click` global (capture) qui referme le dropdown sur tout clic ailleurs que sur le champ d'adresse ou le dropdown lui-même — couvre la nav du bas et les tabs Journal/Bilan ; (2) `showPage()` (changement d'onglet).
  - Vérifié en direct : un dropdown simulé "coincé" visible sur l'écran (`display:block`) passe à `display:none` dès le clic sur l'onglet Bilan.
- **Fuite DOM annexe corrigée au passage** : `removeWalkStep()` (bouton "×" d'une étape) détruisait le champ HTML mais jamais l'instance Google Places Autocomplete ni son `.pac-container` associé (Google ne fournissant aucune API officielle de destruction) — confirmé en direct (le conteneur orphelin restait dans le DOM après suppression de l'étape). `_attachPlacesAutocomplete()` capture désormais une référence (`input._pacContainer`) pour permettre son nettoyage explicite à la suppression de l'étape.

Testé en conditions réelles sur le compte de l'utilisateur (aucune donnée créée en base, uniquement de la manipulation de formulaire côté client) : formulaire Marche/Itinéraire, ajout d'étape, fermeture/réouverture, simulation de dropdown coincé. `node verify.js` au vert, `index-complet.html` resynchronisé. Fichiers touchés : `app.js`, `index-complet.html`.

## Nettoyage du dossier local — rien à faire

Vérification du dossier de travail local (`git status --ignored`) : working tree strictement propre, aucun fichier non suivi et non ignoré. Les 4 fichiers de clutter identifiés lors de la session du 22/08 (`ACTION_CONFIRMATION.txt`, `ANALYSIS_SUMMARY.txt`, `ACTION_PLAN_debug_optimization.md`, `ok.md`) avaient déjà été supprimés à l'époque. Seul `.claude/` est ignoré par git (config locale de l'outil, légitime, pas du clutter applicatif). Aucune suppression nécessaire cette fois.
