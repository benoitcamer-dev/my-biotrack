# Changelog — Session du 11/09/2026

Audit multi-agents (analyse statique du code en parallèle d'un audit fonctionnel live sur
le Pixel 8 de l'utilisateur, pilotage ADB), suivi de correctifs sur l'itinéraire marche,
la sécurité, la cohérence des données et deux graphiques. Chaque correctif a été appliqué
dans `app.js`/`index.html`/`styles.css` puis resynchronisé dans `index-complet.html`
(`node verify.js` OK à chaque étape), poussé sur `main`, et vérifié en direct sur le site
déployé après propagation du déploiement GitHub Pages (`gh run list`/`gh run view` pour
confirmer la fin du build avant de re-tester).

## 1. Itinéraire marche : bouton d'effacement rapide (Départ/Arrivée/Étapes)

**Demande** : un moyen facile d'effacer le contenu d'un champ d'adresse (Départ, Arrivée,
ou une étape intermédiaire) sans avoir à sélectionner puis effacer le texte à la main.

**Fix** : nouveau bouton "×" compact (`clearWalkStep()`, classe `.walk-clear-btn`) sur
chaque ligne du formulaire Itinéraire, placé juste après les boutons monter/descendre.
Un tap vide uniquement le texte du champ (sans supprimer la ligne — à distinguer du
bouton "×" déjà existant sur les étapes intermédiaires, qui lui supprime toute la ligne),
referme le dropdown Google Places s'il était ouvert, et garde le focus dans le champ pour
retaper directement. Même technique de zone de tap invisible agrandie via `::before` que
`.walk-move-btn` (audit du 04/09/2026), pour rester tactile sans surcharger visuellement
une ligne déjà dense (jusqu'à 3 boutons à droite).

**Vérifié en direct sur le Pixel 8** : le bouton efface bien le texte du champ Départ,
garde le focus, rouvre le clavier avec les suggestions natives.

## 2. Audit multi-agents (code + Pixel 8 en direct)

Deux agents lancés en parallèle : un audit statique complet du code (lecture seule), un
audit fonctionnel en conditions réelles sur le Pixel 8 (pilotage ADB, comme les sessions
précédentes — voir `../Bonne pratiques IA/conseils_environnement_travail.md` §16).

**Audit statique — résultats traités ci-dessous (points 3 à 6)**, plus deux points
vérifiés sains sans action nécessaire :
- Pointer Events (`pointerdown`/`pointermove`/`pointerup`/`pointercancel`) : les 3
  implémentations tactiles gèrent toutes correctement `pointercancel`, aucune régression
  du bug corrigé le 13/08/2026.
- `MutationObserver` (icônes Lucide, `.search-active-footer`) : instances uniques créées
  au chargement, pas de fuite.

**Audit live (Pixel 8)** — points du changelog du 10/09/2026 reconfirmés fonctionnels
(champ Arrivée, fond flouté défensif, clavier numérique, liste ingrédients IA), plus deux
constats traités aux points 8 et 9 ci-dessous, et deux bugs cosmétiques mineurs relevés
sans effet fonctionnel :
- **Point 2 du changelog du 10/09 (nom du lieu dans le journal)** : confirmé fonctionnel,
  mais piège UX découvert en creusant un faux positif de test — voir point 8 ci-dessous.
- Écrans balayés sans anomalie : Aliments, Recettes, Lieux, Sports (formulaires Vélo/
  Itinéraire/Simple, favoris), Réglages, Bilan (périodes, export CSV), Poids (ajout, IMC).

## 3. XSS stocké — noms d'ingrédient IA non échappés (CRITIQUE)

**Cause** : `ing.name` (issu de la réponse Gemini) était injecté via `innerHTML` **sans
`escHtml()`** dans les deux rendus de tableau d'ingrédients (`_rebuildEntryIngTable()`,
`_rebuildIngredientTable()`), contrairement aux noms d'aliment/lieu déjà protégés depuis
le 22-23/08/2026. La note dérivée est persistée dans `entries.desc` (Supabase) et se
ré-affiche à chaque ouverture du détail de l'entrée — un nom d'ingrédient contenant du
HTML/JS se serait exécuté à chaque réouverture. Trou pré-existant (pas introduit le
10/09), jamais documenté, reconduit tel quel par la refonte du 10/09/2026 de
`_rebuildIngredientTable()`.

**Fix** : `escHtml()` ajoutée aux deux endroits.

## 4. Biais "Lyon" forcé oublié sur `savePlace()` et `saveQuickPlace()` (IMPORTANT)

