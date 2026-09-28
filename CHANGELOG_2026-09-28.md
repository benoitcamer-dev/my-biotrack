# Changelog — Session du 28/09/2026

Deux bugs signalés par l'utilisateur : des chiffres incohérents dans le tableau d'ingrédients
de l'Assistant IA, et le déplacement ou la copie d'un exercice qui proposait des catégories
de repas sans Sport.

Commits : `7ac2512`, `c740e0f`.

## 1. Assistant IA : quantité ignorée quand l'IA ajoute un 2e poids

**Constat** (capture du téléphone) : ligne « Travers de porc avec os 500g (estimé 300g net) »
affichée **100 g × 250 kcal/100g = 750 kcal**. Les autres lignes étaient cohérentes (riz
80 × 360 = 288, harissa 30 × 270 = 81…).

**Cause** : note IA `Travers de porc avec os 500g (estimé 300g net) → 750kcal · 250kcal/100g`.
`_parseNoteIngredients()` ne reconnaissait la quantité qu'**en fin de nom** (regex ancrée
sur `$`). Ici le nom se termine par « (estimé 300g net) » : pas de correspondance, donc 100 g
par défaut. Les 750 kcal correspondaient aux 300 g nets.

**Fix** (`7ac2512`) :
- Si la quantité n'est pas en fin de nom, on relève toutes les quantités `Xg/ml/cl` du nom et
  on retient celle qui colle avec total ÷ kcal/100g (tolérance 5 %, min 2 kcal), à défaut la
  dernière.
- Si la quantité retenue contredit encore total et kcal/100g, on la **déduit** des deux
  (`kcalTotal / kcal100 × 100`) : une ligne ne peut plus afficher des chiffres incompatibles.
- Prompt (« FORMAT NOTE STRICT ») : la quantité doit être le poids net réellement mangé, juste
  avant la flèche, sans parenthèses ni 2e poids.

Le même parseur sert au tableau de l'Assistant IA et à celui du popup d'une entrée du journal.
Pour un repas déjà enregistré, le total reste juste et la quantité sera relue correctement.

**Vérifié** : parseur extrait du `app.js` déployé et testé sous Node avec la ligne exacte →
300 g × 250 = 750 kcal. Cas `4cl` (→ 40 ml) et ligne sans quantité (→ 100 g) inchangés.
Pas de test UI de bout en bout (il faudrait un vrai appel IA).

## 2. Déplacer / copier un exercice : rangé dans Petit-déjeuner

**Constat** : les popups « Déplacer l'entrée » (`_moveEntry`) et « Copier vers un autre
jour » (`_copyEntry`) proposaient un `<select>` limité aux repas (Petit-déjeuner, Déjeuner,
Dîner, Snack, Boissons). Pour une entrée `Sport`, `select.value = 'Sport'` ne correspondait à
aucune option : le menu retombait sur la 1re, et valider déplaçait l'exercice dans
« Petit-déjeuner ».

**Fix** (`c740e0f`), à la demande de l'utilisateur (ne choisir que le jour) : pour une entrée
`category === 'Sport'`, le bloc Catégorie n'est plus rendu. `_confirmMoveEntry()` et
`_confirmCopyEntry()` retombent alors sur `'Sport'`. Rien ne change pour les repas.

**Vérifié en ligne** (Chrome via Claude in Chrome, SW désenregistré + caches vidés) avec une
entrée fictive injectée dans `currentEntries`, sans rien enregistrer :
- Sport : pas de `#move-cat` / `#copy-entry-cat`, champ date présent dans les deux popups
- Repas (Déjeuner) : menu présent, présélectionné sur « Déjeuner »

Base contrôlée en lecture seule : **aucune** entrée `type = 'burn'` hors catégorie Sport,
donc aucun exercice mal rangé à réparer.
