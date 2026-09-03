# Changelog — Session du 04/09/2026

Session de correctifs UI/UX déclenchée par plusieurs bugs remontés en usage réel, complétée par
une revue multi-agents (3 agents en parallèle, lecture seule) sur les modales/état résiduel, les
bugs d'affichage CSS, et le mapping des fonctions d'édition — pour élargir la recherche au-delà des
symptômes précis signalés. Toutes les corrections ont été appliquées dans `app.js`/`styles.css`
puis resynchronisées dans `index-complet.html` (`node verify.js` OK).

## Bugs remontés directement

- **Vélo — mode "Kcal machine" perdu à l'édition** : `editEntry()` ne détectait que le mode
  "vitesse" (regex sur "km/h" dans la description stockée) et retombait toujours sur ce mode avec
  une vitesse par défaut arbitraire (18 km/h), même pour une entrée créée en mode "Kcal machine"
  (calories affichées par un vélo d'appartement + correction %) — impossible de revoir/corriger ces
  valeurs. Fix : `editEntry()` détecte maintenant le format `"...kcal machine → ...kcal ajusté"`
  dans la description, réaffiche l'onglet "Kcal machine", et repréremplit les kcal machine + une
  correction % recalculée à partir des deux valeurs stockées.
- **Une entrée Boisson/repas affichait des champs "calories vélo"** : `editEntry()` avait sa propre
  logique de reset de formulaire, divergente de `resetModalForm()` (utilisée par le flux d'ajout
  "+"), et oubliait de cacher les éléments spécifiques au vélo (onglets "Vitesse/Kcal machine",
  bloc kcal machine). Un résidu du dernier mode vélo utilisé restait donc affiché en éditant une
  entrée sans rapport. Fix : `editEntry()` appelle maintenant `resetModalForm()` en tête de
  fonction, avant de repeupler les champs de l'entrée à éditer.
- **Édition d'une recette/repas via IA — ingrédients** : après une réponse IA listant plusieurs
  ingrédients, il n'y avait aucun moyen de supprimer un ingrédient en trop (seul modifier la
  quantité/les kcal était possible) sans reposer toute la question à l'IA. Fix : bouton "✕" ajouté
  sur chaque ligne d'ingrédient (dans la fenêtre de résultat IA *et* dans l'éditeur du détail d'une
  entrée déjà enregistrée), plus `_syncAIIngredientTotals()` qui régénère aussi la note textuelle
  détaillée (`_aiLastFoodNote`) après chaque correction — avant ce fix, les totaux affichés se
  recalculaient bien mais la note enregistrée gardait la liste d'ingrédients d'origine, incohérente
  avec le badge kcal une fois l'entrée rouverte.
- **Scroll "bizarre" dans la liste de recettes enregistrées** : le blocage de scroll de fond sous
  les modales (`touchmove` global, "iOS fix") listait `.recipes-list`/`#aliments-list`/
  `#places-list`/`#sport-favs-content`/`#recipe-builder-list` — de simples conteneurs flex SANS
  overflow propre, imbriqués dans le vrai conteneur scrollable `.settings-sheet`. `closest()`
  remontait jusqu'à eux en premier (plus proches dans le DOM), leur `scrollHeight == clientHeight`
  déclenchait alors `preventDefault()` : le scroll tactile de ces listes restait bloqué. Fix : ces
  sélecteurs retirés de la liste, `closest()` remonte maintenant correctement jusqu'à
  `.settings-sheet`. Corrige au passage le même risque sur les listes Aliments/Lieux/Favoris
  sport/Constructeur de recette.
- **Haut des suggestions d'aliment invisible en tapant dans un repas** : le remontage du sheet
  au-dessus du clavier virtuel (translateY calculé sur le débordement en bas) pouvait pousser le
  HAUT du sheet au-dessus de l'écran quand le formulaire était long — or le champ de recherche
  d'aliment (et son dropdown de suggestions) est proche du haut de `modal-add`. Fix : le lift est
  maintenant plafonné à `sheetRect.top - 8px`, il ne peut plus pousser le haut du sheet au-dessus de
  y=0.

## Revue multi-agents (3 audits en parallèle, lecture seule) et correctifs appliqués

**Audit "modals/état résiduel" :**
- `closeRecipeEditor()` ne retirait **jamais** `modal-open` du `<body>` (posé par
  `openRecipeEditorNew/Edit`) → après la moindre utilisation de l'éditeur de recette, la page
  Journal restait scrollée-bloquée et le bouton "+" flottant masqué en permanence, jusqu'à
  l'ouverture/fermeture fortuite d'une autre modale. **Bug critique, corrigé.**
