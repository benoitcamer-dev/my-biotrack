# Audit — Espace écran des modales/popups sur mobile réel (Pixel 8)

**Statut : TERMINÉ — 18/19 modales auditées (13/09/2026), seule `modal-barcode` non testée (accès caméra, écarté par prudence en automatisation). Voir section "Suite du 13/09/2026" plus bas pour la 2e vague et sa synthèse — les sections d'origine (5/19, 11/09/2026) sont conservées telles quelles ci-dessous pour l'historique.**

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

## Suite du 13/09/2026 — 2e vague (13/14 modales restantes + résolution du point en suspens)

Reprise avec une méthode plus robuste que le 11/09 : au lieu de taps devinés + `adb screencap` seul, connexion CDP directe (`adb forward tcp:9222 localabstract:chrome_devtools_remote` + WebSocket `Runtime.evaluate`/`Page.captureScreenshot`, voir `../Bonne pratiques IA/conseils_environnement_travail.md` §16bis) — ouverture des modales en appelant directement leurs fonctions JS réelles (`openWeightModal()`, etc. — les mêmes fonctions que les `onclick` de l'UI, donc équivalent à un vrai clic), mesure de `getBoundingClientRect()`/`visualViewport` pour la position/taille, et taps physiques réels uniquement pour tester l'ouverture du clavier (une `.focus()` synthétique n'ouvre pas toujours le clavier réel Android). Audit toujours **read-only** — aucune modification de code appliquée, seulement `document.getElementById('fab-btn').style.display=''` remis à l'état par défaut après tests. Aucune écriture Supabase déclenchée (jamais appelé de fonction `save*`) — le journal réel de l'utilisateur n'a pas été touché.

**⚠️ Piège méthodologique corrigé en cours de route** : une comparaison naïve `elementRect.bottom <= visualViewport.height` pour savoir si un champ est masqué par le clavier est **fausse** dès que la page a défilé pour amener le champ actif en vue — il faut comparer à `visualViewport.offsetTop + visualViewport.height` (le bas réellement visible en coordonnées de la layout viewport), sans quoi on obtient de faux positifs (repéré sur `modal-dose-fav`, corrigé avant de continuer).

### Point en suspens du 11/09 enfin tranché : le label "NOM DE LA RECETTE" clippé est un VRAI bug

Comparaison directe `adb screencap` vs `Page.captureScreenshot` (CDP natif) sur `modal-recipe-editor` ouvert en **vraie édition** d'une recette existante ("Bœuf bourguignon", `openRecipeEditorEdit('1775906033226')` — le 11/09 avait accidentellement testé le mode "nouvelle recette" vierge) : **les deux méthodes de capture montrent un clipping identique** du haut des lettres de "NOM DE LA RECETTE". Ce n'est donc pas un artefact de `adb screencap` (compositing) comme envisagé le 11/09 — c'est un vrai défaut de rendu, indépendant de la méthode de capture et du mode (nouvelle/édition).

**Cause localisée** : chevauchement d'environ 4px entre `.modal-sticky-header` (`position:sticky`, `z-index:8`, `margin:-20px -18px 16px`, styles.css:901) et la ligne `.setting-row` suivante qui porte le label (`<label>Nom de la recette</label>`, sans classe, `font-size:9px`, `text-transform:uppercase`). Mesuré via CDP : le bord bas du header (`getBoundingClientRect().bottom`) tombe à 124.76px alors que la ligne suivante commence à 120.76px — un sticky avec `z-index` explicite peint toujours par-dessus le contenu statique qu'il chevauche, quel que soit l'ordre DOM, d'où les ~4px du haut du texte (déjà minuscule à 9px) mangés par le fond opaque du header. Non corrigé (audit read-only) — piste de fix à investiguer : ajuster le `margin-bottom` du header ou le point d'ancrage `top` pour supprimer ce chevauchement de 4px.

### Nouveau bug transversal découvert : le bouton flottant "+" (FAB) reste au-dessus de plusieurs modales

Constat empirique sur `modal-edit-weight` : le FAB (`#fab-btn`, `position:fixed`, `z-index:201`) reste visible et **cliquable** par-dessus la modale (`z-index:88`), confirmé par `document.elementFromPoint()` au centre du FAB → renvoie bien `fab-btn`. Mesure des rectangles : le cercle du FAB recouvre **~42% de la largeur** du bouton "Enregistrer" de `modal-edit-weight` — un tap sur le bord droit de ce bouton ouvre le menu d'ajout au lieu d'enregistrer le poids modifié. Repro identique sur `modal-dose-fav` (le FAB chevauche visiblement "Enregistrer la dose").

Cause : le masquage du FAB (`fabBtn.style.display='none'`) n'est codé qu'à certains points d'entrée précis dans `app.js` — `openModal()`/`closeModal()` (modal-add), `_editViaAI()` et `openAIModalGlobal()` (modal-ai) le font correctement — mais **pas** `openWeightModal()` (→ `modal-weight` → `modal-edit-weight`), ni `openDoseForm()` (`modal-dose-fav`), ni les autres modales ouvertes directement depuis la nav du bas sans passer par `openModal()`. Le `currentPage` reste `'journal'` dans tous ces cas, donc la logique globale de `showPage()` (`fabBtn.style.display = page==='journal' ? 'flex' : 'none'`) ne le cache jamais non plus. Non corrigé (audit read-only) — piste de fix la plus simple : masquer `#fab-btn` de façon centralisée dès qu'une modale `.open` est présente dans le DOM (`MutationObserver` sur `document.body` ou vérif dans une fonction utilitaire appelée par toutes les fonctions `open*Modal`), plutôt que de rajouter le même appel un par un à chaque fonction d'ouverture.

### Pattern "vide excessif" généralisé — 6 modales supplémentaires touchées

Même famille de défaut que les bugs déjà corrigés le 11/09 (vide EN HAUT du sheet), mais ici le vide est **au milieu/en bas** : le sheet reste fixé à 100% de la hauteur du viewport même quand le contenu réel est court (2-3 champs, ou 3 favoris), le contenu restant ancré en haut et les boutons d'action tout en bas — laissant un grand espace blanc inutilisé au milieu de l'écran. Confirmé visuellement (captures à l'appui) sur :
- `modal-edit-weight` (2 champs + bouton, ~65% de vide)
- `modal-favs-quick` (3 favoris, ~55% de vide)
- `modal-sport-favs` (3 trajets favoris, ~55% de vide)
- `modal-copy-meal` (2 sélecteurs, ~65% de vide)
- `modal-recipe-date-meal` (date + 5 boutons repas, ~55% de vide)
- `modal-sport-fav-date` (mesuré 100%/840px comme les autres, contenu non vérifié visuellement en détail — probable même pattern, à reconfirmer si prioritaire)

Moins grave que le vide EN HAUT (aucun champ masqué, juste un usage inefficace de l'écran), mais c'est exactement le type de défaut que cet audit cherchait à traquer. Non corrigé (audit read-only) — piste de fix : `max-height: fit-content` (borné par le plafond `--app-height` existant) au lieu d'une hauteur fixe sur `.settings-sheet`/`.modal-sheet` pour ces cas, ou centrer le contenu verticalement plutôt que de le laisser ancré en haut avec les actions collées en bas.

### `modal-ai` : placeholder 2 lignes tronqué dans le champ de saisie

`#ai-input` a un `scrollHeight` (89px) supérieur à sa hauteur visible (`clientHeight` 48px, `overflow:auto`) : l'exemple de placeholder "Ex: cuisse de poulet rôtie" (qui occupe 2 lignes) voit sa 2e ligne coupée au bord visible de la boîte — techniquement scrollable, mais un utilisateur ne s'attend pas à devoir scroller dans un champ de saisie pour lire l'exemple de placeholder qui y est affiché. Mineur. Non corrigé (audit read-only).

### Modales RAS (comportement conforme, rien à signaler)

`modal-custom-food` (sheet 100%, 0 vide, champ "Kcal/100g" visible sous clavier), `modal-aliments` (recherche testée sous clavier, RAS), `modal-recipe-picker` (recherche testée sous clavier, RAS), `modal-weight` (champ "Poids" testé sous clavier, RAS). `modal-recipe-link` : testé seulement en état vide ("Aucun aliment", faute d'entrée réelle dans le journal du jour pour ne pas polluer les données utilisateur) — layout correct pour cet état, mode "avec contenu" non revérifié.

### Non testé

`modal-barcode` : nécessite l'accès caméra (`getUserMedia`), écarté pour ne pas risquer un dialogue de permission bloquant l'automatisation ADB/CDP en session. À tester manuellement par l'utilisateur si besoin, ou dans une session avec l'extension Claude in Chrome (qui gère mieux les permissions caméra).

### Synthèse finale (18/19 modales couvertes)

1. **1 point en suspens du 11/09 résolu** : clipping de "NOM DE LA RECETTE" confirmé comme vrai bug (chevauchement sticky-header/ligne suivante), pas un artefact de capture.
2. **1 bug transversal nouveau, le plus impactant** : le FAB "+" reste cliquable par-dessus plusieurs modales (z-index 201 vs 88), avec un vrai risque de mauvais clic sur `modal-edit-weight`/`modal-dose-fav` (bouton d'action partiellement recouvert).
3. **6 modales avec le pattern "vide excessif"** (vide au milieu/en bas plutôt qu'en haut) — inefficacité d'usage de l'écran, pas de champ cassé.
4. **1 bug mineur** : placeholder 2 lignes tronqué dans `modal-ai`.
5. **1 bug mineur déjà connu, reconfirmé** : bouton "Enregistrer la dose" de `modal-dose-fav` partiellement masqué par le clavier (~23px/60px coupés).
6. **4 modales RAS**, 1 testée seulement en état vide, 1 non testée (caméra).

Aucun correctif appliqué (audit strictement read-only, comme le 11/09). Décision à prendre par l'utilisateur : prioriser le fix du FAB (impact fonctionnel direct) avant le pattern "vide excessif" (cosmétique) et le clipping du label (cosmétique, un seul endroit).

---
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