**Cause** : la session du 10/09/2026 a retiré le biais dur "Lyon"/"Lyon France" de
`geocodePlace()`/`geocodeAddress()` (cassait la recherche hors de Lyon, ex. en voyage) —
mais deux points d'entrée sœurs avaient le même code dupliqué, oubliés de ce fix :
`savePlace()` (enregistrement d'un lieu dans "Mes lieux") et `saveQuickPlace()` (bouton
"Sauvegarder ce lieu" de l'itinéraire, cette 2e occurrence trouvée en creusant la
première, pas relevée par l'audit initial).

**Fix** : biais dur retiré des deux fonctions ; `geocodeAddress()` garde déjà ses biais
géographiques doux (`region`/`bounds`).

## 5. Fuite de note IA food → sport (IMPORTANT)

**Cause** : `addAIEntry()` (flux normal d'ajout via l'assistant IA) protège l'usage de la
note IA détaillée avec une garde `isSport` (une entrée sport n'a jamais de note
d'ingrédients food attachée). `_confirmAIEdit()` (flux "Modifier via IA" d'une entrée déjà
existante) n'avait pas cette garde — `_aiLastFoodNote` n'étant mise à jour que par la
branche "food" de la réponse IA (jamais réinitialisée par une réponse "sport"), un échange
food antérieur dans la même session pouvait accrocher une note périmée à une entrée sport
lors de sa confirmation, faisant ensuite afficher un faux tableau d'ingrédients éditable
(`showEntryDetail()` déclenche le rendu dès que la note contient "→").
Complémentaire : `_openAIModalCore()` (ouverture de l'assistant IA global via
`openAIModalGlobal()`) ne réinitialisait pas `_aiLastFoodNote` à l'ouverture, contrairement
aux deux autres points d'entrée du même flux (`openAIModal()`, `_editViaAI()`).

**Fix** : garde `isSport` ajoutée dans `_confirmAIEdit()` (alignée sur `addAIEntry()`) ;
reset de `_aiLastFoodNote` ajouté dans `_openAIModalCore()`.

## 6. `SHEETS_TO_LIFT` incomplet (IMPORTANT)

**Cause** : le nudge JS qui remonte une modale au-dessus du clavier virtuel quand un champ
texte déborde (`SHEETS_TO_LIFT`, liste de modales couvertes) ne comprenait pas
`modal-places` (champ `place-form-addr`) ni `modal-sport-favs` (champs `sf-new-from`/
`sf-new-to`) — pourtant les mêmes champs `.walk-places-input` que ceux touchés par les
correctifs adresse/clavier du 10/09/2026.

**Fix** : `modal-places` et `modal-sport-favs` ajoutés à `SHEETS_TO_LIFT`.

## 7. Cible tactile + anti-double-tap (MINEUR)

- `.ing-del-btn` (bouton suppression d'un ingrédient, résultat multi-ingrédients IA,
  introduit le 10/09/2026) : 22×22px visuel, sous le seuil connu. Agrandi à 26×26px, zone
  de tap invisible portée à 44×44px via `::before` (seul élément interactif en bout de
  ligne, `justify-content:space-between`, donc sans risque de chevaucher un autre bouton).
- `_saveIngEdits()` (sauvegarde des modifications d'ingrédients dans le détail d'une
  entrée) : la garde anti-double-tap (`btn.disabled = true`) n'intervenait qu'après 2
  aller-retours réseau (auth + lecture de l'entrée), laissant une fenêtre pour un second
  tap rapide. Déplacée avant le premier `await`, avec réactivation du bouton sur les
  chemins d'erreur.

**Vérifié et écarté (pas un bug)** : `ciqual_foods.delete()` sans `.eq('user_id', ...)` —
confirmé via une lecture anonyme (clé anon, lecture seule) que la table n'a aucune colonne
de propriétaire (`id, name, kcal_100, prot_100, gluc_100, lip_100, is_average`), cohérent
avec sa nature de base curée partagée entre tous les utilisateurs, pas une table
par-utilisateur comme `entries`/`custom_foods`. Le filtre ne s'applique donc pas ici.

## 8. Itinéraire marche : piège UX si "Calculer" n'est jamais pressé + bug de données périmées

**Symptôme découvert en creusant un faux positif de l'audit live** : un premier test
(chip "Laiterie de Lyon" → Valider directement, sans taper "Calculer") a semblé produire
un bug — l'entrée sauvegardée affichait juste "Marche (30min·3km·6km/h)" sans nom de lieu.
**Pas un bug de fond** : le bloc kcal/distance générique (`#in-qty`/`#in-speed`/
`#in-distance`, formule durée×vitesse) s'affiche par défaut dès que Départ+Arrivée sont
non vides, **indépendamment** du vrai calcul d'itinéraire ORS — si on ne tape pas
explicitement "Calculer", `currentRouteData` reste `null` et l'entrée retombe sur le
libellé générique, silencieusement.

**Bug de données périmées trouvé en creusant ce point** : `currentRouteData` (résultat du
dernier calcul réussi) n'était jamais invalidé si on modifiait une adresse *après* un
calcul déjà fait — Valider aurait alors silencieusement enregistré l'ancien trajet calculé
(nom de lieu et distance inclus) au lieu du nouveau.

**Fix** :
- Nouveau bandeau d'avertissement (`#walk-not-calculated-hint`), visible tant qu'aucun
  calcul réel n'a été fait pour l'itinéraire courant (`_updateWalkNotCalcHint()`), appelé
  à chaque changement de mode et à la fin de `calcRoute()`.
- Nouvel écouteur délégué sur `.walk-step-input` (`input`) qui invalide `currentRouteData`
  et `currentWalkFavName`, masque le résultat de calcul affiché, et réaffiche le bandeau
  dès qu'un champ change — frappe manuelle, chip "Lieux enregistrés" (`fillWalkStepFromPlace`),
  pré-remplissage Départ (`prefillHomeDeparture`), ou le nouveau bouton `clearWalkStep()`
  du point 1 (tous dispatchent déjà un événement `input` synthétique).

**Vérifié en direct sur le Pixel 8** : le bandeau apparaît dès l'ouverture de l'onglet
Itinéraire (Départ pré-rempli, Arrivée vide), reste affiché même après avoir tapé une
adresse valide dans Arrivée, et **disparaît après un "Calculer" réussi** (testé Domicile →
Corep : 3.7km · 37min · 220kcal, avant fermeture sans validation).

## 9. Deux bugs graphiques (Bilan net, Évolution du poids)

- **"Bilan net / jour"** : l'axe Y sous zéro affichait "250"/"500"/"750" au lieu de
  "-250"/"-500"/"-750" — `Math.abs(v)` passé à `fmtNum()` effaçait le signe, et le
  `"+" : ''` conditionnel ne le restituait que pour les valeurs positives. Fix :
  `(v > 0 ? '+' : '-') + fmtNum(Math.abs(v))`.
- **"Évolution du poids"** : les valeurs min/max de l'axe Y étaient dessinées en double —
  une fois par les labels `#y-axis-min`/`#y-axis-max` (positionnés en `absolute`
  par-dessus le SVG), une fois par la boucle de gridlines du SVG qui les incluait aussi
  (`for (let w = minW; w <= maxW; ...)`, bornes incluses). Le doublon du bas chevauchait
  en plus la date sous le graphique. Fix : `w === minW`/`w === maxW` exclus du texte
  dessiné par la boucle (la ligne de grille elle-même reste dessinée).

**Vérifiés en direct sur le Pixel 8** : axe "Bilan net" affiche bien le signe négatif
("-250"/"-500"/"-750") ; axe "Évolution du poids" n'affiche plus qu'une seule fois "100"
en haut et "75" en bas, sans chevaucher la date "3 janv."

## 10. Incident lors du nettoyage du journal (transparence)

En supprimant les 2 entrées de test créées par l'agent d'audit du point 2
("Marche 30min·3km·6km/h -178kcal" et "Domicile → Laiterie de Lyon -59kcal"), une erreur
de calibration de tap (piège n°2 documenté dans `conseils_environnement_travail.md` §16 :
estimer une coordonnée depuis l'image réduite affichée par `Read` induit en erreur) a fait
supprimer par erreur une **vraie** entrée : "Domicile → Corep (24min·2.4km·6km/h) -142kcal".
Le toast "Annuler" affiché après suppression a été manqué (tap de rattrapage arrivé trop
tard). Signalé immédiatement à l'utilisateur, qui a recréé l'entrée lui-même — confirmé
identique à l'original après recréation (24min·2.4km·6km/h, -142kcal). Les 2 entrées de
test ont ensuite été supprimées avec succès, sans nouvel incident, après recadrage
systématique (crop + zoom) de chaque bouton avant tout tap de suppression.

## Ce qui n'a pas été touché (hors scope de cette session)

- Points "mineurs" de l'audit non liés à un bug utilisateur direct, déjà traités au
  point 7 — rien de résiduel identifié.
- Restriction dure `componentRestrictions: { country: 'fr' }` (autocomplete) et
  `countrycodes=fr` (Nominatim) : non modifiées, mêmes raisons que le 10/09/2026 (pas
  soulevé cette session).