- `editEntry()` n'ajoutait ni `modal-open` ni ne masquait le FAB (contrairement à `openModal()`) :
  le "+" restait cliquable par-dessus le formulaire d'édition, le fond restait scrollable. Corrigé.
- `openAlimentsModal`/`openSettings`/`openPlacesModal`/`openRecipesModal`/`openWeightModal`,
  ouvertes directement depuis la nav du bas, n'ajoutaient jamais `modal-open` — même symptôme. Les
  cinq corrigées (ajout à l'ouverture, retrait à la fermeture, y compris pour les deux dernières qui
  ne le faisaient pas non plus). Deux cas annexes trouvés en vérifiant les fixes ci-dessus
  (`selectFoodFromAliments()` et le retour depuis "+ Créer" dans `saveCustomFood()`) qui perdaient
  `modal-open` en revenant à `modal-add` resté ouvert derrière une modale imbriquée fermée — corrigés
  aussi.
- `SHEETS_TO_LIFT` (remontage clavier) omettait `modal-ai` et `modal-settings`, qui contiennent
  pourtant des champs texte sollicités (question IA, mots de passe en bas d'un long formulaire) —
  ajoutés par prudence.
- `openWeightModal()` ne réinitialisait jamais `#w-val` : une saisie abandonnée (fermeture sans
  valider) restait affichée à la prochaine ouverture. Corrigé.

**Audit "bugs d'affichage CSS" :**
- **Nouvel aliment caché derrière Mes aliments** : le bouton "+ Créer" (et le chemin "scan
  code-barres → produit non trouvé") ouvrait `modal-custom-food` (z83) sans fermer
  `modal-aliments` (z84) restée ouverte par-dessus — le clic semblait ne rien faire. Fix :
  `openCustomFoodModal()` ferme maintenant `modal-aliments` d'abord quand appelée avec
  `fromAlim=true` (paramètre déjà présent mais jamais utilisé jusqu'ici).
- **Classes CSS inexistantes `.food-name`/`.food-meta`** (onglet Ciqual de la modale Aliments) :
  jamais stylées, contrairement à `.food-item-name`/`.food-item-meta` utilisées par l'onglet "Ma
  base" juste à côté — rendu dégradé (police par défaut, pas de troncature). Corrigé en alignant
  sur les bonnes classes.
- **Classe CSS inexistante `.summary-card`** (carte de résumé de l'onglet Bilan) : jamais stylée
  (seule `.summary-cards`, le conteneur, existait) — la carte flottait sans fond/bordure/padding,
  cassant la cohérence visuelle avec le reste de l'app. Corrigée en l'ajoutant à la règle partagée
  avec `.recipe-card`/`.day-line`/etc.
- Cible tactile `.walk-move-btn` (réordonnancement des étapes d'itinéraire, 26×19px) signalée sous
  le seuil de 44px — voir "Suite (même journée)" ci-dessous pour le correctif.

**Audit "mapping formulaires d'édition" :**
- **`parseDesc()` totalement cassée** : sa regex utilisait des ancres fin-de-chaîne `$` littérales
  au lieu de parenthèses échappées (`\(`/`\)`) — un `$` ne peut jamais être suivi d'autre texte,
  donc la fonction renvoyait **toujours** `qty: null`, quelle que soit l'entrée. Seul appelant :
  `cloneRecipeItem()` (bouton "Créer nouvelle recette" depuis une catégorie du journal) — toute
  conversion d'une entrée en ingrédient de recette retombait sur une quantité par défaut de 100,
  sans rapport avec la vraie quantité, avec un nom d'ingrédient gardant le "(Xg)" brut affiché.
  **Bug confirmé en exécutant la regex directement (pas seulement en la relisant)** — trouvé en
  vérifiant indépendamment un correctif suggéré par l'agent (qui avait diagnostiqué un cas plus
  étroit, l'absence de support `cl`). Fix : regex réécrite, support ajouté pour `cl` (converti en
  équivalent ml ×10, même convention que `_parseNoteIngredients`), et repli sur la colonne `qty`
  stockée en base pour les unités personnalisées (cuillères...) que la regex ne couvre pas.
- **Marche en mode itinéraire — nom du trajet perdu à l'édition** (même famille que le bug vélo
  ci-dessus, côté marche) : `editEntry()` écrasait systématiquement le libellé par le texte
  générique "Marche" et ne repositionnait jamais `currentWalkMode`/`currentWalkFavName`/
  `currentRouteData` — à l'enregistrement, un trajet nommé (favori ou itinéraire multi-étapes,
  ex. "Domicile → Bureau") était irréversiblement aplati en "Marche (Qmin · Dkm · Skm/h)". Fix :
  détection du libellé réel (≠ "Marche" pur) pour restaurer `currentWalkFavName`/`currentWalkMode
  = 'route'`/une distance minimale — suffisant pour que `submitEntry()` réutilise le nom d'origine
  sans reconstruire l'itinéraire interactif complet (adresses non récupérables depuis la
  description compacte stockée).
- **Favoris vélo — sauvegarde silencieusement fausse en mode "Kcal machine"** : `saveBikeFav()`
  lisait sans condition la valeur de `#in-kcal` (la vitesse), masquée et jamais renseignée en mode
  "Kcal machine" — le favori était enregistré avec la valeur par défaut du champ caché (18 km/h),
  sans rapport avec les kcal machine/correction réellement saisis. La structure des favoris vélo ne
  sachant représenter que le mode vitesse, fix minimal : garde-fou + message explicite plutôt
  qu'une sauvegarde silencieusement fausse.
- Point mineur signalé : `_saveIngEdits()` (édition du détail d'ingrédients d'une entrée déjà
  enregistrée) réécrivait toujours l'unité en "g" même pour une note en ml/cl à l'origine —
  cosmétique, les calculs restaient corrects. Voir "Suite (même journée)" ci-dessous pour le
  correctif.
- **Non retenu après vérification, `sportFavDateDate` n'est pas un bug** : signalé à confiance
  faible par l'agent (lecture statique du code), qui n'avait pas vu que les deux seuls points
  d'entrée réels du modal date-favori (`loadWalkFavQuick()`/`loadBikeFavQuick()`, appelés depuis
  la liste rapide *et* depuis l'onglet Sports/favoris — aucun autre appelant dans `app.js`/
  `index.html`) réinitialisent déjà `sportFavDateDate = new Date(journalDate)` avant chaque
  ouverture. Vérifié en direct sur le site déployé (console) : `sportFavDateDate` forcée à une
  date absurde (2099) puis `journalDate` mise à une date arbitraire (10/08/2026) → réouverture du
  modal via `loadWalkFavQuick()` → `sportFavDateDate` repart bien de `journalDate`
  ("2026-08-10"), pas de la valeur absurde. Aucun changement de code nécessaire.

