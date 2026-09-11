# Audit — Espace écran des modales/popups sur mobile réel (Pixel 8)

**Statut : EN COURS — 5/19 modales auditées, session interrompue par indisponibilité du device (départ de l'utilisateur avec le téléphone).**

Audit fonctionnel en conditions réelles (pas de simulateur desktop) sur le Google Pixel 8 de l'utilisateur, pilotage ADB + inspection DOM via CDP (`chrome_devtools_remote`, voir `../Bonne pratiques IA/conseils_environnement_travail.md` §16/§16bis pour la méthode complète). Objectif : vérifier que **toutes** les modales/popups de l'app utilisent bien l'espace écran mobile — pas de vide excessif au-dessus du contenu, pas de ligne trop dense, pas de champ/bouton masqué sous le clavier virtuel — au-delà des deux cas déjà corrigés le 11/09/2026 (footer sticky sous clavier, fiche d'ingrédients cramée, voir `CHANGELOG_2026-09-11.md` points 11-12).

Audit **read-only** : aucune modification de code n'a été faite pendant cette session.

## Méthode

Pour chaque modale : ouverture via le flux UI réel (pas d'injection JS de l'état `open`), capture d'écran (`adb exec-out screencap`), puis mesure objective via CDP (`Runtime.evaluate` sur la page réelle) :
- % de hauteur de viewport occupé par le sheet (`.modal-sheet`/`.settings-sheet`)
- px de vide au-dessus du sheet
- présence/comportement du scroll interne (`scrollHeight` vs `clientHeight`)
- pour les champs texte/nombre : tap tactile réel (pas de `.focus()` synthétique, qui n'ouvre pas le clavier Android) puis re-mesure pour vérifier qu'aucun champ actif ni bouton d'action essentiel ne passe sous le clavier virtuel

Calibration tap physique établie pendant cette session (réutilisable directement) :
`physical_x = css_x * 2.625`, `physical_y = css_y * 2.625 + 131` (le +131 correspond à la barre de statut Android, hors repère `getBoundingClientRect()`). Écran : 412×915 en CSS logique, 1080×2400 en physique.

## Modales auditées (5/19)

### 1. `modal-add` (FAB "+" → catégorie "Petit-déjeuner")
- Sheet = `.modal-sheet` (structure différente des autres, confirmé) — couvre 100% de la hauteur viewport, 0px de vide au-dessus, `overflow-y: auto`.
- Clavier testé sur le champ "Quantité (g)" (`in-qty`) : reste visible au-dessus du clavier (bottom 364.6 < viewport visuel 473.9).
- **Constat : RAS.** Confirme que le bug déjà corrigé (commit `b47db20`) est bien résolu.

### 2. `modal-settings` (onglet Réglages)
- `.settings-sheet` couvre 100%, 0px vide au-dessus, scroll interne normal (formulaire long : 1515px de contenu pour 838px visibles).
- Clavier testé sur "Objectif calorique (kcal/jour)" (`s-goal`) : champ reste visible.
- **Constat : RAS.**
- *Note hors-scope (sécurité, pas UI) : les clés API Google Calendar/Google Maps s'affichent en clair dans ce formulaire, non masquées — signalé pour mémoire, non traité ici.*

### 3. `modal-places` (onglet Lieux)
- Sheet 100%, 0px vide au-dessus, scroll interne (liste de lieux).
- Sous-flux "+ Ajouter un lieu" testé : clavier réel sur "Nom court" → les deux champs (Nom court, Adresse complète) restent visibles sous le clavier. Les boutons Annuler/Enregistrer passent sous le clavier mais ne sont pas les éléments actifs au moment de la saisie.
- **Constat : RAS.**

### 4. `modal-recipes` (onglet Recettes)
- Sheet 100%, 0px vide au-dessus, scroll interne important (liste de recettes longue, normal).
- Clavier testé sur "Nom de la nouvelle recette" (`recipe-new-name`) : champ reste visible.
- **Constat : RAS**, bonne densité de la liste.

### 5. `modal-recipe-editor` (via icône crayon d'une recette)
- Le sélecteur générique utilisé a en fait ouvert l'éditeur en mode "Nouvelle recette" vierge plutôt que l'édition de "Bœuf bourguignon" (structure UI identique dans les deux cas donc mesures valables, mais **le flux d'édition d'une recette existante n'a pas été spécifiquement revérifié**).
- Sheet 100% (838/840), 0px vide au-dessus, pas de scroll nécessaire à l'état initial.
- **Point non tranché à vérifier en priorité à la reprise** : le label "NOM DE LA RECETTE" apparaît avec le haut des lettres tronqué sur 2 captures `adb screencap` prises à 2s d'intervalle (identique les deux fois). Le même style CSS (`.setting-row label`) sur "OBJECTIF CALORIQUE" dans `modal-settings` s'affiche lui parfaitement net — donc pas un bug générique de la classe. Soit un cas spécifique à ce label, soit un artefact de la méthode de capture `adb screencap` (compositing) plutôt qu'un vrai rendu utilisateur. Une capture `Page.captureScreenshot` via CDP native a été prise pour comparer mais n'a pas pu être analysée avant la coupure — **à comparer en priorité à la reprise**.

## Modales NON couvertes (14/19) — à faire à la prochaine session

`modal-recipe-link`, `modal-recipe-picker`, `modal-custom-food`, `modal-aliments`, `modal-favs-quick`, `modal-weight`, `modal-sport-favs`, `modal-recipe-date-meal`, `modal-sport-fav-date`, `modal-edit-weight`, `modal-barcode`, `modal-copy-meal`, `modal-ai`, `modal-dose-fav`.

Aucune de ces 14 n'a été ouverte ni mesurée — pas de faux négatif à craindre, juste un travail non commencé. Candidats prioritaires à la reprise (formulaires denses multi-champs, même famille que les bugs déjà trouvés le 11/09) : `modal-custom-food`, `modal-dose-fav`, `modal-weight`, `modal-edit-weight`.

## Synthèse

1. **Aucun bug bloquant trouvé** dans les 5 modales couvertes — les deux correctifs du 11/09/2026 semblent bien généralisés : les 4 champs texte/nombre testés avec clavier réel restent tous visibles au-dessus du clavier virtuel.
2. **Seul point en suspens** : clipping visuel possible du label "NOM DE LA RECETTE" dans `modal-recipe-editor` — statut non tranché (bug réel vs artefact de capture), à investiguer en premier à la reprise.
3. **Couverture très partielle (26%)** — les modales les plus à risque de reproduire le pattern déjà vu n'ont pas encore été testées.
4. Remarque hors-scope notée pour mémoire : clés API visibles en clair dans `modal-settings` (sujet sécurité, pas objet de cet audit).

---
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
