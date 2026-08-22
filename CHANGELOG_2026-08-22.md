# Changelog — Session du 22/08/2026

Audit + corrections sur le journal, les favoris, les recettes et la robustesse concurrence/isolation des données. Fichiers touchés : `app.js`, `index-complet.html` (source de vérité), `styles.css`, `index.html`.

## Bugs corrigés

- **Favoris inactifs depuis la fiche détail d'une entrée du journal** — l'id de l'aliment était injecté sans guillemets dans l'attribut `onclick` (`_toggleFavFromPopup(${matchedFood.id},...)`). Comme `custom_foods.id` est un identifiant texte, ça produisait du JS invalide et le clic ne faisait strictement rien. Corrigé par un guillemetage cohérent avec le reste du code (`'${matchedFood.id}'`).
- **Recherche d'ingrédient inactive dans l'éditeur de recette** (création et modification) — le champ `#re-desc` n'avait aucun `oninput`, contrairement au champ de recherche principal du journal qui filtre en direct avec un debounce de 600 ms. Ajout de `onRecipeSearchInput()` sur le même modèle.
- **Suppression de recette sans confirmation ni annulation possible** — un seul tap détruisait la recette instantanément. Ajout d'une confirmation (`showConfirm`), alignée sur le comportement déjà en place pour les aliments personnalisés.

## Robustesse & isolation des données (multi-utilisateurs)

- Ajout systématique de `.eq('user_id', user.id)` sur une quinzaine de requêtes `UPDATE`/`DELETE` (`entries`, `custom_foods`, `weight_entries`, `favorites`) qui ne filtraient jusque-là que par `id` de ligne. Défense en profondeur : n'importe qui devinant un id ne peut plus modifier/supprimer une ligne d'un autre compte, même en cas de faille de policy RLS côté Supabase.
- Vérifié en conditions réelles (requêtes anonymes en lecture sur `entries`/`custom_foods`/`weight_entries`/`favorites`) : RLS bloque bien tout accès non authentifié — confirmé sain, cette passe consolide le reste.

## Anti double-clic & retours visuels

- Bouton **"Valider"** du journal : passe en `disabled` + "Ajout…" pendant l'envoi, reprend son état initial ensuite (y compris en cas d'erreur), toast de confirmation à la fin.
- Ajout d'un garde anti double-tap (sur le même principe que la validation du journal) sur : sauvegarde d'un aliment personnalisé, sauvegarde d'une recette, ajout/retrait d'un favori depuis la fiche détail. Évite la création de doublons en cas de tap rapide répété.
- Toast de confirmation ajouté après sauvegarde d'une recette.

## Sécurité — injection HTML (XSS stocké)

- Nouvelle fonction `escHtml()` (échappement `&<>"'`), appliquée à l'affichage du nom de repas/aliment dans le journal et dans le titre de la fiche détail — ces deux champs affichaient jusqu'ici du texte libre utilisateur tel quel via `innerHTML`.

## Ergonomie mobile

- Taille du texte principal du journal (`.entry-desc`) : 12px → 14px ; sous-texte (`.entry-sub`) : 11px → 12px. C'est la ligne la plus lue de toute l'app au quotidien.

## Non traité (documenté pour une prochaine passe)

- Cibles tactiles sous 44px : `.entry-action` (36px), `.food-btn` (40px).
- `escHtml()` pas encore appliqué aux noms de recette/aliment dans les listes (moins fréquentés que le journal).
- Architecture mono-fichier (`app.js`, ~6800 lignes) : pas de risque immédiat mais point de vigilance si le projet passe à plusieurs développeurs.
