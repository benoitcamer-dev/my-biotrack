# Changelog — Session du 04-05/09/2026

Session déclenchée par une vidéo utilisateur montrant un bug clavier sur mobile, qui a mené à
une chaîne de 3 bugs distincts (chacun masquant le suivant), puis à une demande de passage des
modales en plein écran. Investigation menée en conditions réelles sur un Google Pixel 8 : d'abord
via captures d'écran + taps simulés par ADB, puis — après échec de `chrome://inspect` (bloqué,
cause non identifiée) — via un pont DevTools Protocol monté à la main (`adb forward` vers le
socket `chrome_devtools_remote` + petit script Node/WebSocket, voir `cdp_eval.mjs`/
`cdp_inject_css.mjs`), permettant d'exécuter du JS et d'injecter du CSS en direct sur la page
réelle du téléphone, avant tout déploiement. Toutes les corrections ont été appliquées dans
`app.js`/`styles.css` puis resynchronisées dans `index-complet.html` (`node verify.js` OK à
chaque étape).

## Bug remonté (vidéo utilisateur) : sheet de modale invisible au clavier ouvert

`#modal-add` (ajout d'aliment) : en tapant "Huile" clavier ouvert, le champ de recherche et ses
résultats étaient scrollés au-dessus de la zone visible, cachés sous la barre de statut — repro
confirmé en extrayant les frames de la vidéo (ffmpeg local).

- **Cause** : `.modal-sheet,.settings-sheet` (`max-height:92dvh`/`90dvh`) ignorait `--app-height`
  (hauteur réelle visible clavier compris, déjà trackée en JS et déjà utilisée par
  `.modal-overlay`). Si `dvh` seul ne se réduit pas de façon fiable avec le clavier sur
  l'appareil, le sheet reste plus grand que son conteneur flex (`align-items:flex-end`) et
  déborde par le HAUT, pas par le bas.
- **Fix** : `max-height: min(92dvh, calc(var(--app-height, 100dvh) - 8px))` — borne tout sheet à
  la hauteur réellement visible, force le scroll interne déjà prévu au lieu du débordement.
  S'applique à toutes les modales via la classe partagée. Deux overrides inline redondants
  supprimés au passage (`modal-recipes` en `92dvh` dur, `modal-barcode` en `92vh`).
- Vérifié une première fois par simulation JS (réduction de `--app-height`), puis en conditions
  réelles sur le Pixel 8 (captures ADB) — confirmé fonctionnel : titre/date/champ redevenus
  visibles.

## Bug révélé par le fix précédent : résultats de recherche cachés sous le footer sticky

Une fois le sheet correctement borné, un second bug préexistant est devenu visible (capture
utilisateur) : les résultats de `#search-results` sont bien générés dans le DOM mais s'affichent
cachés sous la carte kcal et les boutons Valider/Fermer.

- **Cause** : `.modal-sticky-footer` (`position:sticky`) est volontairement sticky pour rester
  visible en scrollant une longue liste de résultats — mais tant que le sheet ne débordait
  jamais correctement (bug précédent), ce recouvrement au tout premier affichage n'était jamais
  visible. Une fois le sheet correctement clampé, son contenu dépasse presque toujours sa petite
  zone visible dès l'ouverture : le footer sticky se plaque alors immédiatement en bas, avant
  tout scroll manuel.
- **Fix** : nouvelle classe `.search-active-footer`, posée/retirée sur `.modal-sheet` par un
  `MutationObserver` sur `#search-results` — footer en flux normal tant que des résultats sont
  affichés, sticky de nouveau une fois masqués (aliment choisi ou recherche vidée). Indépendant
  de `.static-footer` (Sport), qui garde sa propre logique.
- `SHEETS_TO_LIFT` affiné au passage : le lift clavier ne s'applique plus que si `overflow > 0`
  (l'ancienne formule appliquait un lift fantôme de ~8px systématique depuis le fix précédent) —
  piste sérieuse mais insuffisante seule à expliquer le recouvrement (vérifié : transform vide,
  recouvrement toujours présent) ; la vraie cause était bien le sticky-footer.
- Vérifié en conditions réelles sur le Pixel 8 : plus de chevauchement, résultats bien visibles,
  footer revient sticky une fois masqués.

## Bug trouvé en vérifiant "un peu partout" : contenu défilé visible au-dessus du titre sticky

Demande explicite de vérification élargie (clavier/modales/swipe). Repro sur `modal-places` (et
potentiellement toute modale à contenu long) : en scrollant une longue liste, un fragment du
contenu défilé apparaît furtivement au-dessus du titre "sticky" de la modale — persistant, pas un
artefact passager (vérifié : deux captures à 2 min d'intervalle sans interaction, identiques).

- **Cause, mesurée précisément via le pont DevTools distant** : `.modal-sticky-header` a un
  `margin-top:-20px` (pour saigner jusqu'au bord du sheet) combiné à `position:sticky`. Cette
  marge négative n'est pas repeinte par le `background` du header (hors de sa boîte), créant un
  interstice mesuré à **~20,76px** entre le bord réel du sheet et le point d'accroche du header —
  le contenu défilé peut apparaître dans cet interstice à certaines positions de scroll.
- **Fix** : `box-shadow: 0 -22px 0 0 var(--surface)` sur `.modal-sticky-header` — peint hors de la
  boîte (contrairement à `background`), comble l'interstice sans toucher au calcul sticky/scroll.
  Supprime au passage l'override `[data-theme="light"]` devenu redondant (`var(--surface)` vaut
  déjà `#FFFFFF` en thème clair).
- Vérifié : fix injecté et testé en direct sur le Pixel 8 réel avant application au code
  (capture avant/après), puis reconfirmé une fois déployé.

## Audit swipe-to-close (agent, lecture seule) et clarification

Un agent dédié a audité le mécanisme de swipe-to-close (`app.js`, IIFE dédiée) : fonctionne
correctement de bout en bout (fermeture propre, pas de blocage). Risque identifié mais non retenu
comme cause principale : conflit potentiel entre le scroll natif du sheet et le `transform` JS du
drag sur les modales à contenu long. Un test réel (swipe pendant que des résultats de recherche
défilaient) a montré l'en-tête sticky flottant visuellement par-dessus le contenu en cours de
drag — very probablement le même mécanisme que le bug de l'interstice ci-dessus, donc réglé par
la même occasion. Clarification de l'utilisateur en cours de session : le souci perçu était en
fait le scroll/swipe **dans** les menus (listes de contenu), pas le swipe-to-close lui-même — ce
qui a mené directement au bug de l'interstice ci-dessus.

## Feature : modales en plein écran (demande explicite)

Question de l'utilisateur ("pourquoi les modales ne prennent pas tout l'écran ?") clarifiée comme
un choix de design assumé (bottom sheet à 92%/90% de hauteur, bande de fond assombri visible en
haut) — mais l'utilisateur a demandé le passage en plein écran partout après explication.

- `.modal-sheet,.settings-sheet` : `height`/`max-height` forcés à `var(--app-height, 100dvh)` (au
  lieu de `min(92dvh/90dvh, ...)`), `border-radius` supprimé (coins carrés, edge-to-edge).
- Sur les modales à contenu court (Copier ce repas, éditer un poids, date favori sport...), le
  plein écran laissait un grand vide sous le dernier élément — boutons flottant au milieu de
  l'écran. Décision utilisateur (question posée avec aperçus ASCII) : coller les boutons en bas
  plutôt que centrer le contenu ou revenir en arrière.
- **Fix ciblé, pas une règle générale** — chaque modale vérifiée une par une via le pont DevTools
  distant (liste des enfants directs du sheet, contenu des conteneurs ambigus) avant d'écrire une
  règle, pour ne pas pousser par erreur une LISTE de contenu (recettes/aliments/poids/favoris) en
  bas d'écran (casserait sa position naturelle sous la recherche) : `display:flex;
  flex-direction:column` sur tout sheet, `margin-top:auto` sur le dernier élément (ou le premier
  des deux derniers, quand ce sont deux boutons frères non groupés dans un conteneur commun) pour
  8 modales identifiées comme se terminant réellement par un bouton/une rangée d'action :
  `modal-add`, `modal-ai`, `modal-copy-meal`, `modal-edit-weight`, `modal-recipe-editor`,
  `modal-custom-food`, `modal-sport-favs`, `modal-sport-fav-date`.
- `!important` nécessaire sur ces règles : l'élément ciblé porte souvent un style inline
  `margin-top:14px` (rangées de boutons générées en JS), qui bat toujours une règle externe à
  spécificité égale — sans purger cet inline au cas par cas dans chaque template.
- Modales explicitement laissées sans ce fix (contenu long qui remplit déjà l'écran, ou liste de
  contenu en fin de sheet où pousser casserait la mise en page) : `modal-recipes`,
  `modal-aliments`, `modal-favs-quick`, `modal-weight`, `modal-places`, `modal-settings`,
  `modal-recipe-picker`, `modal-recipe-link`, `modal-barcode`, `modal-recipe-date-meal`.
- Vérifié sur le fichier réel (pas seulement un aperçu tapé à la main — un premier essai avec
  `!important` manquant a été détecté précisément grâce à cette vérification sur fichier réel,
  avant tout déploiement) : `modal-add`, `modal-recipe-editor`, `modal-weight` (contenu long,
  inchangés/corrects), `modal-copy-meal`, `modal-edit-weight` (contenu court, boutons bien collés
  en bas). Reconfirmé une fois déployé (contournement du cache HTTP habituel de `styles.css`).

## Outillage mis en place (réutilisable)

- **Accès DevTools distant sans `chrome://inspect`** (qui échouait, `ERR_INVALID_URL`, cause non
  identifiée) : `adb forward tcp:PORT localabstract:chrome_devtools_remote[_PID]` (nom de socket
  variable, trouvé via `adb shell cat /proc/net/unix | grep devtools`) puis requêtes HTTP/WS
  directes sur l'API CDP (`GET /json` pour lister les pages, `Runtime.evaluate` en WebSocket pour
  exécuter du JS). Scripts Node autonomes dans le scratchpad de session (`cdp_eval.mjs` pour
  exécuter une expression, `cdp_inject_css.mjs` pour injecter le contenu d'un fichier CSS local
  dans la page réelle, contournant les soucis de mixed-content HTTPS/HTTP d'un simple `fetch`).
- **ADB Platform Tools** installé localement (`C:\adb-tools`) pour piloter le Pixel 8 en
  parallèle : captures d'écran (`screencap`), taps/swipes réels (`input tap`/`input swipe`/
  `input text`), et dump de l'arbre d'accessibilité (`uiautomator dump`) pour des coordonnées de
  tap précises plutôt que devinées visuellement.
- Piège rencontré et documenté : Git Bash (MSYS) réécrit les chemins commençant par `/` passés à
  `adb` (ex. `/sdcard/...`) en chemins Windows — contournement par le préfixe `//` sur l'argument
  concerné (pas sur tous, au cas par cas).

## Non vérifié / limites connues

- Le point "swipe dans les menus" reste qualitatif (pas de casse fonctionnelle confirmée au-delà
  de l'effet visuel de l'en-tête flottant, probablement réglé par le fix de l'interstice) — à
  reconfirmer si l'utilisateur ressent encore une instabilité en usage normal.
- `chrome://inspect` reste cassé sur ce téléphone (`ERR_INVALID_URL`) — cause non investiguée
  (suspicion : interférence d'une extension de sécurité sur la saisie de la barre d'adresse) ;
  contourné via le pont CDP manuel, pas résolu à la racine.
