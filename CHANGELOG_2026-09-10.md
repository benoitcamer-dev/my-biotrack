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

## Ce qui n'a pas été touché (hors scope de cette session)

- Restriction dure `componentRestrictions: { country: 'fr' }` sur l'autocomplete Google Places —
  non modifiée : bloque toute suggestion hors de France. Pertinent seulement si l'utilisateur
  voyage à l'étranger, pas soulevé cette session.
- `countrycodes=fr` sur le fallback Nominatim (dernier maillon de la chaîne, après Google et ORS) —
  non modifié, même raison.
