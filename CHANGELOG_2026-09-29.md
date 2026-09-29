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
