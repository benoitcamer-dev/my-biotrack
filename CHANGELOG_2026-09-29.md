# Changelog — Session du 29/09/2026

Un bug signalé par l'utilisateur : un itinéraire de marche calculé en aller-retour
apparaissait dans le journal comme un simple aller. Puis, en discutant, une protection
contre le double comptage d'un itinéraire déjà en boucle.

Commits : `7e6a5b0`, `25c693a`.

## 1. Itinéraire aller-retour affiché comme un simple aller

**Constat** (journal du 29/09) : entrée `🚶 Domicile → INDEGO (22min · 2.2km · 6km/h)`,
130 kcal, saisie avec la case « aller-retour » cochée.

**Diagnostic** : `calcMultiLegRoute(['Domicile','INDEGO'])` donne **1,1 km** en aller simple.
Les 2,2 km enregistrés sont donc bien l'aller-retour : distance, durée et kcal étaient justes.
Seul le **libellé** était trompeur : `submitEntry()` construisait le nom à partir des étapes
(`waypoints.join(' → ')`), sans jamais tenir compte de `currentRouteData.roundtrip`. Ce drapeau
ne servait qu'à doubler la distance dans `calcRoute()`.

**Fix** (`7e6a5b0`), option choisie par l'utilisateur (marqueur `⇄`) :
- 2 points : `A ⇄ B` ; plus de 2 points : `A → B → C ⇄`.
- Pas de marqueur pour un **favori nommé** (« Aller-retour psy », « Aller-Retour Bureau ») :
  son nom sert de libellé et le dit déjà.
- `editEntry()` reconnaît aussi `⇄` (en plus de `marche` / `trajet` / `→`) pour rouvrir
  l'entrée comme un trajet de marche. Sinon, un libellé `A ⇄ B` sans `→` retombait dans la
  branche sport générique.
- Non touché : la saisie de marche par l'Assistant IA (`walk_steps`), qui ne connaît pas de
  notion d'aller-retour.

**Données** : l'entrée du jour (id 2772) a été renommée à la main en
`🚶 Domicile ⇄ INDEGO (22min · 2.2km · 6km/h)`, sans changer `val` (130 kcal).

**Vérifié** : `app.js` déployé contient le fix (fetch `cache: 'no-store'`). Aucun itinéraire
test enregistré, pour ne pas polluer le journal.

## 2. Aller-retour ignoré quand l'itinéraire est déjà une boucle

**Contexte** : pour un trajet A → B → C → A, l'utilisateur saisit les 4 étapes **sans**
cocher aller-retour : la distance suit alors le vrai retour C → A. Cocher aussi la case
aurait doublé la boucle entière (distance, durée, kcal). Cocher la case avec seulement A, B, C
reste possible : l'app double A → B → C, c'est-à-dire un retour par le même chemin (C → B → A).

**Fix** (`25c693a`) : dans `calcRoute()`, si l'itinéraire compte plus de 2 étapes et que la
dernière est identique à la première (comparaison sans casse ni espaces), la case est
décochée et un toast s'affiche : « Boucle déjà fermée : aller-retour ignoré. »

**Vérifié en ligne** (Chrome via Claude in Chrome, SW désenregistré + caches vidés), sans
rien enregistrer :

| Itinéraire | Case cochée | Distance |
|---|---|---|
| Domicile → Psy → Bureau → Domicile | oui | 3,6 km, case décochée (7,2 km avant) |
| Domicile → Psy → Bureau → Domicile | non | 3,6 km |
| Domicile → INDEGO | oui | 2,2 km (doublée, comme prévu) |

## 3. Étapes ajoutées sans suggestions Google Places

**Constat** (utilisateur) : « quand j'ai 4 lieux, ça ne me propose plus Google Maps ».

**Diagnostic** : le nombre de lieux n'y était pour rien. `addWalkStep()` créait le champ
sans jamais appeler `_attachPlacesAutocomplete()`, qui n'était lancé qu'à l'entrée en mode
itinéraire (`setWalkMode('route')`). Seuls Départ et Arrivée avaient donc les suggestions ;
toute étape ajoutée via « + Étape » en était privée (`_placesAttached: false`).

**Fix** (`5a73c48`) : `addWalkStep()` appelle `_attachPlacesAutocomplete()` (si la clé Maps
est configurée et l'API chargée). Au passage, `updateWalkStepIndices()` renumérote les
placeholders des étapes : ils étaient décalés (« Étape 2 », « Étape 3 » au lieu de 1, 2).

## 4. Réouverture du formulaire : l'Arrivée était supprimée à la place des étapes

**Constat** (découvert en testant le point 3) : après avoir ajouté des étapes puis fermé le
formulaire, la réouverture affichait un 4e champ « Étape 1… » au lieu de « Arrivée… ».

**Cause** : `resetWalkRouteForm()` gardait les 2 **premières** lignes (`i >= 2` supprimées),
donc Départ + la 1re étape, et supprimait la vraie ligne Arrivée.

**Fix** (`3e56f73`) : on garde la première et la **dernière** ligne
(`i > 0 && i < rows.length - 1` supprimées).

## 5. Plus de bouton « supprimer la ligne » sur l'Arrivée

**Contexte** : dès qu'une étape existait, la ligne Arrivée affichait un ✕ de suppression
(à droite), contrairement au Départ. La supprimer laissait la dernière étape jouer l'arrivée
sous le libellé « Étape N… », et ce ✕ se confondait avec le ✕ « effacer le texte » de gauche.

**Fix** (`f3bcf63`), option choisie par l'utilisateur : `updateWalkStepIndices()` n'affiche
ce bouton que sur les étapes intermédiaires. Pour changer d'arrivée : effacer le texte (✕ de
gauche) ou réordonner avec les flèches.

**Vérifié en ligne** :
- Chrome (SW désenregistré + caches vidés) : ouverture → 2 étapes → fermeture → réouverture →
  2 étapes ; les 4 champs ont l'autocomplétion et les bons libellés ; suggestions « Place
  Bellecour » affichées dans « Étape 2 ».
- Téléphone (vraie PWA sous Brave, via ADB + CDP, SW actif) : après un rechargement, les 3
  correctifs sont chargés ; saisie réelle au clavier dans « Étape 2 » → 5 suggestions Google
  affichées ; ✕ de suppression présent sur les étapes, absent sur l'Arrivée. Formulaire
  refermé sans rien enregistrer.
