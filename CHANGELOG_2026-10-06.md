# Changelog — Session du 06/10/2026

Un bug remonté par l'utilisateur : en ouvrant une recette pour la modifier (page Recettes),
la liste des ingrédients n'apparaissait pas sur le téléphone.

Commit : `424aa27`.

## 1. Liste des ingrédients invisible dans l'éditeur de recette

**Constat** : reproduit aussi sur PC, sur le site live. Pour la recette « Wok Poulet Filet »,
`#recipe-builder-list` contenait bien 12 enfants (11 ingrédients + le total), mais sa hauteur
rendue était de **0 px** (`scrollHeight` 531 px). Les ingrédients étaient donc présents dans
le DOM mais invisibles.

**Diagnostic** : même cause que `#re-search-results` le 14/09. `#recipe-builder-list` est un
enfant direct du `.settings-sheet` (flex-column à hauteur fixe `--app-height`) et porte en
inline `overflow-y:auto; max-height:40vh`. Un `overflow` autre que `visible` annule le
`min-height:auto` implicite d'un enfant flex. Dès que le contenu du formulaire dépasse la
hauteur de l'écran (toujours le cas sur téléphone), flexbox rétrécit cet élément jusqu'à 0.

**Fix** (`424aa27`) : `flex-shrink: 0` sur `.builder-list` (`styles.css` + `index-complet.html`).
La liste garde sa hauteur (jusqu'à 40vh, avec son propre scroll) et c'est le sheet qui
défile, comme prévu.

**Vérification** :
- Avant le commit, correctif injecté à la main dans la page live : hauteur 0 → 204 px (40vh
  d'une fenêtre de 511 px).
- Après le déploiement Pages (contenu de `styles.css` vérifié via `fetch` en `no-store`),
  service worker désenregistré, caches vidés et hard reload : `flex-shrink` calculé à `0`,
  liste de 256 px (40vh de 639 px), 12 éléments rendus. L'éditeur a été refermé sans
  enregistrer.
- Non testé directement sur le téléphone (Brave) : la liste se trouve sous le bouton
  « Ajouter cet ingrédient », il faut faire défiler le panneau pour la voir.
