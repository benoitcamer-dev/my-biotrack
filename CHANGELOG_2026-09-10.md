# Changelog — Session du 10/09/2026

Trois correctifs autour de la saisie d'adresse/itinéraire (marche) et du journal, demandés en
usage réel. Chaque correctif a été appliqué dans `app.js` puis resynchronisé manuellement dans
`index-complet.html` (`node verify.js` OK à chaque étape), poussé sur `main`, et vérifié en direct
sur le site déployé après propagation du déploiement GitHub Pages (`gh run list` pour confirmer la
fin du build avant de re-tester).

## 1. Nom du lieu affiché dans le journal plutôt que l'adresse brute

**Symptôme remonté** : en enregistrant un itinéraire de marche, le journal affiche l'adresse tapée
(ex. "13 rue Montebello") au lieu du nom du lieu que représente cette adresse (ex. "Laiterie de
Lyon").

**Cause** : deux endroits jetaient l'information de nom au profit de l'adresse brute.
- `_attachPlacesAutocomplete()` (écouteur `place_changed` de Google Places) ne retenait que
  `place.formatted_address` pour affichage, jamais `place.name` (pourtant déjà demandé dans
  `fields`).
- `geocodePlace()`, quand l'adresse tapée correspondait à un lieu enregistré ("Mes lieux"),
  retournait `label: p.address` au lieu de `label: p.name` — comportement incohérent avec le flux
  d'ajout par photo IA, qui lui affichait déjà le nom du lieu enregistré correspondant.

**Fix** :
- Nouveau cache `_placeNameByAddress` (adresse Google formatée → nom d'établissement), rempli à la
  sélection d'une suggestion Google Places quand `place.name` diffère de `place.formatted_address`.
- `calcMultiLegRoute()` consulte ce cache pour chaque étape de l'itinéraire avant de construire le
  libellé final (`waypoints`).
- `geocodePlace()` renvoie désormais `p.name` (pas `p.address`) pour un lieu enregistré trouvé par
  correspondance de nom.

**Vérification en direct** (API Google réelle, avec la clé déjà configurée dans les Réglages) :
recherche "Laiterie de Lyon" → `place.name` = "Laiterie de Lyon", `place.formatted_address` =
"13 Rue Montebello, 69003 Lyon, France" (bien distincts). Re-géocodage de cette adresse exacte (ce
que fait `calcMultiLegRoute()` en interne) renvoie **exactement** la même chaîne formatée → la
correspondance dans le cache fonctionne, le nom s'affiche bien dans le journal. Confirmé avec les
vrais lieux enregistrés de l'utilisateur (Domicile, Psy, Bureau...).

**Effet de bord identifié et accepté** : pour une adresse "nue" sans établissement (ex. "20 rue de
la République"), `place.name` diffère aussi de `place.formatted_address` chez Google (forme courte
sans ville/code postal, ex. "20 Rue de la République" vs "20 Rue de la République, 69190
Saint-Fons, France") — le journal affichera donc systématiquement la forme courte, pas seulement
pour un vrai nom de commerce. Décision explicite de l'utilisateur : accepté tel quel (l'app étant
mono-ville, perdre ville/code postal de l'affichage n'est pas gênant).

## 2. Date du jour présélectionnée sur Copier/Déplacer une entrée du journal

**Demande** : les popups "Copier vers un autre jour" / "Déplacer l'entrée" préremplissaient le
champ date avec celui de l'entrée d'origine (`entry.date || journalDateStr()`) — cas d'usage rare —
plutôt qu'avec la date du jour, qui est le cas d'usage le plus fréquent (reporter un repas déjà
saisi vers aujourd'hui).

**Fix** : `_moveEntry()`/`_copyEntry()` préremplissent maintenant avec `todayStr()`. Ajout d'un
badge "Aujourd'hui" + bordure accentuée sur le champ date (nouvelle fonction `_updateTodayBadge()`,
appelée à l'ouverture et à chaque changement manuel de la date) pour rendre visuellement évident
que c'est bien aujourd'hui qui est sélectionné par défaut — option retenue parmi 3 proposées
(champ natif discret / réutiliser le sélecteur calendrier custom déjà utilisé ailleurs dans l'app /
juste la présélection sans changement visuel).

## 3. Recherche d'adresse : ne plus forcer "Lyon" dans la requête (cassait la recherche en voyage)

**Symptôme identifié en creusant le point 1** : `geocodePlace()`/`geocodeAddress()` accolaient en
dur "Lyon"/"Lyon France" au texte de recherche envoyé à Google Geocoding, même quand l'adresse
recherchée ne concernait pas Lyon — cassant potentiellement le calcul d'itinéraire en voyage.

**Preuve concrète (API Google réelle)** : recherche "Café de Flore" (sans ville précisée) —
- **Avant** (avec "Lyon France" forcé) : résout vers *"5 Rue de Nuits, 69004 Lyon, France"* — un
  restaurant quelconque à Lyon, pas le vrai Café de Flore.
- **Après** (texte tel quel + biais géographique doux `bounds`/`region`) : résout correctement vers
  *"172 Bd Saint-Germain, 75006 Paris, France"* — le vrai Café de Flore.

**Fix** :
- `geocodePlace()` : n'ajoute plus "Lyon" au texte avant d'appeler `geocodeAddress()`.
- `geocodeAddress()` (Google) : n'ajoute plus "Lyon France" à la requête — garde `region=fr` et
  `bounds=45.70,4.77|45.82,4.90`, des paramètres de biais *doux* (préférence de classement, jamais
  d'exclusion), suffisants pour continuer à favoriser Lyon sur une requête ambiguë locale (vérifié :
  "Rue de la République" sans ville résout quand même vers Lyon).
- `geocodeAddress()` (fallback ORS/Pelias) : `boundary.rect.*` (filtre **dur**, excluait purement et
  simplement tout résultat hors de la zone Lyon) remplacé par `focus.point.lat/lon` (biais doux
  équivalent à `bounds` côté Google).

**Limite résiduelle identifiée et communiquée** (pas corrigée, comportement volontaire du menu
déroulant) : pour une rue au nom ambigu existant dans plusieurs villes (ex. "Rue de l'Arbre Sec",
qui existe à Lyon **et** à Paris), le menu de suggestions Google propose bien les deux villes
(Lyon en premier à cause du biais, Paris juste après) — sélectionner dans la liste résout donc sans
ambiguïté. Mais si l'adresse est retapée/re-géocodée sans passer par une sélection dans le menu
(cas du recalcul d'itinéraire), Google ne renvoie qu'un seul résultat (Lyon) et l'app le prend sans
avertissement. À garder en tête en voyage : toujours sélectionner une suggestion plutôt que taper
l'adresse complète à la main.

## 4. Itinéraire marche : impossible d'écrire dans le champ "Arrivée" (clavier ne s'ouvrait pas)

**Symptôme remonté** : en tapant sur le champ "Arrivée" de l'itinéraire marche, l'écran se
décalait vers le bas et le clavier virtuel ne s'ouvrait jamais — impossible d'y écrire quoi que ce
soit. "Départ" (premier champ, déjà visible sans scroll) n'était pas affecté.

**Cause** : le listener `scroll` posé sur `document` (capture) pour fermer le dropdown Google
Places (`.pac-container`) dès qu'on scrolle à l'intérieur d'une modale appelait
`blurActiveAddressInput()` sur **tout** scroll du sheet, sans distinguer un scroll volontaire de
l'utilisateur d'un scroll **automatique du navigateur** déclenché par le focus lui-même
(scroll-into-view natif pour dégager la place du clavier virtuel). "Arrivée", situé plus bas dans
le formulaire que "Départ", nécessitait quasi systématiquement ce scroll natif — qui blurait
aussitôt le champ qu'on venait de sélectionner, annulant l'ouverture du clavier.

**Fix** : garde temporelle de 600ms posée sur `focusin` d'un champ d'adresse
(`.walk-step-input`/`.walk-places-input`) — pendant cette fenêtre, le listener `scroll` ignore
l'appel à `blurActiveAddressInput()`. Un scroll manuel ultérieur (au-delà de cette fenêtre) reste
traité normalement, la fermeture du dropdown Google sur scroll volontaire n'est pas affectée.

**Vérifié en direct sur l'appareil réel** (Pixel 8 de l'utilisateur, pilotage ADB en ligne de
commande — voir `../Bonne pratiques IA/conseils_environnement_travail.md` §16) après déploiement
et propagation GitHub Pages confirmée (`gh run view`) : Sport → Marche → Itinéraire → tap sur
"Arrivée" → clavier s'ouvre correctement, saisie ("Bureau") fonctionne, suggestions Google Places
s'affichent. Avant le fix, la même séquence blurait le champ instantanément (cause reproduite par
lecture de code, confirmée corrigée par ce test).

## 5. Refonte de la liste d'ingrédients IA (résultat multi-ingrédients, repas et recette via IA)

**Symptôme remonté** : avant de valider une recette écrite via l'assistant IA, impossible de
scroller dans la zone listant les ingrédients détectés ; par ailleurs le rectangle de chaque
ingrédient jugé "bien trop petit".

**Cause identifiée** : chaque ligne d'ingrédient (`_rebuildIngredientTable()`) entassait sur une
seule rangée flex le nom + 3 champs numériques (qté/kcal-100/kcal-total, 52-58px de large chacun)
+ 2 libellés d'unité + un bouton de suppression. Sur un écran mobile étroit, le nom (seul élément
flexible) se retrouvait écrasé sur une largeur résiduelle minime, provoquant un retour à la ligne
sur plusieurs lignes et un rendu très dense — la sensation de "rectangle trop petit". Le scroll de
la liste dans son ensemble dépend de `.modal-sheet` (déjà `overflow-y:auto`, fix tab-closing du
09/09/2026 déjà en place et vérifié synchronisé) ; aucune régression distincte trouvée à ce niveau
mais non re-testée en direct (même blocage d'outillage que le point 4 ci-dessus).

**Fix** : nouveau layout par ingrédient — nom sur sa propre ligne (plus de place, plus lisible),
puis les 3 champs qté/kcal-100/kcal-total en grille 3 colonnes avec un libellé au-dessus de chaque
champ (au lieu d'unités abrégées collées sur le côté) et une hauteur de champ portée à 36px min.
Nouvelles classes CSS (`.ai-ing-row`, `.ai-ing-row-top`, `.ai-ing-name`, `.ai-ing-row-fields`,
`.ai-ing-field(-label)`, `.ai-ing-total-row`) dans `styles.css`, appliquées dans
`_rebuildIngredientTable()` (`app.js`). Comportement fonctionnel (édition/suppression d'un
ingrédient, recalcul du total) inchangé.

**Vérifié en direct sur l'appareil réel** (Pixel 8, ADB) : recette IA testée de bout en bout
(saisie "Riz 150g poulet 120g sauce soja 10g" dans l'Assistant IA ouvert depuis l'éditeur de
recette → 3 ingrédients détectés par Gemini, chacun affiché en carte nom+3 champs comme prévu →
scroll fluide jusqu'au bouton "Ajouter au journal" en bas, aucun blocage constaté). Donnée de test
non conservée (fermé sans enregistrer).

## 6. Itinéraire marche : nom du lieu toujours affiché en adresse brute malgré le fix du point 1

**Symptôme remonté en usage réel** (après le point 1, donc pas détecté par les vérifications de ce
point-là) : un itinéraire Domicile → Laiterie de Lyon, une fois validé, affichait dans le journal
"🚶 74 Rue Pierre Corneille, 69003 Lyon, France → 13 Rue Montebello, 69003 Lyon, France" — les
adresses brutes des deux lieux, malgré le fix du point 1 censé afficher les noms.

**Cause réelle** : `geocodePlace()` ne reconnaît un lieu enregistré ("Mes lieux") qu'en comparant le
texte du champ au **nom** du lieu (`p.name`). Mais les deux points d'entrée réels qui remplissent
les champs Départ/Arrivée — `prefillHomeDeparture()` (pré-remplissage auto du Départ) et
`fillWalkStepFromPlace()` (clic sur une chip "Lieux enregistrés") — écrivent tous les deux
l'**adresse** du lieu dans le champ (`p.address`), jamais son nom. La comparaison par nom dans
`geocodePlace()` ne pouvait donc quasiment jamais matcher en usage réel (seule une saisie manuelle
du nom exact l'aurait fait) : la correspondance retombait systématiquement sur un nouveau géocodage
de l'adresse brute, sans lien avec le nom du lieu enregistré. Le fix du point 1 (cache
`_placeNameByAddress`, alimenté uniquement à la sélection d'une suggestion Google Places) ne
couvrait donc pas ce cas, le plus courant.

**Fix** : `geocodePlace()` reconnaît maintenant un lieu enregistré aussi par correspondance
**exacte d'adresse** (`p.address`), en plus du nom — réutilise directement les coordonnées déjà en
cache et retourne `label: p.name`, sans dépendre d'un round-trip de géocodage dont le résultat
pourrait différer textuellement de l'adresse stockée.

**Vérifié en direct sur le Pixel 8** (via ADB) : les deux entrées Sport déjà présentes dans le
journal (issues du test du point 1, avant ce fix) affichent toujours les adresses brutes — normal,
un fix de code ne réécrit pas les entrées déjà enregistrées. Nouvelle entrée non testée post-fix
faute de vouloir polluer davantage le journal réel de l'utilisateur avec des trajets de test ;
mécanisme vérifié par lecture de code (le point d'entrée `p.address` correspond exactement à ce que
`prefillHomeDeparture()`/`fillWalkStepFromPlace()` écrivent dans le champ, donc la comparaison
exacte matchera).

## 7. Clavier numérique (Android) : bande de la page réelle visible sous la modale/le dernier bouton

**Symptôme trouvé en testant le point 5** (assistant IA, repas) : en tapant sur un champ numérique
(ex. "Qté" d'un ingrédient) pour corriger une valeur, le clavier numérique Android s'ouvre avec sa
barre de suggestions d'autofill (icônes clé/carte/localisation) — et l'espace visible de la modale
se réduit trop court, laissant une bande de ~80-100px de la page réelle (le journal, en dessous)
visible entre le bas de la modale (bouton "Ajouter au journal" coupé à mi-hauteur) et le haut du
clavier. Stable dans le temps (pas de correction spontanée après quelques secondes) — pas un simple
délai de rendu.

**Cause probable** : `--app-height` (`_setAppHeight()`, calculé depuis `visualViewport.height`) se
fige un instant trop tôt, avant que la barre de suggestions d'autofill au-dessus du clavier
numérique ne s'affiche complètement (elle peut apparaître avec un léger retard après l'événement
`resize` principal du clavier, sans redéclencher `resize` elle-même) — la modale/l'overlay se
dimensionnent alors sur une hauteur visible légèrement surestimée.

**Fix** : recalcul de `--app-height` planifié 350ms après chaque `resize` de `visualViewport`, en
plus du recalcul immédiat déjà en place — rattrape la valeur une fois la barre d'autofill
stabilisée. Effet global (pas seulement l'assistant IA) puisque `--app-height` est utilisé par
toutes les modales de l'app.

**Non vérifié en direct après ce fix précis** (racine probable mais non confirmée à 100% sans accès
DevTools distant sur l'appareil) — à reconfirmer par l'utilisateur : rouvrir l'assistant IA, taper
sur un champ Qté/kcal d'un ingrédient, vérifier que la modale couvre bien tout l'espace jusqu'au
clavier sans bande de page visible en dessous.

## 8. Audit itinéraire marche : page réelle visible sous la modale au focus du champ "Arrivée"

**Contexte** : demande d'audit complet de la fonction itinéraire suite au signalement "l'affichage
est buggé" — reproduit en direct sur Pixel 8 (ADB), y compris sur une page **rechargée à froid**
(donc pas un état corrompu par une session de test précédente).

**Symptôme** : au tap sur le champ "Arrivée" (formulaire Itinéraire), le clavier Android s'ouvre
avec les suggestions natives de la `<datalist>` ("Domicile"/"Psy"…, lieux enregistrés dont le nom
matche). La modale se coupe alors nette juste après le champ Arrivée — tout le reste du formulaire
(+ Étape, Vitesse/Calculer, lieux enregistrés, trajets favoris, Valider) disparaît, remplacé par la
vraie page du journal visible en dessous (chiffres du jour). Confirmé **stable dans le temps**
(pas de correction après plusieurs secondes) : ce n'est pas un problème de délai de rendu.

**Cause** : `.modal-overlay`/`.modal-sheet` sont dimensionnés sur `--app-height`
(`_setAppHeight()`, calculé depuis `visualViewport.height`) pour se positionner juste au-dessus du
clavier. Avec ce clavier précis (suggestions `<datalist>` natives, plus hautes qu'une simple barre
d'autofill), `--app-height` se stabilise sur une valeur trop petite par rapport à l'espace
réellement obscurci — l'overlay ET le sheet se coupent donc nettement avant le clavier, laissant
une bande de la vraie page visible entre les deux. Le fix précédent de cette session (recalcul
différé de 350ms, point 7 ci-dessus) ne peut rien y changer : il refait la même mesure, qui donne
la même valeur stable — le problème n'est pas un timing mais une valeur de mesure durablement
fausse pour cette configuration de clavier précise.

**Fix (défensif, pas une correction pixel-perfect de `--app-height`)** : un fond plein écran
(`body.modal-open::before`, `position:fixed;inset:0;height:100dvh`, assombri + flouté, z-index 55
— juste sous le plus bas des `.modal-overlay` à 60) apparaît systématiquement dès qu'une modale est
ouverte, **indépendamment** de `--app-height` donc jamais soumis au même sous-dimensionnement.
Résultat : si l'overlay/sheet se coupe encore net sur un clavier particulier, on voit au pire un
formulaire tronqué devant un fond flouté (dégradation mineure, cohérente visuellement) — plus
jamais la page réelle qui apparaît par-dessous comme si la modale avait disparu. N'essaie pas de
deviner la hauteur exacte de chaque variante de clavier Android (fragile, impossible à valider
sans DevTools distant) : décorrèle la couverture visuelle du calcul de positionnement.

**Reste du code itinéraire audité, aucun autre problème trouvé** :
- `getWalkSteps()`/`addWalkStep()`/`removeWalkStep()`/`moveWalkStep()` (jusqu'à 6 étapes) : logique
  cohérente, pas de régression liée aux fixes précédents de cette session.
- Édition d'une entrée itinéraire déjà enregistrée (`editEntry()`) : préserve bien le libellé nommé
  (favori ou "A → B") via `currentWalkFavName`/`currentRouteData`, sans reconstruire le formulaire
  interactif complet — limitation connue et documentée (session du 04/09/2026), pas un bug.
- `saveCurrentRoute()`/`walkFavorites` (trajets favoris) : cohérent avec le fix d'affichage du nom
  du lieu (point 6) — un favori garde son propre `name` explicite, non affecté.

**Non vérifié en direct après ce fix précis** (même limite que le point 7 : pas d'accès DevTools
distant pour lire `--app-height` en conditions réelles) — mais le mécanisme est indépendant de la
cause exacte du sous-dimensionnement, donc robuste par construction. À reconfirmer par
l'utilisateur : rouvrir Itinéraire, taper sur "Arrivée", vérifier qu'un fond flouté couvre bien tout
l'écran même si le formulaire reste coupé.

## Ce qui n'a pas été touché (hors scope de cette session)

- Restriction dure `componentRestrictions: { country: 'fr' }` sur l'autocomplete Google Places —
  non modifiée : bloque toute suggestion hors de France. Pertinent seulement si l'utilisateur
  voyage à l'étranger, pas soulevé cette session.
- `countrycodes=fr` sur le fallback Nominatim (dernier maillon de la chaîne, après Google et ORS) —
  non modifié, même raison.