## Documentation

- `PROJECT_BRIEF.md` : ajout d'un pointeur explicite vers les 4 docs de référence transversales
  (`../Bonne pratiques IA/*.md`) en tête de fichier.

## Suite (même journée) : cible tactile + unité ml/cl

Les deux points laissés non corrigés plus haut, traités dans un second temps :

- **`.walk-move-btn`** (réordonnancement des étapes d'itinéraire marche, 26×19px) : zone de tap
  invisible agrandie via un pseudo-élément `::before` sur chaque bouton — mais en n'étendant la
  zone que vers l'**extérieur** de la paire monter/descendre (`.walk-move-up` vers le haut
  uniquement, `.walk-move-down` vers le bas uniquement), jamais l'un vers l'autre : élimine le
  risque de chevauchement identifié initialement (les deux classes CSS distinctes déjà présentes
  dans le HTML permettaient cette approche asymétrique).
- **Unité ml/cl préservée dans le détail d'ingrédients** : `_parseNoteIngredients()` (fonction
  partagée par le détail d'une entrée *et* le résultat IA) mémorise maintenant l'unité d'origine
  de chaque ingrédient (`g`, ou `ml` — le `cl` étant déjà remonté en équivalent ml ×10 comme le
  reste du calcul) au lieu de la perdre. `_saveIngEdits()` et `_syncAIIngredientTotals()`
  réutilisent cette unité au lieu d'un `"g"` codé en dur, dans le tableau éditable comme dans la
  note reconstruite et sauvegardée.

Vérifié en direct sur le site déployé (fetch `no-store` + introspection du code réellement
exécuté dans l'onglet via `.toString()` sur les fonctions concernées, après un vrai hard reload —
la première tentative de vérification est tombée sur un léger délai de propagation du CDN GitHub
Pages, la seconde a confirmé le code à jour). `node verify.js` au vert.
